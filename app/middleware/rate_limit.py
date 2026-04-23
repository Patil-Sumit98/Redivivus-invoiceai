"""
Rate limiting middleware for InvoiceAI.

BUG-08: Redis-backed sliding window rate limiter. Falls open (allows requests)
        if Redis is unavailable — never blocks uploads due to Redis outage.
"""
import time
import logging
from fastapi import HTTPException, status, Depends
from app.models.user import User
from app.middleware.auth import get_current_user

logger = logging.getLogger(__name__)

_redis_client = None
_redis_available = None  # None = not checked yet


def _get_redis():
    """Lazy-init Redis connection. Returns None if Redis is unavailable."""
    global _redis_client, _redis_available

    if _redis_available is False:
        return None  # Already know Redis is down

    if _redis_client is None:
        try:
            import redis as redis_lib
            from app.config import settings
            _redis_client = redis_lib.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=2,
                socket_timeout=2,
            )
            _redis_client.ping()
            _redis_available = True
            logger.info("[rate_limit] Redis connected successfully")
        except Exception as e:
            _redis_available = False
            _redis_client = None
            logger.warning(f"[rate_limit] Redis unavailable, falling back to in-memory: {e}")
            return None

    return _redis_client


# ── In-memory fallback (single-worker only) ────────────────────────────────
from collections import deque

_MEMORY_STORE: dict[str, deque] = {}
_WINDOW_SECONDS = 60


def _check_memory_limit(user_id: str, max_uploads: int) -> bool:
    """In-memory rate check. Returns True if allowed, False if over limit."""
    now = time.monotonic()
    q = _MEMORY_STORE.get(user_id)
    if q is None:
        q = deque()
        _MEMORY_STORE[user_id] = q
    while q and now - q[0] > _WINDOW_SECONDS:
        q.popleft()
    if len(q) >= max_uploads:
        return False
    q.append(now)
    return True


def rate_limited_user(current_user: User = Depends(get_current_user)) -> User:
    """
    Combined auth + rate limit dependency for upload endpoints.
    Returns the authenticated User if the rate limit has not been exceeded.

    BUG-08: Uses Redis sliding window when available. Falls back to in-memory.
    """
    from app.config import settings
    max_uploads = settings.UPLOAD_RATE_LIMIT_PER_MIN

    r = _get_redis()
    if r is not None:
        # Redis-backed sliding window
        try:
            key = f"rate:{current_user.id}:{int(time.time()) // 60}"
            count = r.incr(key)
            if count == 1:
                r.expire(key, 120)  # 2 min TTL for safety
            if count > max_uploads:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Rate limit: max {max_uploads} uploads/min"
                )
        except HTTPException:
            raise  # Re-raise 429
        except Exception:
            pass  # Fail open — do not block uploads if Redis errors mid-check
    else:
        # In-memory fallback
        if not _check_memory_limit(current_user.id, max_uploads):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Max {max_uploads} uploads per minute."
            )

    return current_user
