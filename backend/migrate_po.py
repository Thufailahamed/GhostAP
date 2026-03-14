import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

def migrate():
    print("🚀 Starting Purchase Orders Module Migration...")
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    try:
        # 1. Create purchase_orders table
        print("Creating Table: purchase_orders")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS purchase_orders (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                po_number VARCHAR(255) UNIQUE NOT NULL,
                vendor_id INTEGER REFERENCES vendors(id),
                issue_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                expected_delivery_date TIMESTAMP WITH TIME ZONE,
                status VARCHAR(50) DEFAULT 'DRAFT',
                total_amount FLOAT DEFAULT 0.0,
                notes TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # 2. Create po_line_items table
        print("Creating Table: po_line_items")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS po_line_items (
                id SERIAL PRIMARY KEY,
                po_id INTEGER REFERENCES purchase_orders(id) ON DELETE CASCADE,
                product_id INTEGER REFERENCES products(id),
                description TEXT NOT NULL,
                quantity FLOAT DEFAULT 1.0,
                unit_price FLOAT DEFAULT 0.0,
                total_price FLOAT DEFAULT 0.0,
                quantity_received FLOAT DEFAULT 0.0,
                quantity_billed FLOAT DEFAULT 0.0
            );
        """)

        conn.commit()
        print("✅ Migration completed successfully!")
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    migrate()
