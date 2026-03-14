from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models
from pydantic import BaseModel
from typing import List, Optional
import datetime
from services.auth import get_current_user
from routers.ledger import JournalEntryResponse

router = APIRouter(prefix="/reconciliation", tags=["Bank Reconciliation"])

class BankTransactionResponse(BaseModel):
    id: int
    date: datetime.datetime
    amount: float
    type: Optional[str]
    reference: Optional[str]
    reconciled: bool

    model_config = {"from_attributes": True}

class UnmatchedResponse(BaseModel):
    bank_transactions: List[BankTransactionResponse]
    journal_entries: List[JournalEntryResponse]

class MatchRequest(BaseModel):
    bank_transaction_id: int
    journal_entry_id: int

@router.get("/unmatched", response_model=UnmatchedResponse)
def get_unmatched(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Fetch unlinked bank transactions and unlinked journal entries for matching."""
    user_id = current_user["sub"]
    
    # 1. Unmatched Bank Transactions
    bank_txns = db.query(models.BankTransaction).filter(
        models.BankTransaction.user_id == user_id,
        models.BankTransaction.reconciled == False
    ).order_by(models.BankTransaction.date.desc()).all()
    
    # 2. Unmatched Journal Entries
    # Subquery: all journal_ids currently linked to a bank transaction
    linked_journal_ids = db.query(models.BankTransaction.journal_id).filter(
        models.BankTransaction.user_id == user_id,
        models.BankTransaction.journal_id.isnot(None)
    ).subquery()
    
    # We only want journal entries that are NOT linked.
    # To reduce noise, we might only want entries that hit Asset/Liability accounts,
    # but for simplicity, we return all unmapped GL entries.
    unmapped_journals = db.query(models.JournalEntry).filter(
        models.JournalEntry.user_id == user_id,
        models.JournalEntry.id.notin_(linked_journal_ids)
    ).order_by(models.JournalEntry.date.desc()).limit(100).all()

    return {
        "bank_transactions": bank_txns,
        "journal_entries": unmapped_journals
    }

@router.post("/match")
def match_transaction(req: MatchRequest, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Links a bank transaction to a journal entry and marks it reconciled."""
    user_id = current_user["sub"]
    
    bank_txn = db.query(models.BankTransaction).filter(
        models.BankTransaction.id == req.bank_transaction_id,
        models.BankTransaction.user_id == user_id
    ).first()
    
    if not bank_txn:
        raise HTTPException(status_code=404, detail="Bank transaction not found")
        
    if bank_txn.reconciled:
        raise HTTPException(status_code=400, detail="Bank transaction is already reconciled")
        
    journal_entry = db.query(models.JournalEntry).filter(
        models.JournalEntry.id == req.journal_entry_id,
        models.JournalEntry.user_id == user_id
    ).first()
    
    if not journal_entry:
        raise HTTPException(status_code=404, detail="Journal entry not found")
        
    # Check if this journal entry is already linked to another bank transaction
    existing_link = db.query(models.BankTransaction).filter(
        models.BankTransaction.journal_id == req.journal_entry_id,
        models.BankTransaction.user_id == user_id
    ).first()
    
    if existing_link:
        raise HTTPException(status_code=400, detail="Journal entry is already linked to a different bank transaction")
        
    # Perform strict or loose amount check? We'll leave the UI to warn if amounts differ.
    
    bank_txn.journal_id = req.journal_entry_id
    bank_txn.reconciled = True
    
    db.commit()
    return {"message": "Transaction matched successfully"}
