"""
Migration: Change purchase_orders.po_number from globally unique to unique-per-user.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import engine
from sqlalchemy import text

def migrate():
    with engine.connect() as conn:
        print("Starting migration: purchase_orders uniqueness fix...")
        
        # 1. Drop existing global unique constraint if it exists
        # In SQLite, named constraints are tricky, but often it's just 'purchase_orders_po_number_key' in PG 
        # or we might need to recreate the table in SQLite.
        # Let's check the dialect first.
        dialect = engine.dialect.name
        
        if dialect == "sqlite":
            print("SQLite detected. Recreating table via temporary table to ensure constraints are updated...")
            conn.execute(text("BEGIN TRANSACTION;"))
            try:
                # SQLite doesn't support DROP CONSTRAINT easily. Standard way is:
                # 1. Create new table with correct schema
                # 2. Copy data
                # 3. Drop old table
                # 4. Rename new table
                
                conn.execute(text("ALTER TABLE purchase_orders RENAME TO purchase_orders_old;"))
                
                # Create new table with UniqueConstraint on (user_id, po_number)
                # Note: po_number is no longer unique at column level
                conn.execute(text("""
                    CREATE TABLE purchase_orders (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id VARCHAR,
                        po_number VARCHAR NOT NULL,
                        vendor_id INTEGER REFERENCES vendors(id),
                        issue_date DATETIME,
                        expected_delivery_date DATETIME,
                        status VARCHAR,
                        total_amount FLOAT,
                        amount_base FLOAT,
                        currency VARCHAR,
                        exchange_rate FLOAT,
                        notes VARCHAR,
                        created_at DATETIME,
                        UNIQUE(user_id, po_number)
                    );
                """))
                
                conn.execute(text("""
                    INSERT INTO purchase_orders (id, user_id, po_number, vendor_id, issue_date, expected_delivery_date, status, total_amount, amount_base, currency, exchange_rate, notes, created_at)
                    SELECT id, user_id, po_number, vendor_id, issue_date, expected_delivery_date, status, total_amount, amount_base, currency, exchange_rate, notes, created_at FROM purchase_orders_old;
                """))
                
                conn.execute(text("DROP TABLE purchase_orders_old;"))
                conn.execute(text("COMMIT;"))
                print("Table recreated successfully with composite unique constraint.")
            except Exception as e:
                conn.execute(text("ROLLBACK;"))
                print(f"Error during SQLite migration: {e}")
                raise
        else:
            # PostgreSQL
            try:
                conn.execute(text("ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_po_number_key"))
                conn.execute(text("ALTER TABLE purchase_orders ADD CONSTRAINT uq_user_po_number UNIQUE (user_id, po_number)"))
                conn.commit()
                print("PostgreSQL constraint updated successfully.")
            except Exception as e:
                print(f"Error during PG migration: {e}")
                conn.rollback()

    print("Migration complete!")

if __name__ == "__main__":
    migrate()
