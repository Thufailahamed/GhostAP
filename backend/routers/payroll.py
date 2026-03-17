from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
import models
from pydantic import BaseModel, EmailStr
from typing import List, Optional
import datetime
from services.auth import get_current_user
from services.accounting_service import AccountingService

router = APIRouter(prefix="/payroll", tags=["Payroll"])

# --- Pydantic Schemas ---

class EmployeeBase(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    employee_id: str
    role: Optional[str] = None
    salary_annual: float = 0.0
    salary_monthly: float = 0.0
    currency: str = "USD"
    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None

class EmployeeCreate(EmployeeBase):
    pass

class EmployeeResponse(EmployeeBase):
    id: int
    is_active: bool
    created_at: datetime.datetime
    class Config:
        from_attributes = True

class PayrollRunCreate(BaseModel):
    run_number: str
    period_start: datetime.datetime
    period_end: datetime.datetime
    payment_date: Optional[datetime.datetime] = None

class PaySlipResponse(BaseModel):
    id: int
    employee_id: int
    gross_pay: float
    net_pay: float
    tax_deductions: float
    is_paid: bool
    class Config:
        from_attributes = True

class PayrollRunResponse(BaseModel):
    id: int
    run_number: str
    period_start: datetime.datetime
    period_end: datetime.datetime
    status: str
    total_gross: float
    total_net: float
    total_tax: float
    journal_id: Optional[int] = None
    pay_slips: List[PaySlipResponse] = []
    class Config:
        from_attributes = True

# --- API Endpoints ---

@router.get("/employees", response_model=List[EmployeeResponse])
def get_employees(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    return db.query(models.Employee).filter(models.Employee.user_id == user_id).all()

@router.get("/runs", response_model=List[PayrollRunResponse])
def get_payroll_runs(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    return db.query(models.PayrollRun).filter(models.PayrollRun.user_id == user_id).all()

@router.get("/runs/{run_id}", response_model=PayrollRunResponse)
def get_payroll_run(run_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    run = db.query(models.PayrollRun).filter(models.PayrollRun.id == run_id, models.PayrollRun.user_id == user_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Payroll run not found")
    return run

@router.post("/employees", response_model=EmployeeResponse)
def create_employee(employee: EmployeeCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    db_employee = models.Employee(**employee.model_dump(), user_id=user_id)
    db.add(db_employee)
    db.commit()
    db.refresh(db_employee)
    return db_employee

@router.post("/runs", response_model=PayrollRunResponse)
def create_payroll_run(run: PayrollRunCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Creates a draft payroll run and generates pay slips for all active employees."""
    user_id = current_user["sub"]
    
    # 1. Create Run Header
    db_run = models.PayrollRun(
        user_id=user_id,
        run_number=run.run_number,
        period_start=run.period_start,
        period_end=run.period_end,
        payment_date=run.payment_date,
        status=models.PayrollStatus.DRAFT
    )
    db.add(db_run)
    db.flush()
    
    # 2. Generate Pay Slips for all active employees
    employees = db.query(models.Employee).filter(
        models.Employee.user_id == user_id,
        models.Employee.is_active == True
    ).all()
    
    total_gross = 0.0
    total_net = 0.0
    total_tax = 0.0
    
    for emp in employees:
        gross = emp.salary_monthly if emp.salary_monthly > 0 else (emp.salary_annual / 12)
        # Placeholder for real tax logic
        tax = gross * 0.2 
        net = gross - tax
        
        slip = models.PaySlip(
            user_id=user_id,
            employee_id=emp.id,
            payroll_run_id=db_run.id,
            gross_pay=gross,
            net_pay=net,
            tax_deductions=tax
        )
        db.add(slip)
        
        total_gross += gross
        total_net += net
        total_tax += tax
        
    db_run.total_gross = total_gross
    db_run.total_net = total_net
    db_run.total_tax = total_tax
    
    db.commit()
    db.refresh(db_run)
    return db_run

@router.post("/runs/{run_id}/process")
def process_payroll(run_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Processes the payroll run and posts journal entries to the ledger."""
    user_id = current_user["sub"]
    run = db.query(models.PayrollRun).filter(
        models.PayrollRun.id == run_id, 
        models.PayrollRun.user_id == user_id
    ).first()
    
    if not run:
        raise HTTPException(status_code=404, detail="Payroll run not found")
    if run.status != models.PayrollStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Only DRAFT runs can be processed")

    # 1. Find or Create Accounts
    def get_or_create_account(name: str, code: str, type: models.CategoryType):
        acc = db.query(models.Category).filter(models.Category.code == code, models.Category.user_id == user_id).first()
        if not acc:
            acc = models.Category(user_id=user_id, name=name, code=code, type=type)
            db.add(acc)
            db.flush()
        return acc

    wages_expense = get_or_create_account("Wages & Salaries Expense", "EXP-PAY-001", models.CategoryType.EXPENSE)
    wages_payable = get_or_create_account("Wages Payable", "LIAB-PAY-001", models.CategoryType.LIABILITY)
    tax_payable = get_or_create_account("Payroll Tax Payable", "LIAB-TAX-001", models.CategoryType.LIABILITY)

    # 2. Create Journal Entry
    journal_lines = [
        {"account_id": wages_expense.id, "debit": run.total_gross, "credit": 0.0},
        {"account_id": wages_payable.id, "debit": 0.0, "credit": run.total_net},
        {"account_id": tax_payable.id, "debit": 0.0, "credit": run.total_tax}
    ]
    
    journal_entry = AccountingService.create_journal_entry(
        db, 
        description=f"Payroll Run: {run.run_number}", 
        reference=run.run_number,
        lines=journal_lines,
        user_id=user_id
    )
    
    # 3. Update Run Status
    run.status = models.PayrollStatus.PROCESSED
    run.journal_id = journal_entry.id
    db.commit()
    
    return {"status": "success", "journal_id": journal_entry.id}
