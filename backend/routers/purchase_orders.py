from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models
from pydantic import BaseModel
from typing import List, Optional
import datetime
from services.auth import get_current_user
from services.inventory_service import InventoryService

router = APIRouter(prefix="/purchase-orders", tags=["Purchase Orders & Procurement"])

# --- Schemas ---

class POLineItemBase(BaseModel):
    description: str
    quantity: float = 1.0
    unit_price: float = 0.0
    product_id: Optional[int] = None

class POLineItemResponse(POLineItemBase):
    id: int
    total_price: float
    quantity_received: float
    quantity_billed: float
    
    model_config = {"from_attributes": True}

class POCreate(BaseModel):
    vendor_id: int
    po_number: str
    expected_delivery_date: Optional[datetime.datetime] = None
    currency: Optional[str] = "USD"
    exchange_rate: Optional[float] = None
    notes: Optional[str] = None
    items: List[POLineItemBase]

class POResponse(BaseModel):
    id: int
    po_number: str
    vendor_id: int
    issue_date: datetime.datetime
    expected_delivery_date: Optional[datetime.datetime]
    status: str
    total_amount: float
    currency: str = "USD"
    exchange_rate: float = 1.0
    notes: Optional[str]
    created_at: datetime.datetime
    items: List[POLineItemResponse]
    
    model_config = {"from_attributes": True}

# --- Routes ---

@router.get("/", response_model=List[POResponse])
def get_purchase_orders(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    return db.query(models.PurchaseOrder).filter(models.PurchaseOrder.user_id == user_id).all()

@router.post("/", response_model=POResponse)
def create_purchase_order(po: POCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    
    # Check if PO number already exists for user
    existing = db.query(models.PurchaseOrder).filter(
        models.PurchaseOrder.po_number == po.po_number,
        models.PurchaseOrder.user_id == user_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="PO number already exists")
        
    from services.currency_service import CurrencyService
    
    # Get Exchange Rate if not provided
    rate = po.exchange_rate
    if not rate:
        rate = CurrencyService.get_exchange_rate(db, user_id, po.currency, CurrencyService.get_base_currency(db, user_id))

    total_amount = sum(item.quantity * item.unit_price for item in po.items)
    db_po = models.PurchaseOrder(
        user_id=user_id,
        po_number=po.po_number,
        vendor_id=po.vendor_id,
        expected_delivery_date=po.expected_delivery_date,
        notes=po.notes,
        currency=po.currency,
        exchange_rate=rate,
        total_amount=total_amount,
        amount_base=total_amount * rate
    )
    db.add(db_po)
    db.flush() # Get ID
    
    for item in po.items:
        db_item = models.POLineItem(
            po_id=db_po.id,
            product_id=item.product_id,
            description=item.description,
            quantity=item.quantity,
            unit_price=item.unit_price,
            total_price=item.quantity * item.unit_price
        )
        db.add(db_item)
        
    db.commit()
    db.refresh(db_po)
    return db_po

@router.get("/{po_id}", response_model=POResponse)
def get_purchase_order(po_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    db_po = db.query(models.PurchaseOrder).filter(
        models.PurchaseOrder.id == po_id, 
        models.PurchaseOrder.user_id == user_id
    ).first()
    if not db_po:
        raise HTTPException(status_code=404, detail="Purchase Order not found")
    return db_po

@router.patch("/{po_id}/status")
def update_po_status(po_id: int, status: str, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    db_po = db.query(models.PurchaseOrder).filter(
        models.PurchaseOrder.id == po_id, 
        models.PurchaseOrder.user_id == user_id
    ).first()
    if not db_po:
        raise HTTPException(status_code=404, detail="Purchase Order not found")
        
    db_po.status = status
    db.commit()
    return {"message": "Status updated successfully", "new_status": status}

@router.post("/{po_id}/receive")
def receive_items(po_id: int, items_received: List[dict], db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Mark quantities as received. payload: [{'item_id': 1, 'received': 5}]"""
    user_id = current_user["sub"]
    db_po = db.query(models.PurchaseOrder).filter(
        models.PurchaseOrder.id == po_id, 
        models.PurchaseOrder.user_id == user_id
    ).first()
    if not db_po:
        raise HTTPException(status_code=404, detail="Purchase Order not found")
        
    all_received = True
    any_received = False
    
    for recv_data in items_received:
        item_id = recv_data.get("item_id")
        qty = recv_data.get("received", 0)
        
        db_item = db.query(models.POLineItem).filter(
            models.POLineItem.id == item_id,
            models.POLineItem.po_id == po_id
        ).first()
        
        if db_item:
            db_item.quantity_received += qty
            if db_item.quantity_received < db_item.quantity:
                all_received = False
            if db_item.quantity_received > 0:
                any_received = True
                
    # Update actual inventory stock
    InventoryService.handle_po_receipt(db, user_id, po_id, items_received)
    
    if all_received:
        db_po.status = models.POStatus.RECEIVED
    elif any_received:
        db_po.status = models.POStatus.PARTIALLY_RECEIVED
        
    db.commit()
    return {"status": db_po.status}

@router.post("/{po_id}/convert-to-bill")
def convert_po_to_bill(po_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Convert an issued/received PO into a Vendor Bill (Accounts Payable Invoice)."""
    user_id = current_user["sub"]
    db_po = db.query(models.PurchaseOrder).filter(
        models.PurchaseOrder.id == po_id, 
        models.PurchaseOrder.user_id == user_id
    ).first()
    
    if not db_po:
        raise HTTPException(status_code=404, detail="Purchase Order not found")
        
    if db_po.status in [models.POStatus.DRAFT, models.POStatus.CANCELLED]:
        raise HTTPException(status_code=400, detail="Only Issued or Received POs can be billed")
        
    # Create an Invoice (Accounts Payable)
    vendor = db.query(models.Vendor).filter(models.Vendor.id == db_po.vendor_id).first()
    
    db_invoice = models.Invoice(
        user_id=user_id,
        invoice_number=f"BILL-PO-{db_po.po_number}",
        vendor_id=db_po.vendor_id,
        total_amount=db_po.total_amount,
        amount_base=db_po.amount_base,
        currency=db_po.currency,
        exchange_rate=db_po.exchange_rate,
        status=models.InvoiceStatus.PENDING,
        ai_confidence_score=100.0, # Manually created from PO
    )
    db.add(db_invoice)
    
    db_po.status = models.POStatus.BILLED
    db.commit()
    db.refresh(db_invoice)
    
    return {"message": "Converted to Bill", "invoice_id": db_invoice.id}
