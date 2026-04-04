from typing import List, Optional
import hashlib
from pydantic import BaseModel, HttpUrl
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.webhook import Webhook, WebhookDelivery
from app.middleware.auth import get_current_user
from app.services.webhook_service import deliver_webhook_sync, _is_safe_webhook_url

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])

class WebhookCreate(BaseModel):
    url: HttpUrl
    events: List[str]
    secret: str

@router.post("", status_code=status.HTTP_201_CREATED)
def register_webhook(
    payload: WebhookCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # BUG-04: Validate URL against SSRF before storing
    url_str = str(payload.url)
    if not _is_safe_webhook_url(url_str):
        raise HTTPException(
            status_code=400,
            detail="Webhook URL is blocked. Private IPs and internal addresses are not allowed."
        )

    # BUG-05: Hash the secret before storing — user sees raw secret only once
    raw_secret = payload.secret
    secret_hash = hashlib.sha256(raw_secret.encode('utf-8')).hexdigest()

    new_hook = Webhook(
        user_id=current_user.id,
        url=url_str,
        secret=secret_hash,
        events=payload.events,
        is_active=True
    )
    db.add(new_hook)
    db.commit()
    db.refresh(new_hook)

    return {
        "id": new_hook.id,
        "url": new_hook.url,
        "events": new_hook.events,
        "is_active": new_hook.is_active,
        "secret": raw_secret,  # Returned ONCE — never stored in plaintext
        "created_at": str(new_hook.created_at),
    }

@router.get("")
def list_webhooks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    hooks = db.query(Webhook).filter(
        Webhook.user_id == current_user.id,
        Webhook.is_active == True
    ).all()
    return hooks

@router.delete("/{hook_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_webhook(
    hook_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    hook = db.query(Webhook).filter(
        Webhook.id == hook_id,
        Webhook.user_id == current_user.id
    ).first()
    if not hook:
        raise HTTPException(status_code=404, detail="Webhook not found")
        
    hook.is_active = False
    db.commit()

@router.post("/{hook_id}/test", status_code=status.HTTP_200_OK)
def test_webhook(
    hook_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    hook = db.query(Webhook).filter(
        Webhook.id == hook_id,
        Webhook.user_id == current_user.id,
        Webhook.is_active == True
    ).first()
    
    if not hook:
        raise HTTPException(status_code=404, detail="Active webhook not found")
        
    delivery = WebhookDelivery(
        webhook_id=hook.id,
        invoice_id=None,
        status="pending"
    )
    db.add(delivery)
    db.commit()
    db.refresh(delivery)
    
    # Run sync to get immediate result
    deliver_webhook_sync(delivery.id)
    db.refresh(delivery)
    
    return delivery

@router.get("/{hook_id}/deliveries")
def get_webhook_deliveries(
    hook_id: str,
    page: int = 1,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    hook = db.query(Webhook).filter(
        Webhook.id == hook_id,
        Webhook.user_id == current_user.id
    ).first()
    
    if not hook:
        raise HTTPException(status_code=404, detail="Webhook not found")
        
    skip = (page - 1) * limit
    deliveries = db.query(WebhookDelivery).filter(
        WebhookDelivery.webhook_id == hook_id
    ).order_by(WebhookDelivery.created_at.desc()).offset(skip).limit(limit).all()
    
    return deliveries
