import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

def migrate():
    print("🚀 Starting Receivable Line Items Migration...")
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    try:
        # Create receivable_line_items table
        print("Creating Table: receivable_line_items")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS receivable_line_items (
                id SERIAL PRIMARY KEY,
                receivable_id INTEGER REFERENCES receivables(id) ON DELETE CASCADE,
                product_id INTEGER REFERENCES products(id),
                description TEXT NOT NULL,
                quantity FLOAT DEFAULT 1.0,
                unit_price FLOAT DEFAULT 0.0,
                total_price FLOAT DEFAULT 0.0
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
