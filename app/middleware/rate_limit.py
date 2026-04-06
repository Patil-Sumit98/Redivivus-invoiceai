import time
from collections import deque
from fastapi import HTTPException, status, Depends
from app.models.user import User
from app.middleware.auth import get_current_user

# BUG-20: Renamed to rate_limited_user to make it clear this dependency
# both authenticates AND rate-limits, returning the User object.
# Previously called check_rate_limit which was misleading about its return type.

RATE_LIMIT_STORE: dict[str, deque] = {}

MAX_UPLOADS = 100
WINDOW_SECONDS = 60


def rate_limited_user(current_user: User = Depends(get_current_user)) -> User:
    """
    Combined auth + rate limit dependency for upload endpoints.
    Returns the authenticated User if the rate limit has not been exceeded.
    """
    user_id = current_user.id
    now = time.monotonic()

    q = RATE_LIMIT_STORE.get(user_id)
    if q is None:
        q = deque()
        RATE_LIMIT_STORE[user_id] = q

    # Prune old timestamps
    while q and now - q[0] > WINDOW_SECONDS:
        q.popleft()

    if len(q) >= MAX_UPLOADS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Max {MAX_UPLOADS} uploads per minute."
        )

    q.append(now)

    # Periodic cleanup of stale entries
    if len(RATE_LIMIT_STORE) > 100:
        _cleanup_stale_entries(now)

    return current_user


def _cleanup_stale_entries(now: float):
    """Remove user entries whose deques are empty or fully expired."""
    stale_keys = []
    for uid, q in RATE_LIMIT_STORE.items():
        while q and now - q[0] > WINDOW_SECONDS:
            q.popleft()
        if not q:
            stale_keys.append(uid)
    for uid in stale_keys:
        del RATE_LIMIT_STORE[uid]
