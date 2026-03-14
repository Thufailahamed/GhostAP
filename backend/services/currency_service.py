from sqlalchemy.orm import Session
import models
import datetime
import requests
import os
from typing import Dict

class CurrencyService:
    # We can use https://api.exchangerate-api.com/v4/latest/USD as a free source
    API_URL = "https://api.exchangerate-api.com/v4/latest/"

    @staticmethod
    def get_base_currency(db: Session, user_id: str) -> str:
        settings = db.query(models.CompanySettings).filter(models.CompanySettings.user_id == user_id).first()
        if settings and settings.base_currency:
            return settings.base_currency
        return "USD"

    @staticmethod
    def get_exchange_rate(db: Session, user_id: str, from_currency: str, to_currency: str) -> float:
        """
        Gets the exchange rate (from -> to). 
        First checks if we have a recent rate in the cache (database), 
        otherwise fetches from the API.
        """
        if from_currency == to_currency:
            return 1.0

        # 1. Check DB cache (rates younger than 4 hours)
        cutoff = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=4)
        cached = db.query(models.CurrencyRate).filter(
            models.CurrencyRate.from_currency == from_currency,
            models.CurrencyRate.to_currency == to_currency,
            models.CurrencyRate.date >= cutoff
        ).order_by(models.CurrencyRate.date.desc()).first()

        if cached:
            return cached.rate

        # 2. Fetch from API
        try:
            response = requests.get(f"{CurrencyService.API_URL}{from_currency}", timeout=5)
            if response.status_code == 200:
                data = response.json()
                rate = data.get("rates", {}).get(to_currency)
                if rate:
                    # Save to cache
                    new_rate = models.CurrencyRate(
                        user_id=user_id,
                        from_currency=from_currency,
                        to_currency=to_currency,
                        rate=rate,
                        date=datetime.datetime.now(datetime.timezone.utc)
                    )
                    db.add(new_rate)
                    db.commit()
                    return rate
        except Exception as e:
            print(f"Error fetching exchange rate: {e}")

        # 3. Fallback to older cached rate or 1.0
        fallback = db.query(models.CurrencyRate).filter(
            models.CurrencyRate.from_currency == from_currency,
            models.CurrencyRate.to_currency == to_currency
        ).order_by(models.CurrencyRate.date.desc()).first()
        
        return fallback.rate if fallback else 1.0

    @staticmethod
    def convert_to_base(db: Session, user_id: str, amount: float, from_currency: str) -> float:
        base = CurrencyService.get_base_currency(db, user_id)
        rate = CurrencyService.get_exchange_rate(db, user_id, from_currency, base)
        return amount * rate

    @staticmethod
    def record_realized_gain_loss(db: Session, user_id: str, original_amount_base: float, payment_amount_base: float, reference: str):
        """
        If we received more/less in base currency than we expected when the invoice was issued,
        we record a journal entry for the difference as FX Gain/Loss.
        """
        diff = payment_amount_base - original_amount_base
        if abs(diff) < 0.01:
            return

        # Find or create Gain/Loss account
        account_name = "Exchange Gain or Loss"
        account = db.query(models.Category).filter(
            models.Category.name == account_name,
            models.Category.user_id == user_id
        ).first()

        if not account:
            # Create it under Expense
            account = models.Category(
                user_id=user_id,
                code="7000",
                name=account_name,
                type=models.CategoryType.EXPENSE,
                description="Realized gains and losses from foreign currency fluctuations"
            )
            db.add(account)
            db.flush()

        # Create Journal Entry for the difference
        # This is a bit complex as it needs to offset the AR/AP account.
        # For now, let's just log it. A full implementation would post to the ledger.
        print(f"FX REALIZED {'GAIN' if diff > 0 else 'LOSS'} of {abs(diff)} for {reference}")

    @staticmethod
    def recalculate_historical_data(db: Session, user_id: str, new_base_currency: str, old_base_currency: str = "USD"):
        """
        When the organization results to a new base currency, we must update all
        stored base amounts and exchange rates to reflect the new basis.
        """
        # Get conversion rate from old base to new base for static targets (Budgets)
        old_to_new_rate = CurrencyService.get_exchange_rate(db, user_id, old_base_currency, new_base_currency)

        # 1. Update Bank Transactions
        transactions = db.query(models.BankTransaction).filter(models.BankTransaction.user_id == user_id).all()
        for t in transactions:
            rate = CurrencyService.get_exchange_rate(db, user_id, t.currency or "USD", new_base_currency)
            t.exchange_rate = rate
            t.amount_base = float(t.amount) * rate

        # 2. Update Receivables (Invoices)
        receivables = db.query(models.Receivable).filter(models.Receivable.user_id == user_id).all()
        for r in receivables:
            rate = CurrencyService.get_exchange_rate(db, user_id, r.currency or "USD", new_base_currency)
            r.exchange_rate = rate
            r.amount_base = float(r.total_amount) * rate

        # 3. Update Payables (Invoices)
        invoices = db.query(models.Invoice).filter(models.Invoice.user_id == user_id).all()
        for i in invoices:
            rate = CurrencyService.get_exchange_rate(db, user_id, i.currency or "USD", new_base_currency)
            i.exchange_rate = rate
            i.amount_base = float(i.total_amount) * rate

        # 4. Update Payments Received
        payments = db.query(models.PaymentReceived).filter(models.PaymentReceived.user_id == user_id).all()
        for p in payments:
            rate = CurrencyService.get_exchange_rate(db, user_id, p.currency or "USD", new_base_currency)
            p.exchange_rate = rate
            p.amount_base = float(p.amount) * rate

        # 5. Update Purchase Orders
        pos = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.user_id == user_id).all()
        for po in pos:
            rate = CurrencyService.get_exchange_rate(db, user_id, po.currency or "USD", new_base_currency)
            po.exchange_rate = rate
            po.amount_base = float(po.total_amount) * rate
        
        # 6. Update Recurring Invoices
        recurring = db.query(models.RecurringInvoice).filter(models.RecurringInvoice.user_id == user_id).all()
        for r_inv in recurring:
            rate = CurrencyService.get_exchange_rate(db, user_id, r_inv.currency or "USD", new_base_currency)
            r_inv.exchange_rate = rate
            r_inv.amount_base = float(r_inv.amount) * rate

        # 7. Update Subscriptions
        subs = db.query(models.Subscription).filter(models.Subscription.user_id == user_id).all()
        for s in subs:
            rate = CurrencyService.get_exchange_rate(db, user_id, s.currency or "USD", new_base_currency)
            s.exchange_rate = rate
            s.amount_base = float(s.cost) * rate
        
        # 8. Update Budget Targets
        # We must convert the targets from the old base currency to the new one
        budget_items = db.query(models.BudgetItem).join(models.Budget).filter(models.Budget.user_id == user_id).all()
        month_fields = ["jan_target", "feb_target", "mar_target", "apr_target", "may_target", "jun_target", 
                        "jul_target", "aug_target", "sep_target", "oct_target", "nov_target", "dec_target"]
        
        for item in budget_items:
            for field in month_fields:
                old_val = getattr(item, field) or 0.0
                setattr(item, field, old_val * old_to_new_rate)

        db.commit()
        print(f"Historical data re-calculated for user {user_id} in {new_base_currency}")
