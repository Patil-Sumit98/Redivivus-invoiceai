from pydantic import BaseModel, EmailStr
from typing import Optional


class UserCreate(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    """Kept for backward compatibility, but login now uses OAuth2PasswordRequestForm."""
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    api_key: Optional[str] = None

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Optional[dict] = None  # {id, email} — for frontend hydration