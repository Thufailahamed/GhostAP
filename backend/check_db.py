from database import SessionLocal, engine
from sqlalchemy import text

def check_columns():
    with engine.connect() as conn:
        tables = ['bank_connections', 'bank_accounts', 'bank_transactions']
        for table in tables:
            print(f"\nColumns in {table}:")
            # For PostgreSQL/Supabase
            result = conn.execute(text(f"""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = '{table}'
            """))
            for row in result:
                print(f" - {row[0]} ({row[1]})")

if __name__ == "__main__":
    check_columns()
