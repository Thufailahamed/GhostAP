from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from services.validation_service import validate_invoice_data
from services.ocr_service import perform_ocr
from database import get_db
import models
import os
import shutil
import datetime
from services.accounting_service import AccountingService
from services.email_listener import process_incoming_email
from services.auth import get_current_user

router = APIRouter(
    prefix="/invoices",
    tags=["invoices"],
    dependencies=[Depends(get_current_user)]
)

@router.get("/")
def get_invoices(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Fetch all invoices belonging to the current user."""
    user_id = current_user["sub"]
    invoices = db.query(models.Invoice).filter(models.Invoice.user_id == user_id).all()
    
    response = []
    for inv in invoices:
        response.append({
            "id": str(inv.id),
            "invoice_number": inv.invoice_number or "N/A",
            "vendor_name": inv.vendor.name if inv.vendor else "Unknown Vendor",
            "amount": inv.total_amount or 0.0,
            "status": inv.status.value if inv.status else "PENDING",
            "date": inv.issue_date.strftime("%Y-%m-%d") if inv.issue_date else "N/A",
            "source": inv.source or "UPLOAD",
            "source_email_from": inv.source_email_from or "",
            "source_email_subject": inv.source_email_subject or "",
            "currency": inv.currency or "USD",
            "created_at": inv.created_at.strftime("%Y-%m-%dT%H:%M:%SZ") if inv.created_at else "",
        })
    return response

# =============================================
# VENDOR ENDPOINTS
# =============================================

@router.get("/vendors")
def get_vendors(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """List all vendors belonging to the current user."""
    user_id = current_user["sub"]
    vendors = db.query(models.Vendor).filter(models.Vendor.user_id == user_id).all()
    return [
        {
            "id": v.id,
            "name": v.name,
            "tax_id": v.tax_id,
            "default_currency": v.default_currency or "USD",
            "notes": v.notes or "",
            "is_flagged": v.is_flagged or False,
            "invoice_count": len(v.invoices),
        }
        for v in vendors
    ]


class VendorNotesUpdate(BaseModel):
    notes: Optional[str] = None
    is_flagged: Optional[bool] = None


@router.patch("/vendors/{vendor_id}/notes")
def update_vendor_notes(vendor_id: int, update: VendorNotesUpdate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Update a vendor's notes and/or flag status."""
    user_id = current_user["sub"]
    vendor = db.query(models.Vendor).filter(models.Vendor.id == vendor_id, models.Vendor.user_id == user_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    if update.notes is not None:
        vendor.notes = update.notes
    if update.is_flagged is not None:
        vendor.is_flagged = update.is_flagged
    db.commit()
    return {"id": vendor.id, "notes": vendor.notes, "is_flagged": vendor.is_flagged}

@router.get("/{invoice_id}")
def get_invoice_detail(invoice_id: str, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Fetch a single invoice by ID."""
    user_id = current_user["sub"]
    inv = db.query(models.Invoice).filter(models.Invoice.id == invoice_id, models.Invoice.user_id == user_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
        
    return {
        "id": str(inv.id),
        "invoice_number": inv.invoice_number,
        "vendor_name": inv.vendor.name if inv.vendor else "Unknown Vendor",
        "subtotal": inv.subtotal,
        "discount_amount": inv.discount_amount,
        "tax_amount": inv.tax_amount,
        "shipping_amount": inv.shipping_amount,
        "total_amount": inv.total_amount,
        "currency": inv.currency,
        "status": inv.status.value,
        "date": inv.issue_date.strftime("%Y-%m-%d") if inv.issue_date else "N/A",
        "due_date": inv.due_date.strftime("%Y-%m-%d") if inv.due_date else "N/A",
        "ai_confidence_score": inv.ai_confidence_score,
        "pdf_path": inv.pdf_path,
        "source": inv.source or "UPLOAD",
        "source_email_from": inv.source_email_from or "",
        "source_email_subject": inv.source_email_subject or "",
        "line_items": [
            {
                "description": li.description,
                "quantity": li.quantity,
                "unit_price": li.unit_price,
                "total": li.total_price
            } for li in inv.line_items
        ],
        "approval_comment": inv.approval_comment or "",
        "paid_amount": inv.paid_amount or 0.0,
    }

class LineItemReview(BaseModel):
    description: str = ""
    quantity: float = 1.0
    unit_price: float = 0.0
    total: float = 0.0

class InvoiceReview(BaseModel):
    vendor_name: Optional[str] = ""
    invoice_number: Optional[str] = ""
    date: Optional[str] = ""
    due_date: Optional[str] = ""
    subtotal: Optional[float] = 0.0
    discount: Optional[float] = 0.0
    tax: Optional[float] = 0.0
    shipping: Optional[float] = 0.0
    total: Optional[float] = 0.0
    status: str = "REVIEW_REQUIRED"
    line_items: Optional[List[LineItemReview]] = None
    approval_comment: Optional[str] = None  # Audit comment when approving/rejecting

@router.post("/sync-emails")
async def sync_emails_from_inbox(current_user: dict = Depends(get_current_user)):
    """Manually triggered endpoint to scan inbox for missing invoices."""
    user_id = current_user["sub"]
    result = process_incoming_email("SYNC", user_id=user_id)
    if isinstance(result, dict) and result.get("status") == "error":
        raise HTTPException(status_code=500, detail=result.get("message"))
    
    return {"message": "Sync complete", "data": result}

@router.post("/upload")
async def upload_invoice(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    # 1. Save uploaded file to static directory
    os.makedirs("temp_storage", exist_ok=True)
    file_path = f"temp_storage/{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # 2. Perform OCR Extraction
    extracted = perform_ocr(file_path)

    # 3. Create or Fetch Vendor
    vendor_name = extracted.get("vendor_name", "Unknown Vendor Upload")
    user_id = current_user["sub"]
    vendor = db.query(models.Vendor).filter(models.Vendor.name == vendor_name, models.Vendor.user_id == user_id).first()
    if not vendor:
        import random
        vendor = models.Vendor(name=vendor_name, tax_id=f"UNKNOWN-{random.randint(1000,9999)}", user_id=user_id)
        db.add(vendor)
        db.commit()
        db.refresh(vendor)
        
    import datetime, uuid
    
    # 4. Try to parse extracted date - handles many formats Gemini may return
    issue_dt = datetime.datetime.now(datetime.timezone.utc)
    due_dt = None
    
    def parse_date(date_str):
        if not date_str or date_str in ("", "N/A", "null"):
            return None
        formats = [
            "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y",
            "%B %d %Y", "%b %d %Y", "%B %d, %Y", "%b %d, %Y",
            "%d %B %Y", "%d %b %Y",
        ]
        for fmt in formats:
            try:
                return datetime.datetime.strptime(date_str.strip(), fmt)
            except:
                continue
        return None

    parsed_issue_dt = parse_date(extracted.get("date", ""))
    if parsed_issue_dt:
        issue_dt = parsed_issue_dt
        
    # 4.5. Zero-Touch Auto-Approval Check
    extracted_conf = float(extracted.get("confidence_score", 0.0))
    # Send extracted dict to the validation engine check BEFORE saving
    # We must patch vendor name so validation service knows it since it checks by name
    val_payload = extracted.copy()
    val_payload["vendor_name"] = vendor.name 
    
    validation_result = validate_invoice_data(val_payload, db)
    
    # Perfect Condition: High Confidence, 0 Errors, 0 Warnings
    final_status = models.InvoiceStatus.REVIEW_REQUIRED
    if extracted_conf >= 0.95 and validation_result.is_valid and len(validation_result.warnings) == 0:
        final_status = models.InvoiceStatus.APPROVED

    from services.currency_service import CurrencyService
    base_currency = CurrencyService.get_base_currency(db, user_id)
    rate = CurrencyService.get_exchange_rate(db, user_id, extracted.get("currency", "USD"), base_currency)

    # 5. Save Invoice to Database
    new_inv = models.Invoice(
        user_id=user_id,
        invoice_number=extracted.get("invoice_number") or f"UPL-{uuid.uuid4().hex[:6].upper()}",
        vendor_id=vendor.id,
        issue_date=issue_dt,
        due_date=due_dt,
        subtotal=extracted.get("subtotal", 0.0),
        discount_amount=extracted.get("discount", 0.0),
        tax_amount=extracted.get("tax", 0.0),
        shipping_amount=extracted.get("shipping", 0.0),
        total_amount=extracted.get("total", 0.0),
        amount_base=extracted.get("total", 0.0) * rate,
        currency=extracted.get("currency", "USD"),
        exchange_rate=rate,
        status=final_status,
        ai_confidence_score=extracted_conf,
        pdf_path=f"/static/{file.filename}" # Path accessible by frontend iframe
    )
    db.add(new_inv)
    db.commit()
    db.refresh(new_inv)
    
    # 6. Save Line Items
    for li in extracted.get("line_items", []):
        item = models.LineItem(
            invoice_id=new_inv.id,
            description=li.get("description"),
            quantity=li.get("quantity"),
            unit_price=li.get("unit_price"),
            total_price=li.get("total")
        )
        db.add(item)
    db.commit()

    # 7. Post Zero-Touch Accounting Entry if Auto-Approved
    if final_status == models.InvoiceStatus.APPROVED:
        auto_post_journal(db, new_inv, vendor.name)


    return_data = {
        "invoice_id": str(new_inv.id),
        "vendor_name": vendor.name,
        "invoice_number": new_inv.invoice_number,
        "date": new_inv.issue_date.strftime("%Y-%m-%d") if new_inv.issue_date else "",
        "due_date": new_inv.due_date.strftime("%Y-%m-%d") if new_inv.due_date else "",
        "subtotal": new_inv.subtotal,
        "discount": new_inv.discount_amount,
        "tax": new_inv.tax_amount,
        "shipping": new_inv.shipping_amount,
        "total": new_inv.total_amount,
        "confidence_score": new_inv.ai_confidence_score
    }
    return {"message": "Invoice uploaded and OCR extracted successfully", "data": return_data}

@router.post("/{invoice_id}/reprocess")
async def reprocess_invoice(invoice_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    inv = db.query(models.Invoice).filter(models.Invoice.id == invoice_id, models.Invoice.user_id == user_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
        
    if not inv.pdf_path:
        raise HTTPException(status_code=400, detail="Cannot reprocess: no PDF attached to this invoice.")
        
    # The pdf_path is stored as "/static/filename.pdf". We need the local path.
    # We strip the `/static/` prefix and look in `temp_storage/`
    filename = inv.pdf_path.replace("/static/", "")
    local_path = f"temp_storage/{filename}"
    
    if not os.path.exists(local_path):
        raise HTTPException(status_code=404, detail="PDF file not found on disk.")
        
    extracted = perform_ocr(local_path)
    if not extracted:
        raise HTTPException(status_code=500, detail="OCR processing failed to return data.")
        
    # Update vendor if name changed
    vendor_name = extracted.get("vendor_name", "Unknown Vendor Upload")
    vendor = db.query(models.Vendor).filter(models.Vendor.name == vendor_name, models.Vendor.user_id == user_id).first()
    if not vendor:
        import random
        vendor = models.Vendor(name=vendor_name, tax_id=f"UNKNOWN-{random.randint(1000,9999)}", user_id=user_id)
        db.add(vendor)
        db.flush()
        
    inv.vendor_id = vendor.id
    inv.invoice_number = extracted.get("invoice_number", inv.invoice_number)
    
    # Parse dates
    def parse_date(date_str):
        if not date_str or date_str in ("", "N/A", "null"):
            return None
        formats = [
            "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y",
            "%B %d %Y", "%b %d %Y", "%B %d, %Y", "%b %d, %Y",
            "%d %B %Y", "%d %b %Y",
        ]
        for fmt in formats:
            try:
                return datetime.datetime.strptime(date_str.strip(), fmt)
            except:
                continue
        return None

    parsed_issue_dt = parse_date(extracted.get("date", ""))
    if parsed_issue_dt:
        inv.issue_date = parsed_issue_dt
        
    parsed_due_dt = parse_date(extracted.get("due_date", ""))
    if parsed_due_dt:
        inv.due_date = parsed_due_dt
        
    from services.currency_service import CurrencyService
    base_currency = CurrencyService.get_base_currency(db, user_id)
    rate = CurrencyService.get_exchange_rate(db, user_id, extracted.get("currency", inv.currency), base_currency)

    inv.subtotal = extracted.get("subtotal", 0.0)
    inv.discount_amount = extracted.get("discount", 0.0)
    inv.tax_amount = extracted.get("tax", 0.0)
    inv.shipping_amount = extracted.get("shipping", 0.0)
    inv.total_amount = extracted.get("total", 0.0)
    inv.currency = extracted.get("currency", inv.currency)
    inv.exchange_rate = rate
    inv.amount_base = inv.total_amount * rate
    inv.ai_confidence_score = extracted.get("confidence_score", 0.0)
    inv.status = models.InvoiceStatus.REVIEW_REQUIRED
    
    # Replace line items
    db.query(models.LineItem).filter(models.LineItem.invoice_id == inv.id).delete()
    for li in extracted.get("line_items", []):
        item = models.LineItem(
            invoice_id=inv.id,
            description=li.get("description"),
            quantity=li.get("quantity"),
            unit_price=li.get("unit_price"),
            total_price=li.get("total")
        )
        db.add(item)
        
    db.commit()
    return {"message": "Invoice re-extracted successfully", "invoice_id": invoice_id}


from services.accounting_service import AccountingService

def auto_post_journal(db: Session, inv: models.Invoice, vendor_name: str):
    """Refactored helper to post AP/Expense journal entries automatically."""
    try:
        # 1. Ensure we have an "Accounts Payable" account (Liability)
        user_id = inv.user_id
        ap_account = db.query(models.Category).filter(
            models.Category.name == "Accounts Payable",
            models.Category.user_id == user_id
        ).first()
        if not ap_account:
            # Default creation if it doesn't exist
            ap_account = models.Category(code="2000", name="Accounts Payable", type="Liability", user_id=user_id)
            db.add(ap_account)
            db.flush()

        # 2. Find the Expense account for this invoice
        # For now, we'll use a generic "General Expense" or find the first Expense account
        expense_account = db.query(models.Category).filter(
            models.Category.type == "Expense",
            models.Category.user_id == user_id
        ).first()
        if not expense_account:
            expense_account = models.Category(code="5000", name="General Expense", type="Expense", user_id=user_id)
            db.add(expense_account)
            db.flush()

        # 3. Create Journal Entry (Debit Expense / Credit Accounts Payable)
        AccountingService.create_journal_entry(
            db,
            description=f"Invoice Approved: {inv.invoice_number} - {vendor_name}",
            reference=f"INV-{inv.id}",
            lines=[
                {"account_id": expense_account.id, "debit": inv.total_amount, "credit": 0.0},
                {"account_id": ap_account.id, "debit": 0.0, "credit": inv.total_amount}
            ],
            user_id=user_id
        )
    except Exception as e:
        # Don't fail the whole request, but log it
        print(f"FAILED TO CREATE JOURNAL ENTRY: {e}")

@router.post("/review/{invoice_id}")
async def review_invoice(invoice_id: int, review: InvoiceReview, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    inv = db.query(models.Invoice).filter(models.Invoice.id == invoice_id, models.Invoice.user_id == user_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    from services.currency_service import CurrencyService
    base_currency = CurrencyService.get_base_currency(db, user_id)
    rate = CurrencyService.get_exchange_rate(db, user_id, inv.currency, base_currency)

    # Update Header
    inv.invoice_number = review.invoice_number
    inv.subtotal = review.subtotal
    inv.discount_amount = review.discount
    inv.tax_amount = review.tax
    inv.shipping_amount = review.shipping
    inv.total_amount = review.total
    inv.amount_base = review.total * rate
    inv.exchange_rate = rate
    inv.status = models.InvoiceStatus(review.status)
    
    if review.date:
        try:
            inv.issue_date = datetime.datetime.strptime(review.date, "%Y-%m-%d")
        except:
            pass
            
    if review.due_date:
        try:
            inv.due_date = datetime.datetime.strptime(review.due_date, "%Y-%m-%d")
        except:
            pass
    
    # Simplistic Line Item Sync: Delete and Re-create
    if review.line_items is not None:
        db.query(models.LineItem).filter(models.LineItem.invoice_id == inv.id).delete()
        for li in review.line_items:
            item = models.LineItem(
                invoice_id=inv.id,
                description=li.description,
                quantity=li.quantity,
                unit_price=li.unit_price,
                total_price=li.total
            )
            db.add(item)
            
    # Save approval comment if provided
    if review.approval_comment is not None:
        inv.approval_comment = review.approval_comment

    db.commit()

    # --- Accounting Engine Hook (Phase 21) ---
    if inv.status == models.InvoiceStatus.APPROVED:
        auto_post_journal(db, inv, review.vendor_name)

    return {"message": "Invoice reviewed and saved", "invoice_id": invoice_id}

@router.post("/{invoice_id}/validate")
async def validate_invoice(invoice_id: str, data: Dict[str, Any], db: Session = Depends(get_db)):
    """
    Intelligence Layer endpoint validating real-time changes against business rules.
    """
    # ensure we pass the id so duplicate check can exclude itself
    data["id"] = int(invoice_id) if invoice_id.isdigit() else invoice_id
    result = validate_invoice_data(data, db=db)
    return {"invoice_id": invoice_id, "validation": result.to_dict()}



@router.post("/{invoice_id}/pay")
async def pay_invoice(
    invoice_id: int, 
    bank_account_id: int = Form(...), 
    amount: float = Form(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["sub"]
    inv = db.query(models.Invoice).filter(models.Invoice.id == invoice_id, models.Invoice.user_id == user_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
        
    if inv.status == models.InvoiceStatus.PAID:
        raise HTTPException(status_code=400, detail="Invoice is already paid in full")
        
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Payment amount must be greater than zero")

    # 1. Verify Bank Account
    bank = db.query(models.BankAccount).filter(models.BankAccount.id == bank_account_id, models.BankAccount.user_id == user_id).first()
    if not bank:
        raise HTTPException(status_code=404, detail="Bank account not found")

    # 2. Update Invoice Paid Amount & Status
    inv.paid_amount = (inv.paid_amount or 0.0) + amount
    
    # Handle slight floating point errors, consider paid if it's within a cent
    if inv.total_amount - inv.paid_amount <= 0.01:
        inv.status = models.InvoiceStatus.PAID
        inv.paid_amount = inv.total_amount # Snap to exact total
    else:
        inv.status = models.InvoiceStatus.PARTIAL
    
    # 3. Create Bank Transaction
    from services.currency_service import CurrencyService
    base_currency = CurrencyService.get_base_currency(db, user_id)
    
    # Amount in bank account currency
    if bank.currency != inv.currency:
        rate_inv_to_bank = CurrencyService.get_exchange_rate(db, user_id, inv.currency, bank.currency)
        bank_amount = amount * rate_inv_to_bank
    else:
        bank_amount = amount

    # Amount in base currency for BankTransaction.amount_base
    rate_bank_to_base = CurrencyService.get_exchange_rate(db, user_id, bank.currency, base_currency)
    amount_base = bank_amount * rate_bank_to_base

    txn = models.BankTransaction(
        user_id=user_id,
        bank_account_id=bank_account_id,
        amount=-bank_amount, # Negative for outgoing AP payment
        amount_base=-amount_base,
        currency=bank.currency,
        exchange_rate=rate_bank_to_base,
        type="OUTGOING",
        reference=f"PAY-{inv.invoice_number}",
        date=datetime.datetime.now(datetime.timezone.utc)
    )
    db.add(txn)
    db.flush()

    # 4. Create Journal Entry (Debit AP / Credit Bank)
    bank_gl = db.query(models.Category).filter(
        models.Category.name == "Main Operating Account",
        models.Category.user_id == user_id
    ).first()
    if not bank_gl:
        bank_gl = models.Category(code="1000", name="Main Operating Account", type="Asset", user_id=user_id)
        db.add(bank_gl)
        db.flush()

    ap_account = db.query(models.Category).filter(
        models.Category.name == "Accounts Payable",
        models.Category.user_id == user_id
    ).first()
    if not ap_account:
        ap_account = models.Category(code="2000", name="Accounts Payable", type="Liability", user_id=user_id)
        db.add(ap_account)
        db.flush()

    AccountingService.create_journal_entry(
        db,
        description=f"Invoice Payment: {inv.invoice_number} ({'Partial' if inv.status == models.InvoiceStatus.PARTIAL else 'Full'})",
        reference=f"PAY-{inv.id}-{int(datetime.datetime.now(datetime.timezone.utc).timestamp())}",
        lines=[
            {"account_id": ap_account.id, "debit": amount, "credit": 0.0},
            {"account_id": bank_gl.id, "debit": 0.0, "credit": amount}
        ],
        user_id=user_id
    )
    
    db.commit()
    return {
        "message": f"Payment of {amount} applied", 
        "invoice_id": invoice_id, 
        "status": inv.status.value,
        "paid_amount": inv.paid_amount
    }

@router.delete("/{invoice_id}")
async def delete_invoice(invoice_id: str, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Deletes an invoice and its associated line items from the database."""
    user_id = current_user["sub"]
    inv = db.query(models.Invoice).filter(models.Invoice.id == invoice_id, models.Invoice.user_id == user_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
        
    # Delete associated line items first
    db.query(models.LineItem).filter(models.LineItem.invoice_id == inv.id).delete()
    
    # Delete the invoice itself
    db.delete(inv)
    db.commit()
    
    return {"message": f"Invoice {inv.invoice_number or invoice_id} deleted successfully"}


@router.post("/{id}/convert-to-receivable")
def convert_to_receivable(id: int, customer_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    invoice = db.query(models.Invoice).filter(models.Invoice.id == id, models.Invoice.user_id == user_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
        
    customer = db.query(models.Customer).filter(models.Customer.id == customer_id, models.Customer.user_id == user_id).first()
    if not customer:
        raise HTTPException(status_code=400, detail="Customer not found")

    # Create Receivable
    db_receivable = models.Receivable(
        user_id=user_id,
        invoice_number=invoice.invoice_number,
        customer_id=customer_id,
        issue_date=invoice.issue_date,
        due_date=invoice.due_date,
        total_amount=invoice.total_amount,
        amount_base=invoice.amount_base,
        currency=invoice.currency,
        exchange_rate=invoice.exchange_rate,
        pdf_path=invoice.pdf_path,
        status=models.ReceivableStatus.SENT
    )
    db.add(db_receivable)
    db.flush()

    # Move items
    for item in invoice.line_items:
        db_item = models.ReceivableLineItem(
            receivable_id=db_receivable.id,
            description=item.description,
            quantity=item.quantity,
            unit_price=item.unit_price,
            total_price=item.total_price
        )
        db.add(db_item)
    
    # Delete the source invoice (it is now a receivable)
    db.delete(invoice)
    db.commit()
    
    return {"receivable_id": db_receivable.id}
