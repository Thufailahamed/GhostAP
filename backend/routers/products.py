from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models
from services.auth import get_current_user
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/products", tags=["Products & Services Catalog"])

class ProductCreate(BaseModel):
    name: str
    sku: Optional[str] = None
    unit_price: float = 0.0
    income_account_id: Optional[int] = None
    is_inventory_item: bool = False
    reorder_point: float = 0.0

class ProductResponse(BaseModel):
    id: int
    name: str
    sku: Optional[str]
    unit_price: float
    income_account_id: Optional[int]
    is_inventory_item: bool
    reorder_point: float
    quantity_on_hand: float
    average_cost: float
    
    model_config = {"from_attributes": True}

@router.get("/", response_model=List[ProductResponse])
def get_products(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Get the full catalog of products and services for the current user."""
    user_id = current_user["sub"]
    return db.query(models.ProductItem).filter(models.ProductItem.user_id == user_id).all()

@router.post("/", response_model=ProductResponse)
def create_product(product: ProductCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Create a new product or service item."""
    user_id = current_user["sub"]
    if product.sku:
        existing = db.query(models.ProductItem).filter(
            models.ProductItem.sku == product.sku,
            models.ProductItem.user_id == user_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="SKU already exists for this user.")
            
    if product.income_account_id:
        account = db.query(models.Category).filter(
            models.Category.id == product.income_account_id,
            models.Category.user_id == user_id
        ).first()
        if not account:
            raise HTTPException(status_code=400, detail="Income account not found or access denied.")
            
    db_product = models.ProductItem(
        user_id=user_id,
        name=product.name,
        sku=product.sku,
        unit_price=product.unit_price,
        income_account_id=product.income_account_id,
        is_inventory_item=product.is_inventory_item,
        reorder_point=product.reorder_point
    )
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product

@router.delete("/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Delete a product item from the catalog."""
    user_id = current_user["sub"]
    db_product = db.query(models.ProductItem).filter(
        models.ProductItem.id == product_id,
        models.ProductItem.user_id == user_id
    ).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found or access denied.")
        
    db.delete(db_product)
    db.commit()
    return {"message": "Product deleted successfully."}

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    unit_price: Optional[float] = None
    income_account_id: Optional[int] = None
    is_inventory_item: Optional[bool] = None
    reorder_point: Optional[float] = None

@router.patch("/{product_id}", response_model=ProductResponse)
def update_product(product_id: int, product: ProductUpdate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Update an existing product or service item."""
    user_id = current_user["sub"]
    db_product = db.query(models.ProductItem).filter(
        models.ProductItem.id == product_id,
        models.ProductItem.user_id == user_id
    ).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found or access denied.")
        
    update_data = product.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_product, key, value)
        
    db.commit()
    db.refresh(db_product)
    return db_product
