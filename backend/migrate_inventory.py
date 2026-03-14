import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

def migrate():
    print("🚀 Starting Advanced Inventory Module Migration...")
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    try:
        # 1. Update products table
        print("Updating Table: products")
        cur.execute("""
            ALTER TABLE products 
            ADD COLUMN IF NOT EXISTS quantity_on_hand FLOAT DEFAULT 0.0,
            ADD COLUMN IF NOT EXISTS reorder_point FLOAT DEFAULT 0.0,
            ADD COLUMN IF NOT EXISTS average_cost FLOAT DEFAULT 0.0,
            ADD COLUMN IF NOT EXISTS is_inventory_item BOOLEAN DEFAULT FALSE;
        """)

        # 2. Create inventory_movements table
        print("Creating Table: inventory_movements")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS inventory_movements (
                id SERIAL PRIMARY KEY,
                product_id INTEGER REFERENCES products(id),
                user_id VARCHAR(255) NOT NULL,
                change_amount FLOAT NOT NULL,
                new_quantity FLOAT NOT NULL,
                reference_type VARCHAR(50),
                reference_id INTEGER,
                date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                notes TEXT
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
