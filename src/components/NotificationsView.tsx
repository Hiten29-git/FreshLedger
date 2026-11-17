import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Clock,
  Info,
  RefreshCw,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { formatShortDate, getLiveExpiryCountdown } from '../lib/dateUtils';
import { canUseBrowserNotifications } from '../lib/notificationEngine';
import type { ExpiryNotification, FoodItem, NotificationSeverity } from '../types';

type NotifFilter = 'inbox' | 'unread' | 'dismissed';

interface NotificationsViewProps {
  notifications: ExpiryNotification[];
  items: FoodItem[];
  browserPushEnabled: boolean;
  soundEnabled: boolean;
  nowMs?: number;
  lastScanAt: Date | null;
  scanning: boolean;
  onRunScan: () => Promise<void>;
  onEnableBrowserPush: () => Promise<void>;
  onToggleSound: () => void;
  onTriggerTestAlert: () => void;
  onPopulateSample: () => Promise<void>;
  onMarkRead: (notif: ExpiryNotification) => Promise<void>;
  onDismiss: (notif: ExpiryNotification) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
  onConsumeItem: (item: FoodItem) => Promise<void>;
  onOpenWasteModal: (item: FoodItem) => void;
}

function SeverityLabel({ severity }: { severity: NotificationSeverity }) {
  if (severity === 'expired') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700">
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
        <span>Expired</span>
      </span>
    );
  }
  if (severity === 'urgent') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700">
        <Clock className="w-3.5 h-3.5 shrink-0" />
        <span>Urgent</span>
      </span>
    );
  }
  if (severity === 'warning') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
        <Clock className="w-3.5 h-3.5 shrink-0" />
        <span>Priority</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
      <Info className="w-3.5 h-3.5 shrink-0" />
      <span>Early Notice</span>
    </span>
  );
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  notifications,
  items,
  browserPushEnabled,
  soundEnabled,
  nowMs = Date.now(),
  lastScanAt,
  scanning,
  onRunScan,
  onEnableBrowserPush,
  onToggleSound,
  onTriggerTestAlert,
  onPopulateSample,
  onMarkRead,
  onDismiss,
  onMarkAllRead,
  onConsumeItem,
  onOpenWasteModal,
}) => {
  const [filter, setFilter] = useState<NotifFilter>('inbox');
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  const browserSupported = canUseBrowserNotifications();
  const browserPermission = browserSupported ? Notification.permission : 'denied';

  const itemsById = useMemo(() => {
    const map = new Map<string, FoodItem>();
    for (const item of items) {
      map.set(item.id, item);
    }
    return map;
  }, [items]);

  const filteredNotifications = useMemo(() => {
    return notifications
      .filter((n) => {
        if (filter === 'inbox') return !n.dismissed;
        if (filter === 'unread') return !n.read && !n.dismissed;
        return n.dismissed;
      })
      .sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() ?? 0;
        const bTime = b.createdAt?.toMillis?.() ?? 0;
        return bTime - aTime;
      });
  }, [notifications, filter]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read && !n.dismissed).length,
    [notifications]
  );

  const handleTestLiveAlert = () => {
    onTriggerTestAlert();
    setTestMessage(
      browserSupported && browserPermission === 'granted' && browserPushEnabled
        ? 'Live popup alert and desktop push notification dispatched.'
        : 'Live in-app alert toast dispatched. Enable browser alerts for OS desktop notifications too.'
    );
  };

  const handleConsumeFromAlert = async (item: FoodItem, notifId: string) => {
    setBusyId(notifId);
    try {
      await onConsumeItem(item);
    } finally {
      setBusyId(null);
    }
  };

  const handleSeedFromInbox = async () => {
    setSeeding(true);
    try {
      await onPopulateSample();
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Real-Time Dispatch & Sound Controls */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            {browserSupported && browserPermission === 'granted' && browserPushEnabled ? (
              <Bell className="w-4 h-4 text-emerald-700 shrink-0" />
            ) : (
              <BellOff className="w-4 h-4 text-slate-500 shrink-0" />
            )}
            <span>Real-Time Expiry &amp; Stock Alert Monitor</span>
          </div>
          <p className="text-xs text-slate-600">
            {browserSupported
              ? browserPermission === 'granted' && browserPushEnabled
                ? 'Live in-app toast alerts, browser desktop push, and 10-second background checks are active.'
                : browserPermission === 'denied'
                  ? 'Browser notifications are blocked in site settings; live in-app toasts and inbox alerts remain active.'
                  : 'Live in-app alerts are active. Enable browser notifications for OS desktop alerts even when minimized.'
              : 'Live in-app toast alerts and inbox monitoring are active.'}
            {lastScanAt && (
              <span className="font-mono tabular-nums text-slate-500">
                {' '}· Last scan {lastScanAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </p>
          {testMessage && <p className="text-xs text-emerald-700 font-medium">{testMessage}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onToggleSound}
            aria-pressed={soundEnabled}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {soundEnabled ? (
              <Volume2 className="w-3.5 h-3.5 text-emerald-700" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span>{soundEnabled ? 'Sound On' : 'Muted'}</span>
          </button>

          {browserSupported && (browserPermission !== 'granted' || !browserPushEnabled) && (
            <button
              type="button"
              onClick={onEnableBrowserPush}
              className="px-3.5 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Enable Browser Alerts
            </button>
          )}

          <button
            type="button"
            onClick={handleTestLiveAlert}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Test Live Alert
          </button>

          <button
            type="button"
            onClick={onRunScan}
            disabled={scanning}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
            <span>{scanning ? 'Scanning...' : 'Run Scan Now'}</span>
          </button>
        </div>
      </section>

      {/* Alerts List */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(
              [
                { id: 'inbox', label: 'Active Inbox' },
                { id: 'unread', label: `Unread (${unreadCount})` },
                { id: 'dismissed', label: 'Dismissed' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setFilter(t.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  filter === t.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllRead}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark All Read</span>
            </button>
          )}
        </div>

        {filteredNotifications.length === 0 ? (
          <div className="px-6 py-14 text-center max-w-md mx-auto">
            <h3 className="font-display text-base font-semibold text-slate-900 mb-1.5">
              {filter === 'unread'
                ? 'No unread expiry alerts'
                : filter === 'dismissed'
                  ? 'No dismissed alerts'
                  : 'No automated alerts triggered yet'}
            </h3>
            <p className="text-sm text-slate-600 mb-5">
              When active inventory items cross a configured pre-expiration lead time or drop below a minimum stock threshold, alerts trigger immediately in real time.
            </p>
            {items.length === 0 && filter === 'inbox' && (
              <button
                type="button"
                onClick={handleSeedFromInbox}
                disabled={seeding}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{seeding ? 'Loading Sample...' : 'Load Sample Pantry & Trigger Alerts'}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredNotifications.map((notif) => {
              const linkedItem = itemsById.get(notif.itemId);
              const isActiveItem = linkedItem && linkedItem.status === 'active';
              const isBusy = busyId === notif.id;
              const isStockAlert = notif.tierKey.startsWith('stock_');
              const liveCountdown = getLiveExpiryCountdown(notif.expiresAt, nowMs);

              return (
                <div
                  key={notif.id}
                  className={`px-5 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 transition-colors ${
                    !notif.read && !notif.dismissed ? 'bg-slate-50/70' : 'bg-white'
                  }`}
                >
                  <div className="space-y-1 max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2.5 text-xs">
                      <SeverityLabel severity={notif.severity} />
                      <span className="text-slate-300" aria-hidden="true">·</span>
                      <span className="font-medium text-slate-700">
                        {isStockAlert ? 'Low Stock' : 'Pre-Expiration'}
                      </span>
                      <span className="text-slate-300" aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums text-slate-600">
                        Expires {formatShortDate(notif.expiresAt)}
                      </span>
                      {!isStockAlert && (
                        <>
                          <span className="text-slate-300" aria-hidden="true">·</span>
                          <span
                            className={`font-mono tabular-nums ${
                              liveCountdown.isExpired || liveCountdown.isToday
                                ? 'text-red-700 font-medium'
                                : 'text-slate-600'
                            }`}
                          >
                            {liveCountdown.formatted}
                          </span>
                        </>
                      )}
                      <span className="text-slate-300" aria-hidden="true">·</span>
                      <span className="text-slate-500">
                        {notif.deliveredBrowser ? 'In-App & Browser Push' : 'In-App Inbox'}
                      </span>
                      {!notif.read && !notif.dismissed && (
                        <>
                          <span className="text-slate-300" aria-hidden="true">·</span>
                          <span className="font-medium text-slate-900">Unread</span>
                        </>
                      )}
                    </div>

                    <h4 className="text-sm font-semibold text-slate-900">{notif.title}</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">{notif.message}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {isActiveItem && (
                      <>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleConsumeFromAlert(linkedItem, notif.id)}
                          className="px-3 py-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                        >
                          Mark Consumed
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => onOpenWasteModal(linkedItem)}
                          className="px-3 py-1.5 text-xs font-medium text-red-800 bg-red-50 hover:bg-red-100 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                        >
                          Log Waste
                        </button>
                      </>
                    )}
                    {!notif.read && (
                      <button
                        type="button"
                        onClick={() => onMarkRead(notif)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Read</span>
                      </button>
                    )}
                    {!notif.dismissed && (
                      <button
                        type="button"
                        onClick={() => onDismiss(notif)}
                        className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Dismiss
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
