import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

def migrate():
    print("🚀 Starting Receivable PDF Column Migration...")
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        # Add pdf_path column if it doesn't exist
        print("Adding column: pdf_path to receivables")
        cur.execute("""
            ALTER TABLE receivables 
            ADD COLUMN IF NOT EXISTS pdf_path VARCHAR(255);
        """)

        conn.commit()
        print("✅ Migration completed successfully!")
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        if 'conn' in locals():
            conn.rollback()
    finally:
        if 'cur' in locals():
            cur.close()
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    migrate()
