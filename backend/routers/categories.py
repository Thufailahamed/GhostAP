from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
import models
from services.auth import get_current_user
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()

class CategoryCreate(BaseModel):
    code: str
    name: str
    type: str # Revenue, Expense, Asset, Liability, Equity
    description: Optional[str] = None
    parent_id: Optional[int] = None

class CategoryUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    type: Optional[str] = None
    description: Optional[str] = None
    parent_id: Optional[int] = None

class CategoryResponse(BaseModel):
    id: int
    code: str
    name: str
    type: str
    description: Optional[str]
    parent_id: Optional[int] = None
    is_system: bool = False

    model_config = {"from_attributes": True}

class CategoryBalanceResponse(BaseModel):
    account_id: int
    code: str
    name: str
    type: str
    debit_total: float
    credit_total: float
    balance: float # Debit-normal accounts: DR - CR, Credit-normal: CR - DR

@router.get("/", response_model=List[CategoryResponse])
def get_categories(type: Optional[str] = None, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    query = db.query(models.Category).filter(models.Category.user_id == user_id)
    if type:
        query = query.filter(models.Category.type == type)
    return query.order_by(models.Category.code).all()

@router.post("/", response_model=CategoryResponse)
def create_category(category: CategoryCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    db_category = db.query(models.Category).filter(
        models.Category.code == category.code,
        models.Category.user_id == user_id
    ).first()
    if db_category:
        raise HTTPException(status_code=400, detail="Category code already registered for this user")
    
    db_category = models.Category(
        user_id=user_id,
        code=category.code,
        name=category.name,
        type=category.type,
        description=category.description,
        parent_id=category.parent_id
    )
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category

@router.put("/{category_id}", response_model=CategoryResponse)
def update_category(category_id: int, update: CategoryUpdate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    db_category = db.query(models.Category).filter(
        models.Category.id == category_id,
        models.Category.user_id == user_id
    ).first()
    if not db_category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    if update.code is not None:
        # Check for duplicate code
        existing = db.query(models.Category).filter(
            models.Category.code == update.code,
            models.Category.user_id == user_id,
            models.Category.id != category_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Category code already in use")
        db_category.code = update.code
    if update.name is not None:
        db_category.name = update.name
    if update.type is not None:
        db_category.type = update.type
    if update.description is not None:
        db_category.description = update.description
    if update.parent_id is not None:
        db_category.parent_id = update.parent_id
    
    db.commit()
    db.refresh(db_category)
    return db_category

@router.delete("/{category_id}")
def delete_category(category_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    db_category = db.query(models.Category).filter(
        models.Category.id == category_id,
        models.Category.user_id == user_id
    ).first()
    if not db_category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    if db_category.is_system:
        raise HTTPException(status_code=400, detail="System accounts cannot be deleted.")
    
    # Check if account has journal lines
    has_lines = db.query(models.JournalLine).filter(
        models.JournalLine.account_id == category_id
    ).first()
    if has_lines:
        raise HTTPException(status_code=400, detail="Cannot delete account with existing journal entries. Archive it instead.")
        
    db.delete(db_category)
    db.commit()
    return {"message": "Category deleted successfully"}

@router.get("/balances", response_model=List[CategoryBalanceResponse])
def get_account_balances(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Calculate running balances for all accounts, aggregating children into parents."""
    user_id = current_user["sub"]
    
    accounts = db.query(models.Category).filter(
        models.Category.user_id == user_id
    ).all()
    
    # Get direct aggregated debits/credits per account
    aggregates = db.query(
        models.JournalLine.account_id,
        func.coalesce(func.sum(models.JournalLine.debit), 0).label("total_debit"),
        func.coalesce(func.sum(models.JournalLine.credit), 0).label("total_credit")
    ).join(
        models.JournalEntry, models.JournalLine.journal_id == models.JournalEntry.id
    ).filter(
        models.JournalEntry.user_id == user_id
    ).group_by(models.JournalLine.account_id).all()
    
    # Map direct balances
    direct_balances = {agg.account_id: {"dr": float(agg.total_debit), "cr": float(agg.total_credit)} for agg in aggregates}
    
    # Build tree structure for recursion
    adj = {acc.id: [] for acc in accounts}
    acc_map = {acc.id: acc for acc in accounts}
    roots = []
    for acc in accounts:
        if acc.parent_id and acc.parent_id in adj:
            adj[acc.parent_id].append(acc.id)
        else:
            roots.append(acc.id)
    
    computed_balances = {}
    visiting = set()

    def compute_recursive(acc_id):
        if acc_id in computed_balances:
            return computed_balances[acc_id]
        
        if acc_id in visiting:
            # Cycle detected - return empty but don't hang
            return 0.0, 0.0
            
        visiting.add(acc_id)
        
        # Start with direct transactions for this account
        direct = direct_balances.get(acc_id, {"dr": 0.0, "cr": 0.0})
        total_dr = direct["dr"]
        total_cr = direct["cr"]
        
        # Add all children's recursive totals
        for child_id in adj.get(acc_id, []):
            child_dr, child_cr = compute_recursive(child_id)
            total_dr += child_dr
            total_cr += child_cr
        
        visiting.remove(acc_id)
        computed_balances[acc_id] = (total_dr, total_cr)
        return total_dr, total_cr

    # We need to compute for ALL accounts, just in case some are parts of cycles and not in 'roots'
    for acc in accounts:
        compute_recursive(acc.id)
    
    results = []
    for acc in accounts:
        dr, cr = computed_balances.get(acc.id, (0.0, 0.0))
        # Asset, Expense = debit-normal (balance = DR - CR)
        # Liability, Equity, Revenue = credit-normal (balance = CR - DR)
        if acc.type.value in ("Asset", "Expense"):
            balance = dr - cr
        else:
            balance = cr - dr
        
        results.append(CategoryBalanceResponse(
            account_id=acc.id,
            code=acc.code,
            name=acc.name,
            type=acc.type.value,
            debit_total=dr,
            credit_total=cr,
            balance=balance
        ))
    
    return results

# Default Chart of Accounts
DEFAULT_ACCOUNTS = [
    # Assets (1000s)
    {"code": "1000", "name": "Cash", "type": "Asset", "description": "Primary cash account"},
    {"code": "1100", "name": "Accounts Receivable", "type": "Asset", "description": "Money owed by customers"},
    {"code": "1200", "name": "Inventory", "type": "Asset", "description": "Stock on hand"},
    {"code": "1300", "name": "Prepaid Expenses", "type": "Asset", "description": "Expenses paid in advance"},
    {"code": "1500", "name": "Office Equipment", "type": "Asset", "description": "Furniture, computers, etc."},
    # Liabilities (2000s)
    {"code": "2000", "name": "Accounts Payable", "type": "Liability", "description": "Money owed to vendors"},
    {"code": "2100", "name": "Credit Card Payable", "type": "Liability", "description": "Outstanding credit card balances"},
    {"code": "2200", "name": "Taxes Payable", "type": "Liability", "description": "Tax obligations"},
    {"code": "2300", "name": "Unearned Revenue", "type": "Liability", "description": "Payments received before service delivery"},
    # Equity (3000s)
    {"code": "3000", "name": "Owner's Equity", "type": "Equity", "description": "Owner's capital"},
    {"code": "3100", "name": "Retained Earnings", "type": "Equity", "description": "Accumulated profits"},
    # Revenue (4000s)
    {"code": "4000", "name": "Sales Revenue", "type": "Revenue", "description": "Income from sales"},
    {"code": "4100", "name": "Service Revenue", "type": "Revenue", "description": "Income from services"},
    {"code": "4200", "name": "Interest Income", "type": "Revenue", "description": "Income from interest"},
    {"code": "4900", "name": "Other Income", "type": "Revenue", "description": "Miscellaneous income"},
    # Expenses (5000s - 6000s)
    {"code": "5000", "name": "Cost of Goods Sold", "type": "Expense", "description": "Direct costs of products"},
    {"code": "5100", "name": "Payroll Expense", "type": "Expense", "description": "Employee wages and benefits"},
    {"code": "5200", "name": "Rent Expense", "type": "Expense", "description": "Office/warehouse rent"},
    {"code": "5300", "name": "Utilities Expense", "type": "Expense", "description": "Electricity, water, internet"},
    {"code": "5400", "name": "Office Supplies", "type": "Expense", "description": "Stationery, cleaning, etc."},
    {"code": "5500", "name": "Marketing Expense", "type": "Expense", "description": "Advertising and promotion"},
    {"code": "5600", "name": "Insurance Expense", "type": "Expense", "description": "Business insurance premiums"},
    {"code": "5700", "name": "Depreciation Expense", "type": "Expense", "description": "Asset depreciation"},
    {"code": "5800", "name": "Professional Services", "type": "Expense", "description": "Legal, accounting, consulting"},
    {"code": "6000", "name": "Miscellaneous Expense", "type": "Expense", "description": "Uncategorized expenses"},
]

@router.post("/seed-defaults")
def seed_default_accounts(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Seed the Chart of Accounts with standard business accounts."""
    user_id = current_user["sub"]
    
    # Check if user already has accounts
    existing_count = db.query(models.Category).filter(
        models.Category.user_id == user_id
    ).count()
    
    if existing_count > 0:
        raise HTTPException(status_code=400, detail=f"Chart of Accounts already has {existing_count} accounts. Seed is only for empty ledgers.")
    
    created = []
    for acct in DEFAULT_ACCOUNTS:
        db_cat = models.Category(
            user_id=user_id,
            code=acct["code"],
            name=acct["name"],
            type=acct["type"],
            description=acct["description"],
            is_system=True
        )
        db.add(db_cat)
        created.append(acct["name"])
    
    db.commit()
    return {"message": f"Seeded {len(created)} default accounts.", "accounts": created}
