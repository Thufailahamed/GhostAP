from database import SessionLocal
import models
db = SessionLocal()
try:
    ar = db.query(models.Category).filter(models.Category.name == 'Accounts Receivable').first()
    if not ar:
        db.add(models.Category(code='1200', name='Accounts Receivable', type='Asset'))
    rev = db.query(models.Category).filter(models.Category.name == 'Sales Revenue').first()
    if not rev:
        db.add(models.Category(code='4000', name='Sales Revenue', type='Revenue'))
    db.commit()
    print('AR Seeding successful')
except Exception as e:
    print(f'Error: {e}')
    db.rollback()
finally:
    db.close()
