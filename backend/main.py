from fastapi import FastAPI, Request as FastApiRequest
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from routers import invoices, webhooks, categories, receivables, funds, analytics, financials, ledger, products, email_intake, recurring, cashflow, subscriptions, reconciliation, bank_sync, budgeting, purchase_orders, inventory, settings
from database import engine
import models
import os
import datetime
from dotenv import load_dotenv

# Load environment variables from .env file before importing database
load_dotenv()

# Create all database tables on startup
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AI Accounts Payable Ghost",
    description="Backend API for invoice processing and ERP entry",
    version="0.1.0",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Update for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("temp_storage", exist_ok=True)
app.mount("/static", StaticFiles(directory="temp_storage"), name="static")

from services.auth import get_current_user
from fastapi import Depends

app.include_router(invoices.router)
app.include_router(webhooks.router)
app.include_router(categories.router, prefix="/categories", tags=["Categories"], dependencies=[Depends(get_current_user)])
app.include_router(receivables.router)
app.include_router(funds.router, tags=["Funds Management"], dependencies=[Depends(get_current_user)])
app.include_router(analytics.router, dependencies=[Depends(get_current_user)])
app.include_router(financials.router, dependencies=[Depends(get_current_user)])
app.include_router(ledger.router, dependencies=[Depends(get_current_user)])
app.include_router(products.router, dependencies=[Depends(get_current_user)])
app.include_router(email_intake.router, dependencies=[Depends(get_current_user)])
app.include_router(recurring.router, dependencies=[Depends(get_current_user)])
app.include_router(cashflow.router, dependencies=[Depends(get_current_user)])
app.include_router(subscriptions.router, dependencies=[Depends(get_current_user)])
app.include_router(reconciliation.router, dependencies=[Depends(get_current_user)])
app.include_router(bank_sync.router, dependencies=[Depends(get_current_user)])
app.include_router(budgeting.router, dependencies=[Depends(get_current_user)])
app.include_router(purchase_orders.router, dependencies=[Depends(get_current_user)])
app.include_router(inventory.router, dependencies=[Depends(get_current_user)])
app.include_router(settings.router, dependencies=[Depends(get_current_user)])

@app.get("/")
def read_root():
    return {"status": "ok", "message": "AI Accounts Payable Ghost API is running"}
