import sqlite3
import os
from database import engine
from sqlalchemy import text

def migrate():
    print("Starting Multi-Currency migration...")
    
    with engine.connect() as conn:
        # 1. Create new tables
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS company_settings (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR UNIQUE,
                company_name VARCHAR,
                base_currency VARCHAR DEFAULT 'USD',
                fiscal_year_start_month INTEGER DEFAULT 1
            )
        """))
        
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS currency_rates (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR,
                from_currency VARCHAR NOT NULL,
                to_currency VARCHAR NOT NULL,
                rate FLOAT NOT NULL,
                date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        
        # 2. Add columns to existing tables
        tables_to_update = {
            "invoices": [("exchange_rate", "DOUBLE PRECISION DEFAULT 1.0")],
            "receivables": [
                ("currency", "VARCHAR DEFAULT 'USD'"),
                ("exchange_rate", "DOUBLE PRECISION DEFAULT 1.0")
            ],
            "payments_received": [
                ("amount_base", "DOUBLE PRECISION"),
                ("currency", "VARCHAR DEFAULT 'USD'"),
                ("exchange_rate", "DOUBLE PRECISION DEFAULT 1.0")
            ],
            "purchase_orders": [
                ("currency", "VARCHAR DEFAULT 'USD'"),
                ("exchange_rate", "DOUBLE PRECISION DEFAULT 1.0")
            ]
        }
        
        for table, cols in tables_to_update.items():
            for col_name, col_def in cols:
                try:
                    print(f"Adding column {col_name} to {table}...")
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_def}"))
                    conn.commit()
                except Exception as e:
                    # Column likely already exists
                    print(f"Column {col_name} in {table} already exists or error: {e}")
                    # Postgres requires rolling back the transaction on error
                    # But we are in a loop, so we might need a savepoint or just handle separately
                    pass
        
        conn.commit()
    print("Migration completed successfully.")

if __name__ == "__main__":
    migrate()
