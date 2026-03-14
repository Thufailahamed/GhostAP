import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

def migrate():
    print("Starting bank_transactions migration...")
    conn = psycopg2.connect(DATABASE_URL)
    with conn.cursor() as cur:
        # Check if columns exist first
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='bank_transactions'")
        columns = [row[0] for row in cur.fetchall()]
        
        if 'currency' not in columns:
            print("Adding 'currency' column...")
            cur.execute("ALTER TABLE bank_transactions ADD COLUMN currency VARCHAR DEFAULT 'USD'")
        
        if 'exchange_rate' not in columns:
            print("Adding 'exchange_rate' column...")
            cur.execute("ALTER TABLE bank_transactions ADD COLUMN exchange_rate FLOAT DEFAULT 1.0")
            
        if 'amount_base' not in columns:
            print("Adding 'amount_base' column...")
            cur.execute("ALTER TABLE bank_transactions ADD COLUMN amount_base FLOAT")
            # Update existing records
            print("Backfilling amount_base for existing records...")
            cur.execute("UPDATE bank_transactions SET amount_base = amount WHERE amount_base IS NULL")
        
        conn.commit()
    print("Migration completed successfully.")

if __name__ == "__main__":
    migrate()
