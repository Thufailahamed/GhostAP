from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from services.reporting_service import ReportingService
from typing import Optional
import datetime
from services.auth import get_current_user

router = APIRouter(
    prefix="/financials",
    tags=["financials"]
)

@router.get("/pnl")
def get_profit_and_loss(
    start_date: Optional[datetime.date] = None,
    end_date: Optional[datetime.date] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get the Profit and Loss statement."""
    user_id = current_user["sub"]
    return ReportingService.generate_profit_and_loss(db, start_date, end_date, user_id=user_id)

@router.get("/balance-sheet")
def get_balance_sheet(
    as_of_date: Optional[datetime.date] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get the Balance Sheet statement."""
    user_id = current_user["sub"]
    # Default to today if not provided
    if not as_of_date:
        as_of_date = datetime.date.today()
    return ReportingService.generate_balance_sheet(db, as_of_date, user_id=user_id)
