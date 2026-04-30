from typing import Dict, Any

FIELD_WEIGHTS = {
    "total_amount": 3,
    "vendor_gstin": 2,
    "invoice_date": 2,
    "invoice_number": 2,
    "line_items": 2,
    "vendor_name": 1,
    "buyer_name": 1,
    "subtotal": 1,
}

def _get_field_confidence(field_name: str, field_data: Any) -> float:
    """Pure function to extract or infer confidence for a given field."""
    # Special handling for line_items which is a list, not a confidence dict
    if field_name == "line_items":
        if isinstance(field_data, list) and len(field_data) > 0:
            return 1.0
        return 0.0
        
    # Standard field mapped as {"value": ..., "confidence": ...}
    if isinstance(field_data, dict):
        if field_data.get("value") is None:
            return 0.0
        return float(field_data.get("confidence", 0.0))
        
    # If the field is missing or unexpectedly formatted
    if field_data is None:
        return 0.0
        
    # Fallback for unexpected non-dict values that exist
    return 1.0


def compute_confidence(mapped_data: dict) -> dict:
    """
    Computes a weighted confidence score for a mapped invoice and returns
    its routing status based on predefined thresholds.
    """
    total_weight = 0
    weighted_sum = 0.0
    field_scores: Dict[str, float] = {}
    
    if not mapped_data:
        # Edge case: empty dictionary
        return {
            "overall_score": 0.0,
            "status": "HUMAN_REQUIRED",
            "field_scores": {}
        }
    
    for field, weight in FIELD_WEIGHTS.items():
        # Only consider fields that exist as keys in the mapped data
        if field in mapped_data:
            data = mapped_data[field]
            confidence = _get_field_confidence(field, data)
            
            field_scores[field] = confidence
            total_weight += weight
            weighted_sum += (confidence * weight)
            
    overall_score = 0.0
    if total_weight > 0:
        overall_score = weighted_sum / total_weight
        
    # Determine the status
    if overall_score >= 0.90:
        status = "AUTO_APPROVED"
    elif overall_score >= 0.60:
        status = "NEEDS_REVIEW"
    else:
        status = "HUMAN_REQUIRED"
        
    return {
        "overall_score": round(overall_score, 4),
        "status": status,
        "field_scores": field_scores
    }
