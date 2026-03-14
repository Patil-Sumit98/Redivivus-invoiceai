from azure.ai.documentintelligence import DocumentIntelligenceClient
from azure.ai.documentintelligence.models import AnalyzeDocumentRequest
from azure.core.credentials import AzureKeyCredential
from app.config import settings

def analyze_invoice(file_url: str) -> dict:
    """Sends the invoice URL to Azure AI and returns the raw extracted fields."""
    
    # Initialize the Document Intelligence client
    endpoint = settings.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT
    key = settings.AZURE_DOCUMENT_INTELLIGENCE_KEY
    client = DocumentIntelligenceClient(endpoint=endpoint, credential=AzureKeyCredential(key))
    
    # Call the prebuilt invoice model using the URL
    poller = client.begin_analyze_document(
        "prebuilt-invoice",
        AnalyzeDocumentRequest(url_source=file_url)
    )
    
    # Wait for the AI to finish processing
    result = poller.result()
    
    # Return the raw fields from the first document (if any were found)
    if result.documents:
        # We return the raw dictionary of fields to be mapped later
        return result.documents[0].fields
    
    return {}