from fastapi import FastAPI

app = FastAPI(title="InvoiceAI Backend")

@app.get("/")
async def root():
    return {"message": "InvoiceAI API is running. Phase 0 Complete."}