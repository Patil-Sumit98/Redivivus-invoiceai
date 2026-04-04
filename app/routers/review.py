import logging
from typing import Optional, Literal
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.invoice import Invoice
from app.models.review_log import ReviewLog
from app.middleware.auth import get_current_user
from app.services.confidence_engine import compute_confidence

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/review", tags=["Review Queue"])


class ReviewSubmit(BaseModel):
    action: Literal["APPROVED", "REJECTED", "EDITED"]
    corrected_data: Optional[dict] = None
    notes: Optional[str] = None


@router.get("/queue")
def get_review_queue(
    page: int = 1,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    skip = (page - 1) * limit

    query = db.query(Invoice).filter(
        Invoice.user_id == current_user.id,
        Invoice.status.in_(["NEEDS_REVIEW", "HUMAN_REQUIRED"]),
    )

    total = query.count()
    invoices = query.order_by(Invoice.created_at.desc()).offset(skip).limit(limit).all()

    items = []
    for inv in invoices:
        flags = []
        if inv.gst_rules_json and isinstance(inv.gst_rules_json, dict) and "flags" in inv.gst_rules_json:
            flags = inv.gst_rules_json["flags"]

        items.append({
            "id": inv.id,
            "status": inv.status,
            "confidence_score": inv.confidence,
            "original_filename": inv.original_filename,
            "created_at": inv.created_at,
            "gst_flags": flags,
        })

    # Fix #11: include total_pending so frontend ReviewQueuePage can display it
    return {
        "items": items,
        "total": total,
        "total_pending": total,
        "page": page,
    }


@router.post("/{invoice_id}/submit")
def submit_review(
    invoice_id: str,
    payload: ReviewSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.user_id == current_user.id,
    ).first()

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found.")

    if invoice.status not in ["NEEDS_REVIEW", "HUMAN_REQUIRED"]:
        raise HTTPException(
            status_code=400,
            detail=f"Invoice cannot be reviewed. Current status: {invoice.status}",
        )

    before_data = invoice.data_json
    after_data = invoice.data_json
    new_status = invoice.status
    new_ingestion = invoice.ingestion_method

    if payload.action == "APPROVED":
        new_status = "VERIFIED"
        new_ingestion = "HUMAN"
    elif payload.action == "REJECTED":
        new_status = "REJECTED"
    elif payload.action == "EDITED":
        if not payload.corrected_data:
            raise HTTPException(status_code=400, detail="corrected_data is required when action is EDITED.")
        after_data = payload.corrected_data
        conf_result = compute_confidence(after_data)
        invoice.data_json = after_data
        invoice.confidence = conf_result["overall_score"]
        new_status = "VERIFIED"
        new_ingestion = "HUMAN"

    log_entry = ReviewLog(
        invoice_id=invoice.id,
        reviewer_user_id=current_user.id,
        action=payload.action,
        before_data=before_data,
        after_data=after_data,
        notes=payload.notes,
    )

    invoice.status = new_status
    invoice.ingestion_method = new_ingestion
    db.add(log_entry)
    db.commit()
    db.refresh(invoice)

    logger.info(
        f"[invoice:{invoice.id}] Reviewed by user:{current_user.id} "
        f"action={payload.action} status_updated={new_status}"
    )

    # Fix #12: Return a serializable dict, not a raw SQLAlchemy model
    return {
        "id": invoice.id,
        "status": invoice.status,
        "confidence_score": invoice.confidence,
        "original_filename": invoice.original_filename,
        "ingestion_method": invoice.ingestion_method,
        "data_json": invoice.data_json,
    }


@router.get("/{invoice_id}/history")
def get_review_history(
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

    logs = db.query(ReviewLog).filter(
        ReviewLog.invoice_id == invoice_id,
    ).order_by(ReviewLog.created_at.asc()).all()

    return [
        {
            "id": log.id,
            "invoice_id": log.invoice_id,
            "reviewer_user_id": log.reviewer_user_id,
            "action": log.action,
            "notes": log.notes,
            "created_at": log.created_at,
        }
        for log in logs
    ]
