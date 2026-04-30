import os
import sys

# Ensure backend root (containing 'app' package) is in python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models.user import User
from app.models.invoice import Invoice
from app.services.auth_service import hash_password, generate_api_key

def seed_data():
    db = SessionLocal()
    try:
        # Create user
        demo_email = "demo@invoiceai.in"
        user = db.query(User).filter(User.email == demo_email).first()
        if not user:
            user = User(
                email=demo_email,
                hashed_password=hash_password("password123"), # default password for demo
                api_key=generate_api_key(),
                organization_name="Demo Corp"
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        # Create 5 invoices
        # 1. AUTO_APPROVED, 0.94
        inv1 = Invoice(
            user_id=user.id,
            original_filename="inv_qr_001.pdf",
            status="AUTO_APPROVED",
            confidence=0.94,
            source_type="GST_EINVOICE",
            ingestion_method="QR",
            file_url="https://example.com/inv_qr_001.pdf",
            data_json={
                "vendor_name": {"value": "Tech Supplies Inc", "confidence": 0.94},
                "invoice_number": {"value": "INV-2023-01", "confidence": 0.95},
                "total_amount": {"value": 1180.0, "confidence": 0.96},
                "cgst": {"value": 90.0, "confidence": 0.94},
                "sgst": {"value": 90.0, "confidence": 0.94}
            }
        )

        # 2. NEEDS_REVIEW, 0.71
        inv2 = Invoice(
            user_id=user.id,
            original_filename="rec_scan_002.pdf",
            status="NEEDS_REVIEW",
            confidence=0.71,
            source_type="GST_PDF",
            ingestion_method="OCR",
            file_url="https://example.com/rec_scan_002.pdf",
            data_json={
                "vendor_name": {"value": "Office World", "confidence": 0.71},
                "invoice_number": {"value": "OW-9821", "confidence": 0.85},
                "total_amount": {"value": 500.0, "confidence": 0.65},
                "cgst": {"value": 0.0, "confidence": 0.70},
                "sgst": {"value": 0.0, "confidence": 0.70}
            }
        )

        # 3. AUTO_APPROVED, 0.98
        inv3 = Invoice(
            user_id=user.id,
            original_filename="einvoice_44.pdf",
            status="AUTO_APPROVED",
            confidence=0.98,
            source_type="GST_EINVOICE",
            ingestion_method="QR",
            file_url="https://example.com/einvoice_44.pdf",
            data_json={
                "vendor_name": {"value": "Cloud Services Ltd", "confidence": 0.98},
                "invoice_number": {"value": "CSL-102", "confidence": 0.99},
                "total_amount": {"value": 2360.0, "confidence": 0.98},
                "cgst": {"value": 180.0, "confidence": 0.98},
                "sgst": {"value": 180.0, "confidence": 0.98}
            }
        )

        # 4. HUMAN_REQUIRED, 0.38
        inv4 = Invoice(
            user_id=user.id,
            original_filename="blurry_receipt.jpg",
            status="HUMAN_REQUIRED",
            confidence=0.38,
            source_type="GST_PDF",
            ingestion_method="OCR",
            file_url="https://example.com/blurry_receipt.jpg",
            data_json={
                "vendor_name": {"value": "Unknown Vendor", "confidence": 0.38},
                "invoice_number": {"value": "???-123", "confidence": 0.40},
                "total_amount": {"value": 100.0, "confidence": 0.50},
                "cgst": {"value": 0.0, "confidence": 0.35},
                "sgst": {"value": 0.0, "confidence": 0.35}
            }
        )

        # 5. AUTO_APPROVED, 0.91
        inv5 = Invoice(
            user_id=user.id,
            original_filename="vendor_inv_june.pdf",
            status="AUTO_APPROVED",
            confidence=0.91,
            source_type="GST_PDF",
            ingestion_method="OCR",
            file_url="https://example.com/vendor_inv_june.pdf",
            data_json={
                "vendor_name": {"value": "Logistics Pro", "confidence": 0.91},
                "invoice_number": {"value": "LP-4545", "confidence": 0.92},
                "total_amount": {"value": 5900.0, "confidence": 0.93},
                "cgst": {"value": 450.0, "confidence": 0.90},
                "sgst": {"value": 450.0, "confidence": 0.90}
            }
        )

        db.add_all([inv1, inv2, inv3, inv4, inv5])
        db.commit()
        print("Demo data seeded successfully.")
    except Exception as e:
        db.rollback()
        print(f"Error seeding data: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    try:
        seed_data()
    except Exception as e:
        print(f"Error executing script: {e}")
