from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models
from services.auth import get_current_user
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()

class CategoryCreate(BaseModel):
    code: str
    name: str
    type: str # Revenue, Expense, Asset, Liability, Equity
    description: Optional[str] = None

class CategoryResponse(BaseModel):
    id: int
    code: str
    name: str
    type: str
    description: Optional[str]

    model_config = {"from_attributes": True}

@router.get("/", response_model=List[CategoryResponse])
def get_categories(type: Optional[str] = None, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    query = db.query(models.Category).filter(models.Category.user_id == user_id)
    if type:
        query = query.filter(models.Category.type == type)
    return query.all()

@router.post("/", response_model=CategoryResponse)
def create_category(category: CategoryCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    db_category = db.query(models.Category).filter(
        models.Category.code == category.code,
        models.Category.user_id == user_id
    ).first()
    if db_category:
        raise HTTPException(status_code=400, detail="Category code already registered for this user")
    
    db_category = models.Category(
        user_id=user_id,
        code=category.code,
        name=category.name,
        type=category.type,
        description=category.description
    )
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category

@router.delete("/{category_id}")
def delete_category(category_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    db_category = db.query(models.Category).filter(
        models.Category.id == category_id,
        models.Category.user_id == user_id
    ).first()
    if not db_category:
        raise HTTPException(status_code=404, detail="Category not found")
        
    db.delete(db_category)
    db.commit()
    return {"message": "Category deleted successfully"}
