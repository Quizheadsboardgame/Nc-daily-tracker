import React, { useState, useEffect, useRef } from 'react';
import { Banknote, CreditCard, Globe, ArrowLeftRight, Sparkles, X, Volume2 } from 'lucide-react';
import { SaleFlashEvent, subscribeToSaleFlash } from '../utils/sound';

const FLASH_DURATION_MS = 3000;
const FADE_OUT_MS = 250;

export const SaleFlashBanner: React.FC = () => {
  const [activeFlash, setActiveFlash] = useState<SaleFlashEvent | null>(null);
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
    }, 180);
  };

  useEffect(() => {
    const unsubscribe = subscribeToSaleFlash((event) => {
      clearAllTimers();
      setActiveFlash(event);
      setIsFadingOut(false);
      setProgressWidth('100%');

      // Kick off smooth 3-second countdown bar transition on next paint
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = requestAnimationFrame(() => {
          setProgressWidth('0%');
        });
      });

      fadeTimerRef.current = setTimeout(() => {
        setIsFadingOut(true);
      }, FLASH_DURATION_MS - FADE_OUT_MS);

      clearTimerRef.current = setTimeout(() => {
        setActiveFlash(null);
        setIsFadingOut(false);
      }, FLASH_DURATION_MS);
    });

    return () => {
      unsubscribe();
      clearAllTimers();
    };
  }, []);

  if (!activeFlash) return null;

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
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
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
                className={`text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5 ${
                  activeFlash.isOver100 ? 'text-amber-300' : 'text-emerald-300'
                }`}
              >
                {activeFlash.isOver100 ? (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Big Sale! Over £100</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Sale Put Through</span>
                  </>
                )}
              </span>
            </div>

            <button
              type="button"
              onClick={dismissNow}
              className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
              aria-label="Dismiss sale notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Primary Info Grid: Who the sale is for + How it was paid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* WHO IT'S FOR (Vendor) */}
            <div className="rounded-xl bg-zinc-900/90 border border-zinc-800 px-3.5 py-2.5 flex flex-col justify-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Sale For
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs ring-2 ring-white/20"
                  style={{ backgroundColor: activeFlash.vendorColor }}
                />
                <span className="text-xl sm:text-2xl font-black text-white tracking-tight truncate">
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
                <span
                  className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg border text-base sm:text-lg font-black ${payment.badgeClass}`}
                >
                  <PaymentIcon className="w-5 h-5 shrink-0" />
                  <span>{payment.label}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Subtle Item Context */}
          {activeFlash.itemDescription && (
            <div className="mt-2.5 flex items-center justify-between gap-2 text-xs text-zinc-400 px-0.5">
              <span className="truncate font-medium">
                Item: <span className="text-zinc-200 font-semibold">{activeFlash.itemDescription}</span>
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
              activeFlash.isOver100 ? 'bg-amber-400' : payment.barClass
            } ${progressWidth === '0%' ? 'w-0' : 'w-full'}`}
          />
        </div>
      </div>
    </div>
  );
};
