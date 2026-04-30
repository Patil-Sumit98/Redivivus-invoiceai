"""
Invoice field mapper — Azure Document Intelligence raw fields → canonical API contract.

BUG-04: Attempts direct CGST/SGST/IGST extraction from Azure fields before fallback to _split_gst().
"""


def _get_field(fields: dict, key: str, value_type: str = "value_string") -> dict:
    """Safely extracts field values and confidence from Azure's raw data object."""
    field = fields.get(key)
    if not field:
        return {"value": None, "confidence": 0.0}

    try:
        confidence = getattr(field, "confidence", 0.0) or 0.0

        if value_type == "value_currency":
            currency_obj = getattr(field, "value_currency", None)
            val = getattr(currency_obj, "amount", None) if currency_obj else None
        elif value_type == "value_date":
            val = getattr(field, "value_date", None)
            if val:
                val = str(val)
        elif value_type == "value_number":
            val = getattr(field, "value_number", None)
        else:
            val = getattr(field, value_type, None)

        return {"value": val, "confidence": round(float(confidence), 4)}
    except Exception:
        return {"value": None, "confidence": 0.0}


def _split_gst(total_tax_val, vendor_gstin: str, buyer_gstin: str):
    """
    Splits total tax into CGST/SGST (intra-state) or IGST (inter-state).
    Uses first 2 digits of GSTINs as state codes.
    Returns (cgst, sgst, igst) as floats.
    """
    if total_tax_val is None:
        return None, None, None

    amount = float(total_tax_val)
    half = round(amount / 2, 2)

    # Determine if inter-state from GSTIN state codes
    vendor_state = (vendor_gstin or "")[:2]
    buyer_state = (buyer_gstin or "")[:2]

    if vendor_state and buyer_state and vendor_state != buyer_state:
        # Inter-state → IGST
        return None, None, round(amount, 2)
    else:
        # Intra-state → CGST + SGST
        return half, half, None


def map_fields(raw_fields: dict) -> dict:
    """
    Maps Azure's prebuilt-invoice fields to our canonical API contract.

    BUG-04: Tries to extract CGST/SGST/IGST directly from Azure raw fields first.
            Falls back to _split_gst() only when all three are None (with 0.6 confidence multiplier).
    """
    if not raw_fields:
        return {}

    vendor_gstin_data = _get_field(raw_fields, "VendorTaxId", "value_string")
    buyer_gstin_data = _get_field(raw_fields, "CustomerTaxId", "value_string")
    total_tax_data = _get_field(raw_fields, "TotalTax", "value_currency")

    vendor_gstin_val = vendor_gstin_data.get("value")
    buyer_gstin_val = buyer_gstin_data.get("value")
    total_tax_val = total_tax_data.get("value")
    tax_conf = total_tax_data.get("confidence", 0.0)

    # ── BUG-04: Try direct CGST/SGST/IGST extraction from Azure fields ──
    direct_cgst = _get_field(raw_fields, "CGST", "value_currency")
    direct_sgst = _get_field(raw_fields, "SGST", "value_currency")
    direct_igst = _get_field(raw_fields, "IGST", "value_currency")

    # Also try alternate field names used by some Azure models
    if direct_cgst["value"] is None:
        direct_cgst = _get_field(raw_fields, "TaxDetails.CGST", "value_currency")
    if direct_sgst["value"] is None:
        direct_sgst = _get_field(raw_fields, "TaxDetails.SGST", "value_currency")
    if direct_igst["value"] is None:
        direct_igst = _get_field(raw_fields, "TaxDetails.IGST", "value_currency")

    # Determine tax extraction method
    if (direct_cgst["value"] is None and direct_sgst["value"] is None
            and direct_igst["value"] is None):
        # Fallback: derive from total tax (lower confidence)
        cgst_val, sgst_val, igst_val = _split_gst(total_tax_val, vendor_gstin_val, buyer_gstin_val)
        cgst = {"value": cgst_val, "confidence": round(tax_conf * 0.6, 4)}
        sgst = {"value": sgst_val, "confidence": round(tax_conf * 0.6, 4)}
        igst = {"value": igst_val, "confidence": round(tax_conf * 0.6, 4)}
        tax_method = "derived"
    else:
        # Direct extraction — full confidence from Azure
        cgst = direct_cgst
        sgst = direct_sgst
        igst = direct_igst
        tax_method = "direct"

    data = {
        "vendor_name": _get_field(raw_fields, "VendorName", "value_string"),
        "vendor_gstin": vendor_gstin_data,
        "invoice_number": _get_field(raw_fields, "InvoiceId", "value_string"),
        "invoice_date": _get_field(raw_fields, "InvoiceDate", "value_date"),
        "due_date": _get_field(raw_fields, "DueDate", "value_date"),
        "buyer_name": _get_field(raw_fields, "CustomerName", "value_string"),
        "buyer_gstin": buyer_gstin_data,
        "subtotal": _get_field(raw_fields, "SubTotal", "value_currency"),
        "total_amount": _get_field(raw_fields, "InvoiceTotal", "value_currency"),
        "cgst": cgst,
        "sgst": sgst,
        "igst": igst,
        "tax_method": tax_method,  # BUG-04: "direct" if Azure extracted, "derived" if split
        "line_items": [],
    }

    items_field = raw_fields.get("Items")
    if items_field:
        items_array = getattr(items_field, "value_array", []) or []
        for item in items_array:
            item_dict = getattr(item, "value_object", {}) or {}
            if not item_dict:
                continue
            data["line_items"].append({
                "description": _get_field(item_dict, "Description", "value_string").get("value"),
                "quantity": _get_field(item_dict, "Quantity", "value_number").get("value"),
                "rate": _get_field(item_dict, "UnitPrice", "value_currency").get("value"),
                "amount": _get_field(item_dict, "Amount", "value_currency").get("value"),
                "hsn_code": _get_field(item_dict, "ProductCode", "value_string").get("value"),
            })

    return data

def map_gst_qr_to_canonical(qr_data: dict) -> dict:
    """Takes a raw GST QR JSON payload and formats it to the canonical API structure."""
    if not qr_data:
        return {}

    def _val(keys, default=None):
        for k in keys:
            if k in qr_data:
                return qr_data[k]
        return default

    # Date usually DD/MM/YYYY. We map to YYYY-MM-DD.
    raw_date = _val(["DocDt", "InvDt", "Date"])
    formatted_date = None
    if raw_date and isinstance(raw_date, str):
        if "/" in raw_date:
            parts = raw_date.split("/")
            if len(parts) == 3:
                formatted_date = f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"
        elif "-" in raw_date:
            parts = raw_date.split("-")
            if len(parts) == 3 and len(parts[0]) == 4:
                formatted_date = raw_date
            elif len(parts) == 3:
                formatted_date = f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"

    def _make(val):
        return {"value": val, "confidence": 1.0} if val is not None else {"value": None, "confidence": 0.0}

    # BUG-10: Parse ItemList from GST e-Invoice QR codes
    item_list = qr_data.get("ItemList", [])
    line_items = []
    for item in (item_list if isinstance(item_list, list) else []):
        line_items.append({
            "description": item.get("PrdDesc") or item.get("Nm"),
            "quantity": item.get("Qty"),
            "rate": item.get("UnitPrice") or item.get("UntPrice"),
            "amount": item.get("TotAmt") or item.get("AssAmt"),
            "hsn_code": item.get("HsnCd"),
        })

    return {
        "vendor_name": _make(_val(["SellerNm", "SellerName", "TrdNm"])),
        "vendor_gstin": _make(_val(["SellerGstin", "Gstin", "SupGstin"])),
        "invoice_number": _make(_val(["DocNo", "InvNo"])),
        "invoice_date": _make(formatted_date),
        "due_date": _make(None),
        "buyer_name": _make(_val(["BuyNm", "BuyerName", "LglNm"])),
        "buyer_gstin": _make(_val(["BuyerGstin", "BuyGstin"])),
        "subtotal": _make(_val(["AssVal", "TotAssVal"])),
        "total_amount": _make(_val(["TotInvVal", "InvVal", "TotVal"])),
        "cgst": _make(_val(["CgstVal", "TotCgst"])),
        "sgst": _make(_val(["SgstVal", "TotSgst"])),
        "igst": _make(_val(["IgstVal", "TotIgst"])),
        "tax_method": "direct",  # QR data is always direct
        "line_items": line_items
    }