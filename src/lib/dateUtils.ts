export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDaysToToday(days: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return getLocalDateString(d);
}

export function parseLocalDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
}

export function getDaysUntilExpiry(expiresAt: string, now: Date = new Date()): number {
  const todayStr = getLocalDateString(now);
  const today = parseLocalDate(todayStr);
  const expiry = parseLocalDate(expiresAt);
  const diffMs = expiry.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export interface LiveCountdownMeta {
  isExpired: boolean;
  isToday: boolean;
  formatted: string;
}

/**
 * Computes a live real-time countdown toward the end of the expiration date (23:59:59 local time).
 */
export function getLiveExpiryCountdown(expiresAt: string, nowMs: number = Date.now()): LiveCountdownMeta {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiresAt)) {
    return { isExpired: false, isToday: false, formatted: expiresAt };
  }
  const [y, m, d] = expiresAt.split('-').map(Number);
  const endOfExpiry = new Date(y, (m || 1) - 1, d || 1, 23, 59, 59, 999).getTime();
  const diffMs = endOfExpiry - nowMs;

  const daysUntil = getDaysUntilExpiry(expiresAt, new Date(nowMs));
  const isToday = daysUntil === 0;

  if (diffMs <= 0) {
    const absSec = Math.floor(Math.abs(diffMs) / 1000);
    const days = Math.floor(absSec / 86400);
    const hours = Math.floor((absSec % 86400) / 3600);
    const mins = Math.floor((absSec % 3600) / 60);
    if (days >= 1) {
      return { isExpired: true, isToday: false, formatted: `-${days}d ${hours}h overdue` };
    }
    return { isExpired: true, isToday: false, formatted: `-${hours}h ${mins}m overdue` };
  }

  const totalSec = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  const pad = (n: number) => String(n).padStart(2, '0');

  if (isToday || days === 0) {
    return {
      isExpired: false,
      isToday: true,
      formatted: `${pad(hours)}h ${pad(mins)}m ${pad(secs)}s left`,
    };
  }
  if (days <= 3) {
    return {
      isExpired: false,
      isToday: false,
      formatted: `${days}d ${pad(hours)}h ${pad(mins)}m left`,
    };
  }
  return {
    isExpired: false,
    isToday: false,
    formatted: `${days}d ${pad(hours)}h left`,
  };
}

export function formatShortDate(isoDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  const d = parseLocalDate(isoDate);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export interface ExpiryStatusMeta {
  state: 'expired' | 'urgent' | 'warning' | 'fresh';
  label: string;
  shortLabel: string;
}

export function classifyExpiryStatus(daysLeft: number): ExpiryStatusMeta {
  if (daysLeft < 0) {
    const absDays = Math.abs(daysLeft);
    return {
      state: 'expired',
      label: `Expired ${absDays} ${absDays === 1 ? 'day' : 'days'} ago`,
      shortLabel: `-${absDays}d`,
    };
  }
  if (daysLeft === 0) {
    return {
      state: 'urgent',
      label: 'Expires today',
      shortLabel: 'Today',
    };
  }
  if (daysLeft === 1) {
    return {
      state: 'urgent',
      label: 'Expires tomorrow',
      shortLabel: '1d left',
    };
  }
  if (daysLeft <= 3) {
    return {
      state: 'warning',
      label: `${daysLeft} days remaining`,
      shortLabel: `${daysLeft}d left`,
    };
  }
  if (daysLeft <= 7) {
    return {
      state: 'warning',
      label: `${daysLeft} days remaining`,
      shortLabel: `${daysLeft}d left`,
    };
  }
  return {
    state: 'fresh',
    label: `${daysLeft} days remaining`,
    shortLabel: `${daysLeft}d left`,
  };
}
