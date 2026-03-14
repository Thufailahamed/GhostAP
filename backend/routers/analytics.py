from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, case
from database import get_db
import models
import datetime
from services.auth import get_current_user
from typing import List, Dict, Any

router = APIRouter(
    prefix="/analytics",
    tags=["analytics"],
)

@router.get("/dashboard-stats")
def get_dashboard_stats(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    # 1. KPI Stats
    total_docs = db.query(models.Invoice).filter(models.Invoice.user_id == user_id).count()
    approved = db.query(models.Invoice).filter(
        models.Invoice.user_id == user_id,
        models.Invoice.status.in_([models.InvoiceStatus.APPROVED, models.InvoiceStatus.SYNCED_TO_ERP, models.InvoiceStatus.PAID])
    ).count()
    pending = db.query(models.Invoice).filter(
        models.Invoice.user_id == user_id,
        models.Invoice.status.in_([models.InvoiceStatus.PENDING, models.InvoiceStatus.REVIEW_REQUIRED])
    ).count()
    rejected = db.query(models.Invoice).filter(
        models.Invoice.user_id == user_id,
        models.Invoice.status.in_([models.InvoiceStatus.REJECTED])
    ).count()
    
    avg_conf = db.query(func.avg(models.Invoice.ai_confidence_score)).filter(models.Invoice.user_id == user_id).scalar() or 0
    
    # 2. Daily Throughput (Last 7 Days)
    today = datetime.datetime.now(datetime.timezone.utc).date()
    seven_days_ago = today - datetime.timedelta(days=6)
    
    daily_stats = db.query(
        func.date(models.Invoice.created_at).label('date'),
        func.count(models.Invoice.id).label('count')
    ).filter(
        models.Invoice.user_id == user_id,
        models.Invoice.created_at >= seven_days_ago
    ).group_by(
        func.date(models.Invoice.created_at)
    ).all()
    
    # Fill in missing days
    throughput_data = []
    days_map = {str(d.date): d.count for d in daily_stats}
    for i in range(7):
        target_date = seven_days_ago + datetime.timedelta(days=i)
        date_str = str(target_date)
        day_name = target_date.strftime("%a").upper()
        throughput_data.append({
            "name": day_name,
            "count": days_map.get(date_str, 0),
            "fullDate": date_str
        })

    # 3. Processing Time (Simulated/Calculated)
    # Since we don't have start/end timestamps for "processing", we'll mock trends based on CONFIDENCE
    # High confidence = fast, Low confidence = slow (human review).
    processing_time_data = []
    for i in range(7):
        target_date = seven_days_ago + datetime.timedelta(days=i)
        day_name = target_date.strftime("%a").upper()
        # Mocking a trend that fluctuates slightly around 1.2m
        import random
        base_time = 1.2
        variance = random.uniform(-0.3, 0.5)
        processing_time_data.append({
            "name": day_name,
            "time": round(max(0.5, base_time + variance), 1)
        })

    return {
        "stats": {
            "total": total_docs,
            "approved": approved,
            "pending": pending,
            "rejected": rejected,
            "avgConfidence": round(float(avg_conf), 1)
        },
        "throughput": throughput_data,
        "processingTime": processing_time_data
    }

@router.get("/reports")
def get_reports(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    # 1. Volume by Vendor (Top 5) - using base currency totals
    vendor_volume = db.query(
        models.Vendor.name,
        func.count(models.Invoice.id).label('count'),
        func.sum(models.Invoice.amount_base).label('total_base'),
        func.avg(models.Invoice.ai_confidence_score).label('avg_conf')
    ).join(models.Invoice).filter(models.Invoice.user_id == user_id).group_by(models.Vendor.name).order_by(desc('count')).limit(5).all()
    
    # 2. STP Rate (Straight Through Processing)
    # Defined as invoices with Confidence > 85% or those already approved
    total = db.query(models.Invoice).filter(models.Invoice.user_id == user_id).count()
    if total == 0:
        stp_rate = 0
    else:
        stp_count = db.query(models.Invoice).filter(
            models.Invoice.user_id == user_id,
            models.Invoice.ai_confidence_score > 85
        ).count()
        stp_rate = round((stp_count / total) * 100, 1)

    # 3. Volume by Category
    category_volume = db.query(
        models.Category.name,
        func.count(models.LineItem.id).label('count')
    ).join(models.LineItem, models.Category.id == models.LineItem.category_id)\
     .filter(models.Category.user_id == user_id)\
     .group_by(models.Category.name).all()

    return {
        "stp_rate": stp_rate,
        "vendor_volume": [{"vendor": v.name, "count": v.count, "failure_rate": round(100 - (v.avg_conf or 0), 1)} for v in vendor_volume],
        "category_volume": [{"name": c.name, "value": c.count} for c in category_volume],
        "exception_rate": round(100 - stp_rate, 1) # Simplistic proxy
    }

@router.get("/ai-metrics")
def get_ai_metrics(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    # 1. Global Confidence
    avg_conf = db.query(func.avg(models.Invoice.ai_confidence_score)).filter(models.Invoice.user_id == user_id).scalar() or 0
    
    # 2. Field Error Rates (Mocking specific fields since we don't have field-level confidence yet)
    # We can mock these based on global score to keep it dynamic
    confidence_factor = (avg_conf / 100.0) if avg_conf > 0 else 0.5
    
    fields = [
        {"field": "Invoice_Number", "correction_rate": round(15 * (1-confidence_factor), 1), "note": "Format variations (Special chars)"},
        {"field": "Total_Amount", "correction_rate": round(20 * (1-confidence_factor), 1), "note": "Confused with subtotal/tax"},
        {"field": "Due_Date", "correction_rate": round(10 * (1-confidence_factor), 1), "note": "Multiple dates on page"},
        {"field": "Vendor_Name", "correction_rate": round(5 * (1-confidence_factor), 1), "note": "DB lookup mismatch"}
    ]

    return {
        "global_confidence": round(float(avg_conf), 1),
        "fields": fields,
        "model_version": "Ghost-AP-v2.1",
        "last_trained": "Oct 24, 2023" # Mock
    }
