import io
import json
import base64
import logging
import binascii
from typing import Optional

logger = logging.getLogger(__name__)

def parse_jwt_payload(payload_str: str) -> Optional[dict]:
    """Attempts to decode a base64 JWT payload and parse it as JSON."""
    try:
        # Add padding if needed
        padding_needed = len(payload_str) % 4
        if padding_needed:
            payload_str += "=" * (4 - padding_needed)
            
        decoded_bytes = base64.urlsafe_b64decode(payload_str)
        decoded_str = decoded_bytes.decode("utf-8", errors="ignore")
        return json.loads(decoded_str)
    except (ValueError, binascii.Error, json.JSONDecodeError):
        return None

def extract_qr_data(qr_text: str) -> Optional[dict]:
    """Attempts to parse QR text as a JWT or plain JSON."""
    if not qr_text:
        return None
        
    qr_text = qr_text.strip()
    
    # Check if it's a JWT (typically contains 2 dots: header.payload.signature)
    parts = qr_text.split(".")
    if len(parts) >= 2:
        # payload is usually the second part
        payload = parts[1]
        data = parse_jwt_payload(payload)
        if data:
            return data
            
    # Fallback to plain JSON parse
    try:
        return json.loads(qr_text)
    except json.JSONDecodeError:
        return None

def detect_gst_qr(file_bytes: bytes, filename: str) -> Optional[dict]:
    """
    Scans a document (PDF or image) for a GST e-Invoice QR code.
    If found, parses and returns the JSON payload. Returning None disables fallback.
    Never raises an exception, always returns None on failure.
    """
    try:
        from pyzbar.pyzbar import decode
        from PIL import Image, ImageFile
        import cv2
        import numpy as np
        
        # Ensure PIL is safe against large image decompression bombs
        Image.MAX_IMAGE_PIXELS = 100_000_000
        ImageFile.LOAD_TRUNCATED_IMAGES = True

        ext = filename.split(".")[-1].lower() if "." in filename else ""
        images = []

        if ext == "pdf":
            try:
                import fitz  # pymupdf
                with fitz.open("pdf", file_bytes) as doc:
                    if doc.page_count > 0:
                        page = doc.load_page(0)
                        # Zoom factor 2 for better QR resolution
                        mat = fitz.Matrix(2, 2)
                        pix = page.get_pixmap(matrix=mat)
                        # Convert to PIL Image
                        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                        images.append(img)
            except Exception as e:
                logger.warning(f"Failed to parse PDF using pymupdf: {e}")
                return None
        elif ext in ["jpg", "jpeg", "png", "tiff", "bmp", "gif"]:
            try:
                img = Image.open(io.BytesIO(file_bytes))
                img.load()  # verify integrity
                if img.mode != "RGB":
                    img = img.convert("RGB")
                images.append(img)
            except Exception as e:
                logger.warning(f"Failed to load image using PIL: {e}")
                return None
        else:
            logger.warning(f"Unsupported file format for QR detection: {ext}")
            return None

        # Scan images for QR codes
        for img in images:
            # Convert to numpy array for opencv/pyzbar
            img_cv = np.array(img)
            # Convert RGB to grayscale (better for QR)
            gray = cv2.cvtColor(img_cv, cv2.COLOR_RGB2GRAY)
            
            # Detect QR codes
            decoded_objects = decode(gray)
            for obj in decoded_objects:
                qr_data_raw = obj.data.decode("utf-8", errors="ignore")
                parsed_data = extract_qr_data(qr_data_raw)
                
                if parsed_data:
                    logger.info("Successfully detected and parsed GST QR code.")
                    # Explicitly close image to free memory early
                    img.close()
                    return parsed_data
            
            img.close()
                    
        logger.warning("No valid GST QR code found in the document.")
        return None

    except ImportError as e:
        logger.error(f"Missing required library for QR detection: {e}")
        return None
    except Exception as e:
        # Catch all to ensure we never crash
        logger.exception(f"Unexpected error during QR detection: {e}")
        return None
