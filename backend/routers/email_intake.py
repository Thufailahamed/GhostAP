from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db
import models
from typing import List
from services.auth import get_current_user
from services.email_listener import process_incoming_email

router = APIRouter(
    prefix="/email-intake",
    tags=["email-intake"],
)

class MonitoredEmailCreate(BaseModel):
    email_address: str
    description: str = ""

class MonitoredEmailResponse(BaseModel):
    id: int
    email_address: str
    description: str
    is_active: bool

    model_config = {"from_attributes": True}

@router.get("/monitored-emails", response_model=List[MonitoredEmailResponse])
def get_monitored_emails(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    return db.query(models.MonitoredEmail).filter(models.MonitoredEmail.user_id == user_id).all()

@router.post("/monitored-emails", response_model=MonitoredEmailResponse)
def add_monitored_email(email: MonitoredEmailCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    addr = email.email_address.lower().strip()
    existing = db.query(models.MonitoredEmail).filter(
        models.MonitoredEmail.email_address == addr,
        models.MonitoredEmail.user_id == user_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="This email is already being monitored for your account.")
    
    new_email = models.MonitoredEmail(
        user_id=user_id,
        email_address=addr,
        description=email.description
    )
    db.add(new_email)
    db.commit()
    db.refresh(new_email)
    return new_email

@router.delete("/monitored-emails/{email_id}")
def remove_monitored_email(email_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    email = db.query(models.MonitoredEmail).filter(
        models.MonitoredEmail.id == email_id,
        models.MonitoredEmail.user_id == user_id
    ).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found or access denied")
    
    db.delete(email)
    db.commit()
    return {"message": "Email removed from monitored list"}

@router.post("/sync")
def manual_sync(current_user: dict = Depends(get_current_user)):
    """Trigger a manual scan of the master inbox for new invoices."""
    user_id = current_user["sub"]
    result = process_incoming_email("SYNC", user_id=user_id)
    if not result:
        raise HTTPException(status_code=500, detail="Email sync failed to start.")
    return result
