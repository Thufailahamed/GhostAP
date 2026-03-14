from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional
import datetime
import models
from database import SessionLocal

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# --- Pydantic Schemas ---

class SubscriptionCreate(BaseModel):
    name: str
    vendor_id: Optional[int] = None
    category: str = "General"
    cost: float
    currency: Optional[str] = "USD"
    billing_cycle: str = "MONTHLY"
    next_billing_date: str
    start_date: Optional[str] = None
    status: str = "ACTIVE"
    notes: Optional[str] = None


class SubscriptionUpdate(BaseModel):
    name: Optional[str] = None
    vendor_id: Optional[int] = None
    category: Optional[str] = None
    cost: Optional[float] = None
    currency: Optional[str] = None
    billing_cycle: Optional[str] = None
    next_billing_date: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


# --- Helper ---

def _get_user_id(db: Session) -> str:
    """Get current user. In production, this comes from auth middleware."""
    inv = db.query(models.Invoice).first()
    if inv:
        return inv.user_id
    rec = db.query(models.Receivable).first()
    if rec:
        return rec.user_id
    return "test_user"


def _parse_date(date_str: str) -> datetime.datetime:
    return datetime.datetime.fromisoformat(date_str).replace(tzinfo=datetime.timezone.utc)


# --- Endpoints ---

@router.get("/")
def list_subscriptions(db: Session = Depends(get_db)):
    user_id = _get_user_id(db)
    subs = db.query(models.Subscription).filter(
        models.Subscription.user_id == user_id
    ).order_by(models.Subscription.next_billing_date.asc()).all()

    results = []
    for s in subs:
        vendor = db.query(models.Vendor).filter(models.Vendor.id == s.vendor_id).first() if s.vendor_id else None
        results.append({
            "id": s.id,
            "name": s.name,
            "vendor_name": vendor.name if vendor else None,
            "category": s.category,
            "cost": s.cost,
            "billing_cycle": s.billing_cycle.value if s.billing_cycle else "MONTHLY",
            "next_billing_date": s.next_billing_date.strftime("%Y-%m-%d") if s.next_billing_date else None,
            "start_date": s.start_date.strftime("%Y-%m-%d") if s.start_date else None,
            "end_date": s.end_date.strftime("%Y-%m-%d") if s.end_date else None,
            "status": s.status.value if s.status else "ACTIVE",
            "notes": s.notes,
        })
    return results


@router.post("/")
def create_subscription(data: SubscriptionCreate, db: Session = Depends(get_db)):
    user_id = _get_user_id(db)
    from services.currency_service import CurrencyService
    base_currency = CurrencyService.get_base_currency(db, user_id)
    rate = CurrencyService.get_exchange_rate(db, user_id, data.currency or "USD", base_currency)

    sub = models.Subscription(
        user_id=user_id,
        name=data.name,
        vendor_id=data.vendor_id,
        category=data.category,
        cost=data.cost,
        amount_base=data.cost * rate,
        currency=data.currency or "USD",
        exchange_rate=rate,
        billing_cycle=models.BillingCycle(data.billing_cycle),
        next_billing_date=_parse_date(data.next_billing_date),
        start_date=_parse_date(data.start_date) if data.start_date else datetime.datetime.now(datetime.timezone.utc),
        status=models.SubscriptionStatus(data.status),
        notes=data.notes,
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return {"id": sub.id, "message": "Subscription created"}


@router.put("/{sub_id}")
def update_subscription(sub_id: int, data: SubscriptionUpdate, db: Session = Depends(get_db)):
    user_id = _get_user_id(db)
    sub = db.query(models.Subscription).filter(
        models.Subscription.id == sub_id,
        models.Subscription.user_id == user_id
    ).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")

    if data.name is not None:
        sub.name = data.name
    if data.vendor_id is not None:
        sub.vendor_id = data.vendor_id
    if data.category is not None:
        sub.category = data.category
    if data.cost is not None:
        sub.cost = data.cost
        from services.currency_service import CurrencyService
        sub.amount_base = sub.cost * CurrencyService.get_exchange_rate(db, user_id, sub.currency, CurrencyService.get_base_currency(db, user_id))
    if data.currency is not None:
        sub.currency = data.currency
        from services.currency_service import CurrencyService
        sub.exchange_rate = CurrencyService.get_exchange_rate(db, user_id, sub.currency, CurrencyService.get_base_currency(db, user_id))
        sub.amount_base = sub.cost * sub.exchange_rate
    if data.billing_cycle is not None:
        sub.billing_cycle = models.BillingCycle(data.billing_cycle)
    if data.next_billing_date is not None:
        sub.next_billing_date = _parse_date(data.next_billing_date)
    if data.status is not None:
        sub.status = models.SubscriptionStatus(data.status)
    if data.notes is not None:
        sub.notes = data.notes

    db.commit()
    return {"message": "Subscription updated"}


@router.delete("/{sub_id}")
def delete_subscription(sub_id: int, db: Session = Depends(get_db)):
    user_id = _get_user_id(db)
    sub = db.query(models.Subscription).filter(
        models.Subscription.id == sub_id,
        models.Subscription.user_id == user_id
    ).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    db.delete(sub)
    db.commit()
    return {"message": "Subscription deleted"}


@router.post("/{sub_id}/cancel")
def cancel_subscription(sub_id: int, db: Session = Depends(get_db)):
    user_id = _get_user_id(db)
    sub = db.query(models.Subscription).filter(
        models.Subscription.id == sub_id,
        models.Subscription.user_id == user_id
    ).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    sub.status = models.SubscriptionStatus.CANCELLED
    sub.end_date = datetime.datetime.now(datetime.timezone.utc)
    db.commit()
    return {"message": "Subscription cancelled"}


@router.post("/{sub_id}/pause")
def toggle_pause_subscription(sub_id: int, db: Session = Depends(get_db)):
    user_id = _get_user_id(db)
    sub = db.query(models.Subscription).filter(
        models.Subscription.id == sub_id,
        models.Subscription.user_id == user_id
    ).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")

    if sub.status == models.SubscriptionStatus.PAUSED:
        sub.status = models.SubscriptionStatus.ACTIVE
    else:
        sub.status = models.SubscriptionStatus.PAUSED
    db.commit()
    return {"message": f"Subscription {'resumed' if sub.status == models.SubscriptionStatus.ACTIVE else 'paused'}"}


@router.get("/analytics")
def subscription_analytics(db: Session = Depends(get_db)):
    user_id = _get_user_id(db)
    now = datetime.datetime.now(datetime.timezone.utc)

    subs = db.query(models.Subscription).filter(
        models.Subscription.user_id == user_id
    ).all()

    active_subs = [s for s in subs if s.status == models.SubscriptionStatus.ACTIVE]

    # Monthly cost normalization (Using base currency amounts)
    def monthly_cost(s):
        val = s.amount_base or 0.0
        if s.billing_cycle == models.BillingCycle.MONTHLY:
            return val
        elif s.billing_cycle == models.BillingCycle.QUARTERLY:
            return val / 3
        elif s.billing_cycle == models.BillingCycle.ANNUALLY:
            return val / 12
        return val

    total_monthly = sum(monthly_cost(s) for s in active_subs)
    annual_run_rate = total_monthly * 12

    # Upcoming renewals (next 7 days)
    seven_days = now + datetime.timedelta(days=7)
    upcoming_renewals = len([
        s for s in active_subs
        if s.next_billing_date and s.next_billing_date <= seven_days
    ])

    # Spend by category
    category_spend = {}
    for s in active_subs:
        cat = s.category or "General"
        category_spend[cat] = category_spend.get(cat, 0) + monthly_cost(s)
    
    category_breakdown = [
        {"category": k, "monthly_spend": round(v, 2)}
        for k, v in sorted(category_spend.items(), key=lambda x: -x[1])
    ]

    return {
        "total_monthly_spend": round(total_monthly, 2),
        "annual_run_rate": round(annual_run_rate, 2),
        "active_count": len(active_subs),
        "total_count": len(subs),
        "upcoming_renewals": upcoming_renewals,
        "category_breakdown": category_breakdown,
    }
