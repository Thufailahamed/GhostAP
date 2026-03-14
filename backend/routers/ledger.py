from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models
from pydantic import BaseModel
from typing import List, Optional
import datetime
from services.auth import get_current_user

router = APIRouter(prefix="/ledger", tags=["General Ledger"])

class JournalLineCreate(BaseModel):
    account_id: int
    debit: float = 0.0
    credit: float = 0.0

class JournalEntryCreate(BaseModel):
    date: datetime.datetime
    description: str
    reference: Optional[str] = None
    lines: List[JournalLineCreate]

class JournalLineResponse(BaseModel):
    id: int
    account_id: int
    debit: float
    credit: float
    model_config = {"from_attributes": True}

class JournalEntryResponse(BaseModel):
    id: int
    date: datetime.datetime
    description: Optional[str]
    reference: Optional[str]
    lines: List[JournalLineResponse] = []
    model_config = {"from_attributes": True}

@router.get("/entries", response_model=List[JournalEntryResponse])
def get_journal_entries(limit: int = 100, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Fetch recent journal entries with their lines."""
    user_id = current_user["sub"]
    return db.query(models.JournalEntry)\
             .filter(models.JournalEntry.user_id == user_id)\
             .order_by(models.JournalEntry.date.desc()).limit(limit).all()

@router.post("/entries", response_model=JournalEntryResponse)
def create_journal_entry(entry: JournalEntryCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Manually post a journal entry. Enforces Debits == Credits."""
    user_id = current_user["sub"]
    
    # 1. Math Validation
    total_debits = sum(line.debit for line in entry.lines)
    total_credits = sum(line.credit for line in entry.lines)
    
    # Floating point comparison tolerance
    if abs(total_debits - total_credits) > 0.01:
        raise HTTPException(
            status_code=400, 
            detail=f"Journal unbalanced: Debits ({total_debits}) != Credits ({total_credits})"
        )
        
    if len(entry.lines) < 2:
        raise HTTPException(status_code=400, detail="Journal entry must have at least two lines.")

    # 2. Verify Accounts Exist and belong to user
    for line in entry.lines:
        account = db.query(models.Category).filter(
            models.Category.id == line.account_id,
            models.Category.user_id == user_id
        ).first()
        if not account:
            raise HTTPException(status_code=404, detail=f"Account ID {line.account_id} not found or access denied.")

    # 3. Create Entry
    db_entry = models.JournalEntry(
        user_id=user_id,
        date=entry.date,
        description=entry.description,
        reference=entry.reference
    )
    db.add(db_entry)
    db.flush() # Get ID
    
    # 4. Create Lines
    for line in entry.lines:
        db_line = models.JournalLine(
            journal_id=db_entry.id,
            account_id=line.account_id,
            debit=line.debit,
            credit=line.credit
        )
        db.add(db_line)
        
    db.commit()
    db.refresh(db_entry)
    return db_entry
