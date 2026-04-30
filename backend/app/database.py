from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings

# Build connection args conditionally — check_same_thread is SQLite-only
connect_args = {}
is_sqlite = settings.DATABASE_URL.startswith("sqlite")

if is_sqlite:
    connect_args["check_same_thread"] = False

# BUG-19: Configure connection pool for production workloads
# SQLite does not support pool_size/max_overflow — use NullPool-compatible defaults
engine_kwargs = {
    "connect_args": connect_args,
    "pool_pre_ping": True,        # Verify connections before use
    "pool_recycle": 1800,         # Recycle connections every 30 min (prevents stale connections)
}

if not is_sqlite:
    # PostgreSQL / other full-featured databases
    engine_kwargs["pool_size"] = settings.DB_POOL_SIZE
    engine_kwargs["max_overflow"] = settings.DB_MAX_OVERFLOW
    engine_kwargs["pool_timeout"] = 30

engine = create_engine(settings.DATABASE_URL, **engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()