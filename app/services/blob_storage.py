import uuid
from azure.storage.blob import BlobServiceClient, PublicAccess
from app.config import settings

def upload_file_to_blob(file_bytes: bytes, original_filename: str) -> str:
    """Uploads a file to Azure Blob Storage and returns the public URL."""
    
    # Initialize the Azure client
    blob_service_client = BlobServiceClient.from_connection_string(
        settings.AZURE_STORAGE_CONNECTION_STRING
    )
    
    # Connect to the specific container (e.g., "invoices-test")
    container_client = blob_service_client.get_container_client(
        settings.AZURE_STORAGE_CONTAINER_NAME
    )
    
    # Create the container if it doesn't exist, allowing public read access for the AI
    if not container_client.exists():
        container_client.create_container(public_access=PublicAccess.Blob)
        
    # Generate a unique filename to prevent overwriting (e.g., 123e4567.pdf)
    file_extension = original_filename.split(".")[-1]
    unique_filename = f"{uuid.uuid4()}.{file_extension}"
    
    # Upload the file
    blob_client = container_client.get_blob_client(unique_filename)
    blob_client.upload_blob(file_bytes, overwrite=True)
    
    # Return the URL where the file can be accessed
    return blob_client.url