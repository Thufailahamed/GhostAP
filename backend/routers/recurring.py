from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from database import get_db
import models
import datetime
from services.auth import get_current_user
from pydantic import BaseModel
from typing import Optional

router = APIRouter(
    prefix="/recurring",
    tags=["recurring"],
)


class RecurringCreate(BaseModel):
    customer_id: int
    description: str
    amount: float
    currency: Optional[str] = "USD"
    frequency: str  # WEEKLY, MONTHLY, QUARTERLY, YEARLY
    start_date: str  # ISO date string
    end_date: Optional[str] = None
    auto_send_email: bool = False


class RecurringUpdate(BaseModel):
    description: Optional[str] = None
    amount: Optional[float] = None
    frequency: Optional[str] = None
    is_active: Optional[bool] = None
    end_date: Optional[str] = None
    auto_send_email: Optional[bool] = None


@router.get("/")
def list_recurring(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    items = db.query(models.RecurringInvoice).options(
        joinedload(models.RecurringInvoice.customer)
    ).filter(
        models.RecurringInvoice.user_id == user_id
    ).order_by(models.RecurringInvoice.next_run_date).all()

    return [{
        "id": item.id,
        "customer_name": item.customer.name if item.customer else "Unknown",
        "customer_id": item.customer_id,
        "description": item.description,
        "amount": item.amount,
        "frequency": item.frequency.value if item.frequency else "MONTHLY",
        "next_run_date": item.next_run_date.isoformat() if item.next_run_date else None,
        "last_run_date": item.last_run_date.isoformat() if item.last_run_date else None,
        "end_date": item.end_date.isoformat() if item.end_date else None,
        "is_active": item.is_active,
        "auto_send_email": item.auto_send_email,
        "times_generated": item.times_generated,
        "created_at": item.created_at.isoformat() if item.created_at else None,
    } for item in items]


@router.post("/")
def create_recurring(data: RecurringCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]

    # Validate customer exists
    customer = db.query(models.Customer).filter(
        models.Customer.id == data.customer_id,
        models.Customer.user_id == user_id
    ).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Parse dates
    try:
        start_dt = datetime.datetime.fromisoformat(data.start_date).replace(tzinfo=datetime.timezone.utc)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid start_date format")

    end_dt = None
    if data.end_date:
        try:
            end_dt = datetime.datetime.fromisoformat(data.end_date).replace(tzinfo=datetime.timezone.utc)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format")

    from services.currency_service import CurrencyService
    base_currency = CurrencyService.get_base_currency(db, user_id)
    rate = CurrencyService.get_exchange_rate(db, user_id, data.currency or "USD", base_currency)

    item = models.RecurringInvoice(
        user_id=user_id,
        customer_id=data.customer_id,
        description=data.description,
        amount=data.amount,
        amount_base=data.amount * rate,
        currency=data.currency or "USD",
        exchange_rate=rate,
        frequency=models.RecurringFrequency(data.frequency),
        next_run_date=start_dt,
        end_date=end_dt,
        auto_send_email=data.auto_send_email,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"id": item.id, "message": "Recurring schedule created"}


@router.patch("/{recurring_id}")
def update_recurring(recurring_id: int, data: RecurringUpdate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    item = db.query(models.RecurringInvoice).filter(
        models.RecurringInvoice.id == recurring_id,
        models.RecurringInvoice.user_id == user_id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Recurring schedule not found")

    if data.description is not None:
        item.description = data.description
    if data.amount is not None:
        item.amount = data.amount
        from services.currency_service import CurrencyService
        base_currency = CurrencyService.get_base_currency(db, user_id)
        item.exchange_rate = CurrencyService.get_exchange_rate(db, user_id, item.currency, base_currency)
        item.amount_base = item.amount * item.exchange_rate
    if data.frequency is not None:
        item.frequency = models.RecurringFrequency(data.frequency)
    if data.is_active is not None:
        item.is_active = data.is_active
    if data.auto_send_email is not None:
        item.auto_send_email = data.auto_send_email
    if data.end_date is not None:
        try:
            item.end_date = datetime.datetime.fromisoformat(data.end_date).replace(tzinfo=datetime.timezone.utc)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format")

    db.commit()
    return {"message": "Updated"}


@router.delete("/{recurring_id}")
def delete_recurring(recurring_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    item = db.query(models.RecurringInvoice).filter(
        models.RecurringInvoice.id == recurring_id,
        models.RecurringInvoice.user_id == user_id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Recurring schedule not found")

    db.delete(item)
    db.commit()
    return {"message": "Deleted"}


def _advance_next_run(frequency: models.RecurringFrequency, current_date: datetime.datetime) -> datetime.datetime:
    """Calculate the next run date based on frequency."""
    if frequency == models.RecurringFrequency.WEEKLY:
        return current_date + datetime.timedelta(weeks=1)
    elif frequency == models.RecurringFrequency.MONTHLY:
        month = current_date.month + 1
        year = current_date.year
        if month > 12:
            month = 1
            year += 1
        day = min(current_date.day, 28)  # Safe day
        return current_date.replace(year=year, month=month, day=day)
    elif frequency == models.RecurringFrequency.QUARTERLY:
        month = current_date.month + 3
        year = current_date.year
        while month > 12:
            month -= 12
            year += 1
        day = min(current_date.day, 28)
        return current_date.replace(year=year, month=month, day=day)
    elif frequency == models.RecurringFrequency.YEARLY:
        return current_date.replace(year=current_date.year + 1)
    return current_date + datetime.timedelta(days=30)  # Fallback


@router.post("/trigger")
def trigger_recurring(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Trigger all due recurring schedules and generate receivables."""
    user_id = current_user["sub"]
    now = datetime.datetime.now(datetime.timezone.utc)

    due_items = db.query(models.RecurringInvoice).filter(
        models.RecurringInvoice.user_id == user_id,
        models.RecurringInvoice.is_active == True,
        models.RecurringInvoice.next_run_date <= now,
    ).all()

    generated = 0
    for item in due_items:
        # Check end date
        if item.end_date and now > item.end_date:
            item.is_active = False
            continue

        # Generate a unique invoice number
        inv_number = f"REC-{item.id}-{item.times_generated + 1:04d}"

        # Create receivable
        receivable = models.Receivable(
            user_id=user_id,
            invoice_number=inv_number,
            customer_id=item.customer_id,
            total_amount=item.amount,
            amount_base=item.amount_base,
            currency=item.currency,
            exchange_rate=item.exchange_rate,
            paid_amount=0.0,
            status=models.ReceivableStatus.DRAFT,
            issue_date=now,
            due_date=now + datetime.timedelta(days=30),
        )
        db.add(receivable)

        # Update recurring schedule
        item.last_run_date = now
        item.times_generated += 1
        item.next_run_date = _advance_next_run(item.frequency, item.next_run_date)

        generated += 1

    db.commit()
    return {"generated": generated, "message": f"{generated} receivable(s) generated from recurring schedules"}
