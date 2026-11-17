import React, { useEffect, useState } from 'react';
import { Download, RefreshCw, WifiOff, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: Boolean(deferredPrompt),
    isInstalled,
    isIOS,
    install,
  };
}

interface PWAInstallButtonProps {
  variant?: 'sidebar' | 'hero';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'sidebar' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className={
          variant === 'hero'
            ? 'inline-flex items-center gap-2 px-4 py-3 text-sm font-medium text-[#14532d] bg-white border border-[#cbd8cd] rounded-lg hover:bg-[#f5f8f5] transition-colors whitespace-nowrap shrink-0 cursor-pointer'
            : 'w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-[#14532d] bg-[#f5f8f5] border border-[#cbd8cd] rounded-lg hover:bg-[#eaf0ea] transition-colors whitespace-nowrap shrink-0 cursor-pointer'
        }
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span>Install Offline App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={
            variant === 'hero'
              ? 'inline-flex items-center gap-2 px-4 py-3 text-sm font-medium text-[#14532d] bg-white border border-[#cbd8cd] rounded-lg hover:bg-[#f5f8f5] transition-colors whitespace-nowrap shrink-0 cursor-pointer'
              : 'w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-[#14532d] bg-[#f5f8f5] border border-[#cbd8cd] rounded-lg hover:bg-[#eaf0ea] transition-colors whitespace-nowrap shrink-0 cursor-pointer'
          }
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span>Install on iOS</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
          >
            <div className="w-full max-w-sm rounded-xl bg-white border border-slate-200 p-6">
              <div className="flex items-center justify-between gap-3 mb-2">
                <h3 id="ios-install-title" className="font-display text-base font-semibold text-slate-900">
                  Install FreshLedger on iOS
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Close instructions"
                  className="p-1 text-slate-500 hover:text-slate-900 rounded cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                1. Tap the <strong>Share</strong> button in Safari&apos;s toolbar.
                <br />
                2. Scroll down and select <strong>Add to Home Screen</strong> for instant offline pantry access.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full rounded-lg bg-[#14532d] py-2 text-xs font-medium text-white hover:bg-[#166534] transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

interface OfflineIndicatorProps {
  hasPendingSync?: boolean;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ hasPendingSync = false }) => {
  const isOnline = useOnlineStatus();

  if (isOnline && !hasPendingSync) {
    return null;
  }

  if (!isOnline) {
    return (
      <div
        role="status"
        className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-amber-900"
      >
        <div className="flex items-center gap-2.5">
          <WifiOff className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            <strong>Offline Mode</strong> — Viewing locally cached pantry. Changes save to this device and sync automatically when reconnected.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 flex items-center gap-2.5 text-xs text-emerald-900"
    >
      <RefreshCw className="w-4 h-4 text-emerald-700 animate-spin shrink-0" />
      <span>Back online — syncing local pantry changes to cloud...</span>
    </div>
  );
};
