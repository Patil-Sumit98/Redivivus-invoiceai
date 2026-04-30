"""
GST rules engine for InvoiceAI.

BUG-05: Invoice date window configurable via INVOICE_DATE_MAX_AGE_DAYS (default: 1095 = 3 years).
"""
import re
from datetime import datetime, date, timedelta
from typing import Dict, Any

def _get_val(mapped_data: dict, field: str, default: Any = None) -> Any:
    """Helper to safely extract value from canonical mapped dictionary."""
    data = mapped_data.get(field)
    if isinstance(data, dict):
        return data.get("value", default)
    # Line items is a list, etc.
    return data if data is not None else default

def _to_float(val: Any) -> float:
    if val is None:
        return 0.0
    try:
        return float(val)
    except (ValueError, TypeError):
        return 0.0

def validate_gstin_format(gstin: str) -> dict:
    """Rule 1: Formats and length validation for GSTIN"""
    if not gstin:
        return {"valid": False, "error": "GSTIN is missing"}
    
    gstin = str(gstin).strip().upper()
    if len(gstin) != 15:
        return {"valid": False, "error": f"GSTIN must be exactly 15 characters, got {len(gstin)}"}
        
    # GSTIN pattern: 2-digit state code + 10 chars (PAN) + 1 entity char + 'Z' + checksum
    pattern = r"^(\d{2})([A-Z]{5}\d{4}[A-Z])([1-9A-Z])Z([0-9A-Z])$"
    match = re.match(pattern, gstin)
    if not match:
        return {"valid": False, "error": "GSTIN fails structural regex check (State + PAN + Entity + Z + Checksum)"}
        
    state_code = int(match.group(1))
    if state_code < 1 or state_code > 37:
        return {"valid": False, "error": f"Invalid state code {state_code}"}
        
    return {"valid": True, "error": None}

def validate_gstin_checksum(gstin: str) -> dict:
    """Rule 2: Luhn-style custom algorithm check for the 15th digit"""
    if not gstin or len(gstin) != 15:
        return {"valid": False, "error": "GSTIN must be exactly 15 characters to verify checksum"}
        
    gstin = str(gstin).strip().upper()
    chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    
    total_sum = 0
    for i in range(14):
        char = gstin[i]
        if char not in chars:
            return {"valid": False, "error": f"Invalid character '{char}' found in GSTIN"}
            
        char_val = chars.index(char)
        factor = 1 if i % 2 == 0 else 2
        product = char_val * factor
        
        if product >= len(chars):
            product = (product // len(chars)) + (product % len(chars))
            
        total_sum += product
        
    check_digit_idx = (len(chars) - (total_sum % len(chars))) % len(chars)
    expected_check_char = chars[check_digit_idx]
    
    if gstin[14] != expected_check_char:
        return {"valid": False, "error": f"Checksum failed. Expected '{expected_check_char}', got '{gstin[14]}'"}
        
    return {"valid": True, "error": None}

def validate_tax_math(cgst: float, sgst: float, igst: float) -> dict:
    """Rule 3: Ensure tax balances (CGST == SGST) or (IGST only)"""
    TOLERANCE = 1.0
    
    has_c_s = (cgst > 0 or sgst > 0)
    has_i = (igst > 0)
    
    if has_c_s and has_i:
        return {"valid": False, "error": "Invoice contains both intra-state (CGST/SGST) and inter-state (IGST) values"}
        
    if has_c_s:
        if abs(cgst - sgst) > TOLERANCE:
            return {"valid": False, "error": f"CGST ({cgst}) and SGST ({sgst}) differ by more than ₹1 tolerance"}
            
    return {"valid": True, "error": None}

def validate_line_item_math(line_items: list, subtotal: float, cgst: float, sgst: float, igst: float, total: float) -> dict:
    """Rule 4: Ensure line item aggregates and quantity cross-checks pass"""
    TOLERANCE = 1.0
    errors = []
    
    lines_sum = 0.0
    for i, item in enumerate(line_items or []):
        qty = _to_float(item.get("quantity", 0))
        rate = _to_float(item.get("rate", 0))
        amt = _to_float(item.get("amount", 0))
        
        if qty > 0 and rate > 0:
            expected_amt = qty * rate
            if abs(expected_amt - amt) > TOLERANCE:
                errors.append(f"Line {i+1} math mismatch: Qty {qty} x Rate {rate} != Amt {amt}")
                
        lines_sum += amt
        
    if line_items:
        if abs(lines_sum - subtotal) > TOLERANCE:
            errors.append(f"Sum of lines ({lines_sum}) differs from subtotal ({subtotal}) by > ₹1")
            
    total_tax = cgst + sgst + igst
    if subtotal > 0 and total > 0:
        if abs((subtotal + total_tax) - total) > TOLERANCE:
            errors.append(f"Subtotal ({subtotal}) + Tax ({total_tax}) != Total Output ({total})")
            
    return {"valid": len(errors) == 0, "errors": errors}

def validate_invoice_date(invoice_date_str: str) -> dict:
    """Rule 5: Date bounds check — configurable via settings.INVOICE_DATE_MAX_AGE_DAYS"""
    if not invoice_date_str:
        return {"valid": False, "error": "Invoice date missing"}
        
    try:
        from app.config import settings

        # Assuming YYYY-MM-DD from mapper
        inv_date = date.fromisoformat(invoice_date_str)
        today = date.today()
        
        if inv_date > today:
            return {"valid": False, "error": "Invoice date lies in the future"}
            
        # BUG-05: Configurable window — default 1095 days (3 years for GST reconciliation)
        limit_date = today - timedelta(days=settings.INVOICE_DATE_MAX_AGE_DAYS)
        if inv_date < limit_date:
            return {"valid": False, "error": f"Invoice date is older than {settings.INVOICE_DATE_MAX_AGE_DAYS} days"}
            
        return {"valid": True, "error": None}
    except ValueError:
        return {"valid": False, "error": "Could not parse invoice date (expected YYYY-MM-DD format)"}

def validate_place_of_supply(vendor_gstin: str, buyer_gstin: str, cgst: float, sgst: float, igst: float) -> dict:
    """Rule 6: Ensure correct CGST/SGST vs IGST usage based on states"""
    if not vendor_gstin or len(str(vendor_gstin)) < 2:
        return {"valid": False, "suggestion": "Missing or invalid vendor GSTIN"}
    if not buyer_gstin or len(str(buyer_gstin)) < 2:
        return {"valid": False, "suggestion": "Missing or invalid buyer GSTIN"}
        
    v_state = str(vendor_gstin)[:2]
    b_state = str(buyer_gstin)[:2]
    
    is_intra = (v_state == b_state)
    has_igst = (igst > 0)
    has_csgst = (cgst > 0 or sgst > 0)
    
    if is_intra and has_igst:
        return {"valid": False, "suggestion": "Vendor and Buyer are in same state. Should use CGST/SGST instead of IGST."}
    if not is_intra and has_csgst:
        return {"valid": False, "suggestion": "Vendor and Buyer are in different states. Should use IGST instead of CGST/SGST."}
        
    return {"valid": True, "suggestion": None}

def run_gst_rules(mapped_data: dict) -> dict:
    """
    Executes all 6 GST rules against the structured API dictionary.
    Returns aggregated rule statuses and flags.
    """
    v_gstin = _get_val(mapped_data, "vendor_gstin")
    b_gstin = _get_val(mapped_data, "buyer_gstin")
    inv_date = _get_val(mapped_data, "invoice_date")
    
    cgst = _to_float(_get_val(mapped_data, "cgst"))
    sgst = _to_float(_get_val(mapped_data, "sgst"))
    igst = _to_float(_get_val(mapped_data, "igst"))
    subtotal = _to_float(_get_val(mapped_data, "subtotal"))
    total_amt = _to_float(_get_val(mapped_data, "total_amount"))
    line_items = mapped_data.get("line_items", [])
    
    rules = {}
    flags = []
    
    # 1. Format
    rules["format"] = validate_gstin_format(v_gstin)
    if not rules["format"]["valid"]: flags.append(rules["format"]["error"])
        
    # 2. Checksum (only if format is correct length to avoid crash)
    if v_gstin and len(str(v_gstin)) == 15:
        rules["checksum"] = validate_gstin_checksum(v_gstin)
        if not rules["checksum"]["valid"]: flags.append(rules["checksum"]["error"])
    else:
        rules["checksum"] = {"valid": False, "error": "Skipped due to invalid format"}
        flags.append("Skipped Vendor GSTIN Checksum calculation")
        
    # 3. Tax Math
    rules["tax_math"] = validate_tax_math(cgst, sgst, igst)
    if not rules["tax_math"]["valid"]: flags.append(rules["tax_math"]["error"])
        
    # 4. Line Items
    rules["line_items_math"] = validate_line_item_math(line_items, subtotal, cgst, sgst, igst, total_amt)
    if not rules["line_items_math"]["valid"]: flags.extend(rules["line_items_math"]["errors"])
        
    # 5. Date
    rules["date"] = validate_invoice_date(inv_date)
    if not rules["date"]["valid"]: flags.append(rules["date"]["error"])
        
    # 6. Place of Supply
    rules["place_of_supply"] = validate_place_of_supply(v_gstin, b_gstin, cgst, sgst, igst)
    if not rules["place_of_supply"]["valid"]: flags.append(rules["place_of_supply"]["suggestion"])
        
    # Aggregate Passed State (only fail hard on critical compliance metrics)
    passed_critical = (
        rules["format"]["valid"] and
        rules["checksum"]["valid"] and
        rules["tax_math"]["valid"] and
        rules["line_items_math"]["valid"] and
        rules["date"]["valid"] and
        rules["place_of_supply"]["valid"]
    )
    
    return {
        "passed": passed_critical,
        "rules": rules,
        "flags": flags
    }
