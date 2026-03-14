from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models
from pydantic import BaseModel
from typing import List, Optional
import datetime
from services.auth import get_current_user

from services.inventory_service import InventoryService

router = APIRouter(prefix="/inventory", tags=["Inventory & Stock Management"])

# --- Schemas ---

class StockAdjustment(BaseModel):
    product_id: int
    adjustment_amount: float
    notes: Optional[str] = None
    unit_cost: Optional[float] = None

class MovementResponse(BaseModel):
    id: int
    product_id: int
    change_amount: float
    new_quantity: float
    reference_type: Optional[str]
    date: datetime.datetime
    notes: Optional[str]
    
    model_config = {"from_attributes": True}

# --- Routes ---

@router.get("/movements/{product_id}", response_model=List[MovementResponse])
def get_movements(product_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    return db.query(models.InventoryMovement).filter(
        models.InventoryMovement.product_id == product_id,
        models.InventoryMovement.user_id == user_id
    ).order_by(models.InventoryMovement.date.desc()).all()

@router.post("/adjust")
def adjust_stock(adj: StockAdjustment, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    movement = InventoryService.record_movement(
        db, user_id, adj.product_id, adj.adjustment_amount, "ADJUSTMENT", 
        notes=adj.notes, unit_cost=adj.unit_cost
    )
    if not movement:
        raise HTTPException(status_code=404, detail="Product not found")
    db.commit()
    return {"message": "Stock adjusted", "new_quantity": movement.new_quantity}

@router.get("/low-stock")
def get_low_stock(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    return db.query(models.ProductItem).filter(
        models.ProductItem.user_id == user_id,
        models.ProductItem.is_inventory_item == True,
        models.ProductItem.quantity_on_hand <= models.ProductItem.reorder_point
    ).all()
