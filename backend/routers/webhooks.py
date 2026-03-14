from fastapi import APIRouter, Request, BackgroundTasks, HTTPException
import base64
import json
import logging
from services.email_listener import process_incoming_email

logger = logging.getLogger(__name__)
router = APIRouter(
    prefix="/webhooks",
    tags=["webhooks"],
)

@router.post("/gmail/push")
async def gmail_pubsub_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Endpoint registered with Google Cloud Pub/Sub to receive push notifications
    when new emails arrive in the connected Gmail inbox.
    """
    try:
        body = await request.json()
        
        # Google Pub/Sub sends the payload in `message.data` base64 encoded
        message = body.get("message", {})
        data_b64 = message.get("data")
        
        if not data_b64:
            # As per the instruction, the original code raised HTTPException.
            # The provided "Code Edit" returns a dict. Sticking to the original behavior
            # of raising an exception for missing data, but will ensure the final
            # error handling catches it.
            raise HTTPException(status_code=400, detail="No data in Pub/Sub message")
            
        decoded_data = base64.b64decode(data_b64).decode("utf-8")
        payload = json.loads(decoded_data)
        
        email_address = payload.get("emailAddress", "Unknown")
        history_id = payload.get("historyId", "Unknown")
        
        print(f"\n[WEBHOOK] Received Gmail Push for {email_address} (History ID: {history_id})")
        
        # Process the incoming webhook through our intelligence pipeline in the background
        background_tasks.add_task(process_incoming_email, history_id)
        
        # Return 200 OK to acknowledge receipt to Google Pub/Sub
        # If we return anything else, Google will aggressively retry.
        return {"status": "success", "message": "Webhook processed successfully"}
        
    except Exception as e:
        logger.error(f"Failed to process Pub/Sub webhook: {e}")
        # Always return 200 to prevent pub/sub retry storms on malformed data, 
        # unless it's a transient processing issue
        return {"status": "error", "message": str(e)}
