/**
 * Currency formatter — Indian Rupee, en-IN locale.
 */
export const formatCurrency = (val: number | null | undefined): string => {
  if (val === null || val === undefined || isNaN(val)) return '-';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);
};

/**
 * Ensure a date string is treated as UTC even if the backend omits the Z / +00:00 suffix.
 * SQLite naive datetimes come back as "2026-04-25T04:26:49" (no offset).
 * Appending "Z" forces JavaScript to parse them as UTC, then display in IST (UTC+5:30).
 */
function toUTCDate(dateString: string): Date {
  const s = dateString.trim();
  // Already has explicit offset: ends with Z, or +HH:MM / -HH:MM
  if (s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s)) {
    return new Date(s);
  }
  // No offset → SQLite naive UTC — append Z so JS parses as UTC
  return new Date(s + 'Z');
}

/**
 * Full date + time display in IST (Mumbai / Kolkata, UTC+5:30).
 * Example: "25 Apr 2026, 9:56 am"
 */
export const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  try {
    const d = toUTCDate(dateString);
    if (isNaN(d.getTime())) return '-';
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Kolkata',   // IST — Mumbai / Kolkata
    }).format(d);
  } catch {
    return '-';
  }
};

/**
 * Human-readable "time ago" in IST.
 * Example: "3m ago", "2h ago", "1d ago"
 */
export const formatTimeAgo = (dateString: string): string => {
  try {
    const date = toUTCDate(dateString);
    if (isNaN(date.getTime())) return '-';
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return `${diffInDays}d ago`;

    // Fallback: localised date in IST
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeZone: 'Asia/Kolkata',
    }).format(date);
  } catch {
    return '-';
  }
};
