export interface User {
  id: string;
  email: string;
  organization_name?: string;
}

export interface AuthToken {
  access_token: string;
  token_type: string;
}

export interface ConfidenceField {
  value: string | number | null;
  confidence: number;
}

export interface LineItem {
  description?: string | null;
  quantity?: number | null;
  rate?: number | null;
  amount?: number | null;
  hsn_code?: string | null;
}

export interface InvoiceData {
  metadata?: any;
  gst_rules_json?: any;
  vendor_name?: ConfidenceField;
  vendor_gstin?: ConfidenceField;
  invoice_number?: ConfidenceField;
  invoice_date?: ConfidenceField;
  due_date?: ConfidenceField;
  buyer_name?: ConfidenceField;
  buyer_gstin?: ConfidenceField;
  subtotal?: ConfidenceField;
  total_amount?: ConfidenceField;
  cgst?: ConfidenceField;
  sgst?: ConfidenceField;
  igst?: ConfidenceField;
  line_items?: LineItem[];
}

export interface Invoice {
  id: string;
  original_filename: string;
  status: string;
  file_url: string;
  data_json: InvoiceData;
  confidence_score: number;
  created_at: string;
  error_message?: string;
}

export interface InvoiceListItem {
  id: string;
  original_filename: string;
  status: string;
  created_at: string;
  confidence_score: number;
  vendor_name: string | null;
  total_amount: number | null;
  invoice_number: string | null;
}

export interface Stats {
  total: number;
  completed: number;
  processing: number;
  failed: number;
  avg_confidence: number;
}

export interface ApiError {
  detail: string;
}

export interface WebhookConfig {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  created_at: string;
}

export interface ReviewItem {
  id: string;
  status: string;
  confidence_score: number;
  original_filename: string;
  created_at: string;
  gst_flags: string[];
}
