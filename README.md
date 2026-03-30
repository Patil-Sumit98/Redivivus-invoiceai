# InvoiceAI – Smart Invoice Processing Platform

InvoiceAI is an end-to-end full-stack application that allows users to upload, process, and extract rich information from invoices using **Azure Document Intelligence** and store the documents securely via **Azure Blob Storage**.

This repository contains both the fully functional FastAPI Backend (`/app`) and the seamlessly integrated Vanilla HTML/JS Frontend (`/frontend`). 

---

## 🚀 Quick Start Guide for Beginners

Follow these simple steps to run this application locally on your machine from scratch. 

### Prerequisites
- Python 3.10+ installed
- Git installed
- An active Azure subscription (with Document Intelligence and Blob Storage Services provisioned)

### Step 1: Clone the Repository
```bash
git clone https://github.com/Patil-Sumit98/invoiceai-backend.git
cd invoiceai-backend
```

### Step 2: Set Up Your Virtual Environment
To keep things clean, install the dependencies inside a virtual environment.
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

### Step 3: Install Requirements
With your virtual environment active, install all the python packages the app needs:
```bash
pip install -r requirements.txt
```

### Step 4: Configure Environment Variables
You need to pass your Azure API keys to the backend. Create a new file right in the project root folder named exactly `.env` (no filename before the dot), and paste this inside:

```env
# 1. AZURE DOCUMENT INTELLIGENCE
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT="https://your-endpoint.cognitiveservices.azure.com/"
AZURE_DOCUMENT_INTELLIGENCE_KEY="your-secret-key"

# 2. AZURE BLOB STORAGE
AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=...;EndpointSuffix=core.windows.net"
AZURE_STORAGE_CONTAINER_NAME="invoices-test"

# 3. SECRETS & DB
DATABASE_URL="sqlite:///./invoiceai.db"
# You can generate a random string for JWT_SECRET
JWT_SECRET="your_highly_secure_random_string" 
```

### Step 5: Initialize the Database
Before running the app, you need to create the database schemas locally. Run these commands:
```bash
alembic upgrade head
```
*(This commands creates an `invoiceai.db` SQLite file locally and wires up all the tables).*

### Step 6: Start the Server!
Finally, start up the FastAPI backend!
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Step 7: View the App ✨
Since the frontend code is baked right into the backend, you do NOT need a separate frontend server.

Just open your favorite web browser and navigate directly to:
👉 **[http://localhost:8000/frontend](http://localhost:8000/frontend)**

You will see the beautiful Swiss Financial Light Theme user interface. Register a new account, login, and upload a test PDF invoice! 

---

## 🛠️ Tech Stack
- **Backend**: Python, FastAPI, SQLAlchemy, Alembic
- **Frontend**: Vanilla Javascript (ES6), HTML5, CSS3 
- **Database**: SQLite (local)
- **AI & Cloud**: Azure AI Document Intelligence SDK, Azure Blob Storage SDK
- **Security**: JWT Authentication, bcrypt password hashing

## 📁 Repository Structure
```text
/alembic           # Database migration files
/app
 ├── routes/       # API endpoints (auth, invoices)
 ├── models/       # SQLAlchemy database schemas
 ├── services/     # Azure Cloud integrations and core logic
/frontend          # Decoupled UI assets
 ├── assets/css/   # Premium styling
 ├── assets/js/    # API integration & app logic
 └── index.html    # Base application shell
```
