from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
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
    account_code: Optional[str] = None
    account_name: Optional[str] = None
    account_type: Optional[str] = None
    model_config = {"from_attributes": True}

class JournalEntryResponse(BaseModel):
    id: int
    date: datetime.datetime
    description: Optional[str]
    reference: Optional[str]
    lines: List[JournalLineResponse] = []
    model_config = {"from_attributes": True}

def enrich_entry(entry) -> dict:
    """Convert a JournalEntry ORM object to a response dict with account details."""
    lines = []
    for line in entry.lines:
        line_dict = {
            "id": line.id,
            "account_id": line.account_id,
            "debit": line.debit,
            "credit": line.credit,
            "account_code": line.account.code if line.account else None,
            "account_name": line.account.name if line.account else None,
            "account_type": line.account.type.value if line.account else None,
        }
        lines.append(line_dict)
    return {
        "id": entry.id,
        "date": entry.date,
        "description": entry.description,
        "reference": entry.reference,
        "lines": lines,
    }

@router.get("/entries", response_model=List[JournalEntryResponse])
def get_journal_entries(
    limit: int = 100,
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD"),
    account_id: Optional[int] = Query(None),
    reference: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Fetch recent journal entries with their lines and account details."""
    user_id = current_user["sub"]
    query = db.query(models.JournalEntry)\
             .options(joinedload(models.JournalEntry.lines).joinedload(models.JournalLine.account))\
             .filter(models.JournalEntry.user_id == user_id)
    
    if date_from:
        try:
            dt_from = datetime.datetime.strptime(date_from, "%Y-%m-%d")
            query = query.filter(models.JournalEntry.date >= dt_from)
        except ValueError:
            pass
    
    if date_to:
        try:
            dt_to = datetime.datetime.strptime(date_to, "%Y-%m-%d")
            dt_to = dt_to.replace(hour=23, minute=59, second=59)
            query = query.filter(models.JournalEntry.date <= dt_to)
        except ValueError:
            pass
    
    if reference:
        query = query.filter(models.JournalEntry.reference.ilike(f"%{reference}%"))
    
    if account_id:
        # Filter entries that have at least one line with this account
        query = query.filter(
            models.JournalEntry.lines.any(models.JournalLine.account_id == account_id)
        )
    
    entries = query.order_by(models.JournalEntry.date.desc()).limit(limit).all()
    return [enrich_entry(e) for e in entries]

@router.get("/entries/{entry_id}", response_model=JournalEntryResponse)
def get_journal_entry(entry_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Fetch a single journal entry with full details."""
    user_id = current_user["sub"]
    entry = db.query(models.JournalEntry)\
              .options(joinedload(models.JournalEntry.lines).joinedload(models.JournalLine.account))\
              .filter(models.JournalEntry.id == entry_id, models.JournalEntry.user_id == user_id)\
              .first()
    if not entry:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    return enrich_entry(entry)

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
    
    # 4. Create Lines (with user_id)
    for line in entry.lines:
        db_line = models.JournalLine(
            user_id=user_id,
            journal_id=db_entry.id,
            account_id=line.account_id,
            debit=line.debit,
            credit=line.credit
        )
        db.add(db_line)
        
    db.commit()
    db.refresh(db_entry)
    
    # Re-query with eager loading for response
    result = db.query(models.JournalEntry)\
               .options(joinedload(models.JournalEntry.lines).joinedload(models.JournalLine.account))\
               .filter(models.JournalEntry.id == db_entry.id).first()
    return enrich_entry(result)

@router.post("/entries/{entry_id}/reverse", response_model=JournalEntryResponse)
def reverse_journal_entry(entry_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Create an equal-and-opposite reversing entry for a journal entry."""
    user_id = current_user["sub"]
    
    original = db.query(models.JournalEntry)\
                 .options(joinedload(models.JournalEntry.lines))\
                 .filter(models.JournalEntry.id == entry_id, models.JournalEntry.user_id == user_id)\
                 .first()
    
    if not original:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    
    # Create reversing entry
    reversing = models.JournalEntry(
        user_id=user_id,
        date=datetime.datetime.now(datetime.timezone.utc),
        description=f"REVERSAL of: {original.description}",
        reference=f"REV-{original.reference or original.id}"
    )
    db.add(reversing)
    db.flush()
    
    # Swap debits and credits
    for line in original.lines:
        db_line = models.JournalLine(
            user_id=user_id,
            journal_id=reversing.id,
            account_id=line.account_id,
            debit=line.credit,  # Swap
            credit=line.debit   # Swap
        )
        db.add(db_line)
    
    db.commit()
    
    result = db.query(models.JournalEntry)\
               .options(joinedload(models.JournalEntry.lines).joinedload(models.JournalLine.account))\
               .filter(models.JournalEntry.id == reversing.id).first()
    return enrich_entry(result)
