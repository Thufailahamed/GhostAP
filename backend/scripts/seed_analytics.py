from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import models

# Use invoices.db which we found contains data
DATABASE_URL = "sqlite:///./invoices.db"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def seed_categories():
    db = SessionLocal()
    try:
        # 1. Ensure categories exist
        cats = [
            {"code": "5000", "name": "Office Supplies", "type": models.CategoryType.EXPENSE},
            {"code": "5001", "name": "Software & Subscriptions", "type": models.CategoryType.EXPENSE},
            {"code": "5002", "name": "Utilities", "type": models.CategoryType.EXPENSE},
            {"code": "1000", "name": "Main Operating Account", "type": models.CategoryType.ASSET},
        ]
        
        db_cats = []
        for c in cats:
            existing = db.query(models.Category).filter(models.Category.code == c["code"]).first()
            if not existing:
                new_cat = models.Category(**c)
                db.add(new_cat)
                db.flush() # Get ID
                db_cats.append(new_cat)
            else:
                db_cats.append(existing)
        db.commit()
        
        # 2. Assign categories to line items
        line_items = db.query(models.LineItem).all()
        import random
        for li in line_items:
            if not li.category_id:
                li.category_id = random.choice(db_cats).id
        
        db.commit()
        print(f"Successfully seeded categories for {len(line_items)} line items.")
    finally:
        db.close()

if __name__ == "__main__":
    seed_categories()
