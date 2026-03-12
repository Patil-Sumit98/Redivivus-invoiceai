from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # Azure Document Intelligence
    AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT: str
    AZURE_DOCUMENT_INTELLIGENCE_KEY: str
    
    # Azure Blob Storage
    AZURE_STORAGE_CONNECTION_STRING: str
    AZURE_STORAGE_CONTAINER_NAME: str = "invoices-test"
    
    # Database
    DATABASE_URL: str
    
    # Auth
    JWT_SECRET: str
    
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

# Create a global instance to be imported anywhere in your app
settings = Settings()