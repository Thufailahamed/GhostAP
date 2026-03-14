"""Add missing columns to invoices.db (the actual database used by the server)."""
import sqlite3, os

db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'invoices.db')
print(f"Migrating: {db_path}")

conn = sqlite3.connect(db_path)
cur = conn.cursor()

# Show current columns
cur.execute('PRAGMA table_info(invoices)')
existing = [c[1] for c in cur.fetchall()]
print(f"Existing columns: {existing}")

migrations = [
    ("source", "ALTER TABLE invoices ADD COLUMN source VARCHAR DEFAULT 'UPLOAD'"),
    ("source_email_from", "ALTER TABLE invoices ADD COLUMN source_email_from VARCHAR"),
    ("source_email_subject", "ALTER TABLE invoices ADD COLUMN source_email_subject VARCHAR"),
    ("shipping_amount", "ALTER TABLE invoices ADD COLUMN shipping_amount FLOAT DEFAULT 0.0"),
]

for col, sql in migrations:
    if col in existing:
        print(f"  Already exists: {col}")
        continue
    try:
        cur.execute(sql)
        conn.commit()
        print(f"  Added: {col}")
    except Exception as e:
        print(f"  Error {col}: {e}")

# Verify
cur.execute('PRAGMA table_info(invoices)')
final = [c[1] for c in cur.fetchall()]
print(f"Final columns: {final}")
conn.close()
print("Done!")
