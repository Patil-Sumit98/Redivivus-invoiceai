import uuid
from sqlalchemy import Column, String, Float, ForeignKey, DateTime, Text, JSON
from sqlalchemy.sql import func
from app.database import Base

class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    user_id = Column(String(36), ForeignKey("users.id"))
    status = Column(String, default="processing")
    original_filename = Column(String)
    file_url = Column(String)
    raw_json = Column(Text)
    data_json = Column(JSON)
    confidence = Column(Float)
    error_detail = Column(String, nullable=True)   

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())