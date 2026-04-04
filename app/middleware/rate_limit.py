import time
from collections import defaultdict, deque
from fastapi import HTTPException, status, Depends
from app.models.user import User
from app.middleware.auth import get_current_user

# In-memory dictionary storing {user_id: deque([timestamps...])}
RATE_LIMIT_STORE = defaultdict(deque)

# Limit settings
MAX_UPLOADS = 100
WINDOW_SECONDS = 60

def check_rate_limit(current_user: User = Depends(get_current_user)):
    """
    Dependency that enforces a strict rate limit for invoice uploaded endpoints natively.
    Limits to MAX_UPLOADS per WINDOW_SECONDS.
    """
    user_id = current_user.id
    now = time.monotonic()
    
    # Prune old timestamps
    q = RATE_LIMIT_STORE[user_id]
    while q and now - q[0] > WINDOW_SECONDS:
        q.popleft()
        
    # Validation check
    if len(q) >= MAX_UPLOADS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Max {MAX_UPLOADS} uploads per minute."
        )
        
    # Append the newest footprint
    q.append(now)
    return current_user
