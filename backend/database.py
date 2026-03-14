from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os
from dotenv import load_dotenv

# Load .env here to ensure DATABASE_URL is available during engine initialization
load_dotenv()

# Default to local SQLite for development, but use DATABASE_URL (Supabase) if provided
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

if not SQLALCHEMY_DATABASE_URL:
    # Fallback for local dev if .env isn't set up yet
    SQLALCHEMY_DATABASE_URL = "sqlite:///./ghost_mvp.db"

# For PostgreSQL (Supabase), we don't need check_same_thread
# We also add pooling for better performance with cloud DBs
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_recycle=300,
    pool_pre_ping=True,
    connect_args={"check_same_thread": False} if "sqlite" in SQLALCHEMY_DATABASE_URL else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
