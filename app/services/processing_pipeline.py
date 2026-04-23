"""
Unified invoice processing pipeline for InvoiceAI.

BUG-07: Both initial upload and reprocess share the same pipeline.
        Reprocess now runs QR detection (was previously skipped).
"""
import time
import logging

from app.database import SessionLocal
from app.models.invoice import Invoice

logger = logging.getLogger(__name__)


def run_invoice_pipeline(invoice_id: str, blob_url: str, filename: str):
    """
    Full processing pipeline — used by both initial upload and reprocess.

    Steps:
        1. QR detection (zero Azure AI cost)
        2. If no QR: Azure AI OCR
        3. GST rules validation
        4. Confidence scoring + status assignment
        5. DB save
        6. Webhook notifications

    Args:
        invoice_id: UUID of the invoice record
        blob_url: SAS URL for downloading the file (for QR/OCR)
        filename: Original filename (for extension-based QR detection)
    """
    start_time = time.monotonic()
    db = SessionLocal()
    try:
        logger.info(f"[pipeline:{invoice_id}] Processing started")

        from app.services.qr_detector import detect_gst_qr
        from app.services.azure_ai import analyze_invoice
        from app.services.invoice_mapper import map_fields, map_gst_qr_to_canonical
        from app.services.confidence_engine import compute_confidence
        from app.services.gst_rules import run_gst_rules

        # STEP 1: QR Detection (try first — zero AI cost)
        qr_data = detect_gst_qr(blob_url, filename)

        if qr_data:
            logger.info(f"[pipeline:{invoice_id}] QR code detected — skipping Azure AI")
            mapped_data = map_gst_qr_to_canonical(qr_data)
            source_type = "GST_EINVOICE"
            ingestion_method = "QR"
        else:
            logger.info(f"[pipeline:{invoice_id}] No QR — sending to Azure AI OCR")
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
            invoice.data_json = mapped_data
            invoice.confidence = conf_result["overall_score"]
            invoice.status = conf_result["status"]
            invoice.source_type = source_type
            invoice.ingestion_method = ingestion_method
            invoice.gst_rules_json = gst_result
            invoice.processing_time_ms = elapsed_ms
            invoice.error_detail = None
            db.commit()
            logger.info(
                f"[pipeline:{invoice_id}] Done. status={invoice.status} "
                f"confidence={invoice.confidence} source={source_type} time={elapsed_ms}ms"
            )

            # STEP 5: Trigger webhooks on success
            from app.services.webhook_service import trigger_webhooks_for_invoice
            trigger_webhooks_for_invoice(invoice.id, invoice.user_id, "invoice.completed")

    except Exception as e:
        logger.error(f"[pipeline:{invoice_id}] Failed: {e}", exc_info=True)
        db.rollback()
        inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if inv:
            inv.status = "HUMAN_REQUIRED"
            inv.error_detail = str(e)[:500]
            db.commit()
    finally:
        db.close()
