import uuid
from sqlalchemy import Column, String, Float, ForeignKey, DateTime, Text, JSON, Integer
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

    source_type = Column(String, nullable=True) # GST_EINVOICE, GST_PDF, NON_GST, HANDWRITTEN, UNKNOWN
    ingestion_method = Column(String, nullable=True) # QR, OCR, HUMAN
    gst_rules_json = Column(JSON, nullable=True)
    idempotency_key = Column(String(64), nullable=True, unique=True, index=True)
    processing_time_ms = Column(Integer, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())