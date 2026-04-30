from pydantic import BaseModel
from typing import List, Optional, Any
from datetime import datetime

# Represents a single extracted field and how confident the AI is
class ConfidenceField(BaseModel):
    value: Any
    confidence: float

# Represents a single row in the invoice table
class LineItem(BaseModel):
    description: Optional[str] = None
    quantity: Optional[float] = None
    rate: Optional[float] = None
    amount: Optional[float] = None
    hsn_code: Optional[str] = None

# The mapped, clean data payload
class InvoiceData(BaseModel):
    vendor_name: Optional[ConfidenceField] = None
    vendor_gstin: Optional[ConfidenceField] = None
    invoice_number: Optional[ConfidenceField] = None
    invoice_date: Optional[ConfidenceField] = None
    buyer_name: Optional[ConfidenceField] = None
    buyer_gstin: Optional[ConfidenceField] = None
    subtotal: Optional[ConfidenceField] = None
    cgst: Optional[ConfidenceField] = None
    sgst: Optional[ConfidenceField] = None
    igst: Optional[ConfidenceField] = None
    total_amount: Optional[ConfidenceField] = None
    line_items: List[LineItem] = []

# The final response returned by your GET /invoices/{id} endpoint
class InvoiceResponse(BaseModel):
    id: str
    status: str
    file_url: Optional[str] = None
    created_at: datetime
    confidence_score: Optional[float] = None
    data: Optional[InvoiceData] = None
    error_message: Optional[str] = None

    class Config:
        from_attributes = True  # Allows Pydantic to read your SQLAlchemy model