import uuid
from sqlalchemy import Column, String, ForeignKey, DateTime, Text, JSON
from sqlalchemy.sql import func
from app.database import Base

class ReviewLog(Base):
    __tablename__ = "review_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    invoice_id = Column(String(36), ForeignKey("invoices.id"), nullable=False, index=True)
    reviewer_user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    
    # "APPROVED", "REJECTED", "EDITED"
    action = Column(String(32), nullable=False)
    
    before_data = Column(JSON, nullable=True)
    after_data = Column(JSON, nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
