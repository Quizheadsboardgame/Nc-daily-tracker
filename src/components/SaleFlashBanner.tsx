import React, { useState, useEffect, useRef } from 'react';
import { Banknote, CreditCard, Globe, ArrowLeftRight, Sparkles, X, Volume2 } from 'lucide-react';
import { SaleFlashEvent, subscribeToSaleFlash, getCelebrationTier } from '../utils/sound';
import { BigSaleCelebration } from './BigSaleCelebration';

const FLASH_DURATION_MS = 3000;
const BIG_SALE_DURATION_MS = 6500;
const MEGA_SALE_DURATION_MS = 7500;
const LEGENDARY_SALE_DURATION_MS = 8500;
const FADE_OUT_MS = 300;

export const SaleFlashBanner: React.FC = () => {
  const [activeFlash, setActiveFlash] = useState<SaleFlashEvent | null>(null);
  const [activeDurationMs, setActiveDurationMs] = useState<number>(FLASH_DURATION_MS);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [progressWidth, setProgressWidth] = useState<'100%' | '0%'>('100%');

  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  const clearAllTimers = () => {
    if (fadeTimerRef.current) {
      clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
    if (clearTimerRef.current) {
      clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const dismissNow = () => {
    clearAllTimers();
    setIsFadingOut(true);
    clearTimerRef.current = setTimeout(() => {
      setActiveFlash(null);
      setIsFadingOut(false);
    }, 220);
  };

  useEffect(() => {
    const unsubscribe = subscribeToSaleFlash((event) => {
      clearAllTimers();
      const tier = event.celebrationTier || getCelebrationTier(event.amount);
      const isBigSale = tier !== 'standard' || Boolean(event.isOver100 || (event.amount !== undefined && event.amount > 100));
      const resolvedTier = isBigSale && tier === 'standard' ? 'big' : tier;
      const duration =
        resolvedTier === 'legendary'
          ? LEGENDARY_SALE_DURATION_MS
          : resolvedTier === 'mega'
          ? MEGA_SALE_DURATION_MS
          : isBigSale
          ? BIG_SALE_DURATION_MS
          : FLASH_DURATION_MS;

      setActiveDurationMs(duration);
      setActiveFlash({ ...event, isOver100: isBigSale, celebrationTier: resolvedTier });
      setIsFadingOut(false);
      setProgressWidth('100%');

      // Kick off smooth countdown bar transition on next paint
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = requestAnimationFrame(() => {
          setProgressWidth('0%');
        });
      });

      fadeTimerRef.current = setTimeout(() => {
        setIsFadingOut(true);
      }, duration - FADE_OUT_MS);

      clearTimerRef.current = setTimeout(() => {
        setActiveFlash(null);
        setIsFadingOut(false);
      }, duration);
    });

    return () => {
      unsubscribe();
      clearAllTimers();
    };
  }, []);

  if (!activeFlash) return null;

  if (activeFlash.isOver100) {
    return (
      <BigSaleCelebration
        event={activeFlash}
        durationMs={activeDurationMs}
        isFadingOut={isFadingOut}
        progressWidth={progressWidth}
        onDismiss={dismissNow}
      />
    );
  }

  const getPaymentDisplay = (method: SaleFlashEvent['paymentMethod']) => {
    switch (method) {
      case 'cash':
        return {
          label: 'Cash',
          sublabel: 'Paid in Cash',
          badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/60',
          barClass: 'bg-emerald-400',
          Icon: Banknote,
        };
      case 'online':
        return {
          label: 'Online',
          sublabel: 'Paid Online',
          badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-400/60',
          barClass: 'bg-sky-400',
          Icon: Globe,
        };
      case 'traded_out':
        return {
          label: 'Trade Out',
          sublabel: 'Paid via Trade Out',
          badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-400/60',
          barClass: 'bg-amber-400',
          Icon: ArrowLeftRight,
        };
      case 'card':
      default:
        return {
          label: 'Card',
          sublabel: 'Paid by Card',
          badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-400/60',
          barClass: 'bg-indigo-400',
          Icon: CreditCard,
        };
    }
  };

  const payment = getPaymentDisplay(activeFlash.paymentMethod);
  const PaymentIcon = payment.Icon;
  const isSplit = Boolean(activeFlash.isSplit && activeFlash.splitSummary);
  const itemCount = activeFlash.basketItemCount && activeFlash.basketItemCount > 1 ? activeFlash.basketItemCount : 0;

  return (
    <div
      id="sale-flash-banner"
      role="status"
      aria-live="polite"
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-1.5rem)] max-w-lg pointer-events-none transition-all duration-200 ${
        isFadingOut ? 'opacity-0 -translate-y-3 scale-95' : 'opacity-100 translate-y-0 scale-100'
      }`}
    >
      <div
        className={`pointer-events-auto relative overflow-hidden rounded-2xl bg-zinc-950/95 backdrop-blur-md text-white shadow-2xl border-2 ${
          activeFlash.isOver100
            ? 'border-amber-400 ring-4 ring-amber-400/25'
            : 'border-emerald-400/80 ring-4 ring-emerald-500/20'
        }`}
      >
        <div className="px-4 py-3.5 sm:px-5 sm:py-4">
          {/* Top Status Row */}
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    activeFlash.isOver100 ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                    activeFlash.isOver100 ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                />
              </span>
              <span
                className={`text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5 truncate ${
                  activeFlash.isOver100 ? 'text-amber-300' : 'text-emerald-300'
                }`}
              >
                {activeFlash.isOver100 ? (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="truncate">
                      Big Sale! Over £100{activeFlash.amount !== undefined ? ` (£${activeFlash.amount.toFixed(2)})` : ''}
                    </span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate">
                      {itemCount > 0 ? `Basket Put Through (${itemCount} items)` : 'Sale Put Through'}
                      {activeFlash.amount !== undefined ? ` • £${activeFlash.amount.toFixed(2)}` : ''}
                    </span>
                  </>
                )}
              </span>
            </div>

            <button
              type="button"
              onClick={dismissNow}
              className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer shrink-0"
              aria-label="Dismiss sale notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Primary Info Grid: Who the sale is for + How it was paid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* WHO IT'S FOR (Vendor) */}
            <div className="rounded-xl bg-zinc-900/90 border border-zinc-800 px-3.5 py-2.5 flex flex-col justify-center">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Sale For
                </span>
                {itemCount > 0 && (
                  <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700">
                    {itemCount} items
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs ring-2 ring-white/20"
                  style={{ backgroundColor: activeFlash.vendorColor }}
                />
                <span className="text-lg sm:text-xl font-black text-white tracking-tight truncate">
                  {activeFlash.vendorName}
                </span>
              </div>
            </div>

            {/* HOW IT WAS PAID */}
            <div className="rounded-xl bg-zinc-900/90 border border-zinc-800 px-3.5 py-2.5 flex flex-col justify-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Paid By
              </span>
              <div className="mt-1">
                {isSplit ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs sm:text-sm font-black bg-cyan-500/20 text-cyan-200 border-cyan-400/60 leading-snug">
                    <ArrowLeftRight className="w-4 h-4 shrink-0 text-cyan-300" />
                    <span>{activeFlash.splitSummary}</span>
                  </span>
                ) : (
                  <span
                    className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg border text-base sm:text-lg font-black ${payment.badgeClass}`}
                  >
                    <PaymentIcon className="w-5 h-5 shrink-0" />
                    <span>{payment.label}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Subtle Item Context */}
          {activeFlash.itemDescription && (
            <div className="mt-2.5 flex items-center justify-between gap-2 text-xs text-zinc-400 px-0.5">
              <span className="truncate font-medium">
                {itemCount > 0 ? 'Items: ' : 'Item: '}
                <span className="text-zinc-200 font-semibold">{activeFlash.itemDescription}</span>
              </span>
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold shrink-0">
                3s Flash
              </span>
            </div>
          )}
        </div>

        {/* 3-Second Countdown Progress Bar */}
        <div className="h-1.5 w-full bg-zinc-900">
          <div
            key={activeFlash.id + activeFlash.timestamp}
            className={`h-full transition-all duration-[3000ms] ease-linear ${
              activeFlash.isOver100 ? 'bg-amber-400' : isSplit ? 'bg-cyan-400' : payment.barClass
            } ${progressWidth === '0%' ? 'w-0' : 'w-full'}`}
          />
        </div>
      </div>
    </div>
  );
};
