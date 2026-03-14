from database import engine
from sqlalchemy import text

def run_migrations():
    print("Starting migrations...")
    
    # List of SQL commands to run
    commands = [
        "ALTER TABLE bank_connections ADD COLUMN connection_id VARCHAR",
        "ALTER TABLE bank_connections ADD COLUMN customer_id VARCHAR",
        "ALTER TABLE bank_connections ADD COLUMN secret VARCHAR",
        "ALTER TABLE bank_accounts ADD COLUMN official_name VARCHAR",
        "ALTER TABLE bank_accounts ADD COLUMN account_number VARCHAR",
        "ALTER TABLE bank_accounts ADD COLUMN bank_name VARCHAR",
        "ALTER TABLE bank_accounts ADD COLUMN type VARCHAR DEFAULT 'depository'",
        "ALTER TABLE bank_accounts ADD COLUMN subtype VARCHAR",
        "ALTER TABLE bank_accounts ADD COLUMN currency VARCHAR DEFAULT 'USD'",
        "ALTER TABLE bank_accounts ADD COLUMN external_id VARCHAR",
        "ALTER TABLE bank_accounts ADD COLUMN balance_available FLOAT",
        "ALTER TABLE bank_accounts ADD COLUMN balance_current FLOAT",
        "ALTER TABLE bank_transactions ADD COLUMN external_id VARCHAR",
        "ALTER TABLE bank_transactions ADD COLUMN category VARCHAR"
    ]
    
    for cmd in commands:
        try:
            with engine.connect() as conn:
                conn.execute(text(cmd))
                conn.commit()
                print(f"Success: {cmd}")
        except Exception as e:
            if "already exists" in str(e).lower():
                print(f"Skipped (already exists): {cmd}")
            else:
                print(f"Error on {cmd}: {e}")
                
    print("Migrations complete.")

if __name__ == "__main__":
    run_migrations()
