"""
Migration: Add parent_id and is_system columns to categories table.
Run this script once to update an existing database.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

from database import engine
from sqlalchemy import text

def migrate():
    with engine.connect() as conn:
        # Add parent_id column
        try:
            conn.execute(text("ALTER TABLE categories ADD COLUMN parent_id INTEGER REFERENCES categories(id)"))
            print("Added parent_id column to categories")
        except Exception as e:
            print(f"parent_id column may already exist: {e}")
            conn.rollback()
        
        # Add is_system column
        try:
            conn.execute(text("ALTER TABLE categories ADD COLUMN is_system BOOLEAN DEFAULT FALSE"))
            print("Added is_system column to categories")
        except Exception as e:
            print(f"is_system column may already exist: {e}")
            conn.rollback()

        # Drop the unique constraint on code if it exists — codes should be unique per user, not globally
        try:
            conn.execute(text("ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_code_key"))
            print("Dropped global unique constraint on categories.code")
        except Exception as e:
            print(f"No unique constraint to drop: {e}")
            conn.rollback()

        conn.commit()
        print("Migration complete!")

if __name__ == "__main__":
    migrate()
