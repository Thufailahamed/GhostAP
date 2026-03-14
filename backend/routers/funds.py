from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from sqlalchemy import func
import models
from services.accounting_service import AccountingService
from services.auth import get_current_user
from pydantic import BaseModel
from typing import List, Optional
import datetime

router = APIRouter(prefix="/funds", tags=["Funds Management"])

# --- Schemas ---

class BankAccountBase(BaseModel):
    name: str
    account_number: Optional[str] = None
    bank_name: Optional[str] = None
    currency: str = "USD"

class BankAccountCreate(BankAccountBase):
    pass

class BankAccountResponse(BankAccountBase):
    id: int
    balance: float
    model_config = {"from_attributes": True}

class TransactionCreate(BaseModel):
    amount: float
    type: str # INCOMING, OUTGOING, TRANSFER
    reference: Optional[str] = None
    bank_account_id: int
    date: datetime.datetime = None

class TransactionResponse(BaseModel):
    id: int
    date: datetime.datetime
    amount: float
    type: str
    reference: Optional[str]
    bank_account_id: int
    reconciled: bool = False
    model_config = {"from_attributes": True}
    
class FundsSummaryResponse(BaseModel):
    total_available_cash: float
    total_payables: float
    total_receivables: float
    net_position: float

@router.get("/summary", response_model=FundsSummaryResponse)
def get_funds_summary(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    
    # Filter bank activity by user's accounts
    cash = db.query(func.sum(models.BankTransaction.amount_base))\
             .join(models.BankAccount)\
             .filter(models.BankAccount.user_id == user_id).scalar() or 0.0
    
    payables = db.query(func.sum(models.Invoice.amount_base)).filter(
        models.Invoice.user_id == user_id,
        models.Invoice.status != models.InvoiceStatus.PAID,
        models.Invoice.status != models.InvoiceStatus.REJECTED
    ).scalar() or 0.0
    
    receivables_total = db.query(func.sum(models.Receivable.amount_base)).filter(
        models.Receivable.user_id == user_id,
        models.Receivable.status != models.ReceivableStatus.PAID
    ).scalar() or 0.0
    
    # We subtract paid portion of base currency from base total
    # This keeps it consistent with how Receivable models are tracking it
    receivables_paid = db.query(func.sum(models.PaymentReceived.amount_base))\
                        .join(models.Receivable)\
                        .filter(
                            models.Receivable.user_id == user_id,
                            models.Receivable.status != models.ReceivableStatus.PAID
                        ).scalar() or 0.0
    
    receivables = receivables_total - receivables_paid

    return {
        "total_available_cash": cash,
        "total_payables": payables,
        "total_receivables": receivables,
        "net_position": cash + receivables - payables
    }

@router.get("/bank-accounts", response_model=List[BankAccountResponse])
def get_bank_accounts(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    accounts = db.query(models.BankAccount).filter(models.BankAccount.user_id == user_id).all()
    results = []
    for acc in accounts:
        balance = db.query(func.sum(models.BankTransaction.amount)).filter(
            models.BankTransaction.bank_account_id == acc.id
        ).scalar() or 0.0
        results.append({
            "id": acc.id,
            "name": acc.name,
            "account_number": acc.account_number,
            "bank_name": acc.bank_name,
            "currency": acc.currency,
            "balance": balance
        })
    return results

@router.get("/transactions", response_model=List[TransactionResponse])
def get_transactions(limit: int = 50, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    return db.query(models.BankTransaction)\
             .join(models.BankAccount)\
             .filter(models.BankAccount.user_id == user_id)\
             .order_by(models.BankTransaction.date.desc()).limit(limit).all()

@router.post("/bank-accounts", response_model=BankAccountResponse)
def create_bank_account(account: BankAccountCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    db_acc = models.BankAccount(**account.model_dump(), user_id=user_id)
    db.add(db_acc)
    db.commit()
    db.refresh(db_acc)
    # the response expects balance
    return {
        "id": db_acc.id,
        "name": db_acc.name,
        "account_number": db_acc.account_number,
        "bank_name": db_acc.bank_name,
        "currency": db_acc.currency,
        "balance": 0.0
    }

def _get_or_create_category(db: Session, name: str, code: str, type_enum: models.CategoryType, user_id: str):
    cat = db.query(models.Category).filter(
        models.Category.code == code, 
        models.Category.user_id == user_id
    ).first()
    if cat:
        return cat
    cat = db.query(models.Category).filter(
        models.Category.name == name,
        models.Category.user_id == user_id
    ).first()
    if cat:
        return cat
    cat = models.Category(code=code, name=name, type=type_enum, user_id=user_id)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat

@router.post("/transactions", response_model=TransactionResponse)
def create_transaction(tx: TransactionCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    bank_acc = db.query(models.BankAccount).filter(
        models.BankAccount.id == tx.bank_account_id,
        models.BankAccount.user_id == user_id
    ).first()
    if not bank_acc:
        raise HTTPException(status_code=404, detail="Bank account not found or access denied")

    dt = tx.date or datetime.datetime.now(datetime.timezone.utc)
    
    # 1. Ensure required accounts exist for Journal (User-specific)
    cash_acct = _get_or_create_category(db, "Cash and Equivalents", "1000", models.CategoryType.ASSET, user_id)
    rev_acct = _get_or_create_category(db, "Misc Revenue", "4010", models.CategoryType.REVENUE, user_id)
    exp_acct = _get_or_create_category(db, "Misc Expense", "6010", models.CategoryType.EXPENSE, user_id)

    # 2. Build Journal Lines
    lines = []
    if tx.type.upper() == "INCOMING":
        amount = abs(tx.amount)
        lines = [
            {"account_id": cash_acct.id, "debit": amount, "credit": 0.0},
            {"account_id": rev_acct.id, "debit": 0.0, "credit": amount}
        ]
    elif tx.type.upper() == "OUTGOING":
        amount = -abs(tx.amount) # Store as negative in bank transactions
        lines = [
            {"account_id": cash_acct.id, "debit": 0.0, "credit": abs(amount)},
            {"account_id": exp_acct.id, "debit": abs(amount), "credit": 0.0}
        ]
    else:
        # Simplification: Only support INCOMING and OUTGOING for MVP via this endpoint right now
        amount = tx.amount
        lines = [
            {"account_id": cash_acct.id, "debit": max(amount, 0), "credit": abs(min(amount, 0))},
            {"account_id": rev_acct.id, "debit": abs(min(amount, 0)), "credit": max(amount, 0)} # fallback
        ]

    # 3. Create Journal Entry
    journal = AccountingService.create_journal_entry(
        db=db,
        description=f"Manual Bank Tx: {tx.reference or 'Deposit/Withdrawal'}",
        reference=f"BNK-{dt.strftime('%Y%m%d%H%M')}",
        lines=lines,
        user_id=user_id
    )

    # 4. Create Bank Transaction
    db_tx = models.BankTransaction(
        user_id=user_id,
        bank_account_id=tx.bank_account_id,
        journal_id=journal.id,
        date=dt,
        amount=amount,
        type=tx.type.upper(),
        reference=tx.reference,
        reconciled=True  # Manual entry implies it's reconciled/confirmed
    )
    db.add(db_tx)
    db.commit()
    db.refresh(db_tx)
    return db_tx

@router.patch("/transactions/{transaction_id}/reconcile")
def reconcile_transaction(transaction_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    tx = db.query(models.BankTransaction)\
           .join(models.BankAccount)\
           .filter(models.BankTransaction.id == transaction_id, models.BankAccount.user_id == user_id)\
           .first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found or access denied")
    tx.reconciled = True
    db.commit()
    return {"message": "Transaction reconciled successfully"}

@router.get("/bank-feed")
def get_mock_bank_feed(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Simulates an external bank feed (e.g. from Plaid or CSV upload)"""
    user_id = current_user["sub"]
    import random
    # Grab some recent unreconciled transactions to simulate matching lines
    txs = db.query(models.BankTransaction)\
            .join(models.BankAccount)\
            .filter(models.BankTransaction.reconciled == False, models.BankAccount.user_id == user_id)\
            .order_by(models.BankTransaction.date.desc()).limit(5).all()
    
    feed = []
    for tx in txs:
        # Create a realistic "messy" bank description
        raw_desc = f"ACH {'DEPOSIT' if tx.amount > 0 else 'WITHDRAWAL'} {tx.reference or 'MISC'} {random.randint(100, 999)}"
        feed_date = tx.date + datetime.timedelta(days=random.randint(0, 1))
        
        feed.append({
            "bank_id": f"stmt_{tx.id}_{random.randint(1000, 9999)}",
            "date": feed_date.strftime("%Y-%m-%d"),
            "description": raw_desc,
            "amount": tx.amount,
            "match_hint_id": tx.id # Hint for the UI to suggest a match
        })
    return feed

class AddCashRequest(BaseModel):
    amount: float
    reference: Optional[str] = "Owner Investment / Manual Cash"

@router.post("/add-cash", response_model=TransactionResponse)
def add_cash_in_hand(req: AddCashRequest, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be strictly positive.")

    # 1. Find or create the "Cash in Hand" Bank Account
    cash_acct = db.query(models.BankAccount).filter(
        models.BankAccount.name == "Cash in Hand",
        models.BankAccount.user_id == user_id
    ).first()
    if not cash_acct:
        import random
        cash_acct = models.BankAccount(
            user_id=user_id,
            name="Cash in Hand",
            account_number=f"CASH-{random.randint(1000,9999)}",
            bank_name="Internal Vault",
            currency="USD"
        )
        db.add(cash_acct)
        db.commit()
        db.refresh(cash_acct)

    dt = datetime.datetime.now(datetime.timezone.utc)

    # 2. Setup GL Categories
    cash_gl = _get_or_create_category(db, "Cash and Equivalents", "1000", models.CategoryType.ASSET, user_id)
    equity_gl = _get_or_create_category(db, "Owner Equity / Investment", "3000", models.CategoryType.EQUITY, user_id)

    # 3. Create Journal Entry (Debit Cash, Credit Equity)
    journal = AccountingService.create_journal_entry(
        db=db,
        description=f"Add Cash to Hand: {req.reference}",
        reference=f"CASH-{dt.strftime('%Y%m%d%H%M%S')}",
        lines=[
            {"account_id": cash_gl.id, "debit": req.amount, "credit": 0.0},
            {"account_id": equity_gl.id, "debit": 0.0, "credit": req.amount}
        ],
        user_id=user_id
    )

    # 4. Record the Bank Transaction
    from services.currency_service import CurrencyService
    base_currency = CurrencyService.get_base_currency(db, user_id)
    rate = CurrencyService.get_exchange_rate(db, user_id, "USD", base_currency) # add-cash currently uses USD defaults

    db_tx = models.BankTransaction(
        user_id=user_id,
        bank_account_id=cash_acct.id,
        journal_id=journal.id,
        date=dt,
        amount=req.amount,
        amount_base=req.amount * rate,
        currency="USD",
        exchange_rate=rate,
        type="INCOMING",
        reference=req.reference,
        reconciled=True
    )
    db.add(db_tx)
    db.commit()
    db.refresh(db_tx)

    return db_tx

