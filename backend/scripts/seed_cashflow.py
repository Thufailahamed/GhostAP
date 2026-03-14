import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import datetime
import random
from sqlalchemy.orm import Session
from database import SessionLocal, engine
import models

def create_dummy_data():
    db = SessionLocal()
    
    # Hardcode the frontend dev user's actual UUID so they can see the data
    user_id = "ceac683c-ee3e-420f-a72a-88bf70b3ea8e"
            
    print(f"Using user_id: {user_id}")
    now = datetime.datetime.now(datetime.timezone.utc)

    # 0. Safely clear all old data by deleting dependents first
    db.query(models.JournalEntry).filter(models.JournalEntry.user_id == user_id).delete()
    db.query(models.BankTransaction).filter(models.BankTransaction.user_id == user_id).delete()
    db.query(models.BankAccount).filter(models.BankAccount.user_id == user_id).delete()
    
    db.query(models.LineItem).filter(models.LineItem.invoice_id.in_(
        db.query(models.Invoice.id).filter(models.Invoice.user_id == user_id)
    )).delete(synchronize_session=False)

    db.query(models.Invoice).filter(models.Invoice.user_id == user_id).delete()
    db.query(models.Vendor).filter(models.Vendor.user_id == user_id).delete()
    
    db.query(models.RecurringInvoice).filter(models.RecurringInvoice.user_id == user_id).delete()
    
    db.query(models.Receivable).filter(models.Receivable.user_id == user_id).delete()
    db.query(models.Customer).filter(models.Customer.user_id == user_id).delete()


    # 1. Bank Account & Bank Transactions (Current Balance & Historical Burn)
    bank_account = models.BankAccount(
        user_id=user_id,
        name="Chase Business Checking",
        bank_name="Chase",
        currency="USD"
    )
    db.add(bank_account)
    db.commit()
    db.refresh(bank_account)

    # Let's create a baseline balance of around $150k
    db.add(models.BankTransaction(
        user_id=user_id,
        bank_account_id=bank_account.id,
        date=now - datetime.timedelta(days=40),
        reference="Initial Capital",
        amount=180000.0,
        type="INCOMING",
        reconciled=True
    ))
    
    # Add some recent burn (payroll, rent, software)
    expenses = [
        ("Payroll", -25000.0, 5),
        ("Payroll", -25000.0, 20),
        ("Office Rent", -6500.0, 15),
        ("AWS Hosting", -1200.0, 2),
        ("Google Workspace", -400.0, 10),
        ("Marketing Ads", -3500.0, 8),
        ("Legal Fees", -2000.0, 25),
    ]
    for desc, amt, days_ago in expenses:
        db.add(models.BankTransaction(
            user_id=user_id,
            bank_account_id=bank_account.id,
            date=now - datetime.timedelta(days=days_ago),
            reference=desc,
            amount=amt,
            type="OUTGOING",
            reconciled=True
        ))
        
    # Some recent income
    db.add(models.BankTransaction(
        user_id=user_id,
        bank_account_id=bank_account.id,
        date=now - datetime.timedelta(days=12),
        reference="Stripe Payout",
        amount=12500.0,
        type="INCOMING",
        reconciled=True
    ))
    
    # 2. Customers and Receivables (Incoming Cash)
    db.query(models.Receivable).filter(models.Receivable.user_id == user_id).delete()
    db.query(models.Customer).filter(models.Customer.user_id == user_id).delete()
    
    customers_data = [
        {"name": "Acme Corp", "terms": "Net 30"},
        {"name": "Globex Inc", "terms": "Net 15"},
        {"name": "Initech", "terms": "Net 45"},
        {"name": "Soylent Corp", "terms": "Due on Receipt"}
    ]
    customers = []
    for cd in customers_data:
        c = models.Customer(name=cd["name"], payment_terms=cd["terms"], user_id=user_id)
        db.add(c)
        db.commit()
        db.refresh(c)
        customers.append(c)

    receivables_data = [
        # Overdue
        {"c_idx": 0, "amt": 15000.0, "days_offset": -5, "status": models.ReceivableStatus.OVERDUE},
        {"c_idx": 2, "amt": 8500.0, "days_offset": -12, "status": models.ReceivableStatus.OVERDUE},
        # Due in next 30 days
        {"c_idx": 1, "amt": 12000.0, "days_offset": 8, "status": models.ReceivableStatus.SENT},
        {"c_idx": 0, "amt": 22000.0, "days_offset": 18, "status": models.ReceivableStatus.SENT},
        {"c_idx": 3, "amt": 4500.0, "days_offset": 25, "status": models.ReceivableStatus.SENT},
        # Due in 30-60 days
        {"c_idx": 2, "amt": 35000.0, "days_offset": 45, "status": models.ReceivableStatus.SENT},
        # Due in 60-90 days
        {"c_idx": 1, "amt": 18000.0, "days_offset": 75, "status": models.ReceivableStatus.SENT},
    ]
    
    for i, rd in enumerate(receivables_data):
        db.add(models.Receivable(
            user_id=user_id,
            invoice_number=f"INV-2026-{100+i}",
            customer_id=customers[rd["c_idx"]].id,
            issue_date=now - datetime.timedelta(days=15),
            due_date=now + datetime.timedelta(days=rd["days_offset"]),
            total_amount=rd["amt"],
            paid_amount=0,
            status=rd["status"]
        ))

    # 3. Vendors and Payables (Outgoing Cash)
    db.query(models.Invoice).filter(models.Invoice.user_id == user_id).delete()
    db.query(models.Vendor).filter(models.Vendor.user_id == user_id).delete()
    
    vendors_data = ["WeWork", "Salesforce", "AWS", "Fidelity Payroll", "DLA Piper Legal"]
    vendors = []
    for v_name in vendors_data:
        v = models.Vendor(name=v_name, user_id=user_id)
        db.add(v)
        db.commit()
        db.refresh(v)
        vendors.append(v)

    payables_data = [
        # Due in next 30 days
        {"v_idx": 0, "amt": 6500.0, "days_offset": 5},
        {"v_idx": 3, "amt": 25000.0, "days_offset": 12},
        {"v_idx": 2, "amt": 1500.0, "days_offset": 20},
        # Due in 30-60 days 
        {"v_idx": 3, "amt": 25000.0, "days_offset": 42},
        {"v_idx": 0, "amt": 6500.0, "days_offset": 35},
        {"v_idx": 1, "amt": 12000.0, "days_offset": 55},
        # Due in 60-90 days
        {"v_idx": 3, "amt": 25000.0, "days_offset": 72},
        {"v_idx": 4, "amt": 8500.0, "days_offset": 85},
    ]
    
    for i, pd in enumerate(payables_data):
        db.add(models.Invoice(
            user_id=user_id,
            invoice_number=f"BILL-{i}",
            vendor_id=vendors[pd["v_idx"]].id,
            issue_date=now - datetime.timedelta(days=5),
            due_date=now + datetime.timedelta(days=pd["days_offset"]),
            total_amount=pd["amt"],
            paid_amount=0,
            status=models.InvoiceStatus.APPROVED
        ))
        
    # 4. Recurring Obligations
    db.query(models.RecurringInvoice).filter(models.RecurringInvoice.user_id == user_id).delete()
    db.add(models.RecurringInvoice(
        user_id=user_id,
        customer_id=customers[0].id,
        description="Monthly Retainer",
        frequency=models.RecurringFrequency.MONTHLY,
        amount=5000.0,
        next_run_date=now + datetime.timedelta(days=15),
        is_active=True
    ))
    db.add(models.RecurringInvoice(
        user_id=user_id,
        customer_id=customers[1].id,
        description="Software Subscription",
        frequency=models.RecurringFrequency.MONTHLY,
        amount=2500.0,
        next_run_date=now + datetime.timedelta(days=5),
        is_active=True
    ))

    db.commit()
    print("Successfully populated dummy cash flow data!")
    
if __name__ == "__main__":
    create_dummy_data()
