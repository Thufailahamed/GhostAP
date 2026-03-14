from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models
from pydantic import BaseModel
from typing import Optional
from services.auth import get_current_user

router = APIRouter(prefix="/settings", tags=["Organization Settings"])

class CompanySettingsBase(BaseModel):
    company_name: Optional[str] = None
    base_currency: str = "USD"
    fiscal_year_start_month: int = 1

class CompanySettingsResponse(CompanySettingsBase):
    id: int
    model_config = {"from_attributes": True}

@router.get("/", response_model=CompanySettingsResponse)
def get_settings(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    settings = db.query(models.CompanySettings).filter(models.CompanySettings.user_id == user_id).first()
    if not settings:
        # Create default settings
        settings = models.CompanySettings(user_id=user_id, company_name="My Company", base_currency="USD")
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings

@router.patch("/", response_model=CompanySettingsResponse)
def update_settings(update: CompanySettingsBase, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    settings = db.query(models.CompanySettings).filter(models.CompanySettings.user_id == user_id).first()
    if not settings:
        settings = models.CompanySettings(user_id=user_id)
        db.add(settings)

    if update.company_name is not None:
        settings.company_name = update.company_name
    if update.base_currency is not None and update.base_currency != settings.base_currency:
        old_currency = settings.base_currency
        settings.base_currency = update.base_currency
        # Trigger historical re-calculation
        from services.currency_service import CurrencyService
        CurrencyService.recalculate_historical_data(db, user_id, update.base_currency, old_currency)
    
    if update.fiscal_year_start_month is not None:
        settings.fiscal_year_start_month = update.fiscal_year_start_month
        
    db.commit()
    db.refresh(settings)
    return settings

@router.get("/exchange-rates")
def get_supported_currencies():
    # Return a list of supported currencies for various dropdowns
    return {
        "base_available": ["USD", "EUR", "GBP", "INR", "CAD", "AUD", "JPY", "CNY", "BRL", "MXN", "AED"],
        "popular": ["USD", "EUR", "GBP", "INR", "CAD", "AED"]
    }
