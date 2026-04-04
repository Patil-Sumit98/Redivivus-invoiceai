from typing import List, Optional
from pydantic import BaseModel, HttpUrl
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.webhook import Webhook, WebhookDelivery
from app.middleware.auth import get_current_user
from app.services.webhook_service import deliver_webhook_sync

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
    new_hook = Webhook(
        user_id=current_user.id,
        url=str(payload.url),
        secret=payload.secret,
        events=payload.events,
        is_active=True
    )
    db.add(new_hook)
    db.commit()
    db.refresh(new_hook)
    return new_hook

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
