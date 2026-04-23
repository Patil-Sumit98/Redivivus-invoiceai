"""
QR code detection for GST e-Invoices.

VUL-03: Accepts URL strings (downloads first 5MB) to avoid holding file_bytes in memory.
BUG-18: Lowered Pillow pixel limit to 20M and catches DecompressionBombError.
"""
import io
import json
import base64
import logging
import binascii
from typing import Optional, Union

import requests as http_requests

logger = logging.getLogger(__name__)

_MAX_DOWNLOAD_BYTES = 5 * 1024 * 1024


def parse_jwt_payload(payload_str: str) -> Optional[dict]:
    """Attempts to decode a base64 JWT payload and parse it as JSON."""
    try:
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
    parts = qr_text.split(".")
    if len(parts) >= 2:
        data = parse_jwt_payload(parts[1])
        if data:
            return data
    try:
        return json.loads(qr_text)
    except json.JSONDecodeError:
        return None


def _download_file_bytes(url: str) -> Optional[bytes]:
    """VUL-03: Stream-download a file from URL, capped at _MAX_DOWNLOAD_BYTES."""
    try:
        resp = http_requests.get(url, stream=True, timeout=15)
        resp.raise_for_status()
        chunks = []
        total = 0
        for chunk in resp.iter_content(chunk_size=65536):
            chunks.append(chunk)
            total += len(chunk)
            if total >= _MAX_DOWNLOAD_BYTES:
                break
        return b"".join(chunks)
    except Exception as e:
        logger.warning(f"[qr] Failed to download file from URL: {e}")
        return None


def detect_gst_qr(file_input: Union[bytes, str], filename: str) -> Optional[dict]:
    """
    Scans a document for a GST e-Invoice QR code.
    VUL-03: Accepts bytes OR a URL string. When given URL, downloads max 5MB.
    BUG-18: Pillow pixel limit 20M. DecompressionBombError caught gracefully.
    """
    try:
        from pyzbar.pyzbar import decode
        from PIL import Image, ImageFile
        import cv2
        import numpy as np

        Image.MAX_IMAGE_PIXELS = 20_000_000
        ImageFile.LOAD_TRUNCATED_IMAGES = True

        if isinstance(file_input, str):
            logger.info("[qr] Downloading from URL for QR detection")
            file_bytes = _download_file_bytes(file_input)
            if file_bytes is None:
                return None
        else:
            file_bytes = file_input

        ext = filename.split(".")[-1].lower() if "." in filename else ""
        images = []

        if ext == "pdf":
            try:
                import fitz
                with fitz.open("pdf", file_bytes) as doc:
                    if doc.page_count > 0:
                        page = doc.load_page(0)
                        mat = fitz.Matrix(2, 2)
                        pix = page.get_pixmap(matrix=mat)
                        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                        images.append(img)
            except Exception as e:
                logger.warning(f"Failed to parse PDF using pymupdf: {e}")
                return None
        elif ext in ["jpg", "jpeg", "png", "tiff", "bmp", "gif"]:
            try:
                img = Image.open(io.BytesIO(file_bytes))
                img.load()
                if img.mode != "RGB":
                    img = img.convert("RGB")
                images.append(img)
            except Image.DecompressionBombError:
                logger.warning(f"[qr] Decompression bomb detected in file: {filename[:50]}")
                return None
            except Exception as e:
                logger.warning(f"Failed to load image using PIL: {e}")
                return None
        else:
            logger.warning(f"Unsupported file format for QR detection: {ext}")
            return None

        for img in images:
            try:
                img_cv = np.array(img)
                gray = cv2.cvtColor(img_cv, cv2.COLOR_RGB2GRAY)
                decoded_objects = decode(gray)
                for obj in decoded_objects:
                    qr_data_raw = obj.data.decode("utf-8", errors="ignore")
                    parsed_data = extract_qr_data(qr_data_raw)
                    if parsed_data:
                        logger.info("Successfully detected and parsed GST QR code.")
                        img.close()
                        return parsed_data
            except Image.DecompressionBombError:
                logger.warning(f"[qr] Decompression bomb during processing: {filename[:50]}")
                return None
            finally:
                img.close()

        logger.warning("No valid GST QR code found in the document.")
        return None

    except ImportError as e:
        logger.error(f"Missing required library for QR detection: {e}")
        return None
    except Exception as e:
        logger.exception(f"Unexpected error during QR detection: {e}")
        return None
