from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum, Boolean, TypeDecorator
from sqlalchemy.orm import relationship
from database import Base
import enum
import datetime

class UTCDateTime(TypeDecorator):
    """Custom DateTime type that ensure we always return timezone-aware UTC."""
    impl = DateTime
    cache_ok = True

    def process_result_value(self, value, dialect):
        if value is not None:
            return value.replace(tzinfo=datetime.timezone.utc)
        return value

class InvoiceStatus(str, enum.Enum):
    PENDING = "PENDING"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"
    APPROVED = "APPROVED"
    SYNCED_TO_ERP = "SYNCED_TO_ERP"
    PARTIAL = "PARTIAL"
    PAID = "PAID"
    REJECTED = "REJECTED"

class CategoryType(str, enum.Enum):
    REVENUE = "Revenue"
    EXPENSE = "Expense"
    ASSET = "Asset"
    LIABILITY = "Liability"
    EQUITY = "Equity"

class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True) # For multi-tenancy isolation
    code = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    type = Column(Enum(CategoryType), nullable=False)
    description = Column(String)

class CompanySettings(Base):
    __tablename__ = "company_settings"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, unique=True, index=True)
    company_name = Column(String)
    base_currency = Column(String, default="USD")
    fiscal_year_start_month = Column(Integer, default=1) # 1 = January

class CurrencyRate(Base):
    __tablename__ = "currency_rates"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True)
    from_currency = Column(String, nullable=False)
    to_currency = Column(String, nullable=False)
    rate = Column(Float, nullable=False)
    date = Column(UTCDateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

class Vendor(Base):
    __tablename__ = "vendors"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True) # For multi-tenancy isolation
    name = Column(String, index=True, nullable=False)
    tax_id = Column(String, unique=True, index=True)
    default_currency = Column(String, default="USD")
    default_category = Column(String)
    notes = Column(String, nullable=True)       # Free-text annotations
    is_flagged = Column(Boolean, default=False)  # Risk flag
    
    invoices = relationship("Invoice", back_populates="vendor")

class MonitoredEmail(Base):
    __tablename__ = "monitored_emails"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True) # For multi-tenancy isolation
    email_address = Column(String, unique=True, index=True, nullable=False)
    description = Column(String) # e.g., "Main Billing Inbox"
    is_active = Column(Boolean, default=True)
    created_at = Column(UTCDateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True) # For multi-tenancy isolation
    invoice_number = Column(String, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"))
    
    issue_date = Column(UTCDateTime)
    due_date = Column(UTCDateTime)
    
    subtotal = Column(Float)
    tax_amount = Column(Float, default=0.0)
    shipping_amount = Column(Float, default=0.0)
    discount_amount = Column(Float, default=0.0)
    total_amount = Column(Float)
    paid_amount = Column(Float, default=0.0)
    amount_base = Column(Float) # Amount in organization's base currency
    currency = Column(String, default="USD")
    exchange_rate = Column(Float, default=1.0) # Rate to convert to base currency
    
    status = Column(Enum(InvoiceStatus), default=InvoiceStatus.PENDING)
    ai_confidence_score = Column(Float) # 0.0 to 100.0
    
    # Path to the S3 bucket or local `/tmp/` folder saving the raw PDF
    pdf_path = Column(String)
    
    # Source tracking
    source = Column(String, default="UPLOAD")  # UPLOAD | EMAIL
    source_email_id = Column(String, unique=True, index=True, nullable=True)
    source_email_from = Column(String)
    source_email_subject = Column(String)
    target_email = Column(String, nullable=True) # The specific monitored inbox it arrived at
    
    # Approval audit trail
    approval_comment = Column(String, nullable=True)
    
    created_at = Column(UTCDateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    
    vendor = relationship("Vendor", back_populates="invoices")
    line_items = relationship("LineItem", back_populates="invoice", cascade="all, delete-orphan")

class LineItem(Base):
    __tablename__ = "line_items"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"))
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    
    description = Column(String)
    quantity = Column(Float, default=1.0)
    unit_price = Column(Float, default=0.0)
    total_price = Column(Float, default=0.0)

    invoice = relationship("Invoice", back_populates="line_items")
    category = relationship("Category")

class ReceivableStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SENT = "SENT"
    PARTIAL = "PARTIAL"
    PAID = "PAID"
    OVERDUE = "OVERDUE"

class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True) # For multi-tenancy isolation
    name = Column(String, index=True, nullable=False)
    payment_terms = Column(String, default="Net 30")
    
    receivables = relationship("Receivable", back_populates="customer")

class Receivable(Base):
    __tablename__ = "receivables"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True) # For multi-tenancy isolation
    invoice_number = Column(String, index=True, unique=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    
    issue_date = Column(UTCDateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    due_date = Column(UTCDateTime)
    
    total_amount = Column(Float, nullable=False)
    paid_amount = Column(Float, default=0.0)
    amount_base = Column(Float)
    currency = Column(String, default="USD")
    exchange_rate = Column(Float, default=1.0)
    
    # Path to the raw PDF/Document
    pdf_path = Column(String, nullable=True)
    
    status = Column(Enum(ReceivableStatus), default=ReceivableStatus.DRAFT)
    
    created_at = Column(UTCDateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    
    customer = relationship("Customer", back_populates="receivables")
    payments = relationship("PaymentReceived", back_populates="receivable")
    items = relationship("ReceivableLineItem", back_populates="receivable", cascade="all, delete-orphan")

class PaymentReceived(Base):
    __tablename__ = "payments_received"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True) # For multi-tenancy isolation
    receivable_id = Column(Integer, ForeignKey("receivables.id"), nullable=False)
    amount = Column(Float, nullable=False) # In Document Currency
    amount_base = Column(Float) # In Base Currency
    currency = Column(String, default="USD")
    exchange_rate = Column(Float, default=1.0)
    date = Column(UTCDateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    method = Column(String) # e.g. "Wire", "Check", "ACH"
    reference = Column(String) # e.g. transaction ID
    
    receivable = relationship("Receivable", back_populates="payments")

# --- Accounting Engine (Phase 21) ---

class JournalEntry(Base):
    __tablename__ = "journal_entries"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True) # For multi-tenancy isolation
    date = Column(UTCDateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    description = Column(String)
    reference = Column(String, index=True) # e.g. INV-2026-001
    
    lines = relationship("JournalLine", back_populates="journal")

class JournalLine(Base):
    __tablename__ = "journal_lines"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True) # For multi-tenancy isolation
    journal_id = Column(Integer, ForeignKey("journal_entries.id"), nullable=False)
    account_id = Column(Integer, ForeignKey("categories.id"), nullable=False) # Maps to COA
    debit = Column(Float, default=0.0)
    credit = Column(Float, default=0.0)
    
    journal = relationship("JournalEntry", back_populates="lines")
    account = relationship("Category")

class BankConnection(Base):
    __tablename__ = "bank_connections"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True)
    institution_id = Column(String)
    institution_name = Column(String)
    connection_id = Column(String, unique=True)
    customer_id = Column(String)
    secret = Column(String) # For a real app, this MUST be encrypted
    status = Column(String, default="ACTIVE") # ACTIVE, ERROR, DISCONNECTED
    last_sync = Column(UTCDateTime)
    created_at = Column(UTCDateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

    accounts = relationship("BankAccount", back_populates="connection")

class BankAccount(Base):
    __tablename__ = "bank_accounts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True) # For multi-tenancy isolation
    connection_id = Column(Integer, ForeignKey("bank_connections.id"), nullable=True)
    
    name = Column(String, nullable=False)
    official_name = Column(String)
    account_number = Column(String) # Masked or partial for sync
    bank_name = Column(String)
    type = Column(String, default="depository") # depository, credit, loan, etc
    subtype = Column(String) # checking, savings, credit card
    currency = Column(String, default="USD")
    
    external_id = Column(String, unique=True, index=True) # External unique ID (e.g. Plaid account_id)
    balance_available = Column(Float)
    balance_current = Column(Float)
    
    connection = relationship("BankConnection", back_populates="accounts")
    transactions = relationship("BankTransaction", back_populates="bank_account")

class BankTransaction(Base):
    __tablename__ = "bank_transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True) # For multi-tenancy isolation
    bank_account_id = Column(Integer, ForeignKey("bank_accounts.id"), nullable=False)
    journal_id = Column(Integer, ForeignKey("journal_entries.id"))
    
    external_id = Column(String, unique=True, index=True) # External unique ID (e.g. Plaid transaction_id)
    date = Column(UTCDateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    amount = Column(Float, nullable=False) # Positive for In, Negative for Out (Document Currency)
    amount_base = Column(Float) # Amount in organization's base currency
    currency = Column(String, default="USD")
    exchange_rate = Column(Float, default=1.0)
    type = Column(String) # INCOMING, OUTGOING, TRANSFER
    reference = Column(String)
    merchant_name = Column(String)
    category = Column(String) # Broad category from bank
    reconciled = Column(Boolean, default=False)
    
    bank_account = relationship("BankAccount", back_populates="transactions")
    journal = relationship("JournalEntry")

# --- Products & Estimates (Phase 29) ---

class ProductItem(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True) # For multi-tenancy isolation
    name = Column(String, index=True, nullable=False)
    sku = Column(String, unique=True, index=True)
    unit_price = Column(Float, default=0.0)
    income_account_id = Column(Integer, ForeignKey("categories.id")) # Maps to Revenue account in COA

    # Inventory Fields
    quantity_on_hand = Column(Float, default=0.0)
    reorder_point = Column(Float, default=0.0)
    average_cost = Column(Float, default=0.0)
    is_inventory_item = Column(Boolean, default=False)
    
    income_account = relationship("Category")

class EstimateStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SENT = "SENT"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    INVOICED = "INVOICED"

class Estimate(Base):
    __tablename__ = "estimates"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True) # For multi-tenancy isolation
    estimate_number = Column(String, index=True, unique=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    
    issue_date = Column(UTCDateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    valid_until = Column(UTCDateTime)
    
    total_amount = Column(Float, default=0.0)
    status = Column(Enum(EstimateStatus), default=EstimateStatus.DRAFT)
    
    customer = relationship("Customer")

# --- Recurring Invoices (Phase 30) ---

class RecurringFrequency(str, enum.Enum):
    WEEKLY = "WEEKLY"
    MONTHLY = "MONTHLY"
    QUARTERLY = "QUARTERLY"
    YEARLY = "YEARLY"

class RecurringInvoice(Base):
    __tablename__ = "recurring_invoices"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    description = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    amount_base = Column(Float)
    currency = Column(String, default="USD")
    exchange_rate = Column(Float, default=1.0)
    frequency = Column(Enum(RecurringFrequency), nullable=False)
    next_run_date = Column(UTCDateTime, nullable=False)
    last_run_date = Column(UTCDateTime, nullable=True)
    end_date = Column(UTCDateTime, nullable=True)  # null = runs forever
    is_active = Column(Boolean, default=True)
    auto_send_email = Column(Boolean, default=False)
    times_generated = Column(Integer, default=0)
    created_at = Column(UTCDateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

    customer = relationship("Customer")

# --- Subscriptions Management ---

class SubscriptionStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    CANCELLED = "CANCELLED"
    TRIAL = "TRIAL"

class BillingCycle(str, enum.Enum):
    MONTHLY = "MONTHLY"
    QUARTERLY = "QUARTERLY"
    ANNUALLY = "ANNUALLY"

class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True)
    name = Column(String, nullable=False)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=True)
    category = Column(String, default="General")
    cost = Column(Float, nullable=False)
    amount_base = Column(Float)
    currency = Column(String, default="USD")
    exchange_rate = Column(Float, default=1.0)
    billing_cycle = Column(Enum(BillingCycle), nullable=False, default=BillingCycle.MONTHLY)
    next_billing_date = Column(UTCDateTime, nullable=False)
    start_date = Column(UTCDateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    end_date = Column(UTCDateTime, nullable=True)
    status = Column(Enum(SubscriptionStatus), default=SubscriptionStatus.ACTIVE)
    notes = Column(String, nullable=True)
    created_at = Column(UTCDateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

    vendor = relationship("Vendor")
# --- Budgeting & Planning ---

class Budget(Base):
    __tablename__ = "budgets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True)
    name = Column(String, nullable=False) # e.g. "Fiscal Year 2026"
    fiscal_year = Column(Integer, nullable=False)
    is_active = Column(Boolean, default=True)
    notes = Column(String, nullable=True)
    created_at = Column(UTCDateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

class BudgetItem(Base):
    __tablename__ = "budget_items"

    id = Column(Integer, primary_key=True, index=True)
    budget_id = Column(Integer, ForeignKey("budgets.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    
    # Monthly targets
    jan_target = Column(Float, default=0.0)
    feb_target = Column(Float, default=0.0)
    mar_target = Column(Float, default=0.0)
    apr_target = Column(Float, default=0.0)
    may_target = Column(Float, default=0.0)
    jun_target = Column(Float, default=0.0)
    jul_target = Column(Float, default=0.0)
    aug_target = Column(Float, default=0.0)
    sep_target = Column(Float, default=0.0)
    oct_target = Column(Float, default=0.0)
    nov_target = Column(Float, default=0.0)
    dec_target = Column(Float, default=0.0)

    budget = relationship("Budget")
    category = relationship("Category")
# --- Purchase Orders (Phase 23) ---

class POStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    ISSUED = "ISSUED"
    PARTIALLY_RECEIVED = "PARTIALLY_RECEIVED"
    RECEIVED = "RECEIVED"
    BILLED = "BILLED"
    CANCELLED = "CANCELLED"

class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True)
    po_number = Column(String, index=True, unique=True, nullable=False)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False)
    
    issue_date = Column(UTCDateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    expected_delivery_date = Column(UTCDateTime, nullable=True)
    
    status = Column(Enum(POStatus), default=POStatus.DRAFT)
    total_amount = Column(Float, default=0.0)
    amount_base = Column(Float)
    currency = Column(String, default="USD")
    exchange_rate = Column(Float, default=1.0)
    notes = Column(String, nullable=True)
    created_at = Column(UTCDateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    
    vendor = relationship("Vendor")
    items = relationship("POLineItem", back_populates="purchase_order", cascade="all, delete-orphan")

class POLineItem(Base):
    __tablename__ = "po_line_items"

    id = Column(Integer, primary_key=True, index=True)
    po_id = Column(Integer, ForeignKey("purchase_orders.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    
    description = Column(String, nullable=False)
    quantity = Column(Float, default=1.0)
    unit_price = Column(Float, default=0.0)
    total_price = Column(Float, default=0.0)
    
    # Tracking fulfillment
    quantity_received = Column(Float, default=0.0)
    quantity_billed = Column(Float, default=0.0)

    purchase_order = relationship("PurchaseOrder", back_populates="items")
    product = relationship("ProductItem")

class InventoryMovement(Base):
    __tablename__ = "inventory_movements"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    user_id = Column(String, index=True)
    
    change_amount = Column(Float, nullable=False) # positive for intake, negative for sales
    new_quantity = Column(Float, nullable=False)
    
    reference_type = Column(String) # e.g. "PURCHASE", "SALE", "ADJUSTMENT"
    reference_id = Column(Integer, nullable=True) # ID of the PO or Invoice
    
    date = Column(UTCDateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    notes = Column(String, nullable=True)

    product = relationship("ProductItem")

class ReceivableLineItem(Base):
    __tablename__ = "receivable_line_items"

    id = Column(Integer, primary_key=True, index=True)
    receivable_id = Column(Integer, ForeignKey("receivables.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    
    description = Column(String, nullable=False)
    quantity = Column(Float, default=1.0)
    unit_price = Column(Float, default=0.0)
    total_price = Column(Float, default=0.0)
    
    receivable = relationship("Receivable", back_populates="items")
    product = relationship("ProductItem")
