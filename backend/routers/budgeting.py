from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models
from pydantic import BaseModel
from typing import List, Optional
import datetime
from services.auth import get_current_user
from sqlalchemy import func

router = APIRouter(prefix="/budgeting", tags=["Budgeting & Planning"])

# --- Schemas ---

class BudgetItemBase(BaseModel):
    category_id: int
    jan_target: float = 0.0
    feb_target: float = 0.0
    mar_target: float = 0.0
    apr_target: float = 0.0
    may_target: float = 0.0
    jun_target: float = 0.0
    jul_target: float = 0.0
    aug_target: float = 0.0
    sep_target: float = 0.0
    oct_target: float = 0.0
    nov_target: float = 0.0
    dec_target: float = 0.0

class BudgetItemResponse(BudgetItemBase):
    id: int
    budget_id: int
    category_name: Optional[str] = None
    
    model_config = {"from_attributes": True}

class BudgetCreate(BaseModel):
    name: str
    fiscal_year: int
    notes: Optional[str] = None

class BudgetResponse(BaseModel):
    id: int
    name: str
    fiscal_year: int
    is_active: bool
    notes: Optional[str]
    created_at: datetime.datetime
    
    model_config = {"from_attributes": True}

class BVAReportItem(BaseModel):
    category_name: str
    month: int
    budget: float
    actual: float
    variance: float
    variance_pct: float

# --- Routes ---

@router.get("/", response_model=List[BudgetResponse])
def get_budgets(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    return db.query(models.Budget).filter(models.Budget.user_id == user_id).all()

@router.post("/", response_model=BudgetResponse)
def create_budget(budget: BudgetCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    
    db_budget = models.Budget(
        user_id=user_id,
        name=budget.name,
        fiscal_year=budget.fiscal_year,
        notes=budget.notes
    )
    db.add(db_budget)
    db.commit()
    db.refresh(db_budget)
    
    # Initialize with all categories
    categories = db.query(models.Category).filter(models.Category.user_id == user_id).all()
    for cat in categories:
        item = models.BudgetItem(
            budget_id=db_budget.id,
            category_id=cat.id
        )
        db.add(item)
    db.commit()
    
    return db_budget

@router.get("/{budget_id}/items", response_model=List[BudgetItemResponse])
def get_budget_items(budget_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    items = db.query(models.BudgetItem).join(models.Budget).filter(
        models.Budget.id == budget_id,
        models.Budget.user_id == user_id
    ).all()
    
    # Map category names
    res = []
    for item in items:
        resp = BudgetItemResponse.model_validate(item)
        cat = db.query(models.Category).filter(models.Category.id == item.category_id).first()
        if cat:
            resp.category_name = cat.name
        res.append(resp)
    return res

@router.put("/{budget_id}/items")
def update_budget_items(budget_id: int, items_update: List[BudgetItemBase], db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    budget = db.query(models.Budget).filter(models.Budget.id == budget_id, models.Budget.user_id == user_id).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
        
    for item_data in items_update:
        db_item = db.query(models.BudgetItem).filter(
            models.BudgetItem.budget_id == budget_id,
            models.BudgetItem.category_id == item_data.category_id
        ).first()
        
        if db_item:
            for field, value in item_data.model_dump().items():
                setattr(db_item, field, value)
        else:
            db_item = models.BudgetItem(budget_id=budget_id, **item_data.model_dump())
            db.add(db_item)
            
    db.commit()
    return {"message": "Budget updated successfully"}

@router.get("/{budget_id}/bva")
def get_bva_report(budget_id: int, month: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Budget vs Actual report for a specific month."""
    user_id = current_user["sub"]
    budget = db.query(models.Budget).filter(models.Budget.id == budget_id, models.Budget.user_id == user_id).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
        
    # Get budget targets for this month
    budget_items = db.query(models.BudgetItem).filter(models.BudgetItem.budget_id == budget_id).all()
    
    # Get actuals for this month from Ledger
    # Logic: Sum of entries in Ledger for each category in current fiscal year/month
    # We'll need to join Categories to group by name
    
    # Determine the target field name
    month_names = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
    target_field = f"{month_names[month-1]}_target"
    
    report = []
    
    for b_item in budget_items:
        category = db.query(models.Category).filter(models.Category.id == b_item.category_id).first()
        if not category:
            continue
            
        cat_name = category.name
        target_val = getattr(b_item, target_field)
        
        # Calculate actuals from JournalLines
        # Use simple debit-credit vs credit-debit logic based on category type
        net_balance = db.query(func.sum(models.JournalLine.debit - models.JournalLine.credit)).join(models.JournalEntry).filter(
            models.JournalLine.user_id == user_id,
            models.JournalLine.account_id == b_item.category_id,
            func.extract('month', models.JournalEntry.date) == month,
            func.extract('year', models.JournalEntry.date) == budget.fiscal_year
        ).scalar() or 0.0
        
        # Adjust balance based on Category Type (Expense/Revenue)
        if category.type == models.CategoryType.EXPENSE:
            actual_val = net_balance # Debit normal
        elif category.type == models.CategoryType.REVENUE:
            actual_val = -net_balance # Credit normal
        else:
            actual_val = abs(net_balance) # Fallback for others (Asset/Liab/Equity)
            
        variance = target_val - actual_val
        variance_pct = (variance / target_val * 100) if target_val != 0 else 0
        if target_val == 0 and actual_val != 0:
            variance_pct = -100 # Overspent/Overreceived if budget was 0
            
        report.append({
            "category_name": cat_name,
            "month": month,
            "budget": target_val,
            "actual": actual_val,
            "variance": variance,
            "variance_pct": variance_pct
        })
        
    return report
