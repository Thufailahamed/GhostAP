import sys
import os
import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add backend to path
sys.path.insert(0, os.path.join(os.getcwd(), 'backend'))

import models
from routers.purchase_orders import create_purchase_order, receive_items, convert_po_to_bill, POCreate, POLineItemBase
from routers.products import create_product, ProductCreate

# 1. Setup in-memory DB
engine = create_engine("sqlite:///:memory:")
models.Base.metadata.create_all(bind=engine)
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

user_a = {"sub": "user_a"}
user_b = {"sub": "user_b"}

# Setup Products
p1_a = create_product(ProductCreate(name="Laptop", unit_price=1000.0, is_inventory_item=True), db, user_a)
p2_a = create_product(ProductCreate(name="Mouse", unit_price=50.0, is_inventory_item=True), db, user_a)

# 2. Test Uniqueness per user
po_data_a = POCreate(
    vendor_id=1,
    po_number="PO-123",
    items=[POLineItemBase(description="Laptop", quantity=5, unit_price=1000.0, product_id=p1_a.id)]
)
po_a = create_purchase_order(po_data_a, db, user_a)
print(f"Created PO {po_a.po_number} for user_a")

# Try same number for user_b
po_data_b = POCreate(
    vendor_id=1,
    po_number="PO-123", # Same number!
    items=[POLineItemBase(description="Parts", quantity=10, unit_price=10.0)]
)
po_b = create_purchase_order(po_data_b, db, user_b)
print(f"Created PO {po_b.po_number} for user_b (Uniqueness test passed)")

# 3. Test Partial Receiving
recv_payload = [{"item_id": po_a.items[0].id, "received": 2}]
receive_items(po_a.id, recv_payload, db, user_a)
db.refresh(po_a)
print(f"PO Status after partial receipt: {po_a.status}")
assert po_a.status == models.POStatus.PARTIALLY_RECEIVED
assert po_a.items[0].quantity_received == 2

# Receive remaining
recv_payload2 = [{"item_id": po_a.items[0].id, "received": 3}]
receive_items(po_a.id, recv_payload2, db, user_a)
db.refresh(po_a)
print(f"PO Status after full receipt: {po_a.status}")
assert po_a.status == models.POStatus.RECEIVED
assert po_a.items[0].quantity_received == 5

# 4. Test Convert to Bill
bill_res = convert_po_to_bill(po_a.id, db, user_a)
invoice_id = bill_res["invoice_id"]
invoice = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()

print(f"Converted to Bill: {invoice.invoice_number}")
assert invoice.total_amount == 5000.0
assert len(invoice.line_items) == 1
assert invoice.line_items[0].description == "Laptop"
assert invoice.line_items[0].quantity == 5
assert invoice.line_items[0].unit_price == 1000.0

print("\nSUCCESS: All PO fixes verified!")
