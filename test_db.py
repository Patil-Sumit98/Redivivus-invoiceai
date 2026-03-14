from app.database import engine
from sqlalchemy import inspect

inspector = inspect(engine)
tables = inspector.get_table_names()

print("--- Database Check ---")
print(f"Tables found: {tables}")

if "users" in tables and "invoices" in tables:
    print("✅ SUCCESS: Database is set up correctly!")
else:
    print("❌ ERROR: Tables are missing.")
    