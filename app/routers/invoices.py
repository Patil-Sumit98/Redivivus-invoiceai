from fastapi import APIRouter, Depends, UploadFile, File, BackgroundTasks, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db, SessionLocal
from app.models.user import User
from app.models.invoice import Invoice
from app.middleware.auth import get_current_user
from app.services.blob_storage import upload_file_to_blob
from app.services.azure_ai import analyze_invoice
from app.services.invoice_mapper import map_fields

router = APIRouter(prefix="/invoices", tags=["Invoices"])

ALLOWED_EXTENSIONS = {'.pdf', '.jpg', '.jpeg', '.png'}
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB

def process_invoice_task(invoice_id: str, file_bytes: bytes, filename: str):
    """Background task — creates its OWN DB session."""
    db = SessionLocal()
    try:
        file_url = upload_file_to_blob(file_bytes, filename)
        raw_fields = analyze_invoice(file_url)
        mapped_data = map_fields(raw_fields)

        confidences = [
            v.get("confidence", 0.0)
            for v in mapped_data.values()
            if isinstance(v, dict) and "confidence" in v
        ]
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

        invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if invoice:
            invoice.file_url = file_url
            invoice.raw_json = str(raw_fields)
            invoice.data_json = mapped_data
            invoice.confidence = round(avg_confidence, 4)
            invoice.status = "completed"
            db.commit()

    except Exception as e:
        print(f"[ERROR] Invoice {invoice_id}: {str(e)}")
        db.rollback()
        inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if inv:
            inv.status = "failed"
            db.commit()
    finally:
        db.close()


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_invoice(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    import os
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type {ext} not allowed. Use PDF, JPG, or PNG.")

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds 20MB limit")

    new_invoice = Invoice(
        user_id=current_user.id,
        status="processing",
        original_filename=file.filename
    )
    db.add(new_invoice)
    db.commit()
    db.refresh(new_invoice)

    background_tasks.add_task(
        process_invoice_task,
        invoice_id=new_invoice.id,
        file_bytes=file_bytes,
        filename=file.filename
    )

    return {"id": new_invoice.id, "status": new_invoice.status}


@router.get("/stats")
def get_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from sqlalchemy import func as sqlfunc
    base = db.query(Invoice).filter(Invoice.user_id == current_user.id)
    avg_conf = db.query(sqlfunc.avg(Invoice.confidence)).filter(
        Invoice.user_id == current_user.id, Invoice.status == "completed"
    ).scalar()
    return {
        "total": base.count(),
        "completed": base.filter(Invoice.status == "completed").count(),
        "processing": base.filter(Invoice.status == "processing").count(),
        "failed": base.filter(Invoice.status == "failed").count(),
        "avg_confidence": round(float(avg_conf or 0), 4)
    }


@router.get("/")
def list_invoices(
    skip: int = 0, limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    invoices = (
        db.query(Invoice)
        .filter(Invoice.user_id == current_user.id)
        .order_by(Invoice.created_at.desc())
        .offset(skip).limit(limit).all()
    )
    total = db.query(Invoice).filter(Invoice.user_id == current_user.id).count()

    return {
        "items": [
            {
                "id": inv.id,
                "status": inv.status,
                "original_filename": inv.original_filename,
                "created_at": inv.created_at,
                "confidence_score": inv.confidence,
                "vendor_name": inv.data_json.get("vendor_name", {}).get("value") if inv.data_json else None,
                "total_amount": inv.data_json.get("total_amount", {}).get("value") if inv.data_json else None,
                "invoice_number": inv.data_json.get("invoice_number", {}).get("value") if inv.data_json else None,
            }
            for inv in invoices
        ],
        "total": total
    }


@router.get("/{invoice_id}")
def get_invoice(
    invoice_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.user_id == current_user.id
    ).first()

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    return {
        "id": invoice.id,
        "status": invoice.status,
        "original_filename": invoice.original_filename,
        "file_url": invoice.file_url,
        "created_at": invoice.created_at,
        "confidence_score": invoice.confidence,
        "data": invoice.data_json,
        "error_message": "Processing failed" if invoice.status == "failed" else None
    }