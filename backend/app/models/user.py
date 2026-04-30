import uuid
from sqlalchemy import Column, String
from app.database import Base

class User(Base):
    __tablename__ = "users"

    # Changed from Postgres UUID to standard String
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    api_key = Column(String, unique=True, index=True)
    # BUG-06: Store SHA-256 hash of refresh token — never store raw token
    refresh_token_hash = Column(String(64), nullable=True)