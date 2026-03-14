import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import datetime
from database import SessionLocal
import models

db = SessionLocal()
user_id = 'ceac683c-ee3e-420f-a72a-88bf70b3ea8e'
now = datetime.datetime.now(datetime.timezone.utc)

vendor = db.query(models.Vendor).filter(models.Vendor.user_id == user_id).first()
if not vendor:
    vendor = models.Vendor(user_id=user_id, name="Future Vendor Corp")
    db.add(vendor)
    db.commit()
    db.refresh(vendor)

new_invoice = models.Invoice(
    user_id=user_id,
    invoice_number="FUTURE-90D-TEST",
    vendor_id=vendor.id,
    issue_date=now - datetime.timedelta(days=5),
    due_date=now + datetime.timedelta(days=75),
    total_amount=15000.0,
    paid_amount=0,
    status=models.InvoiceStatus.APPROVED
)

db.add(new_invoice)
db.commit()
print("Added 90-day bill successfully!")
