from fastapi import APIRouter, Depends, UploadFile, File, BackgroundTasks, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.user import User
from app.models.invoice import Invoice
from app.middleware.auth import get_current_user
from app.services.blob_storage import upload_file_to_blob
from app.services.azure_ai import analyze_invoice
from app.services.invoice_mapper import map_fields

router = APIRouter(prefix="/invoices", tags=["Invoices"])

def process_invoice_task(invoice_id: str, file_bytes: bytes, filename: str, db: Session):
    """Background task to handle the heavy lifting of uploading and AI extraction."""
    try:
        # 1. Upload to Azure Blob Storage
        file_url = upload_file_to_blob(file_bytes, filename)
        
        # 2. Call Azure Document Intelligence
        raw_fields = analyze_invoice(file_url)
        
        # 3. Map the messy Azure response to our clean API contract
        mapped_data = map_fields(raw_fields)
        
        # Calculate a rough average confidence score
        confidences = [v.get("confidence", 0.0) for k, v in mapped_data.items() if isinstance(v, dict) and "confidence" in v]
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
        
        # 4. Save everything to the database
        invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if invoice:
            invoice.file_url = file_url
            invoice.raw_json = str(raw_fields)  # Save raw string for debugging
            invoice.data_json = mapped_data     # Save structured JSON
            invoice.confidence = round(avg_confidence, 2)
            invoice.status = "completed"
            db.commit()
            
    except Exception as e:
        # If anything fails (e.g., Azure timeout), mark it as failed
        invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if invoice:
            invoice.status = "failed"
            db.commit()
        print(f"Background Task Error: {str(e)}")

@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_invoice(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Validate file type per best practices
    if not file.filename.lower().endswith(('.pdf', '.jpg', '.png')):
        raise HTTPException(status_code=400, detail="Only PDF, JPG, and PNG files are allowed")

    # Read bytes immediately before passing to the background task
    file_bytes = await file.read()
    
    # Create the initial "processing" record in the database
    new_invoice = Invoice(user_id=current_user.id, status="processing")
    db.add(new_invoice)
    db.commit()
    db.refresh(new_invoice)
    
    # Fire off the background task
    background_tasks.add_task(
        process_invoice_task, 
        invoice_id=new_invoice.id, 
        file_bytes=file_bytes, 
        filename=file.filename, 
        db=db
    )
    
    # Return immediately so the frontend can start polling
    return {"id": new_invoice.id, "status": new_invoice.status}

@router.get("/{invoice_id}")
def get_invoice(invoice_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id, Invoice.user_id == current_user.id).first()
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
        
    # Manually construct the response to match the contract schema
    return {
        "id": invoice.id,
        "status": invoice.status,
        "file_url": invoice.file_url,
        "created_at": invoice.created_at,
        "confidence_score": invoice.confidence,
        "data": invoice.data_json,  # This injects the mapped JSON
        "error_message": None if invoice.status != "failed" else "Processing failed"
    }

@router.get("/")
def list_invoices(skip: int = 0, limit: int = 20, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    invoices = db.query(Invoice).filter(Invoice.user_id == current_user.id).order_by(Invoice.created_at.desc()).offset(skip).limit(limit).all()
    
    total = db.query(Invoice).filter(Invoice.user_id == current_user.id).count()
    
    return {
        "items": [
            {
                "id": inv.id, 
                "status": inv.status, 
                "created_at": inv.created_at,
                "vendor_name": inv.data_json.get("vendor_name", {}).get("value") if inv.data_json else None,
                "total_amount": inv.data_json.get("total_amount", {}).get("value") if inv.data_json else None
            } for inv in invoices
        ],
        "total": total
    }