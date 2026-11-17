import React, { useEffect, useRef, useState } from 'react';
import {
  AnimatePresence,
  motion,
  MotionConfig,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'motion/react';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  BellRing,
  CheckCircle2,
  Clock,
  Layers,
  Leaf,
  Sprout,
  WifiOff,
} from 'lucide-react';
import { PWAInstallButton, useOnlineStatus } from './PWAControls';

interface SignInViewProps {
  onSignIn: () => Promise<void>;
  authError: string | null;
}

interface PreviewStage {
  id: string;
  tabLabel: string;
  kind: 'urgent' | 'stock' | 'saved';
  statusText: string;
  item: string;
  meta: string;
  detail: string;
  meterLabel: string;
  meterValueText: string;
  meterRatio: number;
  meterColorClass: string;
  imageSrc: string;
  imageAlt: string;
  panFrom: { scale: number; x: number; y: number };
  panTo: { scale: number; x: number; y: number };
}

const PREVIEW_STAGES: PreviewStage[] = [
  {
    id: 'expiry',
    tabLabel: '01. Pre-Expiry',
    kind: 'urgent',
    statusText: 'Urgent · 1 day left',
    item: 'Organic Baby Spinach & Herbs',
    meta: '250 g · Crisper Drawer · Produce',
    detail: 'Pre-expiration alert sent 24h early so fresh greens get cooked, not composted.',
    meterLabel: 'Freshness Window',
    meterValueText: '18% left',
    meterRatio: 0.18,
    meterColorClass: 'bg-amber-500',
    imageSrc: '/src/assets/images/eco_produce_crisper_1794938511881.jpg',
    imageAlt:
      'Organic baby spinach in a reusable linen produce bag alongside fresh herbs, heirloom tomatoes, and lemons in a sunlit wooden drawer',
    panFrom: { scale: 1.07, x: -6, y: -4 },
    panTo: { scale: 1.13, x: 6, y: 4 },
  },
  {
    id: 'stock',
    tabLabel: '02. Low Stock',
    kind: 'stock',
    statusText: 'Priority · Low Stock',
    item: 'Local Glass-Bottle Milk & Oats',
    meta: '1 L left · Minimum threshold 2 L',
    detail: 'Low-stock rule triggered a mindful refill alert to avoid impulse overbuying.',
    meterLabel: 'Pantry Reserve',
    meterValueText: '32% left',
    meterRatio: 0.32,
    meterColorClass: 'bg-emerald-600',
    imageSrc: '/src/assets/images/eco_glass_refill_1794938513100.jpg',
    imageAlt:
      'Sustainable pantry shelf with reusable glass milk bottles, olive oil, apothecary jars of oats and lentils, and fresh basil against a sage wall',
    panFrom: { scale: 1.08, x: 6, y: 4 },
    panTo: { scale: 1.14, x: -6, y: -4 },
  },
  {
    id: 'saved',
    tabLabel: '03. Rescued',
    kind: 'saved',
    statusText: 'Consumed · Rescued',
    item: 'Whole Pantry Harvest',
    meta: '12 items · Used in time · Zero landfill waste',
    detail: 'Recorded in your sustainability ledger with multi-currency savings tracking.',
    meterLabel: 'Monthly Rescue Rate',
    meterValueText: '94% saved',
    meterRatio: 0.94,
    meterColorClass: 'bg-[#15803d]',
    imageSrc: '/src/assets/images/pantry_hero_editorial_1794937004539.jpg',
    imageAlt:
      'Sunlit zero-waste kitchen shelf stocked with glass jars, citrus fruits, leafy greens, and reusable milk bottles',
    panFrom: { scale: 1.07, x: -5, y: 4 },
    panTo: { scale: 1.13, x: 5, y: -4 },
  },
];

const STAGE_DURATION_MS = 5000;
const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const SignInView: React.FC<SignInViewProps> = ({ onSignIn, authError }) => {
  const [signingIn, setSigningIn] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [activeStageIndex, setActiveStageIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const isOnline = useOnlineStatus();
  const shouldReduceMotion = useReducedMotion();
  const showcaseRef = useRef<HTMLDivElement | null>(null);

  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const smoothX = useSpring(pointerX, { stiffness: 140, damping: 24, mass: 0.5 });
  const smoothY = useSpring(pointerY, { stiffness: 140, damping: 24, mass: 0.5 });

  const imageShiftX = useTransform(smoothX, [-0.5, 0.5], [10, -10]);
  const imageShiftY = useTransform(smoothY, [-0.5, 0.5], [8, -8]);
  const overlayShiftX = useTransform(smoothX, [-0.5, 0.5], [-4, 4]);
  const overlayShiftY = useTransform(smoothY, [-0.5, 0.5], [-3, 3]);

  useEffect(() => {
    if (isPaused) {
      return;
    }
    const timer = window.setInterval(() => {
      setActiveStageIndex((prev) => (prev + 1) % PREVIEW_STAGES.length);
    }, STAGE_DURATION_MS);
    return () => window.clearInterval(timer);
  }, [isPaused, activeStageIndex]);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (shouldReduceMotion || !showcaseRef.current) {
      return;
    }
    const rect = showcaseRef.current.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    pointerX.set(nx);
    pointerY.set(ny);
  };

  const handlePointerLeave = () => {
    setIsPaused(false);
    pointerX.set(0);
    pointerY.set(0);
  };

  const handleClick = async () => {
    setSigningIn(true);
    try {
      await onSignIn();
    } finally {
      setSigningIn(false);
    }
  };

  const activeStage = PREVIEW_STAGES[activeStageIndex];
  const currentImgFailed = Boolean(failedImages[activeStage.id]);

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-[#f5f8f5] text-[#0f2419] flex flex-col">
        {/* Top Bar Contract: Brand — Nav Links — Primary Action */}
        <header className="w-full border-b border-[#dbe4dc] bg-white/90 backdrop-blur-xs">
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
            <span className="inline-flex items-center gap-2 font-display text-lg font-bold tracking-tight text-[#0f2419] whitespace-nowrap shrink-0">
              <Leaf className="w-4 h-4 text-[#15803d] shrink-0" />
              <span>FreshLedger</span>
            </span>

            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#42584a]">
              <a
                href="#workflow"
                className="hover:text-[#0f2419] transition-colors whitespace-nowrap shrink-0"
              >
                Zero-Waste Flow
              </a>
              <a
                href="#alerts"
                className="hover:text-[#0f2419] transition-colors whitespace-nowrap shrink-0"
              >
                Automated Alerts
              </a>
              <a
                href="#analytics"
                className="hover:text-[#0f2419] transition-colors whitespace-nowrap shrink-0"
              >
                Impact Ledger
              </a>
            </nav>

            <button
              type="button"
              onClick={handleClick}
              disabled={signingIn || !isOnline}
              className="px-4 py-2 text-xs font-medium text-white bg-[#14532d] rounded-lg hover:bg-[#166534] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {signingIn ? 'Signing in...' : 'Sign in with Google'}
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 lg:py-14 flex items-center">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch w-full">
            {/* Left Editorial Eco Column */}
            <div className="lg:col-span-6 flex flex-col justify-between py-1">
              <div>
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#15803d] tracking-wide mb-3"
                >
                  <Sprout className="w-3.5 h-3.5 shrink-0" />
                  <span>Zero-Waste Kitchen &amp; Pantry Operations</span>
                </motion.p>

                <motion.h1
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.42, delay: 0.06, ease: EASE_OUT_EXPO }}
                  className="font-display text-4xl lg:text-5xl font-bold tracking-tight text-[#0f2419] leading-tight mb-5"
                  style={{ textWrap: 'balance' }}
                >
                  Rescue fresh food before it ever hits the bin.
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.42, delay: 0.12, ease: EASE_OUT_EXPO }}
                  className="text-base text-[#42584a] leading-relaxed max-w-xl mb-8"
                >
                  FreshLedger helps households cut food waste at the source — monitoring refrigerator, freezer, and jar storage, sending automated pre-expiration and low-stock alerts, and quantifying every rupee or dollar saved.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.18, ease: EASE_OUT_EXPO }}
                  className="flex flex-wrap items-center gap-4 mb-10"
                >
                  <motion.button
                    type="button"
                    onClick={handleClick}
                    disabled={signingIn || !isOnline}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.99 }}
                    transition={{ duration: 0.15, ease: EASE_OUT_EXPO }}
                    className="group inline-flex items-center gap-3 px-5 py-3 text-sm font-semibold text-white bg-[#14532d] rounded-lg hover:bg-[#166534] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <svg
                      className="w-4 h-4 shrink-0 bg-white rounded-xs p-0.5"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        fill="#EA4335"
                        d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.9 1.5l2.7-2.6C16.9 3.3 14.7 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12S6.7 21.6 12 21.6c6.9 0 9.6-4.8 9.6-7.3 0-.5-.1-.9-.1-1.3H12z"
                      />
                    </svg>
                    <span>
                      {signingIn ? 'Connecting to Google...' : 'Continue with Google'}
                    </span>
                    <ArrowRight className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-0.5" />
                  </motion.button>
                  <PWAInstallButton variant="hero" />
                  <span className="text-xs text-[#546b5d]">
                    Private Firestore pantry · Offline cache ready
                  </span>
                </motion.div>

                {!isOnline && (
                  <div className="mb-6 p-3.5 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-900 flex items-center gap-2.5">
                    <WifiOff className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>
                      You are currently offline. Connect once to sign in with Google; once signed in, FreshLedger works offline with automatic local sync.
                    </span>
                  </div>
                )}

                {authError && (
                  <div className="mb-8 p-3.5 rounded-lg border border-red-200 bg-red-50 text-xs text-red-800">
                    {authError}
                  </div>
                )}
              </div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.24, ease: EASE_OUT_EXPO }}
                className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-8 border-t border-[#dbe4dc]"
                id="workflow"
              >
                <div id="alerts">
                  <div className="flex items-center gap-2 text-[#0f2419] font-semibold text-sm mb-1.5">
                    <BellRing className="w-4 h-4 text-[#b45309] shrink-0" />
                    <span>Pre-Expiry Alerts</span>
                  </div>
                  <p className="text-xs text-[#42584a] leading-relaxed">
                    Multi-stage 7d, 3d, 1d, and expiry-day reminders so perishables are used in time.
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-[#0f2419] font-semibold text-sm mb-1.5">
                    <Layers className="w-4 h-4 text-[#15803d] shrink-0" />
                    <span>Mindful Stocking</span>
                  </div>
                  <p className="text-xs text-[#42584a] leading-relaxed">
                    Low-quantity alerts prevent duplicate purchases and keep pantry turnover balanced.
                  </p>
                </div>
                <div id="analytics">
                  <div className="flex items-center gap-2 text-[#0f2419] font-semibold text-sm mb-1.5">
                    <BarChart3 className="w-4 h-4 text-[#166534] shrink-0" />
                    <span>Rescue Metrics</span>
                  </div>
                  <p className="text-xs text-[#42584a] leading-relaxed">
                    Track food rescue rate, waste drivers, and savings across any world currency.
                  </p>
                </div>
              </motion.div>
            </div>

            {/* Right Interactive Eco Showcase + Living Interface Stage */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease: EASE_OUT_EXPO }}
              className="lg:col-span-6 flex"
            >
              <div
                ref={showcaseRef}
                onPointerEnter={() => setIsPaused(true)}
                onPointerMove={handlePointerMove}
                onPointerLeave={handlePointerLeave}
                className="w-full rounded-xl overflow-hidden border border-[#dbe4dc] bg-white flex flex-col"
              >
                {/* Interactive Scene Switcher Header */}
                <div
                  className="px-4 py-2.5 border-b border-[#dbe4dc] bg-[#fafcfa] grid grid-cols-3 gap-1.5"
                  role="tablist"
                  aria-label="Interactive pantry showcase stages"
                >
                  {PREVIEW_STAGES.map((stage, idx) => {
                    const isActive = idx === activeStageIndex;
                    return (
                      <button
                        key={stage.id}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => setActiveStageIndex(idx)}
                        className={`relative px-2.5 py-2 rounded-md text-left text-xs font-medium transition-colors whitespace-nowrap truncate cursor-pointer ${
                          isActive
                            ? 'bg-white text-[#0f2419] border border-[#dbe4dc]'
                            : 'text-[#42584a] hover:text-[#0f2419] hover:bg-white/60 border border-transparent'
                        }`}
                      >
                        <span className="block truncate">{stage.tabLabel}</span>
                        {isActive && (
                          <motion.span
                            key={`progress-${stage.id}-${isPaused ? 'paused' : 'run'}`}
                            aria-hidden="true"
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: isPaused || shouldReduceMotion ? 0.35 : 1 }}
                            transition={{
                              duration: isPaused || shouldReduceMotion ? 0.25 : STAGE_DURATION_MS / 1000,
                              ease: 'linear',
                            }}
                            style={{ transformOrigin: 'left center' }}
                            className="absolute inset-x-2 bottom-1 h-0.5 rounded-xs bg-[#15803d]"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Living Photographic Stage with Ken Burns Drift & Pointer Parallax */}
                <div className="relative flex-1 min-h-[380px] lg:min-h-[430px] bg-[#eaf0ea] overflow-hidden">
                  <AnimatePresence mode="sync" initial={false}>
                    {!currentImgFailed ? (
                      <motion.div
                        key={activeStage.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.65, ease: EASE_OUT_EXPO }}
                        style={
                          shouldReduceMotion
                            ? undefined
                            : { x: imageShiftX, y: imageShiftY }
                        }
                        className="absolute -inset-3 will-change-transform"
                      >
                        <motion.img
                          src={activeStage.imageSrc}
                          alt={activeStage.imageAlt}
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setFailedImages((prev) => ({
                              ...prev,
                              [activeStage.id]: true,
                            }))
                          }
                          initial={
                            shouldReduceMotion
                              ? { scale: 1 }
                              : activeStage.panFrom
                          }
                          animate={
                            shouldReduceMotion
                              ? { scale: 1 }
                              : activeStage.panTo
                          }
                          transition={{
                            duration: STAGE_DURATION_MS / 1000 + 1.2,
                            ease: 'easeOut',
                          }}
                          className="w-full h-full object-cover will-change-transform"
                        />
                      </motion.div>
                    ) : (
                      <motion.div
                        key={`fallback-${activeStage.id}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-gradient-to-br from-[#eaf0ea] to-[#dce7dd] text-[#42584a]"
                      >
                        <Leaf className="w-10 h-10 mb-3 text-[#15803d]" />
                        <p className="text-sm font-medium text-[#0f2419]">
                          {activeStage.item}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Measured dark forest contrast scrim */}
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-[#0a1a10]/85 via-[#0a1a10]/25 to-transparent pointer-events-none"
                  />

                  {/* Parallax Foreground Live Ledger Preview Drawer */}
                  <motion.div
                    style={
                      shouldReduceMotion
                        ? undefined
                        : { x: overlayShiftX, y: overlayShiftY }
                    }
                    className="absolute inset-x-0 bottom-0 p-4 sm:p-5 will-change-transform"
                  >
                    <div className="bg-[#fafcfa]/95 backdrop-blur-xs border border-[#dbe4dc] rounded-lg p-4">
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={activeStage.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.24, ease: EASE_OUT_EXPO }}
                          className="space-y-2.5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div className="flex flex-wrap items-center gap-2">
                              {activeStage.kind === 'urgent' && (
                                <span className="inline-flex items-center gap-1 font-medium text-red-700">
                                  <Clock className="w-3.5 h-3.5 shrink-0" />
                                  <span>{activeStage.statusText}</span>
                                </span>
                              )}
                              {activeStage.kind === 'stock' && (
                                <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                  <span>{activeStage.statusText}</span>
                                </span>
                              )}
                              {activeStage.kind === 'saved' && (
                                <span className="inline-flex items-center gap-1 font-medium text-[#15803d]">
                                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                  <span>{activeStage.statusText}</span>
                                </span>
                              )}
                              <span className="text-[#cbd8cd]" aria-hidden="true">
                                ·
                              </span>
                              <span className="font-mono tabular-nums text-[#42584a]">
                                {activeStage.meta}
                              </span>
                            </div>
                          </div>

                          <div>
                            <div className="text-sm font-semibold text-[#0f2419]">
                              {activeStage.item}
                            </div>
                            <p className="text-xs text-[#42584a] mt-0.5">
                              {activeStage.detail}
                            </p>
                          </div>

                          {/* Animated Interface Meter Preview */}
                          <div className="pt-2 border-t border-[#e5ede6] flex items-center gap-3">
                            <span className="text-xs text-[#42584a] whitespace-nowrap">
                              {activeStage.meterLabel}
                            </span>
                            <div className="flex-1 h-1.5 bg-[#e5ede6] rounded-xs overflow-hidden">
                              <motion.div
                                initial={{ scaleX: 0 }}
                                animate={{ scaleX: activeStage.meterRatio }}
                                transition={{ duration: 0.55, delay: 0.08, ease: EASE_OUT_EXPO }}
                                style={{ transformOrigin: 'left center' }}
                                className={`h-full rounded-xs ${activeStage.meterColorClass}`}
                              />
                            </div>
                            <span className="font-mono tabular-nums text-xs font-medium text-[#0f2419] whitespace-nowrap">
                              {activeStage.meterValueText}
                            </span>
                          </div>
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </motion.div>
                </div>

                <div className="px-5 py-3 border-t border-[#dbe4dc] bg-white flex items-center justify-between gap-4 text-xs text-[#42584a]">
                  <span>Refrigerator · Freezer · Glass Jars · Counter</span>
                  <span className="font-mono tabular-nums text-[#14532d] font-medium">
                    Low-Waste Pantry Tracking
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        </main>
      </div>
    </MotionConfig>
  );
};
