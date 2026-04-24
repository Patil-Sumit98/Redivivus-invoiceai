import hashlib
import logging
import io
import csv

from fastapi import APIRouter, Depends, UploadFile, File, BackgroundTasks, HTTPException, status, Header
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc
from app.database import get_db, SessionLocal
from app.models.user import User
from app.models.invoice import Invoice
from app.middleware.auth import get_current_user
from app.middleware.rate_limit import rate_limited_user
from app.services.blob_storage import upload_file_to_blob
from app.services.azure_ai import analyze_invoice
from app.services.invoice_mapper import map_fields, map_gst_qr_to_canonical

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s [%(name)s] %(message)s")

router = APIRouter(prefix="/invoices", tags=["Invoices"])

ALLOWED_EXTENSIONS = {'.pdf', '.jpg', '.jpeg', '.png'}
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB

# ── File magic bytes signatures ─────────────────
FILE_SIGNATURES = {
    '.pdf':  [b'%PDF'],
    '.jpg':  [b'\xff\xd8\xff'],
    '.jpeg': [b'\xff\xd8\xff'],
    '.png':  [b'\x89PNG'],
}


def _validate_file_magic(file_bytes: bytes, ext: str) -> bool:
    """Verify actual file content matches the claimed extension."""
    sigs = FILE_SIGNATURES.get(ext, [])
    if not sigs:
        return True  # No known signature, allow
    return any(file_bytes[:len(sig)] == sig for sig in sigs)


def process_invoice_task(invoice_id: str, file_bytes: bytes, filename: str, blob_url: str):
    """BUG-23: blob_url is pre-uploaded by the endpoint to free memory sooner."""
    import time
    logger = logging.getLogger(__name__)
    start_time = time.monotonic()
    db = SessionLocal()
    try:
        logger.info(f"[invoice:{invoice_id}] Processing started")

        from app.services.qr_detector import detect_gst_qr
        from app.services.confidence_engine import compute_confidence
        from app.services.gst_rules import run_gst_rules

        # STEP 1: QR Detection (try first — zero AI cost)
        qr_data = detect_gst_qr(file_bytes, filename)

        if qr_data:
            logger.info(f"[invoice:{invoice_id}] QR code detected — skipping Azure AI")
            mapped_data = map_gst_qr_to_canonical(qr_data)
            source_type = "GST_EINVOICE"
            ingestion_method = "QR"
        else:
            logger.info(f"[invoice:{invoice_id}] No QR — sending to Azure AI OCR")
            raw_fields = analyze_invoice(blob_url)
            mapped_data = map_fields(raw_fields)
            source_type = "GST_PDF"
            ingestion_method = "OCR"

        # STEP 2: GST Rules validation
        gst_result = run_gst_rules(mapped_data)

        # STEP 3: Confidence scoring and routing
        conf_result = compute_confidence(mapped_data)

        # STEP 4: Save
        elapsed_ms = int((time.monotonic() - start_time) * 1000)
        invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if invoice:
            invoice.file_url = blob_url
            invoice.data_json = mapped_data
            invoice.confidence = conf_result["overall_score"]
            invoice.status = conf_result["status"]
            invoice.source_type = source_type
            invoice.ingestion_method = ingestion_method
            invoice.gst_rules_json = gst_result
            invoice.processing_time_ms = elapsed_ms
            db.commit()
            logger.info(
                f"[invoice:{invoice_id}] Done. status={invoice.status} "
                f"confidence={invoice.confidence} time={elapsed_ms}ms"
            )

            from app.services.webhook_service import trigger_webhooks_for_invoice
            trigger_webhooks_for_invoice(invoice.id, invoice.user_id, "invoice.completed")
    except Exception as e:
        logger.error(f"[invoice:{invoice_id}] Failed: {e}", exc_info=True)
        db.rollback()
        inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if inv:
            inv.status = "HUMAN_REQUIRED"
            inv.error_detail = str(e)[:500]
            db.commit()
    finally:
        db.close()


@router.post("/upload", status_code=status.HTTP_202_ACCEPTED)
async def upload_invoice(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    x_idempotency_key: str = Header(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(rate_limited_user),
):
    import os

    # Handle idempotency
    hashed_key = None
    if x_idempotency_key:
        hashed_key = hashlib.sha256(x_idempotency_key.encode("utf-8")).hexdigest()
        existing_invoice = db.query(Invoice).filter(
            Invoice.user_id == current_user.id,
            Invoice.idempotency_key == hashed_key,
        ).first()

        if existing_invoice:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "id": existing_invoice.id,
                    "status": existing_invoice.status,
                    "source_type": existing_invoice.source_type or "UNKNOWN",
                    "ingestion_method": existing_invoice.ingestion_method or "PENDING",
                },
            )

    # Extension check
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{ext}' not allowed. Use PDF, JPG, or PNG.",
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds 20MB limit.")

    # Magic bytes validation (Fix #9)
    if not _validate_file_magic(file_bytes, ext):
        raise HTTPException(
            status_code=400,
            detail="File content does not match the claimed extension. Possible corrupted or disguised file.",
        )

    from sqlalchemy.exc import IntegrityError

    new_invoice = Invoice(
        user_id=current_user.id,
        status="processing",
        original_filename=file.filename,
        idempotency_key=hashed_key,
        source_type="UNKNOWN",
        ingestion_method="PENDING",
    )

    # BUG-08: Handle race condition on idempotency key
    try:
        db.add(new_invoice)
        db.commit()
        db.refresh(new_invoice)
    except IntegrityError:
        db.rollback()
        # Re-fetch the existing invoice that won the race
        existing = db.query(Invoice).filter(
            Invoice.user_id == current_user.id,
            Invoice.idempotency_key == hashed_key,
        ).first()
        if existing:
            return JSONResponse(
                status_code=200,
                content={"id": existing.id, "status": existing.status},
            )
        raise HTTPException(status_code=500, detail="Unexpected conflict during upload.")

    # BUG-23: Upload to blob here so file_bytes can be GC'd sooner
    blob_url = upload_file_to_blob(file_bytes, file.filename)

    background_tasks.add_task(
        process_invoice_task,
        invoice_id=new_invoice.id,
        file_bytes=file_bytes,
        filename=file.filename,
        blob_url=blob_url,
    )

    return {
        "id": new_invoice.id,
        "status": new_invoice.status,
        "source_type": new_invoice.source_type,
        "ingestion_method": new_invoice.ingestion_method,
    }


@router.get("/stats")
def get_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fix #8: Count all final-positive statuses as 'completed',
    and all review statuses as one number."""
    total = db.query(Invoice).filter(Invoice.user_id == current_user.id).count()

    # Completed = legacy "completed" + new "AUTO_APPROVED" + "VERIFIED"
    completed = db.query(Invoice).filter(
        Invoice.user_id == current_user.id,
        Invoice.status.in_(["completed", "AUTO_APPROVED", "VERIFIED"]),
    ).count()

    processing = db.query(Invoice).filter(
        Invoice.user_id == current_user.id,
        Invoice.status.in_(["processing", "NEEDS_REVIEW", "HUMAN_REQUIRED"]),
    ).count()

    failed = db.query(Invoice).filter(
        Invoice.user_id == current_user.id,
        Invoice.status.in_(["failed", "REJECTED"]),
    ).count()

    avg_conf = db.query(sqlfunc.avg(Invoice.confidence)).filter(
        Invoice.user_id == current_user.id,
        Invoice.status.in_(["completed", "AUTO_APPROVED", "VERIFIED"]),
    ).scalar()

    return {
        "total": total,
        "completed": completed,
        "processing": processing,
        "failed": failed,
        "avg_confidence": round(float(avg_conf or 0), 4),
    }


# BUG-18: Safe extraction from data_json that handles non-dict or corrupted values
def _safe_get(data_json, field):
    if not isinstance(data_json, dict):
        return None
    field_data = data_json.get(field, {})
    if isinstance(field_data, dict):
        return field_data.get("value")
    return None


@router.get("/")
def list_invoices(
    skip: int = 0,
    limit: int = 20,
    status: str = None,
    search: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # BUG-17: Server-side filtering instead of client-side over 1000 records
    query = db.query(Invoice).filter(Invoice.user_id == current_user.id)

    if status and status != "All":
        status_map = {
            "Processing": ["processing"],
            "Auto-Approved": ["AUTO_APPROVED", "completed", "VERIFIED"],
            "Needs Review": ["NEEDS_REVIEW", "HUMAN_REQUIRED"],
            "Failed": ["failed", "REJECTED"],
        }
        status_values = status_map.get(status, [status])
        query = query.filter(Invoice.status.in_(status_values))

    # Search by vendor name or invoice number (server-side)
    if search and search.strip():
        search_term = f"%{search.strip()}%"
        # Since vendor_name is inside JSON, we do a broad text search on data_json
        query = query.filter(
            Invoice.original_filename.ilike(search_term)
        )

    total = query.count()

    invoices = (
        query
        .order_by(Invoice.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return {
        "items": [
            {
                "id": inv.id,
                "status": inv.status,
                "original_filename": inv.original_filename,
                "created_at": inv.created_at,
                "confidence_score": inv.confidence,
                "vendor_name": _safe_get(inv.data_json, "vendor_name"),
                "total_amount": _safe_get(inv.data_json, "total_amount"),
                "invoice_number": _safe_get(inv.data_json, "invoice_number"),
                "ingestion_method": inv.ingestion_method,
                "source_type": inv.source_type,
            }
            for inv in invoices
        ],
        "total": total,
    }


@router.get("/{invoice_id}")
def get_invoice(
    invoice_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.user_id == current_user.id,
    ).first()

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found.")

    file_url = invoice.file_url
    if file_url:
        try:
            from app.services.blob_storage import generate_sas_url
            from app.config import settings
            blob_name = file_url.split('?')[0].split('/')[-1]
            file_url = generate_sas_url(blob_name, settings.AZURE_STORAGE_CONTAINER_NAME)
        except Exception:
            pass

    # Fix #1: Return both "data" (legacy) and "data_json" (new frontend)
    return {
        "id": invoice.id,
        "status": invoice.status,
        "original_filename": invoice.original_filename,
        "file_url": file_url,
        "created_at": invoice.created_at,
        "confidence_score": invoice.confidence,
        "data": invoice.data_json,
        "data_json": invoice.data_json,
        "source_type": invoice.source_type,
        "ingestion_method": invoice.ingestion_method,
        "gst_rules_json": invoice.gst_rules_json,
        "processing_time_ms": invoice.processing_time_ms,
        "error_message": invoice.error_detail if invoice.status in ("failed", "HUMAN_REQUIRED") else None,
    }


@router.delete("/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_invoice(
    invoice_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.user_id == current_user.id,
    ).first()

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found.")

    db.delete(invoice)
    db.commit()


@router.post("/{invoice_id}/reprocess", status_code=status.HTTP_202_ACCEPTED)
def reprocess_invoice(
    invoice_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fix #10: Use the full pipeline (GST rules + confidence engine) on reprocess."""
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.user_id == current_user.id,
    ).first()

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found.")

    if invoice.status == "processing":
        raise HTTPException(status_code=400, detail="Invoice is already being processed.")

    if not invoice.file_url:
        raise HTTPException(status_code=400, detail="No file URL stored. Cannot reprocess.")

    invoice.status = "processing"
    invoice.error_detail = None
    db.commit()

    def reprocess_task(inv_id: str, file_url: str):
        import time
        _logger = logging.getLogger(__name__)
        start = time.monotonic()
        _db = SessionLocal()
        try:
            from app.services.confidence_engine import compute_confidence
            from app.services.gst_rules import run_gst_rules

            if file_url:
                try:
                    from app.services.blob_storage import generate_sas_url
                    from app.config import settings
                    blob_name = file_url.split('?')[0].split('/')[-1]
                    file_url = generate_sas_url(blob_name, settings.AZURE_STORAGE_CONTAINER_NAME)
                except Exception:
                    pass

            raw_fields = analyze_invoice(file_url)
            mapped_data = map_fields(raw_fields)
            gst_result = run_gst_rules(mapped_data)
            conf_result = compute_confidence(mapped_data)
            elapsed_ms = int((time.monotonic() - start) * 1000)

            inv = _db.query(Invoice).filter(Invoice.id == inv_id).first()
            if inv:
                inv.raw_json = str(raw_fields)  # BUG-14: Update raw_json so UI Raw JSON tab is fresh
                inv.data_json = mapped_data
                inv.confidence = conf_result["overall_score"]
                inv.status = conf_result["status"]
                inv.gst_rules_json = gst_result
                inv.ingestion_method = "OCR"
                inv.processing_time_ms = elapsed_ms
                inv.error_detail = None
                _db.commit()
                _logger.info(f"[invoice:{inv_id}] Reprocessed. status={inv.status} confidence={inv.confidence}")
        except Exception as e:
            _db.rollback()
            inv = _db.query(Invoice).filter(Invoice.id == inv_id).first()
            if inv:
                inv.status = "HUMAN_REQUIRED"
                inv.error_detail = str(e)[:500]
                _db.commit()
            _logger.error(f"[invoice:{inv_id}] Reprocess failed: {e}", exc_info=True)
        finally:
            _db.close()

    background_tasks.add_task(reprocess_task, invoice.id, invoice.file_url)

    return {"id": invoice.id, "status": "processing"}


# ── Export Endpoints ────────────────────────────

@router.get("/export/csv")
def export_invoices_csv(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invoices = db.query(Invoice).filter(Invoice.user_id == current_user.id).order_by(Invoice.created_at.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)

    headers = [
        "id", "original_filename", "status", "confidence_score",
        "vendor_name", "vendor_gstin", "invoice_number", "invoice_date",
        "total_amount", "created_at", "processing_time_ms",
    ]
    writer.writerow(headers)

    for inv in invoices:
        data = inv.data_json or {}
        confidence_val = inv.confidence if inv.confidence is not None else 0.0

        def _g(key):
            v = data.get(key, {})
            return v.get("value", "") if isinstance(v, dict) else ""

        row = [
            inv.id,
            inv.original_filename or "",
            inv.status or "",
            round(confidence_val, 4),
            _g("vendor_name"),
            _g("vendor_gstin"),
            _g("invoice_number"),
            _g("invoice_date"),
            _g("total_amount"),
            inv.created_at.isoformat() if inv.created_at else "",
            inv.processing_time_ms if inv.processing_time_ms is not None else "",
        ]
        writer.writerow(row)

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="invoices.csv"'},
    )


@router.get("/export/xlsx")
def export_invoices_xlsx(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import openpyxl
    from openpyxl.styles import Font

    invoices = db.query(Invoice).filter(Invoice.user_id == current_user.id).order_by(Invoice.created_at.desc()).all()

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Invoices"

    headers = [
        "ID", "Original Filename", "Status", "Confidence Score",
        "Vendor Name", "Vendor GSTIN", "Invoice Number", "Invoice Date",
        "Total Amount", "Created At", "Processing Time (ms)",
    ]

    ws.append(headers)

    header_font = Font(bold=True)
    for cell in ws[1]:
        cell.font = header_font
    ws.freeze_panes = "A2"

    for inv in invoices:
        data = inv.data_json or {}
        confidence_val = inv.confidence if inv.confidence is not None else 0.0

        def _g(key):
            v = data.get(key, {})
            val = v.get("value", "") if isinstance(v, dict) else ""
            return str(val) if val is not None else ""

        row = [
            str(inv.id),
            str(inv.original_filename or ""),
            str(inv.status or ""),
            round(confidence_val, 4),
            _g("vendor_name"),
            _g("vendor_gstin"),
            _g("invoice_number"),
            _g("invoice_date"),
            _g("total_amount"),
            inv.created_at.isoformat() if inv.created_at else "",
            inv.processing_time_ms if inv.processing_time_ms is not None else "",
        ]
        ws.append(row)

    for col in ws.columns:
        max_length = 0
        column = col[0].column_letter
        for cell in col:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except Exception:
                pass
        adjusted_width = max_length + 2
        ws.column_dimensions[column].width = min(adjusted_width, 50)

    b = io.BytesIO()
    wb.save(b)
    b.seek(0)

    return StreamingResponse(
        b,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="invoices.xlsx"'},
    )