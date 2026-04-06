import uuid
from azure.storage.blob import BlobServiceClient
from app.config import settings

# BUG-26: Track container creation to avoid calling container.exists() on every upload
_container_created = False


def upload_file_to_blob(file_bytes: bytes, original_filename: str) -> str:
    """Uploads a file to Azure Blob Storage and returns the public URL."""
    global _container_created

    blob_service_client = BlobServiceClient.from_connection_string(
        settings.AZURE_STORAGE_CONNECTION_STRING
    )
    container_client = blob_service_client.get_container_client(
        settings.AZURE_STORAGE_CONTAINER_NAME
    )

    # Only check/create container on the first upload
    if not _container_created:
        if not container_client.exists():
            container_client.create_container()
        _container_created = True

    file_extension = original_filename.rsplit(".", 1)[-1] if "." in original_filename else "bin"
    unique_filename = f"{uuid.uuid4()}.{file_extension}"

    blob_client = container_client.get_blob_client(unique_filename)
    blob_client.upload_blob(file_bytes, overwrite=True)

    return blob_client.url