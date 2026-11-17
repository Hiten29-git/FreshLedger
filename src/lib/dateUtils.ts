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

export function getDaysUntilExpiry(expiresAt: string): number {
  const todayStr = getLocalDateString();
  const today = parseLocalDate(todayStr);
  const expiry = parseLocalDate(expiresAt);
  const diffMs = expiry.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
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
