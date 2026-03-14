# 🧾 InvoiceAI Backend

This is the FastAPI backend for the InvoiceAI project. It provides secure user authentication, handles file uploads via Azure Blob Storage, and extracts structured invoice data using the Azure Document Intelligence AI.

## 🚀 Features
* **JWT Authentication:** Secure user registration and login (`passlib` + `bcrypt`).
* **Azure AI Core:** Automated invoice parsing using the `prebuilt-invoice` model.
* **Blob Storage:** Secure file hosting for AI processing.
* **Database:** SQLite with SQLAlchemy ORM.
* **Background Tasks:** Non-blocking API endpoints for fast frontend feedback.

## 🛠️ Prerequisites
* Python 3.10+
* An Azure account with Document Intelligence and Blob Storage resources.

## 💻 Local Setup for Dev 2 (Frontend)

**1. Clone the repository**
```bash
git clone [https://github.com/YOUR_GITHUB_USERNAME/invoiceai-backend.git](https://github.com/YOUR_GITHUB_USERNAME/invoiceai-backend.git)
cd invoiceai-backend
