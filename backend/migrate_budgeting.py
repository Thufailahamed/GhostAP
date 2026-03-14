import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

def migrate():
    print("🚀 Starting Budgeting Module Migration...")
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    try:
        # 1. Create budgets table
        print("Creating Table: budgets")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS budgets (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                name VARCHAR(255) NOT NULL,
                fiscal_year INTEGER NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                notes TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # 2. Create budget_items table
        print("Creating Table: budget_items")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS budget_items (
                id SERIAL PRIMARY KEY,
                budget_id INTEGER REFERENCES budgets(id) ON DELETE CASCADE,
                category_id INTEGER REFERENCES categories(id),
                jan_target FLOAT DEFAULT 0.0,
                feb_target FLOAT DEFAULT 0.0,
                mar_target FLOAT DEFAULT 0.0,
                apr_target FLOAT DEFAULT 0.0,
                may_target FLOAT DEFAULT 0.0,
                jun_target FLOAT DEFAULT 0.0,
                jul_target FLOAT DEFAULT 0.0,
                aug_target FLOAT DEFAULT 0.0,
                sep_target FLOAT DEFAULT 0.0,
                oct_target FLOAT DEFAULT 0.0,
                nov_target FLOAT DEFAULT 0.0,
                dec_target FLOAT DEFAULT 0.0
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
