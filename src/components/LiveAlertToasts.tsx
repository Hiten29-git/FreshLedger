import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { AlertCircle, CheckCircle2, Clock, Info, X } from 'lucide-react';
import { getLiveExpiryCountdown } from '../lib/dateUtils';
import type { TriggeredAlertPreview } from '../lib/notificationEngine';
import type { FoodItem } from '../types';

interface LiveAlertToastsProps {
  toasts: TriggeredAlertPreview[];
  itemsById: Map<string, FoodItem>;
  nowMs: number;
  onDismissToast: (id: string) => void;
  onOpenInbox: () => void;
  onConsumeItem: (item: FoodItem, toastId: string) => Promise<void>;
}

const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const LiveAlertToasts: React.FC<LiveAlertToastsProps> = ({
  toasts,
  itemsById,
  nowMs,
  onDismissToast,
  onOpenInbox,
  onConsumeItem,
}) => {
  const [hovered, setHovered] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (toasts.length === 0 || hovered) return;
    const timer = window.setTimeout(() => {
      onDismissToast(toasts[0].id);
    }, 9000);
    return () => window.clearTimeout(timer);
  }, [toasts, hovered, onDismissToast]);

  if (toasts.length === 0) return null;

  const visible = toasts.slice(0, 3);

  return (
    <MotionConfig reducedMotion="user">
      <div
        aria-live="polite"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="fixed bottom-4 right-4 z-50 w-[min(380px,calc(100vw-2rem))] space-y-2.5 pointer-events-none"
      >
        <AnimatePresence initial={false}>
          {visible.map((toast) => {
            const linkedItem = itemsById.get(toast.itemId);
            const isActiveItem = Boolean(linkedItem && linkedItem.status === 'active');
            const countdown = getLiveExpiryCountdown(toast.expiresAt, nowMs);

            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: 0.24, ease: EASE_OUT_EXPO }}
                className="pointer-events-auto bg-white border border-slate-200 rounded-xl p-4 shadow-lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs">
                    {toast.severity === 'expired' ? (
                      <span className="inline-flex items-center gap-1 font-medium text-red-700">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>Expired</span>
                      </span>
                    ) : toast.severity === 'urgent' ? (
                      <span className="inline-flex items-center gap-1 font-medium text-red-700">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>Urgent</span>
                      </span>
                    ) : toast.severity === 'warning' ? (
                      <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>Priority</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                        <Info className="w-3.5 h-3.5 shrink-0" />
                        <span>Notice</span>
                      </span>
                    )}
                    <span className="text-slate-300" aria-hidden="true">
                      ·
                    </span>
                    <span className="font-mono tabular-nums text-slate-500">
                      {toast.isStock ? 'Low Stock' : countdown.formatted}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDismissToast(toast.id)}
                    aria-label="Dismiss live alert"
                    className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="mt-1.5 text-sm font-semibold text-slate-900">{toast.title}</div>
                <p className="mt-1 text-xs text-slate-600 line-clamp-2">{toast.message}</p>

                <div className="mt-3 flex items-center gap-2">
                  {isActiveItem && linkedItem && (
                    <button
                      type="button"
                      disabled={busyId === toast.id}
                      onClick={async () => {
                        setBusyId(toast.id);
                        try {
                          await onConsumeItem(linkedItem, toast.id);
                        } finally {
                          setBusyId(null);
                        }
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Mark Consumed</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      onOpenInbox();
                      onDismissToast(toast.id);
                    }}
                    className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    View Inbox
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
};
