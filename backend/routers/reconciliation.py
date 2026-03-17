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
    bank_account_id: int
    date: datetime.datetime
    amount: float
    type: Optional[str]
    reference: Optional[str]
    merchant_name: Optional[str]
    reconciled: bool

    model_config = {"from_attributes": True}

class UnmatchedResponse(BaseModel):
    bank_transactions: List[BankTransactionResponse]
    journal_entries: List[JournalEntryResponse]

class MatchRequest(BaseModel):
    bank_transaction_id: int
    journal_entry_id: int

class CreateAndMatchRequest(BaseModel):
    bank_transaction_id: int
    account_id: int # The GL account to link the transaction to
    description: Optional[str] = None

class SuggestionResponse(BaseModel):
    bank_transaction_id: int
    suggested_journal_id: Optional[int]
    confidence: float # 0.0 to 1.0
    reason: Optional[str]

@router.get("/unmatched", response_model=UnmatchedResponse)
def get_unmatched(
    bank_account_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Fetch unlinked bank transactions and unlinked journal entries for matching."""
    user_id = current_user["sub"]
    
    # 1. Unmatched Bank Transactions
    bank_query = db.query(models.BankTransaction).filter(
        models.BankTransaction.user_id == user_id,
        models.BankTransaction.reconciled == False
    )
    if bank_account_id:
        bank_query = bank_query.filter(models.BankTransaction.bank_account_id == bank_account_id)
        
    bank_txns = bank_query.order_by(models.BankTransaction.date.desc()).all()
    
    # 2. Unmatched Journal Entries
    # Subquery: all journal_ids currently linked to a bank transaction
    linked_journal_ids = db.query(models.BankTransaction.journal_id).filter(
        models.BankTransaction.user_id == user_id,
        models.BankTransaction.journal_id.isnot(None)
    ).subquery()
    
    # We only want journal entries that are NOT linked.
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

@router.post("/create-and-match")
def create_and_match(req: CreateAndMatchRequest, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Creates a journal entry from a bank transaction and immediately reconciles it."""
    user_id = current_user["sub"]
    
    bank_txn = db.query(models.BankTransaction).filter(
        models.BankTransaction.id == req.bank_transaction_id,
        models.BankTransaction.user_id == user_id
    ).first()
    
    if not bank_txn:
        raise HTTPException(status_code=404, detail="Bank transaction not found")
        
    if bank_txn.reconciled:
        raise HTTPException(status_code=400, detail="Bank transaction is already reconciled")
        
    # 1. Create Journal Entry
    description = req.description or f"Reconciled: {bank_txn.merchant_name or bank_txn.reference or 'Bank Transaction'}"
    
    db_entry = models.JournalEntry(
        user_id=user_id,
        date=bank_txn.date,
        description=description,
        reference=bank_txn.reference
    )
    db.add(db_entry)
    db.flush()
    
    # 2. Create Journal Lines
    # Determine which account is the Bank account
    # In a real app, BankAccount would be linked to a Category. 
    # For now, we'll try to find a Category that matches the bank account name or use a default 'Cash' account.
    bank_category = db.query(models.Category).filter(
        models.Category.user_id == user_id,
        models.Category.type == models.CategoryType.ASSET,
        models.Category.name.ilike("%Cash%")
    ).first()
    
    if not bank_category:
        # Fallback to the first Asset account if no 'Cash' found
        bank_category = db.query(models.Category).filter(
            models.Category.user_id == user_id,
            models.Category.type == models.CategoryType.ASSET
        ).first()
        
    if not bank_category:
        raise HTTPException(status_code=400, detail="No Asset account found to link bank transaction. Please set up your Chart of Accounts.")

    # Bank transaction amount logic:
    # If amount > 0 (Incoming): Debit Bank, Credit Target Account
    # If amount < 0 (Outgoing): Credit Bank, Debit Target Account
    amount = abs(bank_txn.amount)
    
    if bank_txn.amount > 0:
        # Incoming
        db.add(models.JournalLine(user_id=user_id, journal_id=db_entry.id, account_id=bank_category.id, debit=amount))
        db.add(models.JournalLine(user_id=user_id, journal_id=db_entry.id, account_id=req.account_id, credit=amount))
    else:
        # Outgoing
        db.add(models.JournalLine(user_id=user_id, journal_id=db_entry.id, account_id=req.account_id, debit=amount))
        db.add(models.JournalLine(user_id=user_id, journal_id=db_entry.id, account_id=bank_category.id, credit=amount))
        
    # 3. Mark Reconciled
    bank_txn.journal_id = db_entry.id
    bank_txn.reconciled = True
    
    db.commit()
    return {"message": "Journal entry created and transaction reconciled", "journal_id": db_entry.id}

@router.get("/suggestions", response_model=List[SuggestionResponse])
def get_suggestions(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Returns match suggestions for unmatched bank transactions."""
    user_id = current_user["sub"]
    
    bank_txns = db.query(models.BankTransaction).filter(
        models.BankTransaction.user_id == user_id,
        models.BankTransaction.reconciled == False
    ).all()
    
    linked_journal_ids = db.query(models.BankTransaction.journal_id).filter(
        models.BankTransaction.user_id == user_id,
        models.BankTransaction.journal_id.isnot(None)
    ).subquery()
    
    unmapped_journals = db.query(models.JournalEntry).filter(
        models.JournalEntry.user_id == user_id,
        models.JournalEntry.id.notin_(linked_journal_ids)
    ).all()
    
    suggestions = []
    
    for bt in bank_txns:
        best_match = None
        best_score = 0.0
        reason = None
        
        bt_amount = abs(bt.amount)
        bt_ref = (bt.reference or "").lower()
        bt_merchant = (bt.merchant_name or "").lower()
        
        for je in unmapped_journals:
            # Calculate total amount of journal entry lines (sum of debits)
            je_amount = sum(line.debit for line in je.lines)
            
            score = 0.0
            current_reason = ""
            
            # Amount Match (Highest Weight)
            if abs(bt_amount - je_amount) < 0.01:
                score += 0.8
                current_reason = "Perfect amount match"
            elif abs(bt_amount - je_amount) < (bt_amount * 0.05): # 5% variance
                score += 0.4
                current_reason = "Approximate amount match"
            
            # Date Proximity (Within 7 days)
            days_diff = abs((bt.date - je.date).days)
            if days_diff <= 7:
                score += 0.1
                if score > 0.1: current_reason += " & close date"
            
            # Reference/Description Match
            je_ref = (je.reference or "").lower()
            je_desc = (je.description or "").lower()
            
            if bt_ref and bt_ref in je_ref:
                score += 0.1
                current_reason += " & ref match"
            elif bt_merchant and bt_merchant in je_desc:
                score += 0.1
                current_reason += " & desc match"
            
            if score > best_score:
                best_score = score
                best_match = je.id
                reason = current_reason
        
        if best_match and best_score >= 0.5:
            suggestions.append(SuggestionResponse(
                bank_transaction_id=bt.id,
                suggested_journal_id=best_match,
                confidence=best_score,
                reason=reason
            ))
            
    return suggestions
