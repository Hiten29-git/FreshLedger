import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromCache,
  getDocs,
  getDocsFromCache,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { detectDefaultCurrencyCode } from './currency';
import { getLocalDateString } from './dateUtils';
import {
  db,
  executeOfflineSafeWrite,
  handleFirestoreError,
  isClientOnline,
  OperationType,
} from './firebase';
import { buildSamplePantrySeeds, DEFAULT_NOTIFICATION_RULES } from './sampleData';
import {
  FIELD_LIMITS,
  type ExpiryNotification,
  type FoodCategory,
  type FoodItem,
  type FoodUnit,
  type LogReason,
  type NotificationSeverity,
  type RuleType,
  type StorageLocation,
} from '../types';

export async function ensureUserAndDefaults(user: User): Promise<void> {
  const userPath = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);
  const online = isClientOnline();

  try {
    let userExists = false;
    if (online) {
      const snap = await getDoc(userRef);
      userExists = snap.exists();
    } else {
      try {
        const cachedSnap = await getDocFromCache(userRef);
        userExists = cachedSnap.exists();
      } catch {
        // Not yet in IndexedDB cache while offline; allow cached listeners to mount
        return;
      }
    }

    if (!userExists) {
      const displayName = (
        user.displayName?.trim() ||
        user.email?.split('@')[0] ||
        'Kitchen Manager'
      ).slice(0, 100);
      await executeOfflineSafeWrite(
        setDoc(userRef, {
          userId: user.uid,
          displayName,
          email: (user.email || '').slice(0, 200),
          browserPushEnabled: false,
          dailyCheckHour: 9,
          currencyCode: detectDefaultCurrencyCode(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
        OperationType.WRITE,
        userPath
      );
    }

    const rulesPath = `users/${user.uid}/rules`;
    const rulesQuery = query(collection(db, rulesPath), where('ownerId', '==', user.uid));
    let rulesEmpty = false;

    if (online) {
      const rulesSnap = await getDocs(rulesQuery);
      rulesEmpty = rulesSnap.empty;
    } else {
      try {
        const cachedRules = await getDocsFromCache(rulesQuery);
        rulesEmpty = cachedRules.empty;
      } catch {
        rulesEmpty = false;
      }
    }

    if (rulesEmpty) {
      const batch = writeBatch(db);
      for (const rule of DEFAULT_NOTIFICATION_RULES) {
        const ruleRef = doc(db, rulesPath, rule.id);
        const payload: Record<string, unknown> = {
          ownerId: user.uid,
          label: rule.label,
          tierKey: rule.tierKey,
          daysBefore: rule.daysBefore,
          ruleType: rule.ruleType,
          enabled: rule.enabled,
          channelBrowser: rule.channelBrowser,
          channelInApp: rule.channelInApp,
          severity: rule.severity,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (rule.ruleType === 'stock') {
          payload.minQuantity = rule.minQuantity ?? 1;
          payload.targetUnit = rule.targetUnit ?? 'ANY';
          payload.targetCategory = rule.targetCategory ?? 'ALL';
        }
        batch.set(ruleRef, payload);
      }
      await executeOfflineSafeWrite(batch.commit(), OperationType.WRITE, rulesPath);
    }
  } catch (error) {
    if (!isClientOnline()) {
      console.warn('Offline account bootstrap fallback active:', error);
      return;
    }
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export interface FoodItemInput {
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

export async function addFoodItem(userId: string, input: FoodItemInput): Promise<string> {
  const path = `users/${userId}/items`;
  const ref = doc(collection(db, path));
  await executeOfflineSafeWrite(
    setDoc(ref, {
      ownerId: userId,
      name: input.name.trim().slice(0, FIELD_LIMITS.NAME_MAX),
      category: input.category,
      storageLocation: input.storageLocation,
      quantity: Math.max(0.01, Math.min(FIELD_LIMITS.QUANTITY_MAX, Number(input.quantity) || 1)),
      unit: input.unit,
      estimatedCost: Math.max(0, Math.min(FIELD_LIMITS.COST_MAX, Number(input.estimatedCost) || 0)),
      purchasedAt: input.purchasedAt,
      expiresAt: input.expiresAt,
      status: 'active',
      notifiedTiers: [],
      notes: input.notes.trim().slice(0, FIELD_LIMITS.NOTES_MAX),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
    OperationType.CREATE,
    path
  );
  return ref.id;
}

export async function updateFoodItem(
  userId: string,
  itemId: string,
  input: FoodItemInput,
  resetNotificationsIfDateChanged: boolean,
  existingTiers: string[]
): Promise<void> {
  const path = `users/${userId}/items/${itemId}`;
  await executeOfflineSafeWrite(
    updateDoc(doc(db, path), {
      name: input.name.trim().slice(0, FIELD_LIMITS.NAME_MAX),
      category: input.category,
      storageLocation: input.storageLocation,
      quantity: Math.max(0.01, Math.min(FIELD_LIMITS.QUANTITY_MAX, Number(input.quantity) || 1)),
      unit: input.unit,
      estimatedCost: Math.max(0, Math.min(FIELD_LIMITS.COST_MAX, Number(input.estimatedCost) || 0)),
      purchasedAt: input.purchasedAt,
      expiresAt: input.expiresAt,
      notifiedTiers: resetNotificationsIfDateChanged
        ? []
        : existingTiers.slice(0, FIELD_LIMITS.MAX_NOTIFIED_TIERS),
      notes: input.notes.trim().slice(0, FIELD_LIMITS.NOTES_MAX),
      updatedAt: serverTimestamp(),
    }),
    OperationType.UPDATE,
    path
  );
}

export async function deleteFoodItem(userId: string, itemId: string): Promise<void> {
  const path = `users/${userId}/items/${itemId}`;
  await executeOfflineSafeWrite(deleteDoc(doc(db, path)), OperationType.DELETE, path);
}

export async function resolveFoodItemOutcome(params: {
  userId: string;
  item: FoodItem;
  outcome: 'consumed' | 'wasted';
  reason: LogReason;
  notes: string;
  relatedNotifications: ExpiryNotification[];
}): Promise<void> {
  const { userId, item, outcome, reason, notes, relatedNotifications } = params;
  const itemPath = `users/${userId}/items/${item.id}`;
  const batch = writeBatch(db);

  batch.update(doc(db, itemPath), {
    status: outcome,
    updatedAt: serverTimestamp(),
  });

  const logRef = doc(collection(db, `users/${userId}/wasteLogs`));
  batch.set(logRef, {
    ownerId: userId,
    itemId: item.id,
    itemName: item.name.slice(0, FIELD_LIMITS.NAME_MAX),
    category: item.category,
    outcome,
    quantity: item.quantity,
    unit: item.unit,
    estimatedValue: item.estimatedCost,
    reason,
    loggedDate: getLocalDateString(),
    notes: notes.trim().slice(0, FIELD_LIMITS.LOG_NOTES_MAX),
    createdAt: serverTimestamp(),
  });

  for (const notif of relatedNotifications) {
    if (notif.itemId === item.id && (!notif.read || !notif.dismissed)) {
      batch.update(doc(db, `users/${userId}/notifications/${notif.id}`), {
        read: true,
        dismissed: true,
        updatedAt: serverTimestamp(),
      });
    }
  }

  await executeOfflineSafeWrite(batch.commit(), OperationType.WRITE, itemPath);
}

export async function populateSamplePantry(userId: string): Promise<void> {
  const path = `users/${userId}/items`;
  const seeds = buildSamplePantrySeeds();
  const batch = writeBatch(db);

  for (const seed of seeds) {
    const ref = doc(collection(db, path));
    batch.set(ref, {
      ownerId: userId,
      name: seed.name.slice(0, FIELD_LIMITS.NAME_MAX),
      category: seed.category,
      storageLocation: seed.storageLocation,
      quantity: seed.quantity,
      unit: seed.unit,
      estimatedCost: seed.estimatedCost,
      purchasedAt: seed.purchasedAt,
      expiresAt: seed.expiresAt,
      status: 'active',
      notifiedTiers: [],
      notes: seed.notes.slice(0, FIELD_LIMITS.NOTES_MAX),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  await executeOfflineSafeWrite(batch.commit(), OperationType.WRITE, path);
}

export async function updateNotificationState(
  userId: string,
  notificationId: string,
  updates: { read: boolean; dismissed: boolean }
): Promise<void> {
  const path = `users/${userId}/notifications/${notificationId}`;
  await executeOfflineSafeWrite(
    updateDoc(doc(db, path), {
      read: updates.read,
      dismissed: updates.dismissed,
      updatedAt: serverTimestamp(),
    }),
    OperationType.UPDATE,
    path
  );
}

export async function markAllNotificationsRead(
  userId: string,
  notifications: ExpiryNotification[]
): Promise<void> {
  const unread = notifications.filter((n) => !n.read);
  if (unread.length === 0) return;

  const path = `users/${userId}/notifications`;
  const batch = writeBatch(db);
  for (const n of unread) {
    batch.update(doc(db, path, n.id), {
      read: true,
      dismissed: n.dismissed,
      updatedAt: serverTimestamp(),
    });
  }
  await executeOfflineSafeWrite(batch.commit(), OperationType.WRITE, path);
}

export interface RuleInput {
  label: string;
  daysBefore: number;
  ruleType?: RuleType;
  minQuantity?: number;
  targetUnit?: FoodUnit | 'ANY';
  targetCategory?: FoodCategory | 'ALL';
  enabled: boolean;
  channelBrowser: boolean;
  channelInApp: boolean;
  severity: NotificationSeverity;
}

export async function createNotificationRule(userId: string, input: RuleInput): Promise<void> {
  const path = `users/${userId}/rules`;
  const ruleType: RuleType = input.ruleType === 'stock' ? 'stock' : 'expiry';
  const safeDays = ruleType === 'stock' ? 0 : Math.max(-7, Math.min(90, Math.round(input.daysBefore)));
  const tierKey =
    ruleType === 'stock'
      ? `stock_${Date.now().toString(36)}`.slice(0, FIELD_LIMITS.TIER_KEY_MAX)
      : `custom_${safeDays < 0 ? `neg${Math.abs(safeDays)}` : safeDays}d_${Date.now().toString(36)}`.slice(
          0,
          FIELD_LIMITS.TIER_KEY_MAX
        );

  const payload: Record<string, unknown> = {
    ownerId: userId,
    label: input.label.trim().slice(0, FIELD_LIMITS.RULE_LABEL_MAX),
    tierKey,
    daysBefore: safeDays,
    ruleType,
    enabled: input.enabled,
    channelBrowser: input.channelBrowser,
    channelInApp: input.channelInApp,
    severity: input.severity,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (ruleType === 'stock') {
    payload.minQuantity = Math.max(
      0.01,
      Math.min(FIELD_LIMITS.QUANTITY_MAX, Number(input.minQuantity) || 1)
    );
    payload.targetUnit = input.targetUnit ?? 'ANY';
    payload.targetCategory = input.targetCategory ?? 'ALL';
  }

  const ref = doc(collection(db, path));
  await executeOfflineSafeWrite(setDoc(ref, payload), OperationType.CREATE, path);
}

export async function updateNotificationRule(
  userId: string,
  ruleId: string,
  input: RuleInput
): Promise<void> {
  const path = `users/${userId}/rules/${ruleId}`;
  const ruleType: RuleType = input.ruleType === 'stock' ? 'stock' : 'expiry';
  const safeDays = ruleType === 'stock' ? 0 : Math.max(-7, Math.min(90, Math.round(input.daysBefore)));

  const payload: Record<string, unknown> = {
    label: input.label.trim().slice(0, FIELD_LIMITS.RULE_LABEL_MAX),
    daysBefore: safeDays,
    ruleType,
    enabled: input.enabled,
    channelBrowser: input.channelBrowser,
    channelInApp: input.channelInApp,
    severity: input.severity,
    updatedAt: serverTimestamp(),
  };

  if (ruleType === 'stock') {
    payload.minQuantity = Math.max(
      0.01,
      Math.min(FIELD_LIMITS.QUANTITY_MAX, Number(input.minQuantity) || 1)
    );
    payload.targetUnit = input.targetUnit ?? 'ANY';
    payload.targetCategory = input.targetCategory ?? 'ALL';
  }

  await executeOfflineSafeWrite(updateDoc(doc(db, path), payload), OperationType.UPDATE, path);
}

export async function deleteNotificationRule(userId: string, ruleId: string): Promise<void> {
  const path = `users/${userId}/rules/${ruleId}`;
  await executeOfflineSafeWrite(deleteDoc(doc(db, path)), OperationType.DELETE, path);
}

export async function updateUserNotificationPrefs(
  userId: string,
  prefs: { browserPushEnabled: boolean; dailyCheckHour: number }
): Promise<void> {
  const path = `users/${userId}`;
  await executeOfflineSafeWrite(
    updateDoc(doc(db, path), {
      browserPushEnabled: prefs.browserPushEnabled,
      dailyCheckHour: Math.max(0, Math.min(23, Math.round(prefs.dailyCheckHour))),
      updatedAt: serverTimestamp(),
    }),
    OperationType.UPDATE,
    path
  );
}

export async function updateUserCurrency(
  userId: string,
  currencyCode: string
): Promise<void> {
  const safeCode = /^[A-Z]{3}$/.test(currencyCode) ? currencyCode : 'USD';
  const path = `users/${userId}`;
  await executeOfflineSafeWrite(
    updateDoc(doc(db, path), {
      currencyCode: safeCode,
      updatedAt: serverTimestamp(),
    }),
    OperationType.UPDATE,
    path
  );
}

export async function deleteWasteLog(userId: string, logId: string): Promise<void> {
  const path = `users/${userId}/wasteLogs/${logId}`;
  await executeOfflineSafeWrite(deleteDoc(doc(db, path)), OperationType.DELETE, path);
}
