export interface CurrencyOption {
  code: string;
  name: string;
  symbol: string;
}

const POPULAR_CURRENCY_CODES = [
  'INR',
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'AUD',
  'CAD',
  'SGD',
  'AED',
  'CHF',
  'CNY',
  'KRW',
  'BRL',
  'MXN',
  'ZAR',
] as const;

const FALLBACK_ISO_CURRENCIES = [
  'AED', 'AFN', 'ALL', 'AMD', 'ANG', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN',
  'BAM', 'BBD', 'BDT', 'BGN', 'BHD', 'BIF', 'BMD', 'BND', 'BOB', 'BRL',
  'BSD', 'BTN', 'BWP', 'BYN', 'BZD', 'CAD', 'CDF', 'CHF', 'CLP', 'CNY',
  'COP', 'CRC', 'CUP', 'CVE', 'CZK', 'DJF', 'DKK', 'DOP', 'DZD', 'EGP',
  'ERN', 'ETB', 'EUR', 'FJD', 'FKP', 'GBP', 'GEL', 'GHS', 'GIP', 'GMD',
  'GNF', 'GTQ', 'GYD', 'HKD', 'HNL', 'HTG', 'HUF', 'IDR', 'ILS', 'INR',
  'IQD', 'IRR', 'ISK', 'JMD', 'JOD', 'JPY', 'KES', 'KGS', 'KHR', 'KMF',
  'KPW', 'KRW', 'KWD', 'KYD', 'KZT', 'LAK', 'LBP', 'LKR', 'LRD', 'LSL',
  'LYD', 'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT', 'MOP', 'MRU', 'MUR',
  'MVR', 'MWK', 'MXN', 'MYR', 'MZN', 'NAD', 'NGN', 'NIO', 'NOK', 'NPR',
  'NZD', 'OMR', 'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PLN', 'PYG', 'QAR',
  'RON', 'RSD', 'RUB', 'RWF', 'SAR', 'SBD', 'SCR', 'SDG', 'SEK', 'SGD',
  'SHP', 'SLE', 'SOS', 'SRD', 'SSP', 'STN', 'SYP', 'SZL', 'THB', 'TJS',
  'TMT', 'TND', 'TOP', 'TRY', 'TTD', 'TWD', 'TZS', 'UAH', 'UGX', 'USD',
  'UYU', 'UZS', 'VES', 'VND', 'VUV', 'WST', 'XAF', 'XCD', 'XOF', 'XPF',
  'YER', 'ZAR', 'ZMW',
];

function getAllSupportedCurrencyCodes(): string[] {
  try {
    const intlWithSupported = Intl as typeof Intl & {
      supportedValuesOf?: (key: 'currency') => string[];
    };
    if (typeof intlWithSupported.supportedValuesOf === 'function') {
      const list = intlWithSupported.supportedValuesOf('currency');
      if (Array.isArray(list) && list.length > 0) {
        return list.filter((code) => /^[A-Z]{3}$/.test(code));
      }
    }
  } catch {
    // Fallback below
  }
  return FALLBACK_ISO_CURRENCIES;
}

const displayNames =
  typeof Intl !== 'undefined' && 'DisplayNames' in Intl
    ? new Intl.DisplayNames(['en'], { type: 'currency' })
    : null;

export function getCurrencySymbol(currencyCode: string): string {
  const safeCode = /^[A-Z]{3}$/.test(currencyCode) ? currencyCode : 'USD';
  try {
    const locale = safeCode === 'INR' ? 'en-IN' : 'en-US';
    const parts = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: safeCode,
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(0);
    const symbolPart = parts.find((p) => p.type === 'currency');
    return symbolPart?.value || safeCode;
  } catch {
    return safeCode;
  }
}

export function getCurrencyName(currencyCode: string): string {
  try {
    return displayNames?.of(currencyCode) || currencyCode;
  } catch {
    return currencyCode;
  }
}

let cachedOptions: { popular: CurrencyOption[]; others: CurrencyOption[] } | null = null;

export function getGroupedCurrencyOptions(): {
  popular: CurrencyOption[];
  others: CurrencyOption[];
} {
  if (cachedOptions) return cachedOptions;

  const allCodes = getAllSupportedCurrencyCodes();
  const popularSet = new Set<string>(POPULAR_CURRENCY_CODES);

  const toOption = (code: string): CurrencyOption => ({
    code,
    name: getCurrencyName(code),
    symbol: getCurrencySymbol(code),
  });

  const popular = POPULAR_CURRENCY_CODES.filter((code) => allCodes.includes(code)).map(toOption);
  const others = allCodes
    .filter((code) => !popularSet.has(code))
    .sort((a, b) => a.localeCompare(b))
    .map(toOption);

  cachedOptions = { popular, others };
  return cachedOptions;
}

export function formatCurrency(amount: number, currencyCode: string = 'USD'): string {
  const safeCode = /^[A-Z]{3}$/.test(currencyCode) ? currencyCode : 'USD';
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const locale = safeCode === 'INR' ? 'en-IN' : 'en-US';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: safeCode,
    }).format(safeAmount);
  } catch {
    return `${safeCode} ${safeAmount.toFixed(2)}`;
  }
}

export function detectDefaultCurrencyCode(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const lang = (navigator.language || '').toUpperCase();
    if (tz === 'Asia/Kolkata' || tz === 'Asia/Calcutta' || lang.endsWith('-IN')) return 'INR';
    if (tz === 'Europe/London' || lang.endsWith('-GB')) return 'GBP';
    if (tz === 'Asia/Tokyo' || lang.endsWith('-JP')) return 'JPY';
    if (tz === 'Asia/Dubai') return 'AED';
    if (tz === 'Asia/Singapore' || lang.endsWith('-SG')) return 'SGD';
    if (tz.startsWith('Australia/') || lang.endsWith('-AU')) return 'AUD';
    if (lang.endsWith('-CA')) return 'CAD';
    if (tz.startsWith('Europe/')) return 'EUR';
  } catch {
    // Default below
  }
  return 'USD';
}
