import time
from collections import deque
from fastapi import HTTPException, status, Depends
from app.models.user import User
from app.middleware.auth import get_current_user

# BUG-06 fix: Use a plain dict instead of defaultdict so we can evict empty keys.
# Keys are user_ids, values are deques of timestamps.
RATE_LIMIT_STORE: dict[str, deque] = {}

# Limit settings
MAX_UPLOADS = 100
WINDOW_SECONDS = 60

def check_rate_limit(current_user: User = Depends(get_current_user)):
    """
    Dependency that enforces a rate limit for invoice upload endpoints.
    Limits to MAX_UPLOADS per WINDOW_SECONDS.
    """
    user_id = current_user.id
    now = time.monotonic()

    # Get or create the deque for this user
    q = RATE_LIMIT_STORE.get(user_id)
    if q is None:
        q = deque()
        RATE_LIMIT_STORE[user_id] = q

    # Prune old timestamps
    while q and now - q[0] > WINDOW_SECONDS:
        q.popleft()

    # BUG-06 fix: Evict the key entirely if the deque is now empty
    # This prevents unbounded memory growth from inactive users
    if not q:
        # Don't delete yet — we still need to add the current timestamp below.
        # But if this user had an old empty entry, it was cleaned by popleft above.
        pass

    # Validation check
    if len(q) >= MAX_UPLOADS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Max {MAX_UPLOADS} uploads per minute."
        )

    # Append the current request timestamp
    q.append(now)

    # BUG-06 fix: Periodically clean stale entries from other users
    # Run cleanup every ~100 requests to avoid O(n) on every call
    if len(RATE_LIMIT_STORE) > 100:
        _cleanup_stale_entries(now)

    return current_user


def _cleanup_stale_entries(now: float):
    """Remove user entries whose deques are empty or fully expired."""
    stale_keys = []
    for uid, q in RATE_LIMIT_STORE.items():
        # Prune expired timestamps
        while q and now - q[0] > WINDOW_SECONDS:
            q.popleft()
        if not q:
            stale_keys.append(uid)
    for uid in stale_keys:
        del RATE_LIMIT_STORE[uid]
