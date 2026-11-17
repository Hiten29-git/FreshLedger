import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { formatCurrency } from './currency';
import { getDaysUntilExpiry, formatShortDate } from './dateUtils';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  FIELD_LIMITS,
  type ExpiryNotification,
  type FoodItem,
  type NotificationRule,
  type NotificationSeverity,
} from '../types';

export interface EvaluationResult {
  triggeredCount: number;
  browserSentCount: number;
  latestTitles: string[];
}

function buildExpiryNotificationCopy(
  item: FoodItem,
  daysRemaining: number,
  severity: NotificationSeverity,
  currencyCode: string
): { title: string; message: string } {
  const expiryLabel = formatShortDate(item.expiresAt);
  const qtyLabel = `${item.quantity} ${item.unit}`;
  const valueLabel = formatCurrency(item.estimatedCost, currencyCode);

  if (daysRemaining < 0) {
    const overdue = Math.abs(daysRemaining);
    return {
      title: `${item.name} expired ${overdue} ${overdue === 1 ? 'day' : 'days'} ago`.slice(0, 140),
      message: `${qtyLabel} in ${item.storageLocation} passed its ${expiryLabel} date. Inspect immediately or log waste to keep analytics accurate.`.slice(0, 400),
    };
  }
  if (daysRemaining === 0) {
    return {
      title: `${item.name} expires today`.slice(0, 140),
      message: `${qtyLabel} in ${item.storageLocation} reaches expiration today (${expiryLabel}). Use, cook, or freeze today to prevent ${valueLabel} waste.`.slice(0, 400),
    };
  }
  if (daysRemaining === 1) {
    return {
      title: `${item.name} expires tomorrow`.slice(0, 140),
      message: `${qtyLabel} in ${item.storageLocation} expires on ${expiryLabel}. Prioritize for tomorrow's meals.`.slice(0, 400),
    };
  }
  const urgencyVerb = severity === 'warning' ? 'approaching expiry' : 'upcoming expiry';
  return {
    title: `${item.name} — ${daysRemaining} days until expiry (${urgencyVerb})`.slice(0, 140),
    message: `${qtyLabel} in ${item.storageLocation} expires on ${expiryLabel}. Plan usage ahead of schedule to save ${valueLabel}.`.slice(0, 400),
  };
}

function buildStockNotificationCopy(
  item: FoodItem,
  rule: NotificationRule
): { title: string; message: string } {
  const qtyLabel = `${item.quantity} ${item.unit}`;
  const thresholdLabel = `${rule.minQuantity} ${item.unit}`;
  return {
    title: `${item.name} is low on stock (${qtyLabel} left)`.slice(0, 140),
    message: `Stock dropped below your ${thresholdLabel} minimum threshold (${rule.label}) in ${item.storageLocation}. Add to your grocery list or restock soon.`.slice(0, 400),
  };
}

export function canUseBrowserNotifications(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function dispatchBrowserNotification(title: string, body: string, tag: string): boolean {
  if (!canUseBrowserNotifications()) return false;
  if (Notification.permission !== 'granted') return false;
  try {
    new Notification(title, {
      body,
      tag,
      requireInteraction: false,
    });
    return true;
  } catch {
    return false;
  }
}

export async function evaluateAndDispatchNotifications(params: {
  userId: string;
  items: FoodItem[];
  rules: NotificationRule[];
  existingNotifications: ExpiryNotification[];
  browserPushEnabled: boolean;
  currencyCode?: string;
}): Promise<EvaluationResult> {
  const {
    userId,
    items,
    rules,
    existingNotifications,
    browserPushEnabled,
    currencyCode = 'USD',
  } = params;

  const activeRules = rules.filter(
    (r) => r.enabled && (r.channelInApp || r.channelBrowser)
  );

  const expiryRules = activeRules
    .filter((r) => (r.ruleType ?? 'expiry') === 'expiry')
    .sort((a, b) => a.daysBefore - b.daysBefore);

  const stockRules = activeRules
    .filter(
      (r) =>
        r.ruleType === 'stock' &&
        typeof r.minQuantity === 'number' &&
        r.minQuantity > 0
    )
    .sort((a, b) => (a.minQuantity ?? 0) - (b.minQuantity ?? 0));

  if ((expiryRules.length === 0 && stockRules.length === 0) || items.length === 0) {
    return { triggeredCount: 0, browserSentCount: 0, latestTitles: [] };
  }

  // Deduplicate expiry notifications against existing records and item.notifiedTiers
  const existingKeys = new Set(
    existingNotifications.map((n) => `${n.itemId}::${n.tierKey}`)
  );

  const batch = writeBatch(db);
  let triggeredCount = 0;
  let browserSentCount = 0;
  const latestTitles: string[] = [];

  for (const item of items) {
    if (item.status !== 'active') continue;

    const daysRemaining = getDaysUntilExpiry(item.expiresAt);
    let currentTiers = [...item.notifiedTiers];
    let itemTiersDirty = false;

    // 1. Evaluate Pre-Expiration Rules
    if (expiryRules.length > 0) {
      const matchingExpiryRule = expiryRules.find((rule) => daysRemaining <= rule.daysBefore);
      if (matchingExpiryRule) {
        const alreadyNotified =
          currentTiers.includes(matchingExpiryRule.tierKey) ||
          existingKeys.has(`${item.id}::${matchingExpiryRule.tierKey}`);

        if (!alreadyNotified) {
          currentTiers = [...currentTiers, matchingExpiryRule.tierKey].slice(
            -FIELD_LIMITS.MAX_NOTIFIED_TIERS
          );
          itemTiersDirty = true;

          const { title, message } = buildExpiryNotificationCopy(
            item,
            daysRemaining,
            matchingExpiryRule.severity,
            currencyCode
          );

          let deliveredBrowser = false;
          if (browserPushEnabled && matchingExpiryRule.channelBrowser) {
            deliveredBrowser = dispatchBrowserNotification(
              title,
              message,
              `freshledger-${item.id}-${matchingExpiryRule.tierKey}`
            );
            if (deliveredBrowser) {
              browserSentCount += 1;
            }
          }

          const notifRef = doc(collection(db, `users/${userId}/notifications`));
          batch.set(notifRef, {
            ownerId: userId,
            itemId: item.id,
            itemName: item.name.slice(0, FIELD_LIMITS.NAME_MAX),
            tierKey: matchingExpiryRule.tierKey.slice(0, FIELD_LIMITS.TIER_KEY_MAX),
            severity: matchingExpiryRule.severity,
            title,
            message,
            expiresAt: item.expiresAt,
            daysRemaining: Math.max(-365, Math.min(365, daysRemaining)),
            read: false,
            dismissed: false,
            deliveredBrowser,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          existingKeys.add(`${item.id}::${matchingExpiryRule.tierKey}`);
          triggeredCount += 1;
          latestTitles.push(title);
        }
      }
    }

    // 2. Evaluate Low-Stock Quantity Threshold Rules
    if (stockRules.length > 0) {
      const matchingStockRule = stockRules.find((rule) => {
        const catMatch =
          !rule.targetCategory ||
          rule.targetCategory === 'ALL' ||
          rule.targetCategory === item.category;
        const unitMatch =
          !rule.targetUnit ||
          rule.targetUnit === 'ANY' ||
          rule.targetUnit === item.unit;
        return catMatch && unitMatch && item.quantity < (rule.minQuantity ?? 0);
      });

      if (matchingStockRule && !currentTiers.includes(matchingStockRule.tierKey)) {
        currentTiers = [...currentTiers, matchingStockRule.tierKey].slice(
          -FIELD_LIMITS.MAX_NOTIFIED_TIERS
        );
        itemTiersDirty = true;

        const { title, message } = buildStockNotificationCopy(item, matchingStockRule);

        let deliveredBrowser = false;
        if (browserPushEnabled && matchingStockRule.channelBrowser) {
          deliveredBrowser = dispatchBrowserNotification(
            title,
            message,
            `freshledger-${item.id}-${matchingStockRule.tierKey}`
          );
          if (deliveredBrowser) {
            browserSentCount += 1;
          }
        }

        const notifRef = doc(collection(db, `users/${userId}/notifications`));
        batch.set(notifRef, {
          ownerId: userId,
          itemId: item.id,
          itemName: item.name.slice(0, FIELD_LIMITS.NAME_MAX),
          tierKey: matchingStockRule.tierKey.slice(0, FIELD_LIMITS.TIER_KEY_MAX),
          severity: matchingStockRule.severity,
          title,
          message,
          expiresAt: item.expiresAt,
          daysRemaining: Math.max(-365, Math.min(365, daysRemaining)),
          read: false,
          dismissed: false,
          deliveredBrowser,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        triggeredCount += 1;
        latestTitles.push(title);
      }
    }

    if (itemTiersDirty) {
      const itemRef = doc(db, `users/${userId}/items/${item.id}`);
      batch.update(itemRef, {
        notifiedTiers: currentTiers,
        updatedAt: serverTimestamp(),
      });
    }
  }

  if (triggeredCount > 0) {
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${userId}/notifications`);
    }
  }

  return { triggeredCount, browserSentCount, latestTitles };
}
