import sys
import os
import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add backend to path
sys.path.insert(0, os.path.join(os.getcwd(), 'backend'))

import models
from services.reporting_service import ReportingService

# 1. Setup in-memory DB
engine = create_engine("sqlite:///:memory:")
models.Base.metadata.create_all(bind=engine)
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

user_id = "test_user_123"

# 2. Seed default categories
def seed_defaults():
    from routers.categories import DEFAULT_ACCOUNTS
    for acct in DEFAULT_ACCOUNTS:
        db_cat = models.Category(
            user_id=user_id,
            code=acct["code"],
            name=acct["name"],
            type=acct["type"],
            description=acct["description"],
            is_system=True
        )
        db.add(db_cat)
    db.commit()

seed_defaults()

# Helper to get category by code
def get_cat(code):
    return db.query(models.Category).filter(models.Category.code == code, models.Category.user_id == user_id).first()

# 3. Record Transactions
# Transaction 1: Revenue (Sales) - $1000 Debit Cash / $1000 Credit Sales
entry1 = models.JournalEntry(user_id=user_id, description="Sales", reference="S001", date=datetime.datetime(2026, 1, 15))
db.add(entry1)
db.flush()
db.add(models.JournalLine(user_id=user_id, journal_id=entry1.id, account_id=get_cat("1000").id, debit=1000.0))
db.add(models.JournalLine(user_id=user_id, journal_id=entry1.id, account_id=get_cat("4000").id, credit=1000.0))

# Transaction 2: AR Sale - $500 Debit AR / $500 Credit Sales
entry2 = models.JournalEntry(user_id=user_id, description="AR Sale", reference="S002", date=datetime.datetime(2026, 1, 20))
db.add(entry2)
db.flush()
db.add(models.JournalLine(user_id=user_id, journal_id=entry2.id, account_id=get_cat("1100").id, debit=500.0))
db.add(models.JournalLine(user_id=user_id, journal_id=entry2.id, account_id=get_cat("4000").id, credit=500.0))

# Transaction 3: Expense with AP - $200 Debit Rent / $200 Credit AP
entry3 = models.JournalEntry(user_id=user_id, description="Rent Unpaid", reference="E001", date=datetime.datetime(2026, 1, 25))
db.add(entry3)
db.flush()
db.add(models.JournalLine(user_id=user_id, journal_id=entry3.id, account_id=get_cat("5200").id, debit=200.0))
db.add(models.JournalLine(user_id=user_id, journal_id=entry3.id, account_id=get_cat("2000").id, credit=200.0))

# Transaction 4: Buying Equipment with Cash - $300 Debit Equipment / $300 Credit Cash
entry4 = models.JournalEntry(user_id=user_id, description="Buy Laptop", reference="I001", date=datetime.datetime(2026, 1, 30))
db.add(entry4)
db.flush()
db.add(models.JournalLine(user_id=user_id, journal_id=entry4.id, account_id=get_cat("1500").id, debit=300.0))
db.add(models.JournalLine(user_id=user_id, journal_id=entry4.id, account_id=get_cat("1000").id, credit=300.0))

db.commit()

# 4. Generate Cash Flow Statement
start = datetime.date(2026, 1, 1)
end = datetime.date(2026, 1, 31)
cf = ReportingService.generate_cash_flow_statement(db, start, end, user_id)

print("\n--- CASH FLOW STATEMENT ---")
print(f"Period: {cf['start_date']} to {cf['end_date']}")
print(f"Net Income: {cf['operating_activities']['net_income']}")
print("Operating Adjustments:")
for adj in cf['operating_activities']['adjustments']:
    print(f"  {adj['name']}: {adj['amount']}")
print(f"Net Cash from Operating: {cf['operating_activities']['total']}")
print("Investing Activities:")
for item in cf['investing_activities']['items']:
    print(f"  {item['name']}: {item['amount']}")
print(f"Net Cash from Investing: {cf['investing_activities']['total']}")
print(f"Net Change in Cash: {cf['net_cash_increase']}")
print(f"Beginning Cash: {cf['beginning_cash']}")
print(f"Ending Cash: {cf['ending_cash']}")

# Expected:
# Net Income = 1000 + 500 - 200 = 1300
# AR Change = increase of 500 = -500 Impact
# AP Change = increase of 200 = +200 Impact
# Operating Total = 1300 - 500 + 200 = 1000
# Investing Change = increase of 300 = -300 Impact
# Net Change = 1000 - 300 = 700
# Beginning Cash = 0
# Ending Cash = 700 (Matches Ledger: 1000 DR - 300 CR = 700)

assert cf['operating_activities']['net_income'] == 1300.0
assert cf['operating_activities']['total'] == 1000.0
assert cf['investing_activities']['total'] == -300.0
assert cf['net_cash_increase'] == 700.0
assert cf['ending_cash'] == 700.0

print("\nSUCCESS: All assertions passed!")
