# InvoiceAI – Enterprise Invoice Processing Platform

InvoiceAI is a comprehensive full-stack application designed to automate the extraction, processing, and management of financial invoices. Leveraging **Azure Document Intelligence** for high-accuracy OCR/Data extraction and **Azure Blob Storage** for secure document archiving, this platform eliminates manual data entry and streamlines financial operations.

This repository encompasses a production-ready **FastAPI Backend**, an asynchronous background processing pipeline, and a modular **Vanilla HTML/JS Frontend**, unified within a cohesive monolithic architecture for simplified deployment.

---

## 🌟 Key Features & Capabilities

- **Automated Data Extraction**: Extracts complex invoice entities (Vendor Details, GSTINs, Line Items, Tax Rates, and Confidence Scores) using pre-built machine learning models.
- **Asynchronous Processing**: Employs non-blocking background tasks to handle Azure API communication and database transactions without degrading user experience.
- **Secure Architecture**: Implements stateless JWT (JSON Web Token) authentication and bcrypt password hashing.
- **Robust Storage**: Integrates directly with Azure Blob Storage for reliable cloud-hosted document persistence.
- **Interactive Dashboard**: A responsive, premium-designed interface displaying real-time extraction analytics, confidence metrics, and processing statuses.

---

## 🚀 Quick Start Guide

Follow these instructions to configure and execute the application locally from scratch.

### Prerequisites
- Python 3.10+ installed
- Git installed
- An active Azure subscription (with Document Intelligence and Blob Storage Services provisioned)

### Step 1: Clone the Repository
```bash
git clone https://github.com/Patil-Sumit98/invoiceai-backend.git
cd invoiceai-backend
```

### Step 2: Set Up the Virtual Environment
To isolate project dependencies, create and activate a Python virtual environment.
**For Windows:**
```powershell
python -m venv venv
.\venv\Scripts\activate
```
**For Mac/Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
```

### Step 3: Install Dependencies
```bash
pip install -r requirements.txt
```

### Step 4: Configure Environment Variables
Create a file named `.env` in the root directory and populate it with your environment-specific credentials:

```env
# 1. AZURE DOCUMENT INTELLIGENCE
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT="https://your-endpoint.cognitiveservices.azure.com/"
AZURE_DOCUMENT_INTELLIGENCE_KEY="your-secret-key"

# 2. AZURE BLOB STORAGE
AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=...;EndpointSuffix=core.windows.net"
AZURE_STORAGE_CONTAINER_NAME="invoices-test"

# 3. SECRETS & DATABASE
DATABASE_URL="sqlite:///./invoiceai.db"
JWT_SECRET="your_highly_secure_random_string" 
```

### Step 5: Initialize the Database Schema
Apply the Alembic migrations to build the necessary database tables (Users, Invoices, etc.):
```bash
alembic upgrade head
```

### Step 6: Launch the Application
Start the FastAPI server:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Step 7: Access the Platform
Navigate to the following URL in your web browser to access the frontend interface:
👉 **[http://localhost:8000/frontend](http://localhost:8000/frontend)**

---

## 🛠️ Technology Stack
- **Backend**: Python 3.10+, FastAPI, SQLAlchemy (ORM), Alembic (Migrations)
- **Frontend**: ES6 Javascript, HTML5, CSS3 (No framework dependencies)
- **Database**: SQLite (Configured for local deployment, easily substitutable for PostgreSQL)
- **Cloud Services**: Azure AI Document Intelligence SDK, Azure Blob Storage SDK
- **Authentication**: JWT (JSON Web Tokens), Passlib (Bcrypt)

## 📁 Repository Architecture
```text
/alembic           # Database migration configurations
/app
 ├── routers/      # API endpoints (Authentication & Invoice routing)
 ├── models/       # SQLAlchemy database schemas
 ├── services/     # Azure Cloud integrations and background tasks
/frontend          # Decoupled UI assets served via FastAPI static mounts
 ├── assets/css/   # Application styling
 ├── assets/js/    # API integration & DOM manipulation logic
 └── index.html    # Core application shell
```
