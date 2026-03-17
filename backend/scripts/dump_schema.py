import sqlite3
import json

conn = sqlite3.connect('ghost_mvp.db')
cursor = conn.cursor()

cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = [t[0] for t in cursor.fetchall()]

schema = {}
for t in tables:
    cursor.execute(f"PRAGMA table_info({t})")
    schema[t] = [col[1] for col in cursor.fetchall()]

with open("schema_dump.json", "w") as f:
    json.dump(schema, f, indent=2)

print("Schema dumped to schema_dump.json")
