from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import func
from sqlalchemy.orm import Session
from database import get_db
import models
from pydantic import BaseModel
from typing import List, Optional
import datetime
from services.accounting_service import AccountingService
from services.auth import get_current_user, get_current_user_from_query

router = APIRouter(
    prefix="/receivables",
    tags=["Receivables"],
    dependencies=[Depends(get_current_user)]
)

# --- Schemas ---

class CustomerBase(BaseModel):
    name: str
    payment_terms: Optional[str] = "Net 30"

class CustomerCreate(CustomerBase):
    pass

class CustomerResponse(CustomerBase):
    id: int
    model_config = {"from_attributes": True}

class ReceivableLineItemBase(BaseModel):
    description: str
    quantity: float = 1.0
    unit_price: float = 0.0
    product_id: Optional[int] = None

class ReceivableLineItemResponse(ReceivableLineItemBase):
    id: int
    total_price: float
    model_config = {"from_attributes": True}

class ReceivableCreate(BaseModel):
    invoice_number: Optional[str] = None
    customer_id: int
    due_date: Optional[datetime.datetime] = None
    total_amount: float
    currency: Optional[str] = "USD"
    exchange_rate: Optional[float] = None
    pdf_path: Optional[str] = None
    items: List[ReceivableLineItemBase] = []

class PaymentCreate(BaseModel):
    amount: float
    method: str
    reference: Optional[str] = None
    currency: Optional[str] = "USD"
    exchange_rate: Optional[float] = None

class PaymentResponse(BaseModel):
    id: int
    receivable_id: int
    amount: float
    date: datetime.datetime
    method: str
    reference: Optional[str]
    model_config = {"from_attributes": True}

class ReceivableResponse(BaseModel):
    id: int
    invoice_number: str
    customer_id: int
    issue_date: datetime.datetime
    due_date: Optional[datetime.datetime]
    total_amount: float
    paid_amount: float
    currency: str = "USD"
    exchange_rate: float = 1.0
    pdf_path: Optional[str] = None
    status: str
    customer: CustomerResponse
    payments: List[PaymentResponse] = []
    items: List[ReceivableLineItemResponse] = []
    
    model_config = {"from_attributes": True}

# --- Endpoints ---

@router.get("/customers", response_model=List[CustomerResponse])
def get_customers(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    return db.query(models.Customer).filter(models.Customer.user_id == user_id).all()


@router.get("/customers/details")
def get_customers_with_details(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Return all customers with financial summaries."""
    user_id = current_user["sub"]
    customers = db.query(models.Customer).filter(models.Customer.user_id == user_id).all()

    result = []
    for c in customers:
        receivables = db.query(models.Receivable).filter(
            models.Receivable.customer_id == c.id,
            models.Receivable.user_id == user_id,
        ).all()

        total_billed_base = sum(r.amount_base or 0 for r in receivables)
        # Use sum of amount_base from payments
        total_paid_base = db.query(func.sum(models.PaymentReceived.amount_base))\
                            .filter(models.PaymentReceived.receivable_id.in_([r.id for r in receivables]))\
                            .scalar() or 0.0
        outstanding_base = total_billed_base - total_paid_base
        invoice_count = len(receivables)
        overdue_count = sum(1 for r in receivables if r.status == models.ReceivableStatus.OVERDUE)
        last_invoice_date = max(
            (r.issue_date for r in receivables if r.issue_date),
            default=None
        )

        result.append({
            "id": c.id,
            "name": c.name,
            "payment_terms": c.payment_terms,
            "total_billed": round(total_billed_base, 2),
            "total_paid": round(total_paid_base, 2),
            "outstanding": round(outstanding_base, 2),
            "invoice_count": invoice_count,
            "overdue_count": overdue_count,
            "last_invoice_date": last_invoice_date.isoformat() if last_invoice_date else None,
        })

    return sorted(result, key=lambda x: x["outstanding"], reverse=True)

@router.post("/customers", response_model=CustomerResponse)
def create_customer(customer: CustomerCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    db_customer = models.Customer(name=customer.name, payment_terms=customer.payment_terms, user_id=user_id)
    db.add(db_customer)
    db.commit()
    db.refresh(db_customer)
    return db_customer


@router.delete("/customers/{customer_id}")
def delete_customer(customer_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    customer = db.query(models.Customer).filter(
        models.Customer.id == customer_id,
        models.Customer.user_id == user_id
    ).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    db.delete(customer)
    db.commit()
    return {"message": "Customer deleted"}

@router.get("/", response_model=List[ReceivableResponse])
def get_receivables(status: Optional[str] = None, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    query = db.query(models.Receivable).filter(models.Receivable.user_id == user_id)
    if status:
        query = query.filter(models.Receivable.status == status)
    return query.all()

# =============================================
# AGING REPORT
# =============================================

@router.get("/aging")
def get_aging_report(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Compute AR Aging — buckets receivables into 0-30, 31-60, 61-90, 90+ days."""
    user_id = current_user["sub"]
    now = datetime.datetime.now(datetime.timezone.utc)
    receivables = db.query(models.Receivable).filter(
        models.Receivable.user_id == user_id,
        models.Receivable.status != models.ReceivableStatus.PAID
    ).all()

    buckets = {
        "current": {"label": "0-30 Days", "items": [], "total": 0.0},
        "aging_30": {"label": "31-60 Days", "items": [], "total": 0.0},
        "aging_60": {"label": "61-90 Days", "items": [], "total": 0.0},
        "aging_90": {"label": "90+ Days", "items": [], "total": 0.0},
    }

    for rec in receivables:
        # Calculate balance in base currency
        paid_base = sum(p.amount_base for p in rec.payments)
        balance_base = (rec.amount_base or 0.0) - paid_base
        
        if balance_base <= 0.01:
            continue

        ref_date = rec.due_date or rec.issue_date
        if ref_date and ref_date.tzinfo is None:
            ref_date = ref_date.replace(tzinfo=datetime.timezone.utc)
        age_days = (now - ref_date).days if ref_date else 0

        item = {
            "id": rec.id,
            "invoice_number": rec.invoice_number,
            "customer": rec.customer.name if rec.customer else "Unknown",
            "total_amount": rec.amount_base,
            "balance_due": round(balance_base, 2),
            "days_outstanding": age_days,
            "status": rec.status.value if rec.status else "DRAFT",
            "due_date": rec.due_date.strftime("%Y-%m-%d") if rec.due_date else None,
        }

        if age_days <= 30:
            buckets["current"]["items"].append(item)
            buckets["current"]["total"] += balance_base
        elif age_days <= 60:
            buckets["aging_30"]["items"].append(item)
            buckets["aging_30"]["total"] += balance_base
        elif age_days <= 90:
            buckets["aging_60"]["items"].append(item)
            buckets["aging_60"]["total"] += balance_base
        else:
            buckets["aging_90"]["items"].append(item)
            buckets["aging_90"]["total"] += balance_base

    total_ar = sum(b["total"] for b in buckets.values())
    for b in buckets.values():
        b["total"] = round(b["total"], 2)

    return {"buckets": buckets, "total_ar": round(total_ar, 2)}


# =============================================
# OVERDUE AUTO-MARK
# =============================================

@router.post("/auto-mark-overdue")
def auto_mark_overdue(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Sweep DB for receivables past their due_date and flip them to OVERDUE."""
    user_id = current_user["sub"]
    now = datetime.datetime.now(datetime.timezone.utc)
    updated = 0

    candidates = db.query(models.Receivable).filter(
        models.Receivable.user_id == user_id,
        models.Receivable.status.notin_([
            models.ReceivableStatus.PAID,
            models.ReceivableStatus.OVERDUE,
        ])
    ).all()

    for rec in candidates:
        if rec.due_date:
            due = rec.due_date
            if due.tzinfo is None:
                due = due.replace(tzinfo=datetime.timezone.utc)
            if due < now:
                rec.status = models.ReceivableStatus.OVERDUE
                updated += 1

    db.commit()
    return {"updated": updated, "message": f"{updated} receivable(s) marked as OVERDUE."}
@router.get("/{id}", response_model=ReceivableResponse)
def get_receivable(id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    db_receivable = db.query(models.Receivable).filter(
        models.Receivable.id == id,
        models.Receivable.user_id == user_id
    ).first()
    if not db_receivable:
        raise HTTPException(status_code=404, detail="Receivable not found or access denied")
    return db_receivable

@router.post("/", response_model=ReceivableResponse)
def create_receivable(receivable: ReceivableCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    # Verify customer exists
    customer = db.query(models.Customer).filter(
        models.Customer.id == receivable.customer_id,
        models.Customer.user_id == user_id
    ).first()
    if not customer:
        raise HTTPException(status_code=400, detail="Customer not found or access denied")
        
    effective_invoice_number = receivable.invoice_number
    if not effective_invoice_number:
        import uuid
        effective_invoice_number = f"REC-{datetime.datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    else:
        # Verify uniqueness only if provided
        existing = db.query(models.Receivable).filter(models.Receivable.invoice_number == effective_invoice_number).first()
        if existing:
            raise HTTPException(status_code=400, detail="Invoice number already exists")

    from services.currency_service import CurrencyService
    
    # Get Exchange Rate if not provided
    rate = receivable.exchange_rate
    if not rate:
        rate = CurrencyService.get_exchange_rate(db, user_id, receivable.currency, CurrencyService.get_base_currency(db, user_id))

    db_receivable = models.Receivable(
        user_id=user_id,
        invoice_number=effective_invoice_number,
        customer_id=receivable.customer_id,
        due_date=receivable.due_date,
        total_amount=receivable.total_amount,
        amount_base=receivable.total_amount * rate,
        currency=receivable.currency,
        exchange_rate=rate,
        pdf_path=receivable.pdf_path,
        status=models.ReceivableStatus.SENT
    )
    db.add(db_receivable)
    db.flush() # Get ID
    
    from services.inventory_service import InventoryService
    
    for item in receivable.items:
        db_item = models.ReceivableLineItem(
            receivable_id=db_receivable.id,
            product_id=item.product_id,
            description=item.description,
            quantity=item.quantity,
            unit_price=item.unit_price,
            total_price=item.quantity * item.unit_price
        )
        db.add(db_item)
        
        # If it's a product, reduce inventory
        if item.product_id:
            InventoryService.record_movement(
                db, user_id, item.product_id, -item.quantity, "SALE", ref_id=db_receivable.id
            )
    db.commit()
    db.refresh(db_receivable)

    # --- Accounting Engine Hook (Phase 23) ---
    try:
        ar_account = db.query(models.Category).filter(models.Category.name == "Accounts Receivable", models.Category.user_id == user_id).first()
        rev_account = db.query(models.Category).filter(models.Category.name == "Sales Revenue", models.Category.user_id == user_id).first()
        
        if not ar_account:
            ar_account = models.Category(code="1200", name="Accounts Receivable", type="Asset", user_id=user_id)
            db.add(ar_account)
            db.flush()
        
        if not rev_account:
            rev_account = models.Category(code="4000", name="Sales Revenue", type="Revenue", user_id=user_id)
            db.add(rev_account)
            db.flush()

        total_base = db_receivable.total_amount * db_receivable.exchange_rate

        AccountingService.create_journal_entry(
            db,
            description=f"Receivable Created: {db_receivable.invoice_number} - {customer.name}",
            reference=f"REC-{db_receivable.id}",
            lines=[
                {"account_id": ar_account.id, "debit": total_base, "credit": 0.0},
                {"account_id": rev_account.id, "debit": 0.0, "credit": total_base}
            ],
            user_id=user_id
        )
    except Exception as e:
        print(f"FAILED TO CREATE AR JOURNAL ENTRY: {e}")

    return db_receivable

class ReceivableStatusUpdate(BaseModel):
    status: str

@router.patch("/{id}/status", response_model=ReceivableResponse)
def update_receivable_status(id: int, update: ReceivableStatusUpdate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    db_receivable = db.query(models.Receivable).filter(
        models.Receivable.id == id,
        models.Receivable.user_id == user_id
    ).first()
    if not db_receivable:
        raise HTTPException(status_code=404, detail="Receivable not found or access denied")
        
    db_receivable.status = update.status
    db.commit()
    db.refresh(db_receivable)
    return db_receivable

@router.post("/{id}/payment", response_model=PaymentResponse)
def record_payment(id: int, payment: PaymentCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    db_receivable = db.query(models.Receivable).filter(
        models.Receivable.id == id,
        models.Receivable.user_id == user_id
    ).first()
    if not db_receivable:
        raise HTTPException(status_code=404, detail="Receivable not found or access denied")
        
    if db_receivable.status == models.ReceivableStatus.PAID:
        raise HTTPException(status_code=400, detail="Receivable is already fully paid")
        
    from services.currency_service import CurrencyService
    
    # Get Exchange Rate for payment
    pay_rate = payment.exchange_rate
    if not pay_rate:
        pay_rate = CurrencyService.get_exchange_rate(db, user_id, payment.currency, CurrencyService.get_base_currency(db, user_id))

    amount_base = payment.amount * pay_rate

    db_payment = models.PaymentReceived(
        user_id=user_id,
        receivable_id=id,
        amount=payment.amount,
        amount_base=amount_base,
        currency=payment.currency,
        exchange_rate=pay_rate,
        method=payment.method,
        reference=payment.reference
    )
    db.add(db_payment)
    
    # Update receivable stats (paid_amount is in document currency)
    # If document is in EUR and payment is in EUR, it's simple.
    # If payment is in USD but document is in EUR, we need to convert payment back to EUR.
    if payment.currency != db_receivable.currency:
        # Convert payment amount to document currency
        rate_to_doc = CurrencyService.get_exchange_rate(db, user_id, payment.currency, db_receivable.currency)
        amount_in_doc_currency = payment.amount * rate_to_doc
    else:
        amount_in_doc_currency = payment.amount

    db_receivable.paid_amount += amount_in_doc_currency
    if db_receivable.paid_amount >= db_receivable.total_amount - 0.01:
        db_receivable.status = models.ReceivableStatus.PAID
    else:
        db_receivable.status = models.ReceivableStatus.PARTIAL
        
    # Realized Gain/Loss Logic
    # Original Base Value of this portion: amount_in_doc_currency * db_receivable.exchange_rate
    # Actual Base Value received: amount_base
    original_base = amount_in_doc_currency * db_receivable.exchange_rate
    CurrencyService.record_realized_gain_loss(db, user_id, original_base, amount_base, f"REC-{db_receivable.invoice_number}")

    db.commit()

    # --- Accounting Engine Hook (Phase 23) ---
    try:
        # 1. Update Ledger (Debit Bank / Credit AR)
        bank_gl = db.query(models.Category).filter(models.Category.name == "Main Operating Account", models.Category.user_id == user_id).first()
        ar_account = db.query(models.Category).filter(models.Category.name == "Accounts Receivable", models.Category.user_id == user_id).first()
        
        if not bank_gl:
            bank_gl = models.Category(code="1000", name="Main Operating Account", type="Asset", user_id=user_id)
            db.add(bank_gl)
            db.flush()
            
        if not ar_account:
            ar_account = models.Category(code="1200", name="Accounts Receivable", type="Asset", user_id=user_id)
            db.add(ar_account)
            db.flush()
            
        AccountingService.create_journal_entry(
            db,
            description=f"Payment Received: {db_receivable.invoice_number} from {db_receivable.customer.name}",
            reference=f"PAY-REC-{db_payment.id}",
            lines=[
                {"account_id": bank_gl.id, "debit": amount_base, "credit": 0.0},
                {"account_id": ar_account.id, "debit": 0.0, "credit": amount_base}
            ],
            user_id=user_id
        )

        # 2. Record Bank Transaction (For Funds Management list)
        bank_account = db.query(models.BankAccount).filter(models.BankAccount.user_id == user_id).first() # Default to first for now
        if bank_account:
            txn = models.BankTransaction(
                user_id=user_id,
                bank_account_id=bank_account.id,
                amount=amount_base,
                type="INCOMING",
                reference=f"REC-PAY-{db_receivable.invoice_number}",
                date=datetime.datetime.now(datetime.timezone.utc)
            )
            db.add(txn)
            db.commit()
            
    except Exception as e:
        print(f"FAILED TO CREATE PAYMENT JOURNAL ENTRY: {e}")

    db.refresh(db_payment)
    return db_payment


@router.get("/{receivable_id}/pdf")
def download_receivable_pdf(receivable_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user_from_query)):
    """Generate and download a PDF invoice for a receivable."""
    user_id = current_user["sub"]
    rec = db.query(models.Receivable).filter(
        models.Receivable.id == receivable_id,
        models.Receivable.user_id == user_id
    ).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Receivable not found")

    customer = db.query(models.Customer).filter(models.Customer.id == rec.customer_id).first()
    customer_name = customer.name if customer else "Unknown"

    from services.pdf_generator import generate_invoice_pdf

    issue_str = rec.issue_date.strftime("%Y-%m-%d") if rec.issue_date else "N/A"
    due_str = rec.due_date.strftime("%Y-%m-%d") if rec.due_date else None

    pdf_bytes = generate_invoice_pdf(
        invoice_number=rec.invoice_number,
        customer_name=customer_name,
        issue_date=issue_str,
        due_date=due_str,
        total_amount=rec.total_amount,
        paid_amount=rec.paid_amount or 0,
        line_items=[{
            "description": item.description,
            "quantity": item.quantity,
            "unit_price": item.unit_price,
            "total_price": item.total_price
        } for item in rec.items]
    )

    filename = f"Invoice_{rec.invoice_number}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
