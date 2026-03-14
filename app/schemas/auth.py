from pydantic import BaseModel, EmailStr
from typing import Optional

# What we expect from the frontend when a user registers
class UserCreate(BaseModel):
    email: EmailStr
    password: str

# What we expect when a user logs in
class LoginRequest(BaseModel):
    email: EmailStr
    password: str

# What we send back to the frontend after registration/login
class UserResponse(BaseModel):
    id: str
    email: str
    api_key: Optional[str] = None

    class Config:
        from_attributes = True  # Allows Pydantic to read SQLAlchemy models

# The JWT token response shape required by your API contract
class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"