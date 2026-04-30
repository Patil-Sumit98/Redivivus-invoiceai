"""
app/utils/datetime_utils.py

Centralised datetime serialisation helpers.

Problem: SQLite stores datetimes without timezone info. When SQLAlchemy reads
them back, Python gets a naive datetime (tzinfo=None). Calling .isoformat()
on a naive datetime produces "2026-04-25T04:26:49" — no Z or +00:00 suffix.
JavaScript then parses this as LOCAL time (IST), making dates appear
5h 30m ahead of the correct UTC value.

Fix: Always attach +00:00 (UTC) before serialising. The frontend (IST) then
displays the correct local time automatically via Intl.DateTimeFormat.
"""
from datetime import datetime, timezone


def utc_iso(dt: datetime | None) -> str | None:
    """Return an ISO-8601 string with explicit UTC offset, or None.

    Examples:
        naive  2026-04-25 04:26:49  →  "2026-04-25T04:26:49+00:00"
        aware  2026-04-25 04:26:49+00:00  →  "2026-04-25T04:26:49+00:00"
        None   →  None
    """
    if dt is None:
        return None
    # If SQLite returned a naive datetime, treat it as UTC
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    # Normalise to UTC in case it came from a tz-aware source in another tz
    return dt.astimezone(timezone.utc).isoformat()
