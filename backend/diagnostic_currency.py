from sqlalchemy.orm import Session
from database import engine
import models

def diagnostic():
    db = Session(bind=engine)
    user_id = "ceac683c-ee3e-420f-a72a-88bf70b3ea8e"
    
    print("Checking for NULL amount_base fields...")
    
    models_to_check = [
        ("Invoice", models.Invoice),
        ("Receivable", models.Receivable),
        ("PurchaseOrder", models.PurchaseOrder),
        ("RecurringInvoice", models.RecurringInvoice),
        ("Subscription", models.Subscription),
        ("BankTransaction", models.BankTransaction),
        ("PaymentReceived", models.PaymentReceived)
    ]
    
    for name, model in models_to_check:
        count = db.query(model).filter(model.user_id == user_id, model.amount_base == None).count()
        total = db.query(model).filter(model.user_id == user_id).count()
        print(f"{name}: {count} NULLs out of {total} total records.")

if __name__ == "__main__":
    diagnostic()
