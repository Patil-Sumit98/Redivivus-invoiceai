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
    """Maps Azure's prebuilt-invoice fields to our canonical API contract."""
    if not raw_fields:
        return {}

    vendor_gstin_data = _get_field(raw_fields, "VendorTaxId", "value_string")
    buyer_gstin_data = _get_field(raw_fields, "CustomerTaxId", "value_string")
    total_tax_data = _get_field(raw_fields, "TotalTax", "value_currency")

    vendor_gstin_val = vendor_gstin_data.get("value")
    buyer_gstin_val = buyer_gstin_data.get("value")
    total_tax_val = total_tax_data.get("value")
    tax_conf = total_tax_data.get("confidence", 0.0)

    cgst_val, sgst_val, igst_val = _split_gst(total_tax_val, vendor_gstin_val, buyer_gstin_val)

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
        "cgst": {"value": cgst_val, "confidence": tax_conf},
        "sgst": {"value": sgst_val, "confidence": tax_conf},
        "igst": {"value": igst_val, "confidence": tax_conf},
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