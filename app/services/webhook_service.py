import hmac
import hashlib
import json
import logging
import requests
import time
from datetime import datetime, timezone
from threading import Thread

from app.database import SessionLocal
from app.models.webhook import Webhook, WebhookDelivery
from app.models.invoice import Invoice

logger = logging.getLogger(__name__)

def compute_hmac_signature(payload_bytes: bytes, secret: str) -> str:
    """Returns hex HMAC-SHA256 signature for the payload."""
    return hmac.new(secret.encode('utf-8'), payload_bytes, hashlib.sha256).hexdigest()

def deliver_webhook_sync(delivery_id: str):
    """
    Synchronous delivery function (called from background thread).
    """
    max_attempts = 3
    retry_delay = 5 # seconds
    
    for attempt in range(max_attempts):
        db = SessionLocal()
        try:
            delivery = db.query(WebhookDelivery).filter(WebhookDelivery.id == delivery_id).first()
            if not delivery:
                logger.error(f"[webhook] Delivery {delivery_id} not found.")
                return
                
            if delivery.status in ["delivered", "failed"] and delivery.attempts >= max_attempts:
                return # Already fully processed or failed

            webhook = db.query(Webhook).filter(Webhook.id == delivery.webhook_id).first()
            
            if not webhook:
                delivery.status = "failed"
                delivery.response_body = "Webhook record missing."
                delivery.attempts += 1
                delivery.last_attempt_at = datetime.now(timezone.utc)
                db.commit()
                return

            if delivery.invoice_id:
                invoice = db.query(Invoice).filter(Invoice.id == delivery.invoice_id).first()
                if not invoice:
                    delivery.status = "failed"
                    delivery.response_body = "Invoice record missing."
                    delivery.attempts += 1
                    delivery.last_attempt_at = datetime.now(timezone.utc)
                    db.commit()
                    return

                payload_dict = {
                    "invoice_id": invoice.id,
                    "status": invoice.status,
                    "source_type": invoice.source_type,
                    "ingestion_method": invoice.ingestion_method,
                    "data": invoice.data_json,
                    "confidence": invoice.confidence
                }
            else:
                payload_dict = {"event": "ping", "message": "Test webhook payload"}
            
            
            payload_bytes = json.dumps(payload_dict).encode('utf-8')
            signature = compute_hmac_signature(payload_bytes, webhook.secret)
            
            headers = {
                "Content-Type": "application/json",
                "X-InvoiceAI-Signature": f"sha256={signature}"
            }
            
            delivery.attempts += 1
            delivery.last_attempt_at = datetime.now(timezone.utc)
            db.commit() 
            
            try:
                response = requests.post(webhook.url, data=payload_bytes, headers=headers, timeout=10)
                delivery.http_status_code = response.status_code
                delivery.response_body = response.text[:500] if response.text else None
                
                if 200 <= response.status_code < 300:
                    delivery.status = "delivered"
                    db.commit()
                    logger.info(f"[webhook] Delivered successfully to {webhook.url}")
                    return 
                else:
                    logger.warning(f"[webhook] Delivery failed with HTTP {response.status_code} on attempt {delivery.attempts}")
                    
            except requests.exceptions.RequestException as e:
                delivery.response_body = str(e)[:500]
                logger.warning(f"[webhook] Network error on attempt {delivery.attempts}: {e}")

            if delivery.attempts >= max_attempts:
                delivery.status = "failed"
            else:
                delivery.status = "pending"
                
            db.commit()
            
            if delivery.status == "pending":
                time.sleep(retry_delay)
                continue 
            else:
                return 
                
        except Exception as e:
            logger.error(f"[webhook] Critical error processing delivery {delivery_id}: {e}", exc_info=True)
            return
        finally:
            db.close()


def deliver_webhook(delivery_id: str):
    deliver_webhook_sync(delivery_id)


def trigger_webhooks_for_invoice(invoice_id: str, user_id: str, event: str):
    """
    Called after invoice processing completes.
    """
    db = SessionLocal()
    try:
        webhooks = db.query(Webhook).filter(
            Webhook.user_id == user_id,
            Webhook.is_active == True
        ).all()
        
        for hook in webhooks:
            events_list = hook.events if isinstance(hook.events, list) else []
            if event in events_list or "*" in events_list:
                delivery = WebhookDelivery(
                    webhook_id=hook.id,
                    invoice_id=invoice_id,
                    status="pending"
                )
                db.add(delivery)
                db.commit()
                db.refresh(delivery)
                
                Thread(target=deliver_webhook_sync, args=(delivery.id,)).start()
                
    except Exception as e:
        logger.error(f"[webhook] Error triggering webhooks for invoice {invoice_id}: {e}")
    finally:
        db.close()
