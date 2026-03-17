"""AI-powered Cash Flow Forecast using Gemini and historical data."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
import models
import datetime
import os
import json
from services.auth import get_current_user
from typing import Optional

router = APIRouter(
    prefix="/cashflow",
    tags=["Cash Flow Forecast"],
)


@router.get("/forecast")
def get_cashflow_forecast(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["sub"]
    now = datetime.datetime.now(datetime.timezone.utc)

    # Get user's base currency
    settings = db.query(models.CompanySettings).filter(models.CompanySettings.user_id == user_id).first()
    base_currency = settings.base_currency if settings else "USD"

    # Optimized Helper: Batch calculate customer reliability if possible
    # For now, let's at least optimize the individual call with a join
    def _get_customer_reliability(cid: int) -> float:
        # Get last 5 paid receivables with their latest payment in one join
        past_data = db.query(
            models.Receivable, 
            func.max(models.PaymentReceived.date).label("last_pay_date")
        ).join(
            models.PaymentReceived, models.Receivable.id == models.PaymentReceived.receivable_id
        ).filter(
            models.Receivable.customer_id == cid,
            models.Receivable.status == models.ReceivableStatus.PAID
        ).group_by(models.Receivable.id).order_by(models.Receivable.due_date.desc()).limit(5).all()
        
        if not past_data:
            return 0.85
        
        scores = []
        for rec, last_pay_date in past_data:
            effective_due = rec.due_date or rec.issue_date
            if not effective_due or not last_pay_date:
                scores.append(1.0)
                continue
            
            days_late = (last_pay_date - effective_due).days
            if days_late <= 0: scores.append(1.0)
            elif days_late <= 7: scores.append(0.9)
            elif days_late <= 30: scores.append(0.7)
            else: scores.append(0.4)
        
        return round(sum(scores) / len(scores), 2)

    # Helper: Calculate Working Capital Metrics
    def _get_working_capital_metrics():
        # 1. DSO Calculation (Days Sales Outstanding)
        # Based on PaymentReceived vs Receivable.issue_date for last 6 months
        six_months_ago = now - datetime.timedelta(days=180)
        recent_payments = db.query(models.PaymentReceived, models.Receivable).join(
            models.Receivable, models.PaymentReceived.receivable_id == models.Receivable.id
        ).filter(
            models.PaymentReceived.user_id == user_id,
            models.PaymentReceived.date >= six_months_ago
        ).all()

        dso_days = []
        for pay, rec in recent_payments:
            if rec.issue_date:
                days = (pay.date - rec.issue_date).days
                dso_days.append(max(0, days))
        
        current_dso = round(sum(dso_days) / len(dso_days), 1) if dso_days else 30.0

        # DSO Trend (Last 30 days vs 30-60 days ago)
        thirty_days_ago = now - datetime.timedelta(days=30)
        sixty_days_ago = now - datetime.timedelta(days=60)
        
        dso_30 = [max(0, (p.date - r.issue_date).days) for p, r in recent_payments if p.date >= thirty_days_ago and r.issue_date]
        dso_60 = [max(0, (p.date - r.issue_date).days) for p, r in recent_payments if sixty_days_ago <= p.date < thirty_days_ago and r.issue_date]
        
        avg_30 = sum(dso_30) / len(dso_30) if dso_30 else current_dso
        avg_60 = sum(dso_60) / len(dso_60) if dso_60 else current_dso
        dso_trend = "improving" if avg_30 < avg_60 else "worsening" if avg_30 > avg_60 else "stable"

        # 2. DPO Calculation (Days Payable Outstanding)
        # Based on BankTransaction (PAY- ref) vs Invoice.issue_date
        recent_ap_txns = db.query(models.BankTransaction).filter(
            models.BankTransaction.user_id == user_id,
            models.BankTransaction.type == "OUTGOING",
            models.BankTransaction.reference.like("PAY-%"),
            models.BankTransaction.date >= six_months_ago
        ).all()

        dpo_days = []
        for txn in recent_ap_txns:
            # Try to find the invoice by invoice_number extracted from reference
            # reference is like "PAY-INV-123"
            inv_num = txn.reference.replace("PAY-", "")
            inv = db.query(models.Invoice).filter(
                models.Invoice.user_id == user_id,
                models.Invoice.invoice_number == inv_num
            ).first()
            if inv and inv.issue_date:
                days = (txn.date - inv.issue_date).days
                dpo_days.append(max(0, days))
        
        current_dpo = round(sum(dpo_days) / len(dpo_days), 1) if dpo_days else 28.0

        dpo_30 = []
        dpo_60 = []
        for txn in recent_ap_txns:
            inv_num = txn.reference.replace("PAY-", "")
            inv = db.query(models.Invoice).filter(models.Invoice.user_id == user_id, models.Invoice.invoice_number == inv_num).first()
            if inv and inv.issue_date:
                val = max(0, (txn.date - inv.issue_date).days)
                if txn.date >= thirty_days_ago: dpo_30.append(val)
                elif sixty_days_ago <= txn.date < thirty_days_ago: dpo_60.append(val)

        avg_p30 = sum(dpo_30) / len(dpo_30) if dpo_30 else current_dpo
        avg_p60 = sum(dpo_60) / len(dpo_60) if dpo_60 else current_dpo
        # For DPO, increasing is usually "improving" for cash flow (paying later)
        dpo_trend = "improving" if avg_p30 > avg_p60 else "worsening" if avg_p30 < avg_p60 else "stable"

        # 3. CCC (Cash Conversion Cycle)
        # Simplified: DSO - DPO (In a full model it would be DIO + DSO - DPO)
        current_ccc = round(current_dso - current_dpo, 1)
        prev_ccc = round(avg_60 - avg_p60, 1)
        ccc_trend = "improving" if current_ccc < prev_ccc else "worsening" if current_ccc > prev_ccc else "stable"

        return {
            "dso": current_dso,
            "dpo": current_dpo,
            "ccc": current_ccc,
            "dso_trend": dso_trend,
            "dpo_trend": dpo_trend,
            "ccc_trend": ccc_trend,
            "avg_30_dso": round(avg_30, 1),
            "avg_30_dpo": round(avg_p30, 1)
        }

    wc_metrics = _get_working_capital_metrics()

    # 1. Bank Balance (sum of all bank account transactions - using amount_base)
    total_incoming = db.query(func.coalesce(func.sum(models.BankTransaction.amount_base), 0)).filter(
        models.BankTransaction.user_id == user_id,
        models.BankTransaction.amount_base > 0
    ).scalar() or 0

    total_outgoing = db.query(func.coalesce(func.sum(models.BankTransaction.amount_base), 0)).filter(
        models.BankTransaction.user_id == user_id,
        models.BankTransaction.amount_base < 0
    ).scalar() or 0

    bank_balance = float(total_incoming) + float(total_outgoing)  # outgoing is negative

    # 1.1 Ledger Balance (Sum of all 'Asset' accounts typically used for cash)
    ledger_balance = db.query(
        func.coalesce(func.sum(models.JournalLine.debit - models.JournalLine.credit), 0)
    ).join(
        models.Category, models.JournalLine.account_id == models.Category.id
    ).filter(
        models.JournalLine.user_id == user_id,
        models.Category.type == models.CategoryType.ASSET,
        models.Category.name.ilike("%cash%")
    ).scalar() or 0.0

    # Primary dashboard balance will now be the Ledger Balance for consistency with CoA
    current_balance = float(ledger_balance)

    # 1.5. 30-Day Variance & Sparkline
    thirty_days_ago = now - datetime.timedelta(days=30)
    inflows_since_30d = db.query(func.coalesce(func.sum(models.BankTransaction.amount_base), 0)).filter(
        models.BankTransaction.user_id == user_id,
        models.BankTransaction.amount_base > 0,
        models.BankTransaction.date >= thirty_days_ago
    ).scalar() or 0
    outflows_since_30d = db.query(func.coalesce(func.sum(models.BankTransaction.amount_base), 0)).filter(
        models.BankTransaction.user_id == user_id,
        models.BankTransaction.amount_base < 0,
        models.BankTransaction.date >= thirty_days_ago
    ).scalar() or 0
    
    balance_30d_ago = current_balance - (float(inflows_since_30d) + float(outflows_since_30d))
    variance_amount = current_balance - balance_30d_ago
    variance_pct = (variance_amount / balance_30d_ago * 100) if balance_30d_ago != 0 else 0

    daily_changes = db.query(
        func.date(models.BankTransaction.date).label("day"),
        func.sum(models.BankTransaction.amount_base).label("net")
    ).filter(
        models.BankTransaction.user_id == user_id,
        models.BankTransaction.date >= thirty_days_ago
    ).group_by(func.date(models.BankTransaction.date)).all()
    
    change_map = {str(d.day): float(d.net) for d in daily_changes}
    sparkline_data = []
    running_bal = balance_30d_ago
    for i in range(31):
        d = (thirty_days_ago + datetime.timedelta(days=i)).date()
        running_bal += change_map.get(str(d), 0)
        sparkline_data.append(round(running_bal, 2))

    # 2. Upcoming Payables (approved but unpaid invoices)
    payables = db.query(models.Invoice).filter(
        models.Invoice.user_id == user_id,
        models.Invoice.status.in_([
            models.InvoiceStatus.APPROVED,
            models.InvoiceStatus.SYNCED_TO_ERP,
            models.InvoiceStatus.PARTIAL,
            models.InvoiceStatus.REVIEW_REQUIRED,
        ])
    ).all()

    upcoming_payables = []
    total_payables_30d = 0
    total_payables_60d = 0
    total_payables_90d = 0
    for p in payables:
        # remaining is in document currency
        remaining = (p.total_amount or 0) - (p.paid_amount or 0)
        if remaining <= 0:
            continue
        
        # Convert remaining to base currency
        remaining_base = remaining * (p.exchange_rate or 1.0)
        due = p.due_date
        if isinstance(due, str):
            try:
                due = datetime.datetime.fromisoformat(due).replace(tzinfo=datetime.timezone.utc)
            except (ValueError, TypeError):
                due = now + datetime.timedelta(days=30)  # Default to 30 days
        elif due is None:
            due = now + datetime.timedelta(days=30)

        days_until = (due - now).days if due else 30
        vendor = db.query(models.Vendor).filter(models.Vendor.id == p.vendor_id).first()
        upcoming_payables.append({
            "id": p.id,
            "vendor_id": p.vendor_id,
            "vendor": vendor.name if vendor else "Unknown",
            "invoice_number": p.invoice_number or "N/A",
            "amount": round(remaining_base, 2), # Use base currency for forecast
            "due_date": due.strftime("%Y-%m-%d") if due else "N/A",
            "days_until": max(0, days_until),
            "type": "payable",
        })
        if days_until <= 30:
            total_payables_30d += remaining_base
        if days_until <= 60:
            total_payables_60d += remaining_base
        if days_until <= 90:
            total_payables_90d += remaining_base

    # 3. Upcoming Receivables (outstanding AR)
    receivables = db.query(models.Receivable).filter(
        models.Receivable.user_id == user_id,
        models.Receivable.status.in_([
            models.ReceivableStatus.SENT,
            models.ReceivableStatus.PARTIAL,
            models.ReceivableStatus.OVERDUE,
        ])
    ).all()

    upcoming_receivables = []
    total_receivables_30d = 0
    total_receivables_60d = 0
    total_receivables_90d = 0
    for r in receivables:
        remaining = (r.total_amount or 0) - (r.paid_amount or 0)
        if remaining <= 0:
            continue
        
        # Convert to base currency
        remaining_base = remaining * (r.exchange_rate or 1.0)
        due = r.due_date
        if due is None:
            due = now + datetime.timedelta(days=30)
        days_until = (due - now).days if due else 30

        customer = db.query(models.Customer).filter(models.Customer.id == r.customer_id).first()
        reliability = _get_customer_reliability(r.customer_id)
        expected_amount_base = remaining_base * reliability

        upcoming_receivables.append({
            "id": r.id,
            "customer_id": r.customer_id,
            "customer": customer.name if customer else "Unknown",
            "invoice_number": r.invoice_number or "N/A",
            "amount": round(remaining_base, 2),
            "expected_amount": round(expected_amount_base, 2),
            "probability": int(reliability * 100),
            "due_date": due.strftime("%Y-%m-%d") if due else "N/A",
            "days_until": max(0, days_until),
            "type": "receivable",
        })
        if days_until <= 30:
            total_receivables_30d += expected_amount_base
        if days_until <= 60:
            total_receivables_60d += expected_amount_base
        if days_until <= 90:
            total_receivables_90d += expected_amount_base

    # 4. Recurring obligations
    recurring_items = db.query(models.RecurringInvoice).filter(
        models.RecurringInvoice.user_id == user_id,
        models.RecurringInvoice.is_active == True,
    ).all()

    recurring_monthly = sum(
        (item.amount_base or (item.amount * (item.exchange_rate or 1.0))) * (4 if item.frequency == models.RecurringFrequency.WEEKLY else
                       1 if item.frequency == models.RecurringFrequency.MONTHLY else
                       1/3 if item.frequency == models.RecurringFrequency.QUARTERLY else
                       1/12)
        for item in recurring_items
    )

    # 4b. Active Subscriptions (vendor SaaS/service costs)
    active_subs = db.query(models.Subscription).filter(
        models.Subscription.user_id == user_id,
        models.Subscription.status == models.SubscriptionStatus.ACTIVE,
    ).all()

    def _sub_monthly(s):
        cost_base = s.amount_base or (s.cost * (s.exchange_rate or 1.0))
        if s.billing_cycle == models.BillingCycle.MONTHLY:
            return cost_base
        elif s.billing_cycle == models.BillingCycle.QUARTERLY:
            return cost_base / 3
        elif s.billing_cycle == models.BillingCycle.ANNUALLY:
            return cost_base / 12
        return cost_base

    subscription_monthly = sum(_sub_monthly(s) for s in active_subs)

    # Compute subscription costs per forecast window
    sub_cost_30d = subscription_monthly  # ~1 month
    sub_cost_60d = subscription_monthly * 2  # ~2 months
    sub_cost_90d = subscription_monthly * 3  # ~3 months

    # 5. Calculate forecasts
    # Recurring (Revenue) = Inflow
    rec_1mo = recurring_monthly
    rec_2mo = recurring_monthly * 2
    rec_3mo = recurring_monthly * 3

    # Subscriptions (Cost) = Outflow
    sub_1mo = subscription_monthly
    sub_2mo = subscription_monthly * 2
    sub_3mo = subscription_monthly * 3

    forecast_30d = {
        "projected_balance": round(current_balance + total_receivables_30d - total_payables_30d + rec_1mo - sub_1mo, 2),
        "inflows": round(total_receivables_30d + rec_1mo, 2),
        "outflows": round(total_payables_30d + sub_1mo, 2),
    }
    forecast_60d = {
        "projected_balance": round(current_balance + total_receivables_60d - total_payables_60d + rec_2mo - sub_2mo, 2),
        "inflows": round(total_receivables_60d + rec_2mo, 2),
        "outflows": round(total_payables_60d + sub_2mo, 2),
    }
    forecast_90d = {
        "projected_balance": round(current_balance + total_receivables_90d - total_payables_90d + rec_3mo - sub_3mo, 2),
        "inflows": round(total_receivables_90d + rec_3mo, 2),
        "outflows": round(total_payables_90d + sub_3mo, 2),
    }

    # Calculate range
    days_range = 90
    if end_date:
        try:
            clean_end = end_date.replace('Z', '+00:00')
            target_end = datetime.datetime.fromisoformat(clean_end)
            if target_end.tzinfo is None:
                target_end = target_end.replace(tzinfo=datetime.timezone.utc)
            days_range = (target_end - now).days
            days_range = max(1, min(days_range, 365))
        except:
            pass

    # 6. Generate chart data (daily projected balance)
    chart_data = []
    running_balance = current_balance

    # Calculate AR Aging risk early for confidence scoring
    total_outstanding_ar = sum(item["amount"] for item in upcoming_receivables)
    overdue_ar = sum(item["amount"] for item in upcoming_receivables if item["days_until"] == 0)
    ar_aging_risk_pct = round((overdue_ar / total_outstanding_ar * 100), 1) if total_outstanding_ar > 0 else 0.0
    
    # Base confidence score (100% drops as AR aging increases)
    confidence_score = max(50.0, 100.0 - (ar_aging_risk_pct * 0.8))

    # Pre-sort obligations by due date
    all_obligations = sorted(
        upcoming_payables + upcoming_receivables,
        key=lambda x: x["days_until"]
    )

    step = max(1, days_range // 30)
    for day_offset in range(0, days_range + 1, step): 
        target_date = now + datetime.timedelta(days=day_offset)
        day_inflows = sum(
            item["expected_amount"] for item in all_obligations
            if item["type"] == "receivable" and item["days_until"] <= day_offset
        )
        day_outflows = sum(
            item["amount"] for item in all_obligations
            if item["type"] == "payable" and item["days_until"] <= day_offset
        )
        # Also sum raw inflow for chart if needed, but projected balance uses expected_amount
        raw_day_inflows = sum(
            item["amount"] for item in all_obligations
            if item["type"] == "receivable" and item["days_until"] <= day_offset
        )

        # Add prorated daily fixed revenue/costs
        rec_daily = (recurring_monthly / 30) * day_offset
        sub_daily = (subscription_monthly / 30) * day_offset
        
        projected = current_balance + day_inflows - day_outflows + rec_daily - sub_daily
        
        # Calculate statistical bounds (variance increases further out in time)
        # Variance is based on how much AR is outstanding, scaled by time offset
        variance_factor = (day_offset / 90.0) * ((100.0 - confidence_score) / 100.0) * 0.5 
        uncertainty_amt = day_inflows * variance_factor
        
        best_case = projected + uncertainty_amt
        worst_case = projected - uncertainty_amt
        
        chart_data.append({
            "date": target_date.strftime("%Y-%m-%d"),
            "balance": round(projected, 2),
            "best_case": round(best_case, 2),
            "worst_case": round(worst_case, 2),
            "type": "actual" if day_offset == 0 else "projected",
            "inflows": round(day_inflows + rec_daily, 2),
            "raw_inflows": round(raw_day_inflows + rec_daily, 2),
            "outflows": round(day_outflows + sub_daily, 2),
            "net_change": round((day_inflows + rec_daily) - (day_outflows + sub_daily), 2)
        })

    # 7. MANUAL COMPUTED ANALYTICS (no AI needed)
    thirty_days_ago = now - datetime.timedelta(days=30)
    sixty_days_ago = now - datetime.timedelta(days=60)

    # 7a. Historical Burn Rate (last 30 days of actual outflows - using amount_base)
    recent_outflows = db.query(func.coalesce(func.sum(models.BankTransaction.amount_base), 0)).filter(
        models.BankTransaction.user_id == user_id,
        models.BankTransaction.amount_base < 0,
        models.BankTransaction.date >= thirty_days_ago
    ).scalar() or 0
    monthly_burn_rate = abs(float(recent_outflows))

    # 7b. Historical Burn Rate (previous 30 days, for trend - using amount_base)
    prev_outflows = db.query(func.coalesce(func.sum(models.BankTransaction.amount_base), 0)).filter(
        models.BankTransaction.user_id == user_id,
        models.BankTransaction.amount_base < 0,
        models.BankTransaction.date >= sixty_days_ago,
        models.BankTransaction.date < thirty_days_ago
    ).scalar() or 0
    prev_burn_rate = abs(float(prev_outflows))

    # 7c. Burn Rate Trend (% change month over month)
    if prev_burn_rate > 0:
        burn_trend_pct = round(((monthly_burn_rate - prev_burn_rate) / prev_burn_rate) * 100, 1)
    else:
        burn_trend_pct = 0.0
    burn_trend_direction = "increasing" if burn_trend_pct > 5 else "decreasing" if burn_trend_pct < -5 else "stable"

    # 7d. Zero-Revenue Runway
    runway_months = round(current_balance / monthly_burn_rate, 1) if monthly_burn_rate > 0 else 999.9

    # 7e. AR Aging Analysis (already calculated above)
    # total_outstanding_ar and overdue_ar calculated for confidence score

    # 7f. Net Cash Flow per period (inflows - outflows, including fixed revenue/costs)
    net_30d = round(total_receivables_30d - total_payables_30d + rec_1mo - sub_1mo, 2)
    net_60d = round(total_receivables_60d - total_payables_60d + rec_2mo - sub_2mo, 2)
    net_90d = round(total_receivables_90d - total_payables_90d + rec_3mo - sub_3mo, 2)

    # 7g. Working Capital Ratio (AR / AP) — above 1.0 is healthy
    total_outstanding_ap = sum(item["amount"] for item in upcoming_payables)
    working_capital_ratio = round(total_outstanding_ar / total_outstanding_ap, 2) if total_outstanding_ap > 0 else 999.0

    # 7h. Fixed Cost Coverage Ratio (current balance / monthly fixed costs)
    total_fixed_monthly_cost = subscription_monthly # only subscriptions are fixed costs
    coverage_months = round(current_balance / total_fixed_monthly_cost, 1) if total_fixed_monthly_cost > 0 else 999.9

    # 7i. Customer Concentration Risk (% of AR from top customer)
    customer_totals = {}
    for item in upcoming_receivables:
        c = item.get("customer", "Unknown")
        customer_totals[c] = customer_totals.get(c, 0) + item["amount"]
    
    top_customer_pct = 0.0
    top_customer_name = "N/A"
    customer_concentration = []
    
    if customer_totals and total_outstanding_ar > 0:
        for name, amt in sorted(customer_totals.items(), key=lambda x: x[1], reverse=True):
            pct = round((amt / total_outstanding_ar) * 100, 1)
            customer_concentration.append({"name": name, "amount": amt, "percentage": pct})
            
        top_customer_name = customer_concentration[0]["name"]
        top_customer_pct = customer_concentration[0]["percentage"]

    # 7j. Category Breakdown (Last 30 days Outflows)
    category_breakdown = []
    # Join JournalEntry -> JournalLine -> Category for EXPENSE types
    raw_cat_outflows = db.query(
        models.Category.name,
        func.sum(models.JournalLine.debit - models.JournalLine.credit).label('amount')
    ).join(models.JournalLine).join(models.JournalEntry).filter(
        models.Category.user_id == user_id,
        models.Category.type == models.CategoryType.EXPENSE,
        models.JournalEntry.date >= thirty_days_ago
    ).group_by(models.Category.name).all()
    
    total_cat_outflow = sum(float(r[1] or 0) for r in raw_cat_outflows)
    if total_cat_outflow > 0:
        for name, amount in raw_cat_outflows:
            pct = round((float(amount or 0) / total_cat_outflow) * 100, 1)
            if pct > 0:
                category_breakdown.append({"label": name, "amount": round(float(amount or 0), 2), "percentage": pct})
    else:
        # Fallback to simple vendor grouping if no journal entries exist
        category_breakdown.append({"label": "Operating Expenses", "amount": monthly_burn_rate, "percentage": 100.0})

    # 7k. Historical Inflow Concentration (Last 30 days - using amount_base)
    # Group BankTransactions by reference if positive
    inflow_groups = {}
    recent_inflows = db.query(models.BankTransaction).filter(
        models.BankTransaction.user_id == user_id,
        models.BankTransaction.amount_base > 0,
        models.BankTransaction.date >= thirty_days_ago
    ).all()
    total_actual_inflows = sum(t.amount_base for t in recent_inflows)
    for t in recent_inflows:
        ref = t.reference or "General Receipts"
        inflow_groups[ref] = inflow_groups.get(ref, 0) + t.amount_base
    
    hist_top_inflow_name = "N/A"
    hist_top_inflow_pct = 0.0
    actual_inflow_concentration = []
    
    if inflow_groups and total_actual_inflows > 0:
        for name, amt in sorted(inflow_groups.items(), key=lambda x: x[1], reverse=True):
            pct = round((amt / total_actual_inflows) * 100, 1)
            actual_inflow_concentration.append({"name": name, "amount": amt, "percentage": pct})
            
        hist_top_inflow_name = actual_inflow_concentration[0]["name"]
        hist_top_inflow_pct = actual_inflow_concentration[0]["percentage"]

    # 7l. Vendor Trend (Last 30 days vs prev 30 days)
    # Reusing monthly_burn_rate and prev_burn_rate as proxy for "Vendor Payments"
    vendor_trend_pct = burn_trend_pct
    vendor_trend_direction = burn_trend_direction

    # 7m. Cash Flow Health Score (0-100, computed deterministically)
    health_score = 100
    # Runway penalty
    if runway_months < 2:
        health_score -= 40
    elif runway_months < 4:
        health_score -= 20
    elif runway_months < 6:
        health_score -= 10
    # AR aging penalty
    if ar_aging_risk_pct > 30:
        health_score -= 20
    elif ar_aging_risk_pct > 15:
        health_score -= 10
    # Negative net cash flow penalty
    if net_30d < 0:
        health_score -= 15
    # Burn trend penalty
    if burn_trend_pct > 20:
        health_score -= 10
    # Low working capital ratio
    if working_capital_ratio < 1.0:
        health_score -= 10
    # Customer concentration penalty
    if top_customer_pct > 60:
        health_score -= 5
    health_score = max(0, min(100, health_score))

    # 7k. Deterministic Risk Flags (computed, not AI)
    risk_flags = []
    if runway_months < 3:
        risk_flags.append({"severity": "CRITICAL", "message": f"Cash runway is only {runway_months} months at current burn rate"})
    if ar_aging_risk_pct > 20:
        risk_flags.append({"severity": "HIGH", "message": f"{ar_aging_risk_pct}% of outstanding AR is overdue"})
    if net_30d < 0:
        risk_flags.append({"severity": "WARNING", "message": f"Negative net cash flow expected in next 30 days"})
    if burn_trend_pct > 20:
        risk_flags.append({"severity": "WARNING", "message": f"Burn rate increased {burn_trend_pct}% vs prior month"})
    if working_capital_ratio < 1.0 and total_outstanding_ap > 0:
        risk_flags.append({"severity": "WARNING", "message": f"Working capital ratio {working_capital_ratio}x — you owe more than you're owed"})
    if top_customer_pct > 50:
        risk_flags.append({"severity": "INFO", "message": f"{top_customer_pct}% of AR concentrated in {top_customer_name}"})
    if total_fixed_monthly_cost > 0 and coverage_months < 3:
        risk_flags.append({"severity": "WARNING", "message": f"Fixed costs covered for only {coverage_months} months"})
    if len(risk_flags) == 0:
        risk_flags.append({"severity": "OK", "message": "No significant risks detected. Cash position is healthy."})

    # 7L. Smart Alerts Engine (Actionable specific recommendations)
    smart_alerts = []
    
    # Rule 1: Minimum cash drop warning
    min_chart_day = min(chart_data, key=lambda x: x["balance"]) if chart_data else None
    if min_chart_day and min_chart_day["balance"] < (monthly_burn_rate * 1.5): # Less than 1.5 months runway at lowest point
        smart_alerts.append({
            "type": "critical",
            "message": f"Cash forecasted to drop to {base_currency} {min_chart_day['balance']:,.0f} on {min_chart_day['date']}. Review upcoming payables before this date."
        })
    
    # Rule 2: Large incoming opportunities
    for rec in sorted(upcoming_receivables, key=lambda x: x["amount"], reverse=True):
        if rec["amount"] > 5000 and rec["days_until"] > 15:
            smart_alerts.append({
                "type": "opportunity",
                "message": f"Large receivable of {base_currency} {rec['amount']:,.0f} due from {rec['customer']} in {rec['days_until']} days. Consider offering a 2% early-pay discount to accelerate cash."
            })
            break # Just one alert of this type

    # Rule 3: Large outflow warning
    for pay in sorted(upcoming_payables, key=lambda x: x["amount"], reverse=True):
        if current_balance > 0 and pay["amount"] > (current_balance * 0.3): # Cost > 30% of current liquid cash
            smart_alerts.append({
                "type": "warning",
                "message": f"Large payment of {base_currency} {pay['amount']:,.0f} to {pay['vendor']} due in {pay['days_until']} days. Consider negotiating split payments to preserve liquidity."
            })
            break

    # 7m. Forecast Accuracy "Backtest" (Last 30 days)
    # 1. Total Forecasted Inflows (based on Due Dates) - using amount_base
    forecasted_inflows = db.query(func.coalesce(func.sum(models.Receivable.amount_base), 0)).filter(
        models.Receivable.user_id == user_id,
        models.Receivable.due_date >= thirty_days_ago,
        models.Receivable.due_date < now
    ).scalar() or 0
    forecasted_inflows += (recurring_monthly / 30) * 30 # Full month of recurring revenue
    
    # 2. Total Forecasted Outflows (based on Due Dates) - using amount_base
    forecasted_outflows = db.query(func.coalesce(func.sum(models.Invoice.amount_base), 0)).filter(
        models.Invoice.user_id == user_id,
        models.Invoice.due_date >= thirty_days_ago,
        models.Invoice.due_date < now
    ).scalar() or 0
    forecasted_outflows += (subscription_monthly / 30) * 30 # Full month of subscriptions
    
    # 3. Actual Inflows (already calculated in historical concentration)
    # total_actual_inflows is already available from step 7k
    
    # 4. Actual Outflows (already calculated in historical burn)
    # monthly_burn_rate is already available from step 7a
    
    total_forecasted = float(forecasted_inflows) + float(forecasted_outflows)
    total_actual = float(total_actual_inflows) + float(monthly_burn_rate)
    
    # Calculate Accuracy Score
    if total_actual > 0:
        variance = abs(total_actual - total_forecasted)
        accuracy_score = max(0, min(100, round((1 - (variance / total_actual)) * 100, 1)))
    else:
        accuracy_score = 100.0 # No activity to evaluate
        
    # Variance Drivers
    variance_drivers = []
    inflow_delta = float(total_actual_inflows) - float(forecasted_inflows)
    if abs(inflow_delta) > 500:
        variance_drivers.append({
            "category": "Inflows",
            "impact": "Overestimated" if inflow_delta < 0 else "Underestimated",
            "amount": abs(inflow_delta),
            "message": f"{'Collections' if inflow_delta < 0 else 'Surprise revenue'} was {base_currency} {abs(inflow_delta):,.0f} {'lower' if inflow_delta < 0 else 'higher'} than forecasted."
        })
        
    outflow_delta = float(monthly_burn_rate) - float(forecasted_outflows)
    if abs(outflow_delta) > 500:
        variance_drivers.append({
            "category": "Outflows",
            "impact": "Overestimated" if outflow_delta < 0 else "Underestimated",
            "amount": abs(outflow_delta),
            "message": f"Expenditures were {base_currency} {abs(outflow_delta):,.0f} {'higher' if outflow_delta > 0 else 'lower'} than scheduled."
        })

    analytics = {
        "monthly_burn_rate": round(monthly_burn_rate, 2),
        "prev_burn_rate": round(prev_burn_rate, 2),
        "burn_trend_pct": burn_trend_pct,
        "burn_trend_direction": burn_trend_direction,
        "runway_months": runway_months,
        "total_outstanding_ar": round(total_outstanding_ar, 2),
        "total_outstanding_ap": round(total_outstanding_ap, 2),
        "overdue_ar": round(overdue_ar, 2),
        "ar_aging_risk_pct": ar_aging_risk_pct,
        "net_cash_flow_30d": net_30d,
        "net_cash_flow_60d": net_60d,
        "net_cash_flow_90d": net_90d,
        "working_capital_ratio": working_capital_ratio,
        "fixed_cost_coverage_months": coverage_months,
        "subscription_monthly": round(subscription_monthly, 2),
        "active_subscriptions": len(active_subs),
        "total_fixed_monthly": round(total_fixed_monthly_cost, 2),
        "top_customer_name": top_customer_name,
        "top_customer_pct": top_customer_pct,
        "customer_concentration": customer_concentration,
        "hist_top_inflow_name": hist_top_inflow_name,
        "hist_top_inflow_pct": hist_top_inflow_pct,
        "actual_inflow_concentration": actual_inflow_concentration,
        "category_breakdown": category_breakdown,
        "vendor_trend_pct": vendor_trend_pct,
        "forecast_accuracy": {
            "score": accuracy_score,
            "forecasted_total": round(total_forecasted, 2),
            "actual_total": round(total_actual, 2),
            "drivers": variance_drivers
        },
        "health_score": health_score,
        "risk_flags": risk_flags,
        "working_capital": wc_metrics,
        "recurring_monthly_obligation": round(recurring_monthly, 2),
    }

    # 8. Waterfall Aggregation (30-day window)
    waterfall_data = []
    # 1. Starting
    waterfall_data.append({"label": "Starting Balance", "amount": round(current_balance, 2), "type": "total"})
    
    # 2. Inflows
    customer_groups = {}
    for r in upcoming_receivables:
        if r["days_until"] <= 30:
            name = r["customer"]
            customer_groups[name] = customer_groups.get(name, 0) + r["expected_amount"]
    
    for name, amt in sorted(customer_groups.items(), key=lambda x: x[1], reverse=True):
        waterfall_data.append({"label": f"{name} (Exp)", "amount": round(amt, 2), "type": "inflow"})
    
    if recurring_monthly > 0:
        waterfall_data.append({"label": "Recurring Rev", "amount": round(recurring_monthly, 2), "type": "inflow"})

    # 3. Outflows
    vendor_groups = {}
    for p in upcoming_payables:
        if p["days_until"] <= 30:
            name = p["vendor"]
            vendor_groups[name] = vendor_groups.get(name, 0) + p["amount"]

    for name, amt in sorted(vendor_groups.items(), key=lambda x: x[1], reverse=True):
        waterfall_data.append({"label": f"{name}", "amount": round(-amt, 2), "type": "outflow"})

    if subscription_monthly > 0:
        waterfall_data.append({"label": "Subscriptions", "amount": round(-subscription_monthly, 2), "type": "outflow"})

    # 4. Ending
    ending_bal = forecast_30d["projected_balance"]
    waterfall_data.append({"label": "30d Forecast", "amount": round(ending_bal, 2), "type": "total"})

    # 10. Recent Bank Transactions (Last 10)
    recent_txns = db.query(models.BankTransaction).filter(
        models.BankTransaction.user_id == user_id
    ).order_by(models.BankTransaction.date.desc()).limit(10).all()
    
    recent_transactions = [
        {
            "id": t.id,
            "date": t.date.isoformat(),
            "amount": t.amount_base or t.amount,
            "description": t.reference or "Bank Transaction",
            "type": t.type,
            "reference": t.reference
        } for t in recent_txns
    ]

    return {
        "current_balance": round(current_balance, 2),
        "forecast_30d": forecast_30d,
        "forecast_60d": forecast_60d,
        "forecast_90d": forecast_90d,
        "ai_insights": None, # Moved to /strategic-advice for performance
        "smart_alerts": smart_alerts,
        "confidence_score": round(confidence_score, 1),
        "chart_data": chart_data,
        "waterfall_data": waterfall_data,
        "upcoming_payables": sorted(upcoming_payables, key=lambda x: x["days_until"])[:10],
        "upcoming_receivables": sorted(upcoming_receivables, key=lambda x: x["days_until"])[:10],
        "recurring_monthly_obligation": round(recurring_monthly, 2),
        "subscription_monthly": round(subscription_monthly, 2),
        "variance_amount": round(variance_amount, 2),
        "variance_pct": round(variance_pct, 1),
        "sparkline_data": sparkline_data,
        "analytics": analytics,
        "recent_transactions": recent_transactions,
        "base_currency": base_currency,
        "bank_balance": round(bank_balance, 2),
        "ledger_balance": round(ledger_balance, 2),
        "reconciliation_variance": round(bank_balance - float(ledger_balance), 2)
    }

@router.get("/strategic-advice")
def get_strategic_advice(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Slow AI-based strategic advice in a separate endpoint."""
    user_id = current_user["sub"]
    # We call the forecast logic internally but without the AI part if we can,
    # or just fetch the necessary analytics.
    # To keep it simple, we'll just call get_cashflow_forecast and then the AI.
    data = get_cashflow_forecast(db=db, current_user=current_user)
    return {
        "advice": _generate_strategic_advice(data["analytics"], data["current_balance"], data["forecast_90d"], data["base_currency"])
    }


def _generate_strategic_advice(analytics: dict, current_balance: float, forecast_90d: dict, base_currency: str) -> str:
    """Use Gemini ONLY for strategic business advice. All numbers are pre-computed."""
    try:
        import google.generativeai as genai
        api_key = os.getenv("GEMINI_API_KEY", "")
        if not api_key:
            return "AI strategic advisor unavailable — Gemini API key not configured."

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-2.0-flash")

        # Build a compact summary of pre-computed facts for AI to reason about
        risk_flags = analytics.get("risk_flags", [])
        flags_text = "\n".join(f"  - [{f.get('severity', 'INFO')}] {f.get('message', 'N/A')}" for f in risk_flags)

        prompt = f"""You are a fractional CFO. The following financial metrics have already been computed by our system. DO NOT recalculate or restate them. Instead, provide 2-3 SHORT strategic recommendations based on what these numbers imply for the business.

PRE-COMPUTED METRICS (all in {base_currency}):
- Health Score: {analytics.get('health_score', 0)}/100
- Cash: {base_currency} {current_balance:,.0f} | Runway: {analytics.get('runway_months', 0)}mo
- Burn Trend: {analytics.get('burn_trend_direction', 'stable')} ({analytics.get('burn_trend_pct', 0):+.1f}%)
- Net 30d: {base_currency} {analytics.get('net_cash_flow_30d', 0):,.0f} | Net 90d: {base_currency} {analytics.get('net_cash_flow_90d', 0):,.0f}
- AR/AP Ratio: {analytics.get('working_capital_ratio', 0)}x
- Fixed Subscriptions (Outflow): {base_currency} {analytics.get('total_fixed_monthly', 0):,.0f} (covers {analytics.get('fixed_cost_coverage_months', 0)}mo)
- Fixed Recurring (Inflow): {base_currency} {analytics.get('recurring_monthly_obligation', 0):,.0f}
- Top Client: {analytics.get('top_customer_name', 'N/A')} ({analytics.get('top_customer_pct', 0)}% of AR)

RISK FLAGS:
{flags_text}

Rules:
- Give ONLY strategic advice (e.g. "negotiate payment terms", "diversify revenue", "build credit line")
- Do NOT repeat the numbers above — the user already sees them
- 2-3 bullet points max, under 100 words total
- Be direct and actionable"""

        response = model.generate_content(prompt)
        return response.text.strip()

    except Exception as e:
        return f"AI strategic advisor temporarily unavailable. Error: {str(e)[:100]}"

