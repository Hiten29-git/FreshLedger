import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import {
  BarChart3,
  Bell,
  LogOut,
  Menu,
  Package,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { AnalyticsView } from './components/AnalyticsView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { InventoryView } from './components/InventoryView';
import { ItemModal } from './components/ItemModal';
import { NotificationsView } from './components/NotificationsView';
import { RulesView } from './components/RulesView';
import { SignInView } from './components/SignInView';
import { WasteOutcomeModal } from './components/WasteOutcomeModal';
import { detectDefaultCurrencyCode, getGroupedCurrencyOptions } from './lib/currency';
import { getLocalDateString } from './lib/dateUtils';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from './lib/firebase';
import {
  canUseBrowserNotifications,
  evaluateAndDispatchNotifications,
} from './lib/notificationEngine';
import {
  addFoodItem,
  createNotificationRule,
  deleteFoodItem,
  deleteNotificationRule,
  deleteWasteLog,
  ensureUserAndDefaults,
  markAllNotificationsRead,
  populateSamplePantry,
  resolveFoodItemOutcome,
  updateFoodItem,
  updateNotificationRule,
  updateNotificationState,
  updateUserCurrency,
  updateUserNotificationPrefs,
  type FoodItemInput,
  type RuleInput,
} from './lib/pantryActions';
import type {
  ExpiryNotification,
  FoodItem,
  NotificationRule,
  UserProfile,
  WasteLog,
  WasteReason,
} from './types';

type WorkspaceSection = 'inventory' | 'notifications' | 'rules' | 'analytics';

const NAV_ITEMS: { id: WorkspaceSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'rules', label: 'Alert Rules', icon: SlidersHorizontal },
  { id: 'analytics', label: 'Waste Analytics', icon: BarChart3 },
];

function WorkspaceApp() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [profileReady, setProfileReady] = useState(false);

  const [section, setSection] = useState<WorkspaceSection>('inventory');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [items, setItems] = useState<FoodItem[]>([]);
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [notifications, setNotifications] = useState<ExpiryNotification[]>([]);
  const [wasteLogs, setWasteLogs] = useState<WasteLog[]>([]);

  const [dataLoading, setDataLoading] = useState(true);
  const [itemsLoaded, setItemsLoaded] = useState(false);
  const [rulesLoaded, setRulesLoaded] = useState(false);
  const [notifsLoaded, setNotifsLoaded] = useState(false);

  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FoodItem | null>(null);
  const [wasteTargetItem, setWasteTargetItem] = useState<FoodItem | null>(null);

  const [scanning, setScanning] = useState(false);
  const [lastScanAt, setLastScanAt] = useState<Date | null>(null);
  const [alertBanner, setAlertBanner] = useState<string | null>(null);

  const scanInFlightRef = useRef(false);
  const lastSignatureRef = useRef<string>('');

  // Authentication listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      setProfileReady(false);

      if (!nextUser) {
        setProfile(null);
        setItems([]);
        setRules([]);
        setNotifications([]);
        setWasteLogs([]);
        setDataLoading(false);
        setItemsLoaded(false);
        setRulesLoaded(false);
        setNotifsLoaded(false);
        lastSignatureRef.current = '';
        return;
      }

      setDataLoading(true);
      try {
        await ensureUserAndDefaults(nextUser);
        setProfileReady(true);
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : 'Failed to initialize account.');
        setDataLoading(false);
      }
    });

    return () => unsub();
  }, []);

  // Real-time Firestore listeners scoped strictly to authenticated owner
  useEffect(() => {
    if (!authReady || !user || !profileReady) return;

    const uid = user.uid;

    const unsubProfile = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
        }
      },
      (error) => handleFirestoreError(error, OperationType.GET, `users/${uid}`)
    );

    const itemsPath = `users/${uid}/items`;
    const unsubItems = onSnapshot(
      query(collection(db, itemsPath), where('ownerId', '==', uid)),
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() } as FoodItem)));
        setItemsLoaded(true);
        setDataLoading(false);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, itemsPath)
    );

    const rulesPath = `users/${uid}/rules`;
    const unsubRules = onSnapshot(
      query(collection(db, rulesPath), where('ownerId', '==', uid)),
      (snap) => {
        setRules(snap.docs.map((d) => ({ id: d.id, ...d.data() } as NotificationRule)));
        setRulesLoaded(true);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, rulesPath)
    );

    const notifsPath = `users/${uid}/notifications`;
    const unsubNotifs = onSnapshot(
      query(collection(db, notifsPath), where('ownerId', '==', uid)),
      (snap) => {
        setNotifications(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as ExpiryNotification))
        );
        setNotifsLoaded(true);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, notifsPath)
    );

    const logsPath = `users/${uid}/wasteLogs`;
    const unsubLogs = onSnapshot(
      query(collection(db, logsPath), where('ownerId', '==', uid)),
      (snap) => {
        setWasteLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as WasteLog)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, logsPath)
    );

    return () => {
      unsubProfile();
      unsubItems();
      unsubRules();
      unsubNotifs();
      unsubLogs();
    };
  }, [authReady, user, profileReady]);

  const currencyCode = profile?.currencyCode || detectDefaultCurrencyCode();
  const currencyOptions = useMemo(() => getGroupedCurrencyOptions(), []);

  const runExpiryScan = useCallback(
    async (manual = false) => {
      if (!user || !itemsLoaded || !rulesLoaded || !notifsLoaded) return;
      if (scanInFlightRef.current) return;

      scanInFlightRef.current = true;
      if (manual) setScanning(true);

      try {
        const result = await evaluateAndDispatchNotifications({
          userId: user.uid,
          items,
          rules,
          existingNotifications: notifications,
          browserPushEnabled: profile?.browserPushEnabled ?? false,
          currencyCode,
        });
        setLastScanAt(new Date());

        if (result.triggeredCount > 0) {
          const preview = result.latestTitles[0];
          setAlertBanner(
            result.triggeredCount === 1
              ? `Automated alert sent: ${preview}`
              : `${result.triggeredCount} automated expiry alerts triggered (including ${preview})`
          );
        } else if (manual) {
          setAlertBanner('Expiry scan complete — all active items are within configured alert thresholds.');
        }
      } finally {
        scanInFlightRef.current = false;
        if (manual) setScanning(false);
      }
    },
    [user, itemsLoaded, rulesLoaded, notifsLoaded, items, rules, notifications, profile, currencyCode]
  );

  // Automatic scan when active items, enabled rules, or local calendar date change
  const scanSignature = useMemo(() => {
    const today = getLocalDateString();
    const itemSig = items
      .filter((i) => i.status === 'active')
      .map(
        (i) =>
          `${i.id}:${i.expiresAt}:${i.quantity}:${i.unit}:${i.category}:${i.notifiedTiers.join(',')}`
      )
      .sort()
      .join('|');
    const ruleSig = rules
      .filter((r) => r.enabled)
      .map(
        (r) =>
          `${r.id}:${r.ruleType ?? 'expiry'}:${r.daysBefore}:${r.minQuantity ?? ''}:${r.targetUnit ?? ''}:${r.targetCategory ?? ''}:${r.channelInApp}:${r.channelBrowser}`
      )
      .sort()
      .join('|');
    return `${today}::${itemSig}::${ruleSig}`;
  }, [items, rules]);

  useEffect(() => {
    if (!user || !itemsLoaded || !rulesLoaded || !notifsLoaded) return;
    if (lastSignatureRef.current === scanSignature) return;
    lastSignatureRef.current = scanSignature;
    void runExpiryScan(false);
  }, [user, itemsLoaded, rulesLoaded, notifsLoaded, scanSignature, runExpiryScan]);

  // Background 60-second timer to catch midnight/date rollovers automatically
  useEffect(() => {
    if (!user || !itemsLoaded || !rulesLoaded || !notifsLoaded) return;
    const interval = window.setInterval(() => {
      void runExpiryScan(false);
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [user, itemsLoaded, rulesLoaded, notifsLoaded, runExpiryScan]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read && !n.dismissed).length,
    [notifications]
  );

  const handleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'Unable to complete Google sign-in.'
      );
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  const handleEnableBrowserPush = async () => {
    if (!user) return;
    if (!canUseBrowserNotifications()) {
      setAlertBanner('Browser notification API is not supported in this browser.');
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      await updateUserNotificationPrefs(user.uid, {
        browserPushEnabled: true,
        dailyCheckHour: profile?.dailyCheckHour ?? 9,
      });
      setAlertBanner('Browser desktop alerts enabled for pre-expiration reminders.');
    } else {
      await updateUserNotificationPrefs(user.uid, {
        browserPushEnabled: false,
        dailyCheckHour: profile?.dailyCheckHour ?? 9,
      });
      setAlertBanner('Browser notification permission was not granted. In-app alerts remain active.');
    }
  };

  const handleSaveItem = async (input: FoodItemInput, target: FoodItem | null) => {
    if (!user) return;
    if (target) {
      const dateChanged = target.expiresAt !== input.expiresAt;
      const quantityIncreased = input.quantity > target.quantity;
      let nextTiers = [...target.notifiedTiers];
      if (dateChanged) {
        nextTiers = nextTiers.filter((t) => t.startsWith('stock_'));
      }
      if (quantityIncreased) {
        nextTiers = nextTiers.filter((t) => !t.startsWith('stock_'));
      }
      await updateFoodItem(
        user.uid,
        target.id,
        input,
        dateChanged || quantityIncreased,
        nextTiers
      );
    } else {
      await addFoodItem(user.uid, input);
    }
  };

  const handleConsumeItem = async (item: FoodItem) => {
    if (!user) return;
    await resolveFoodItemOutcome({
      userId: user.uid,
      item,
      outcome: 'consumed',
      reason: 'Used in Time',
      notes: '',
      relatedNotifications: notifications,
    });
  };

  const handleConfirmWaste = async (item: FoodItem, reason: WasteReason, notes: string) => {
    if (!user) return;
    await resolveFoodItemOutcome({
      userId: user.uid,
      item,
      outcome: 'wasted',
      reason,
      notes,
      relatedNotifications: notifications,
    });
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-sm text-slate-500 font-medium">Loading FreshLedger...</div>
      </div>
    );
  }

  if (!user) {
    return <SignInView onSignIn={handleSignIn} authError={authError} />;
  }

  const currentNavLabel = NAV_ITEMS.find((n) => n.id === section)?.label ?? 'Inventory';

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/30 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Left Workspace Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 bg-white border-r border-slate-200 flex flex-col transition-transform duration-150 lg:static lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 px-5 border-b border-slate-200 flex items-center justify-between gap-3">
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            FreshLedger
          </span>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation"
            className="p-1.5 text-slate-500 hover:text-slate-900 lg:hidden"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Workspace sections">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSection(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span className="inline-flex items-center gap-2.5">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </span>
                {item.id === 'notifications' && unreadCount > 0 && (
                  <span
                    className={`font-mono tabular-nums text-xs px-1.5 py-0.5 rounded ${
                      active
                        ? 'bg-white/20 text-white'
                        : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    {unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-3">
          <div>
            <label htmlFor="sidebar-currency-select" className="block text-xs font-medium text-slate-600 mb-1">
              Currency
            </label>
            <select
              id="sidebar-currency-select"
              value={currencyCode}
              onChange={(e) => void updateUserCurrency(user.uid, e.target.value)}
              aria-label="Select display currency"
              className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900"
            >
              <optgroup label="Popular Currencies">
                {currencyOptions.popular.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.symbol}) — {c.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="All World Currencies">
                {currencyOptions.others.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.symbol}) — {c.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
          <div className="min-w-0 pt-2 border-t border-slate-100">
            <div className="text-xs font-medium text-slate-900 truncate">
              {profile?.displayName || user.displayName || 'Account'}
            </div>
            <div className="text-xs text-slate-500 truncate">
              {profile?.email || user.email || ''}
            </div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation"
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg lg:hidden"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="text-slate-500 hidden sm:inline">Workspace</span>
              <span className="text-slate-300 hidden sm:inline" aria-hidden="true">/</span>
              <h1 className="font-display font-semibold text-slate-900 truncate">
                {currentNavLabel}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => void runExpiryScan(true)}
              disabled={scanning}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
              <span>{scanning ? 'Scanning...' : 'Run Alert Scan'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingItem(null);
                setItemModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Food Item</span>
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
          {alertBanner && (
            <div
              role="status"
              className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between gap-4 text-xs"
            >
              <div className="flex items-center gap-2.5 text-slate-800">
                <Bell className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{alertBanner}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {section !== 'notifications' && (
                  <button
                    type="button"
                    onClick={() => setSection('notifications')}
                    className="font-medium text-slate-900 underline underline-offset-2 hover:text-slate-700 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    View Alerts
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setAlertBanner(null)}
                  aria-label="Dismiss notification banner"
                  className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {section === 'inventory' && (
            <InventoryView
              items={items}
              wasteLogs={wasteLogs}
              loading={dataLoading}
              currencyCode={currencyCode}
              onAddItem={() => {
                setEditingItem(null);
                setItemModalOpen(true);
              }}
              onEditItem={(item) => {
                setEditingItem(item);
                setItemModalOpen(true);
              }}
              onConsumeItem={handleConsumeItem}
              onOpenWasteModal={(item) => setWasteTargetItem(item)}
              onDeleteItem={(item) => deleteFoodItem(user.uid, item.id)}
              onPopulateSample={() => populateSamplePantry(user.uid)}
            />
          )}

          {section === 'notifications' && (
            <NotificationsView
              notifications={notifications}
              items={items}
              browserPushEnabled={profile?.browserPushEnabled ?? false}
              lastScanAt={lastScanAt}
              scanning={scanning}
              onRunScan={() => runExpiryScan(true)}
              onEnableBrowserPush={handleEnableBrowserPush}
              onMarkRead={(n) =>
                updateNotificationState(user.uid, n.id, { read: true, dismissed: n.dismissed })
              }
              onDismiss={(n) =>
                updateNotificationState(user.uid, n.id, { read: true, dismissed: true })
              }
              onMarkAllRead={() => markAllNotificationsRead(user.uid, notifications)}
              onConsumeItem={handleConsumeItem}
              onOpenWasteModal={(item) => setWasteTargetItem(item)}
            />
          )}

          {section === 'rules' && (
            <RulesView
              rules={rules}
              browserPushEnabled={profile?.browserPushEnabled ?? false}
              dailyCheckHour={profile?.dailyCheckHour ?? 9}
              currencyCode={currencyCode}
              onUpdatePrefs={(prefs) => updateUserNotificationPrefs(user.uid, prefs)}
              onUpdateCurrency={(code) => updateUserCurrency(user.uid, code)}
              onEnableBrowserPush={handleEnableBrowserPush}
              onUpdateRule={(ruleId, input: RuleInput) =>
                updateNotificationRule(user.uid, ruleId, input)
              }
              onCreateRule={(input: RuleInput) => createNotificationRule(user.uid, input)}
              onDeleteRule={(ruleId) => deleteNotificationRule(user.uid, ruleId)}
            />
          )}

          {section === 'analytics' && (
            <AnalyticsView
              logs={wasteLogs}
              currencyCode={currencyCode}
              onDeleteLog={(logId) => deleteWasteLog(user.uid, logId)}
            />
          )}
        </main>
      </div>

      <ItemModal
        isOpen={itemModalOpen}
        editingItem={editingItem}
        currencyCode={currencyCode}
        onClose={() => {
          setItemModalOpen(false);
          setEditingItem(null);
        }}
        onSave={handleSaveItem}
      />

      <WasteOutcomeModal
        item={wasteTargetItem}
        currencyCode={currencyCode}
        onClose={() => setWasteTargetItem(null)}
        onConfirmWaste={handleConfirmWaste}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <WorkspaceApp />
    </ErrorBoundary>
  );
}
