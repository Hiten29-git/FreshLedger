import { addDaysToToday } from './dateUtils';
import type {
  FoodCategory,
  FoodUnit,
  NotificationSeverity,
  RuleType,
  StorageLocation,
} from '../types';

export interface DefaultRuleSeed {
  id: string;
  label: string;
  tierKey: string;
  daysBefore: number;
  ruleType: RuleType;
  minQuantity?: number;
  targetUnit?: FoodUnit | 'ANY';
  targetCategory?: FoodCategory | 'ALL';
  enabled: boolean;
  channelBrowser: boolean;
  channelInApp: boolean;
  severity: NotificationSeverity;
}

export const DEFAULT_NOTIFICATION_RULES: DefaultRuleSeed[] = [
  {
    id: 'rule_7d',
    label: 'Early Planning Reminder (7 days before)',
    tierKey: '7d',
    daysBefore: 7,
    ruleType: 'expiry',
    enabled: true,
    channelBrowser: false,
    channelInApp: true,
    severity: 'info',
  },
  {
    id: 'rule_3d',
    label: 'Priority Use Alert (3 days before)',
    tierKey: '3d',
    daysBefore: 3,
    ruleType: 'expiry',
    enabled: true,
    channelBrowser: true,
    channelInApp: true,
    severity: 'warning',
  },
  {
    id: 'rule_1d',
    label: 'Urgent Next-Day Alert (1 day before)',
    tierKey: '1d',
    daysBefore: 1,
    ruleType: 'expiry',
    enabled: true,
    channelBrowser: true,
    channelInApp: true,
    severity: 'urgent',
  },
  {
    id: 'rule_0d',
    label: 'Final Expiration Day Warning',
    tierKey: '0d',
    daysBefore: 0,
    ruleType: 'expiry',
    enabled: true,
    channelBrowser: true,
    channelInApp: true,
    severity: 'urgent',
  },
  {
    id: 'rule_expired',
    label: 'Overdue / Expired Check',
    tierKey: 'expired',
    daysBefore: -1,
    ruleType: 'expiry',
    enabled: true,
    channelBrowser: true,
    channelInApp: true,
    severity: 'expired',
  },
  {
    id: 'rule_stock_pcs',
    label: 'Low Piece Stock Alert (< 2 pcs)',
    tierKey: 'stock_pcs_2',
    daysBefore: 0,
    ruleType: 'stock',
    minQuantity: 2,
    targetUnit: 'pcs',
    targetCategory: 'ALL',
    enabled: true,
    channelBrowser: true,
    channelInApp: true,
    severity: 'warning',
  },
];

export interface SampleFoodSeed {
  name: string;
  category: FoodCategory;
  storageLocation: StorageLocation;
  quantity: number;
  unit: FoodUnit;
  estimatedCost: number;
  purchasedAt: string;
  expiresAt: string;
  notes: string;
}

export function buildSamplePantrySeeds(): SampleFoodSeed[] {
  return [
    {
      name: 'Organic Baby Spinach',
      category: 'Produce',
      storageLocation: 'Refrigerator',
      quantity: 250,
      unit: 'g',
      estimatedCost: 4.5,
      purchasedAt: addDaysToToday(-5),
      expiresAt: addDaysToToday(1),
      notes: 'Use in tonight’s sauté or morning smoothie.',
    },
    {
      name: 'Pasture-Raised Whole Milk',
      category: 'Dairy',
      storageLocation: 'Refrigerator',
      quantity: 1,
      unit: 'L',
      estimatedCost: 5.25,
      purchasedAt: addDaysToToday(-6),
      expiresAt: addDaysToToday(2),
      notes: 'Opened 3 days ago.',
    },
    {
      name: 'Wild Atlantic Salmon Fillets',
      category: 'Meat & Seafood',
      storageLocation: 'Refrigerator',
      quantity: 2,
      unit: 'pcs',
      estimatedCost: 16.8,
      purchasedAt: addDaysToToday(-2),
      expiresAt: addDaysToToday(0),
      notes: 'Cook today or move to freezer.',
    },
    {
      name: 'Sourdough Country Loaf',
      category: 'Bakery',
      storageLocation: 'Counter',
      quantity: 1,
      unit: 'pcs',
      estimatedCost: 6.5,
      purchasedAt: addDaysToToday(-3),
      expiresAt: addDaysToToday(3),
      notes: 'Slice and freeze remaining half if unused.',
    },
    {
      name: 'Greek Plain Yogurt',
      category: 'Dairy',
      storageLocation: 'Refrigerator',
      quantity: 500,
      unit: 'g',
      estimatedCost: 4.9,
      purchasedAt: addDaysToToday(-10),
      expiresAt: addDaysToToday(-1),
      notes: 'Check aroma and seal before discarding.',
    },
    {
      name: 'Honeycrisp Apples',
      category: 'Produce',
      storageLocation: 'Refrigerator',
      quantity: 6,
      unit: 'pcs',
      estimatedCost: 7.2,
      purchasedAt: addDaysToToday(-4),
      expiresAt: addDaysToToday(10),
      notes: 'Stored in crisper drawer.',
    },
    {
      name: 'Heirloom Cherry Tomatoes',
      category: 'Produce',
      storageLocation: 'Counter',
      quantity: 1,
      unit: 'packs',
      estimatedCost: 4.2,
      purchasedAt: addDaysToToday(-3),
      expiresAt: addDaysToToday(5),
      notes: 'Roast with garlic if softening.',
    },
    {
      name: 'Frozen Edamame Pods',
      category: 'Frozen',
      storageLocation: 'Freezer',
      quantity: 450,
      unit: 'g',
      estimatedCost: 3.75,
      purchasedAt: addDaysToToday(-20),
      expiresAt: addDaysToToday(95),
      notes: 'Bulk freezer staple.',
    },
  ];
}
