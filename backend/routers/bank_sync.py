from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models
from pydantic import BaseModel
from typing import List, Optional
import datetime
import random
import uuid
import os
import requests
import json
from services.auth import get_current_user
from services.accounting_service import AccountingService

router = APIRouter(prefix="/bank-sync", tags=["Bank Sync"])

# --- Salt Edge Configuration ---
SALTEDGE_APP_ID = os.getenv('SALTEDGE_APP_ID')
SALTEDGE_SECRET = os.getenv('SALTEDGE_SECRET')
SALTEDGE_BASE_URL = "https://www.saltedge.com/api/v6"

SALTEDGE_HEADERS = {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "App-id": SALTEDGE_APP_ID or "",
    "Secret": SALTEDGE_SECRET or ""
}

# --- Schemas ---

class ConnectSessionResponse(BaseModel):
    connect_url: str

class CallbackData(BaseModel):
    connection_id: str
    customer_id: str
    secret: Optional[str] = None
    status: Optional[str] = "success"

class CallbackRequest(BaseModel):
    data: CallbackData
    meta: Optional[dict] = None

class BankConnectionResponse(BaseModel):
    id: int
    institution_name: str
    status: str
    last_sync: Optional[datetime.datetime]
    created_at: datetime.datetime
    model_config = {"from_attributes": True}

class LinkMockRequest(BaseModel):
    institution_name: str # e.g. "Chase", "Bank of America"

@router.post("/create-connect-session", response_model=ConnectSessionResponse)
def create_connect_session(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Creates a Salt Edge connect session and returns the connect_url."""
    user_id = current_user["sub"]
    
    # 1. Ensure Customer exists for this user in Salt Edge
    # For simplicity, we'll use a mocked/identifier or look up in connection
    # in a real app, you'd store saltedge_customer_id in a UserProfile model.
    # We'll just try to find an existing connection to steal the customer_id
    existing = db.query(models.BankConnection).filter(models.BankConnection.user_id == user_id).first()
    
    customer_id = existing.customer_id if existing else None
    
    if not customer_id:
        # Create Customer in Salt Edge
        payload = {"data": {"identifier": user_id}}
        res = requests.post(f"{SALTEDGE_BASE_URL}/customers", headers=SALTEDGE_HEADERS, json=payload)
        if res.status_code == 200:
            customer_id = res.json()["data"]["id"]
        elif res.status_code == 409:
            # Salt Edge often returns the existing customer ID in the error response for 409
            error_data = res.json()
            customer_id = error_data.get("data", {}).get("duplicated_customer_id")
            
            if not customer_id:
                # Fallback: Fetch existing customer by identifier
                list_res = requests.get(f"{SALTEDGE_BASE_URL}/customers?identifier={user_id}", headers=SALTEDGE_HEADERS)
                if list_res.status_code == 200:
                    customers_data = list_res.json().get("data", [])
                    # Find the exact match
                    match = next((c for c in customers_data if c.get("identifier") == user_id), None)
                    if match:
                        customer_id = match.get("id") or match.get("customer_id")
                    
            if not customer_id:
                raise HTTPException(status_code=409, detail=f"Conflict creating customer, and could not retrieve existing ID. Response: {res.text}")
        else:
            # Handle other errors
            raise HTTPException(status_code=res.status_code, detail=res.text)

    # 2. Create Connect Session
    session_payload = {
        "data": {
            "customer_id": customer_id,
            "consent": {
                "scopes": ["accounts", "transactions"],
                "from_date": (datetime.datetime.now() - datetime.timedelta(days=90)).strftime("%Y-%m-%d")
            },
            "attempt": {
                "return_to": "http://localhost:3000/dashboard/funds/connect?status=success"
            }
        }
    }
    
    session_res = requests.post(f"{SALTEDGE_BASE_URL}/connections/connect", headers=SALTEDGE_HEADERS, json=session_payload)
    if session_res.status_code == 200:
        return {"connect_url": session_res.json()["data"]["connect_url"]}
    else:
        raise HTTPException(status_code=session_res.status_code, detail=session_res.text)

@router.post("/callback")
def saltedge_callback(req: CallbackRequest, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Handled after Salt Edge redirect. We verify and save the connection."""
    user_id = current_user["sub"]
    
    # Fetch connection details from Salt Edge to confirm
    conn_id = req.data.connection_id
    cust_id = req.data.customer_id
    secret = req.data.secret
    
    conn_res = requests.get(f"{SALTEDGE_BASE_URL}/connections/{conn_id}", headers=SALTEDGE_HEADERS)
    if conn_res.status_code != 200:
        raise HTTPException(status_code=conn_res.status_code, detail="Could not verify connection with Salt Edge")
    
    conn_data = conn_res.json()["data"]
    
    # Save or update connection
    conn = db.query(models.BankConnection).filter(
        models.BankConnection.user_id == user_id,
        models.BankConnection.connection_id == conn_id
    ).first()
    
    if not conn:
        conn = models.BankConnection(
            user_id=user_id,
            connection_id=conn_id,
            customer_id=cust_id,
            secret=secret, # provided if first time
            institution_name=conn_data.get("provider_name", "Connected Bank"),
            status="ACTIVE"
        )
        db.add(conn)
    else:
        conn.status = "ACTIVE"
        if secret:
            conn.secret = secret

    db.commit()
    return {"status": "success"}

@router.get("/connections", response_model=List[BankConnectionResponse])
def get_connections(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    return db.query(models.BankConnection).filter(models.BankConnection.user_id == user_id).all()

@router.post("/link-mock")
def link_mock_bank(req: LinkMockRequest, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Simulates a secure bank link flow, creating a connection and accounts."""
    user_id = current_user["sub"]
    
    # 1. Create the Connection
    connection = models.BankConnection(
        user_id=user_id,
        institution_id=f"ins_{random.randint(100, 999)}",
        institution_name=req.institution_name,
        access_token=f"mock_access_token_{uuid.uuid4().hex[:8]}",
        item_id=f"item_{uuid.uuid4().hex[:12]}",
        status="ACTIVE"
    )
    db.add(connection)
    db.flush() # Get ID
    
    # 2. Create Mock Accounts for this connection
    account_types = [
        ("Checking", "checking", 5420.50),
        ("Business Savings", "savings", 125000.00),
        ("Corporate Credit", "credit card", -420.15)
    ]
    
    for name, subtype, bal in account_types:
        acc = models.BankAccount(
            user_id=user_id,
            connection_id=connection.id,
            name=f"{req.institution_name} {name}",
            official_name=f"{req.institution_name} {name} Account",
            account_number=f"xxxx-{random.randint(1000, 9999)}",
            bank_name=req.institution_name,
            type="depository" if subtype != "credit card" else "credit",
            subtype=subtype,
            currency="USD",
            external_id=f"acc_{uuid.uuid4().hex[:12]}",
            balance_current=bal,
            balance_available=bal * 0.98 if bal > 0 else bal
        )
        db.add(acc)
        
    db.commit()
    return {"message": f"Successfully linked {req.institution_name}", "connection_id": connection.id}

@router.post("/sync-all")
def sync_all_connections(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Fetches new transactions from all linked banks (Mock and Plaid)."""
    user_id = current_user["sub"]
    connections = db.query(models.BankConnection).filter(
        models.BankConnection.user_id == user_id,
        models.BankConnection.status == "ACTIVE"
    ).all()
    
    total_new_txns = 0
    
    for conn in connections:
        # Check if it's a Salt Edge connection (has connection_id and not mock)
        if conn.connection_id and not str(conn.connection_id).startswith("mock_"):
            try:
                # 1. Fetch Accounts from Salt Edge
                acc_res = requests.get(
                    f"{SALTEDGE_BASE_URL}/accounts?connection_id={conn.connection_id}", 
                    headers=SALTEDGE_HEADERS
                )
                if acc_res.status_code == 200:
                    plaid_accs = acc_res.json()["data"] # We'll reuse variable names for mapping logic
                    for s_acc in plaid_accs:
                        # Find or create account
                        db_acc = db.query(models.BankAccount).filter(
                            models.BankAccount.external_id == s_acc["id"]
                        ).first()
                        
                        if not db_acc:
                            db_acc = models.BankAccount(
                                user_id=user_id,
                                connection_id=conn.id,
                                name=s_acc["name"],
                                official_name=s_acc.get("official_name") or s_acc["name"],
                                account_number=s_acc.get("extra", {}).get("account_number") or "Unknown",
                                bank_name=conn.institution_name,
                                type=s_acc["nature"],
                                subtype=s_acc.get("extra", {}).get("account_type"),
                                currency=s_acc["currency_code"],
                                external_id=s_acc["id"],
                                balance_current=float(s_acc["balance"]),
                                balance_available=float(s_acc.get("available_amount", s_acc["balance"]))
                            )
                            db.add(db_acc)
                            db.flush()
                        else:
                            db_acc.balance_current = float(s_acc["balance"])
                            db_acc.balance_available = float(s_acc.get("available_amount", s_acc["balance"]))

                # 2. Fetch Transactions from Salt Edge
                txn_res = requests.get(
                    f"{SALTEDGE_BASE_URL}/transactions?connection_id={conn.connection_id}", 
                    headers=SALTEDGE_HEADERS
                )
                if txn_res.status_code == 200:
                    s_txns = txn_res.json()["data"]
                    for s_tx in s_txns:
                        # Deduplicate
                        existing_tx = db.query(models.BankTransaction).filter(
                            models.BankTransaction.external_id == s_tx["id"]
                        ).first()
                        
                        if not existing_tx:
                            # Map account ID
                            acc = db.query(models.BankAccount).filter(
                                models.BankAccount.external_id == s_tx["account_id"]
                            ).first()
                            
                            if acc:
                                from services.currency_service import CurrencyService
                                currency = s_tx["currency_code"]
                                amount = float(s_tx["amount"])
                                base_currency = CurrencyService.get_base_currency(db, user_id)
                                exchange_rate = CurrencyService.get_exchange_rate(db, user_id, currency, base_currency)
                                amount_base = amount * exchange_rate

                                db_tx = models.BankTransaction(
                                    user_id=user_id,
                                    bank_account_id=acc.id,
                                    external_id=s_tx["id"],
                                    date=datetime.datetime.strptime(s_tx["made_on"], "%Y-%m-%d"),
                                    amount=amount,
                                    amount_base=amount_base,
                                    currency=currency,
                                    exchange_rate=exchange_rate,
                                    type="INCOMING" if amount > 0 else "OUTGOING",
                                    reference=s_tx.get("extra", {}).get("check_number"),
                                    merchant_name=s_tx.get("extra", {}).get("merchant_name") or s_tx["description"],
                                    category=s_tx.get("category"),
                                    reconciled=False
                                )
                                db.add(db_tx)
                                total_new_txns += 1

            except Exception as e:
                print(f"Salt Edge sync error for {conn.institution_name}: {e}")
        
        else:
            # MOCK LOGIC (Fallback)
            accounts = db.query(models.BankAccount).filter(models.BankAccount.connection_id == conn.id).all()
            for acc in accounts:
                count = random.randint(1, 3)
                for _ in range(count):
                    from services.currency_service import CurrencyService
                    amount = random.uniform(10, 500)
                    currency = acc.currency or "USD"
                    base_currency = CurrencyService.get_base_currency(db, user_id)
                    exchange_rate = CurrencyService.get_exchange_rate(db, user_id, currency, base_currency)
                    amount_base = amount * exchange_rate

                    is_incoming = random.choice([True, False])
                    ext_id = f"txn_{uuid.uuid4().hex[:12]}"
                    db_tx = models.BankTransaction(
                        user_id=user_id,
                        bank_account_id=acc.id,
                        external_id=ext_id,
                        date=datetime.datetime.now(datetime.timezone.utc),
                        amount=amount if is_incoming else -amount,
                        amount_base=amount_base if is_incoming else -amount_base,
                        currency=currency,
                        exchange_rate=exchange_rate,
                        type="INCOMING" if is_incoming else "OUTGOING",
                        reference=f"MOCK-{random.randint(1000, 9999)}",
                        merchant_name="Mock Merchant",
                        reconciled=False
                    )
                    db.add(db_tx)
                    total_new_txns += 1
        
        conn.last_sync = datetime.datetime.now(datetime.timezone.utc)
        
    db.commit()
    return {"status": "success", "new_transactions": total_new_txns}
