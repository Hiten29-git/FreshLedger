import type { Timestamp } from 'firebase/firestore';

export const CATEGORIES = [
  'Produce',
  'Dairy',
  'Meat & Seafood',
  'Bakery',
  'Pantry',
  'Frozen',
  'Beverages',
  'Prepared',
] as const;

export type FoodCategory = (typeof CATEGORIES)[number];

export const STORAGE_LOCATIONS = [
  'Refrigerator',
  'Freezer',
  'Pantry',
  'Counter',
] as const;

export type StorageLocation = (typeof STORAGE_LOCATIONS)[number];

export const UNITS = [
  'pcs',
  'kg',
  'g',
  'L',
  'ml',
  'packs',
  'oz',
  'lbs',
] as const;

export type FoodUnit = (typeof UNITS)[number];

export const WASTE_REASONS = [
  'Expired',
  'Spoiled Early',
  'Over-purchased',
  'Leftovers',
  'Other',
] as const;

export type WasteReason = (typeof WASTE_REASONS)[number];
export type LogReason = WasteReason | 'Used in Time';

export type ItemStatus = 'active' | 'consumed' | 'wasted';
export type NotificationSeverity = 'info' | 'warning' | 'urgent' | 'expired';

// Constraints synchronized with firebase-blueprint.json
export const FIELD_LIMITS = {
  NAME_MAX: 120,
  NOTES_MAX: 500,
  LOG_NOTES_MAX: 300,
  RULE_LABEL_MAX: 80,
  TIER_KEY_MAX: 32,
  MAX_NOTIFIED_TIERS: 10,
  QUANTITY_MAX: 100000,
  COST_MAX: 100000,
} as const;

export interface UserProfile {
  userId: string;
  displayName: string;
  email: string;
  browserPushEnabled: boolean;
  dailyCheckHour: number;
  currencyCode?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FoodItem {
  id: string;
  ownerId: string;
  name: string;
  category: FoodCategory;
  storageLocation: StorageLocation;
  quantity: number;
  unit: FoodUnit;
  estimatedCost: number;
  purchasedAt: string;
  expiresAt: string;
  status: ItemStatus;
  notifiedTiers: string[];
  notes: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type RuleType = 'expiry' | 'stock';

export interface NotificationRule {
  id: string;
  ownerId: string;
  label: string;
  tierKey: string;
  daysBefore: number;
  ruleType?: RuleType;
  minQuantity?: number;
  targetUnit?: FoodUnit | 'ANY';
  targetCategory?: FoodCategory | 'ALL';
  enabled: boolean;
  channelBrowser: boolean;
  channelInApp: boolean;
  severity: NotificationSeverity;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ExpiryNotification {
  id: string;
  ownerId: string;
  itemId: string;
  itemName: string;
  tierKey: string;
  severity: NotificationSeverity;
  title: string;
  message: string;
  expiresAt: string;
  daysRemaining: number;
  read: boolean;
  dismissed: boolean;
  deliveredBrowser: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface WasteLog {
  id: string;
  ownerId: string;
  itemId: string;
  itemName: string;
  category: FoodCategory;
  outcome: 'consumed' | 'wasted';
  quantity: number;
  unit: FoodUnit;
  estimatedValue: number;
  reason: LogReason;
  loggedDate: string;
  notes: string;
  createdAt: Timestamp;
}
