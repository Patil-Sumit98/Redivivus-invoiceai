import uuid
from sqlalchemy import Column, String, Integer, Boolean, ForeignKey, DateTime, Text, JSON
from sqlalchemy.sql import func
from app.database import Base

class Webhook(Base):
    __tablename__ = "webhooks"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    url = Column(String(500), nullable=False)
    secret = Column(String(64), nullable=False)
    is_active = Column(Boolean, default=True)
    events = Column(JSON, nullable=False) # e.g. ["invoice.completed", "invoice.needs_review"]
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class WebhookDelivery(Base):
    __tablename__ = "webhook_deliveries"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    webhook_id = Column(String(36), ForeignKey("webhooks.id"), nullable=False, index=True)
    invoice_id = Column(String(36), ForeignKey("invoices.id"), nullable=True, index=True)
    status = Column(String(32), default="pending") # pending, delivered, failed
    http_status_code = Column(Integer, nullable=True)
    response_body = Column(Text, nullable=True)
    attempts = Column(Integer, default=0)
    last_attempt_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
