def _get_field(fields: dict, key: str, value_type: str = "value_string") -> dict:
    """Safely extracts field values and confidence from Azure's raw data object."""
    field = fields.get(key)
    if not field:
        return {"value": None, "confidence": 0.0}

    try:
        confidence = getattr(field, "confidence", 0.0)
        
        if value_type == "value_currency":
            # Currency is nested: field.value_currency.amount
            currency_obj = getattr(field, "value_currency", None)
            val = getattr(currency_obj, "amount", None) if currency_obj else None
        elif value_type == "value_date":
            # Dates need to be converted to strings for JSON serialization
            val = getattr(field, "value_date", None)
            if val: 
                val = str(val)
        else:
            val = getattr(field, value_type, None)
            
        return {"value": val, "confidence": confidence}
    except Exception:
        return {"value": None, "confidence": 0.0}

def map_fields(raw_fields: dict) -> dict:
    """Maps Azure's prebuilt-invoice fields to our API contract."""
    if not raw_fields:
        return {}

    # Map the standard prebuilt-invoice fields
    data = {
        "vendor_name": _get_field(raw_fields, "VendorName", "value_string"),
        "vendor_gstin": _get_field(raw_fields, "VendorTaxId", "value_string"),
        "invoice_number": _get_field(raw_fields, "InvoiceId", "value_string"),
        "invoice_date": _get_field(raw_fields, "InvoiceDate", "value_date"),
        "buyer_name": _get_field(raw_fields, "CustomerName", "value_string"),
        "buyer_gstin": _get_field(raw_fields, "CustomerTaxId", "value_string"),
        "subtotal": _get_field(raw_fields, "SubTotal", "value_currency"),
        "total_amount": _get_field(raw_fields, "InvoiceTotal", "value_currency"),
        # Map Azure's TotalTax to CGST for the demo contract
        "cgst": _get_field(raw_fields, "TotalTax", "value_currency"),
        "sgst": {"value": 0.0, "confidence": 0.0},
        "igst": {"value": 0.0, "confidence": 0.0},
        "line_items": []
    }

    # Map line items array if present
    items_field = raw_fields.get("Items")
    if items_field:
        items_array = getattr(items_field, "value_array", [])
        
        for item in items_array:
            item_dict = getattr(item, "value_object", {})
            if not item_dict: continue

            data["line_items"].append({
                "description": _get_field(item_dict, "Description", "value_string").get("value"),
                "quantity": _get_field(item_dict, "Quantity", "value_number").get("value"),
                "rate": _get_field(item_dict, "UnitPrice", "value_currency").get("value"),
                "amount": _get_field(item_dict, "Amount", "value_currency").get("value"),
                "hsn_code": None
            })

    return data