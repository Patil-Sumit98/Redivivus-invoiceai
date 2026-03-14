from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, invoices  # <-- Add 'invoices' here

app = FastAPI(title="InvoiceAI Backend")

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(invoices.router)  # <-- Add this line

@app.get("/")
async def root():
    return {"message": "InvoiceAI API is running. Phase 2 Complete."}