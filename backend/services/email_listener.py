"""
Real Gmail-to-Invoice pipeline.
Called by the Pub/Sub webhook in routers/webhooks.py when a new email arrives.
Uses the Gmail API to fetch the email, download PDF attachments, and run them
through the Gemini OCR pipeline to create real Invoice records.
"""
import os
import base64
import datetime
import logging
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Use readonly to match the existing token.json
# If you want to also mark emails as read, re-run the OAuth flow with:
# SCOPES = ['https://www.googleapis.com/auth/gmail.modify']
SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']


def get_gmail_service():
    """Initialize the Gmail API service using OAuth2 credentials."""
    try:
        from google.auth.transport.requests import Request
        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build

        creds = None

        # Try loading token with readonly scope first (matches existing token.json)
        if os.path.exists('token.json'):
            try:
                creds = Credentials.from_authorized_user_file('token.json', SCOPES)
            except Exception:
                # Try loading without scope validation (token may have been created with different scopes)
                creds = Credentials.from_authorized_user_file('token.json')

        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                logger.warning("No valid OAuth credentials found for Gmail.")
                return None

        return build('gmail', 'v1', credentials=creds)
    except Exception as e:
        logger.error(f"Failed to initialize Gmail service: {e}")
        return None


def get_latest_email_with_pdf(service, history_id: str):
    """
    Given a historyId, fetch the most recent email(s) that were added to inbox.
    Returns a list of message dicts with 'id' and 'threadId'.
    """
    if history_id == "SYNC":
        try:
            # For manual sync, we remove `is:unread` to catch anything missed previously,
            # rely on DB deduplication to skip duplicates, and increase the limit.
            result = service.users().messages().list(
                userId='me',
                q='has:attachment',
                maxResults=50
            ).execute()
            messages = result.get('messages', [])
            logger.info(f"Manual sync found {len(messages)} messages with attachments.")
            return messages
        except Exception as e:
            logger.error(f"Manual sync search failed: {e}")
            return []

    try:
        # Use historyId to get list of messages added since that point
        history = service.users().history().list(
            userId='me',
            startHistoryId=history_id,
            historyTypes=['messageAdded'],
            labelId='INBOX',
        ).execute()

        messages = []
        for record in history.get('history', []):
            for msg in record.get('messagesAdded', []):
                messages.append(msg['message'])
        
        if messages:
            return messages
            
        # If history yielded nothing (sometimes label additions don't show as messageAdded)
        logger.info("History API yielded no explicit messagesAdded, falling back to search.")
        raise ValueError("Empty history")
        
    except Exception as e:
        logger.error(f"Failed to get history from Gmail: {e}")
        # Fallback: get latest unread messages.
        # Gmail's search index takes a few seconds to update upon receiving an email.
        # Since the webhook fires instantly, we must wait before searching.
        import time
        logger.info("Waiting 5 seconds for Gmail index propagation before fallback search...")
        time.sleep(5)
        
        try:
            result = service.users().messages().list(
                userId='me',
                q='is:unread has:attachment',
                maxResults=5
            ).execute()
            messages = result.get('messages', [])
            logger.info(f"Fallback search found {len(messages)} unread messages with attachments.")
            return messages
        except Exception as e2:
            logger.error(f"Fallback message fetch failed: {e2}")
            return []


def download_pdf_attachment(service, message_id: str, msg_full: dict):
    """
    Extract the first PDF attachment from a Gmail message.
    Returns (filename, file_bytes) or (None, None).
    """
    try:
        payload = msg_full.get('payload', {})
        parts = payload.get('parts', [])

        # Flatten nested parts
        all_parts = []
        stack = list(parts)
        while stack:
            part = stack.pop()
            all_parts.append(part)
            if part.get('parts'):
                stack.extend(part['parts'])

        for part in all_parts:
            mime = part.get('mimeType', '')
            filename = part.get('filename', '')

            if 'pdf' in mime.lower() or filename.lower().endswith('.pdf'):
                body = part.get('body', {})
                attachment_id = body.get('attachmentId')

                if attachment_id:
                    attachment = service.users().messages().attachments().get(
                        userId='me',
                        messageId=message_id,
                        id=attachment_id
                    ).execute()
                    data = base64.urlsafe_b64decode(attachment['data'])
                    return filename or f"email_invoice_{message_id}.pdf", data
                elif body.get('data'):
                    data = base64.urlsafe_b64decode(body['data'])
                    return filename or f"email_invoice_{message_id}.pdf", data

        return None, None
    except Exception as e:
        logger.error(f"Failed to download PDF attachment: {e}")
        return None, None


def get_email_metadata(msg_full: dict):
    """Extract sender, subject, and target (Delivered-To or To) from email headers."""
    headers = msg_full.get('payload', {}).get('headers', [])
    sender = next((h['value'] for h in headers if h['name'].lower() == 'from'), 'Unknown')
    subject = next((h['value'] for h in headers if h['name'].lower() == 'subject'), 'No Subject')
    
    # Try Delivered-To first (set by forwarding), then fallback to To
    target = next((h['value'] for h in headers if h['name'].lower() == 'delivered-to'), None)
    if not target:
        target = next((h['value'] for h in headers if h['name'].lower() == 'to'), 'Unknown')
        
    # Clean up target (e.g. "Some Name <email@domain.com>" -> "email@domain.com")
    import re
    match = re.search(r'<([^>]+)>', target)
    clean_target = match.group(1).lower().strip() if match else target.lower().strip()
    
    return sender, subject, clean_target


def mark_as_read(service, message_id: str):
    """Mark an email as read so it isn't processed again."""
    try:
        service.users().messages().modify(
            userId='me',
            id=message_id,
            body={'removeLabelIds': ['UNREAD']}
        ).execute()
    except Exception as e:
        if '403' in str(e) or 'insufficientPermissions' in str(e):
            logger.info(f"Could not mark email as read (using read-only token).")
        else:
            logger.warning(f"Could not mark email as read: {e}")


def process_incoming_email(history_id: str, user_id: str = None):
    """
    Main entry point called by the Pub/Sub webhook.
    Fetches the latest email, downloads any PDF attachments,
    runs them through Gemini OCR, and saves real Invoice records.
    """
    logger.info(f"\n[EMAIL] 📧 Pub/Sub notification received — historyId: {history_id}")

    service = get_gmail_service()
    if not service:
        logger.error("[EMAIL] Gmail service unavailable. Cannot process email.")
        return False

    messages = get_latest_email_with_pdf(service, history_id)
    if not messages:
        logger.info("[EMAIL] No unread inbox messages with PDFs found.")
        if history_id == "SYNC":
            return {"status": "success", "processed": 0, "scanned": 0, "message": "No unread invoices found in email."}
        return False

    from services.ocr_service import perform_ocr
    from database import SessionLocal
    import models, uuid, shutil

    db = SessionLocal()
    processed = 0
    auto_approved = 0
    skipped_duplicates = 0
    skipped_non_invoice = 0
    skipped_no_pdf = 0

    try:
        for msg_ref in messages:
            message_id = msg_ref['id']

            # Robust database-backed deduplication check
            exists = db.query(models.Invoice).filter(
                models.Invoice.source_email_id == message_id,
                models.Invoice.user_id == user_id if user_id else True
            ).first()
            if exists:
                logger.info(f"[EMAIL] Skipping {message_id} — already stored in database.")
                skipped_duplicates += 1
                continue

            # Fetch the full message
            msg_full = service.users().messages().get(
                userId='me', id=message_id, format='full'
            ).execute()

            sender, subject, target_email = get_email_metadata(msg_full)
            logger.info(f"[EMAIL] Processing: From={sender} | To={target_email} | Subject={subject}")

            # --- Auth Check: Is this target email monitored? ---
            monitored_query = db.query(models.MonitoredEmail).filter(
                models.MonitoredEmail.email_address == target_email,
                models.MonitoredEmail.is_active == True
            )
            
            if user_id:
                monitored_query = monitored_query.filter(models.MonitoredEmail.user_id == user_id)
            
            monitored = monitored_query.first()

            if not monitored:
                logger.info(f"[EMAIL] REJECTED: Email sent to {target_email} which is not a registered Monitored Email.")
                if history_id != "SYNC":
                    mark_as_read(service, message_id)
                skipped_non_invoice += 1
                continue

            # Check if this looks like an invoice (keyword filter)
            keywords = ['invoice', 'bill', 'receipt', 'payment', 'po ', 'purchase order', 'order', 'statement']
            subject_lower = subject.lower()
            body_snippet = msg_full.get('snippet', '').lower()
            if not any(kw in subject_lower or kw in body_snippet for kw in keywords):
                logger.info(f"[EMAIL] Skipping — subject/body doesn't match invoice keywords.")
                if history_id != "SYNC":
                    mark_as_read(service, message_id)
                skipped_non_invoice += 1
                continue

            # Download PDF attachment
            filename, pdf_bytes = download_pdf_attachment(service, message_id, msg_full)
            if not pdf_bytes:
                logger.info("[EMAIL] No PDF attachment found. Skipping.")
                if history_id != "SYNC":
                    mark_as_read(service, message_id)
                skipped_no_pdf += 1
                continue

            # Save PDF to temp_storage
            os.makedirs("temp_storage", exist_ok=True)
            safe_filename = f"email_{message_id}_{filename}"
            file_path = f"temp_storage/{safe_filename}"
            with open(file_path, 'wb') as f:
                f.write(pdf_bytes)

            logger.info(f"[EMAIL] PDF saved: {file_path}")

            import time
            time.sleep(2) # Give the Gemini API breathing room before the next request

            # Run Gemini OCR
            extracted = perform_ocr(file_path)
            if not extracted:
                logger.error("[EMAIL] OCR extraction returned empty result.")
                continue

            logger.info(f"[EMAIL] OCR complete: {extracted.get('vendor_name')} | Total: {extracted.get('total')}")

            # Create or find vendor
            vendor_name = extracted.get("vendor_name", "Unknown Email Vendor")
            # If user_id is unknown, we might have a problem, but it should be set by monitored check
            current_user_id = user_id or monitored.user_id
            
            vendor = db.query(models.Vendor).filter(
                models.Vendor.name == vendor_name,
                models.Vendor.user_id == current_user_id
            ).first()
            if not vendor:
                import random
                vendor = models.Vendor(
                    name=vendor_name, 
                    tax_id=f"EMAIL-{random.randint(1000, 9999)}",
                    user_id=current_user_id
                )
                db.add(vendor)
                db.commit()
                db.refresh(vendor)

            # Parse date
            issue_dt = datetime.datetime.now(datetime.timezone.utc)
            raw_date = extracted.get("date", "")
            if raw_date and raw_date not in ("", "N/A", "null"):
                for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%B %d %Y", "%b %d %Y", "%B %d, %Y", "%b %d, %Y"):
                    try:
                        issue_dt = datetime.datetime.strptime(raw_date.strip(), fmt)
                        break
                    except:
                        continue

            due_dt = None
            raw_due = extracted.get("due_date", "")
            if raw_due and raw_due not in ("", "N/A", "null"):
                for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%B %d %Y", "%b %d %Y", "%B %d, %Y", "%b %d, %Y"):
                    try:
                        due_dt = datetime.datetime.strptime(raw_due.strip(), fmt)
                        break
                    except:
                        continue

            # --- Zero-Touch Validation Check ---
            from services.validation_service import validate_invoice_data
            
            extracted_conf = float(extracted.get("confidence_score", 0.0))
            val_payload = extracted.copy()
            val_payload["vendor_name"] = vendor.name 
            
            validation_result = validate_invoice_data(val_payload, db)
            
            final_status = models.InvoiceStatus.REVIEW_REQUIRED
            if extracted_conf >= 0.95 and validation_result.is_valid and len(validation_result.warnings) == 0:
                final_status = models.InvoiceStatus.APPROVED

            # Create Invoice record
            new_inv = models.Invoice(
                user_id=current_user_id,
                invoice_number=extracted.get("invoice_number") or f"EMAIL-{uuid.uuid4().hex[:6].upper()}",
                vendor_id=vendor.id,
                issue_date=issue_dt,
                due_date=due_dt,
                subtotal=extracted.get("subtotal", 0.0),
                discount_amount=extracted.get("discount", 0.0),
                tax_amount=extracted.get("tax", 0.0),
                shipping_amount=extracted.get("shipping", 0.0),
                total_amount=extracted.get("total", 0.0),
                currency=extracted.get("currency", "USD"),
                status=final_status,
                ai_confidence_score=extracted_conf,
                pdf_path=f"/static/{safe_filename}",
                source="EMAIL",
                source_email_id=message_id,
                source_email_from=sender,
                source_email_subject=subject,
                target_email=target_email,
            )
            db.add(new_inv)

            # Save line items
            for li in extracted.get("line_items", []):
                item = models.LineItem(
                    invoice_id=None,  # Will be set after commit
                    description=li.get("description", ""),
                    quantity=li.get("quantity", 1.0),
                    unit_price=li.get("unit_price", 0.0),
                    total_price=li.get("total", 0.0),
                )
                db.add(item)

            db.commit()
            db.refresh(new_inv)

            # Now fix line item invoice_id (since we didn't have the ID before)
            for item in db.query(models.LineItem).filter(models.LineItem.invoice_id == None).all():
                item.invoice_id = new_inv.id
            db.commit()

            # Mark email as read
            mark_as_read(service, message_id)
            processed += 1
            if final_status == models.InvoiceStatus.APPROVED:
                auto_approved += 1

            # --- Post Zero-Touch Accounting Entry if Auto-Approved ---
            if final_status == models.InvoiceStatus.APPROVED:
                from routers.invoices import auto_post_journal
                auto_post_journal(db, new_inv, vendor.name)

            logger.info(f"[EMAIL] ✅ Invoice #{new_inv.invoice_number} created from email. ID={new_inv.id} Status={final_status}")

    except Exception as e:
        logger.error(f"[EMAIL] Pipeline error: {e}")
        db.rollback()
    finally:
        db.close()

    logger.info(f"[EMAIL] Done. {processed} invoice(s) created from email ({auto_approved} auto-approved).")
    if history_id == "SYNC":
        msg = (
            f"Successfully synced {processed} new invoices out of {len(messages)} emails scanned.\n"
            f"🚀 {auto_approved} invoices were high-confidence and AUTO-APPROVED.\n\n"
            f"• {skipped_duplicates} emails were skipped (already in database)\n"
            f"• {skipped_non_invoice} emails were skipped (not invoices)\n"
            f"• {skipped_no_pdf} emails were skipped (no PDF format)"
        )
        return {"status": "success", "processed": processed, "scanned": len(messages), "message": msg}
    return processed > 0
