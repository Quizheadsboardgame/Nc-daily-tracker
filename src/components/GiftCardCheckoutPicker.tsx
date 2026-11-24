import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Gift,
  Search,
  X,
  CheckCircle2,
  Sparkles,
  ScanBarcode,
  Camera,
  CameraOff,
  AlertCircle,
} from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/library';
import { GiftCardRecord } from '../types';
import { cloudDb, formatCurrency } from '../db/cloudDatabase';
import { playSaleBeep } from '../utils/sound';

interface GiftCardCheckoutPickerProps {
  theme?: 'light' | 'dark';
  checkoutTotal: number;
  maxAllowedAmount?: number;
  selectedCardId: string | null;
  appliedAmount: number;
  onApplyGiftCard: (
    selection: {
      card: GiftCardRecord;
      amountToUse: number;
    } | null
  ) => void;
  onOpenGiftCardsTab?: () => void;
}

export const GiftCardCheckoutPicker: React.FC<GiftCardCheckoutPickerProps> = ({
  theme = 'light',
  checkoutTotal,
  maxAllowedAmount,
  selectedCardId,
  appliedAmount,
  onApplyGiftCard,
  onOpenGiftCardsTab,
}) => {
  const [cards, setCards] = useState<GiftCardRecord[]>(() =>
    cloudDb.getGiftCards().filter((c) => c.status === 'active' && c.balance > 0.004)
  );
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [customInput, setCustomInput] = useState('');
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const lookupRef = useRef<(code: string) => void>(() => {});

  useEffect(() => {
    const sync = () => {
      setCards(cloudDb.getGiftCards().filter((c) => c.status === 'active' && c.balance > 0.004));
    };
    sync();
    return cloudDb.subscribe(sync);
  }, []);

  const selectedCard = useMemo(
    () => (selectedCardId ? cloudDb.getGiftCards().find((c) => c.id === selectedCardId) : undefined),
    [selectedCardId, cards]
  );

  const effectiveCheckoutCap = useMemo(() => {
    if (typeof maxAllowedAmount === 'number') {
      return Math.max(0, Math.round(maxAllowedAmount * 100) / 100);
    }
    return Math.max(0, Math.round(checkoutTotal * 100) / 100);
  }, [checkoutTotal, maxAllowedAmount]);

  useEffect(() => {
    if (selectedCard && appliedAmount > 0) {
      setCustomInput(appliedAmount.toFixed(2));
    } else {
      setCustomInput('');
    }
  }, [selectedCard, appliedAmount]);

  const stopCamera = () => {
    try {
      codeReaderRef.current?.reset();
    } catch {
      // ignore
    }
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((t) => t.stop());
      activeStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter(
      (c) =>
        c.barcode.toLowerCase().includes(q) ||
        (c.recipientName && c.recipientName.toLowerCase().includes(q)) ||
        (c.notes && c.notes.toLowerCase().includes(q))
    );
  }, [cards, search]);

  const handleSelectCard = (card: GiftCardRecord) => {
    setLookupError(null);
    if (card.status === 'void') {
      playSaleBeep(false);
      setLookupError(`Gift card #${card.barcode} is voided and cannot be used.`);
      return;
    }
    if (card.balance <= 0.004) {
      playSaleBeep(false);
      setLookupError(`Gift card #${card.barcode} has £0.00 remaining.`);
      return;
    }

    const targetTotal = effectiveCheckoutCap > 0 ? effectiveCheckoutCap : card.balance;
    const maxApplicable = Math.round(Math.min(card.balance, targetTotal) * 100) / 100;
    onApplyGiftCard({
      card,
      amountToUse: maxApplicable,
    });
    stopCamera();
    setIsOpen(false);
    setSearch('');
  };

  const handleBarcodeLookup = (rawCode: string) => {
    const clean = rawCode.trim();
    if (!clean) return;
    setLookupError(null);

    const match = cloudDb.getGiftCardByBarcode(clean);
    if (!match) {
      playSaleBeep(false);
      setLookupError(`No gift card found with barcode "${clean}".`);
      return;
    }
    if (match.status === 'void') {
      playSaleBeep(false);
      setLookupError(`Gift card #${match.barcode} is voided and cannot be redeemed.`);
      return;
    }
    if (match.balance <= 0.004 || match.status === 'empty') {
      playSaleBeep(false);
      setLookupError(`Gift card #${match.barcode} has £0.00 remaining balance.`);
      return;
    }

    playSaleBeep(true);
    handleSelectCard(match);
  };

  lookupRef.current = handleBarcodeLookup;

  const startCamera = async () => {
    setLookupError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setLookupError('Camera scanning is not available on this device/browser. Type or scan with a USB scanner.');
      return;
    }

    setIsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      activeStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const reader = new BrowserMultiFormatReader();
        codeReaderRef.current = reader;
        reader.decodeFromVideoElementContinuously(videoRef.current, (result) => {
          if (result) {
            const text = result.getText().trim();
            if (text) {
              lookupRef.current(text);
            }
          }
        });
      }
    } catch {
      stopCamera();
      setLookupError('Could not access camera. Check camera permission or type the gift card barcode.');
    }
  };

  const handleCustomAmountChange = (valStr: string) => {
    setCustomInput(valStr);
    if (!selectedCard) return;
    const parsed = Math.max(0, Math.round((parseFloat(valStr) || 0) * 100) / 100);
    const maxCap =
      effectiveCheckoutCap > 0
        ? Math.min(selectedCard.balance, effectiveCheckoutCap)
        : selectedCard.balance;
    const clamped = Math.round(Math.min(parsed, maxCap) * 100) / 100;
    if (clamped > 0) {
      onApplyGiftCard({ card: selectedCard, amountToUse: clamped });
    }
  };

  const isDark = theme === 'dark';
  const remainingAfterSale = selectedCard
    ? Math.max(0, Math.round((selectedCard.balance - appliedAmount) * 100) / 100)
    : 0;
  const remainingCustomerToPay = Math.max(
    0,
    Math.round((effectiveCheckoutCap - appliedAmount) * 100) / 100
  );

  return (
    <div
      id="panel-gift-card-checkout"
      className={`rounded-2xl border p-3 sm:p-3.5 transition-all ${
        selectedCard
          ? isDark
            ? 'bg-rose-500/20 border-rose-400 shadow-md shadow-rose-500/15'
            : 'bg-rose-50/90 border-rose-300'
          : isDark
          ? 'bg-rose-500/10 border-rose-400/50'
          : 'bg-zinc-50/80 border-zinc-200'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Gift
            className={`w-4 h-4 shrink-0 ${
              isDark ? 'text-rose-300' : 'text-rose-600'
            }`}
          />
          <span
            className={`text-xs font-black uppercase tracking-wider ${
              isDark ? 'text-rose-100' : 'text-rose-950'
            }`}
          >
            Gift Card Payment
          </span>
          {!selectedCard && (
            <span
              className={`text-[11px] font-semibold ${
                isDark ? 'text-rose-200/80' : 'text-zinc-500'
              }`}
            >
              · {cards.length} active
            </span>
          )}
        </div>

        {selectedCard ? (
          <button
            type="button"
            id="btn-remove-gift-card-checkout"
            onClick={() => {
              onApplyGiftCard(null);
              setLookupError(null);
            }}
            className={`text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
              isDark
                ? 'bg-zinc-900 text-rose-400 hover:text-rose-300 border border-zinc-700'
                : 'bg-white text-rose-600 hover:bg-rose-50 border border-rose-200'
            }`}
          >
            <X className="w-3 h-3" />
            <span>Remove Gift Card</span>
          </button>
        ) : (
          <button
            type="button"
            id="btn-toggle-gift-card-checkout"
            onClick={() => {
              const next = !isOpen;
              setIsOpen(next);
              setLookupError(null);
              if (!next) stopCamera();
            }}
            className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              isDark
                ? 'bg-rose-600/20 hover:bg-rose-600/30 text-rose-200 border-rose-500/50'
                : 'bg-white hover:bg-rose-50 text-rose-800 border-rose-300'
            }`}
          >
            {isOpen ? 'Close Gift Card' : 'Use Gift Card'}
          </button>
        )}
      </div>

      {/* Selected Gift Card Breakdown */}
      {selectedCard && (
        <div className="mt-2.5 pt-2.5 border-t border-rose-500/20 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <CheckCircle2
                className={`w-3.5 h-3.5 shrink-0 ${
                  isDark ? 'text-rose-400' : 'text-rose-600'
                }`}
              />
              <span className={`font-mono font-black ${isDark ? 'text-white' : 'text-zinc-950'}`}>
                #{selectedCard.barcode}
              </span>
              {selectedCard.recipientName && (
                <span className={`truncate ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>
                  · {selectedCard.recipientName}
                </span>
              )}
            </div>
            <span
              className={`font-bold tabular-nums ${
                isDark ? 'text-rose-200' : 'text-rose-800'
              }`}
            >
              Available: {formatCurrency(selectedCard.balance)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[130px]">
              <span
                className={`absolute left-2.5 top-2 text-xs font-black pointer-events-none ${
                  isDark ? 'text-rose-400' : 'text-rose-700'
                }`}
              >
                £
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={
                  effectiveCheckoutCap > 0
                    ? Math.min(selectedCard.balance, effectiveCheckoutCap)
                    : selectedCard.balance
                }
                id="input-gift-card-redeem-amount"
                value={customInput}
                onChange={(e) => handleCustomAmountChange(e.target.value)}
                className={`w-full pl-6 pr-2.5 py-1.5 text-xs font-black tabular-nums rounded-xl border focus:outline-hidden ${
                  isDark
                    ? 'bg-zinc-950 border-rose-500/60 text-white'
                    : 'bg-white border-rose-300 text-zinc-950'
                }`}
              />
            </div>

            {effectiveCheckoutCap > 0 && (
              <button
                type="button"
                onClick={() => handleSelectCard(selectedCard)}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
                  isDark
                    ? 'bg-rose-500/30 hover:bg-rose-500/40 text-rose-100 border border-rose-400/50'
                    : 'bg-rose-600 hover:bg-rose-700 text-white'
                }`}
              >
                <Sparkles className="w-3 h-3" />
                <span>
                  Use Max ({formatCurrency(Math.min(selectedCard.balance, effectiveCheckoutCap))})
                </span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold">
            <span className={isDark ? 'text-zinc-300' : 'text-zinc-600'}>
              Card balance after sale:{' '}
              <strong className={`tabular-nums ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                {formatCurrency(remainingAfterSale)}
              </strong>
            </span>

            {effectiveCheckoutCap > 0 && remainingCustomerToPay > 0.004 && (
              <span className={isDark ? 'text-amber-300' : 'text-amber-800'}>
                Remaining to pay via Cash / Card:{' '}
                <strong className="tabular-nums">{formatCurrency(remainingCustomerToPay)}</strong>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Scanner & Searchable Gift Card Lookup */}
      {!selectedCard && isOpen && (
        <div className="mt-2.5 pt-2.5 border-t border-zinc-500/20 space-y-2.5">
          {/* Barcode Scan / Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <ScanBarcode className="w-4 h-4 absolute left-3 top-2 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                id="input-checkout-gift-card-search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  if (lookupError) setLookupError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleBarcodeLookup(search);
                  }
                }}
                placeholder="Scan gift card barcode or search recipient..."
                autoFocus
                className={`w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border focus:outline-hidden ${
                  isDark
                    ? 'bg-zinc-900 border-zinc-700 text-white placeholder-zinc-500 focus:border-rose-400'
                    : 'bg-white border-zinc-300 text-zinc-900 focus:border-rose-600'
                }`}
              />
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => handleBarcodeLookup(search)}
                disabled={!search.trim()}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap ${
                  isDark
                    ? 'bg-rose-500 hover:bg-rose-400 text-zinc-950'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-white'
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                <span>Apply Code</span>
              </button>

              <button
                type="button"
                onClick={() => (isCameraActive ? stopCamera() : startCamera())}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${
                  isCameraActive
                    ? 'bg-rose-600 text-white border-rose-600'
                    : isDark
                    ? 'bg-zinc-900 text-zinc-200 border-zinc-700 hover:bg-zinc-800'
                    : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-100'
                }`}
                title="Scan physical gift card barcode using camera"
              >
                {isCameraActive ? (
                  <>
                    <CameraOff className="w-3.5 h-3.5" />
                    <span>Stop</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-3.5 h-3.5" />
                    <span>Scan</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {isCameraActive && (
            <div className="relative rounded-xl overflow-hidden bg-black border border-rose-400/50 max-h-48">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-44 object-cover"
              />
              <div className="absolute bottom-2 inset-x-0 text-center">
                <span className="text-[11px] font-bold bg-black/75 text-white px-2.5 py-1 rounded-lg">
                  Point camera at gift card barcode
                </span>
              </div>
            </div>
          )}

          {lookupError && (
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-700 bg-rose-100/80 border border-rose-300 rounded-xl px-2.5 py-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span>{lookupError}</span>
            </div>
          )}

          {/* Active Gift Cards Quick List */}
          <div className="max-h-44 overflow-y-auto space-y-1">
            {filtered.length === 0 ? (
              <div className="text-center text-[11px] text-zinc-500 py-2.5 space-y-1">
                <p>
                  {cards.length === 0
                    ? 'No active gift cards with remaining balance yet.'
                    : 'No matching active gift cards.'}
                </p>
                {onOpenGiftCardsTab && cards.length === 0 && (
                  <button
                    type="button"
                    onClick={onOpenGiftCardsTab}
                    className="font-bold text-rose-700 hover:underline cursor-pointer"
                  >
                    Open Gift Cards tab to activate one
                  </button>
                )}
              </div>
            ) : (
              filtered.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => handleSelectCard(card)}
                  className={`w-full px-3 py-2 rounded-xl text-left text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                    isDark
                      ? 'bg-zinc-900 hover:bg-rose-950/60 text-white border border-zinc-800'
                      : 'bg-white hover:bg-rose-50 text-zinc-900 border border-zinc-200'
                  }`}
                >
                  <div className="min-w-0">
                    <span className="font-mono font-black block truncate">#{card.barcode}</span>
                    {(card.recipientName || card.notes) && (
                      <span className="text-[10px] text-zinc-500 truncate block">
                        {[card.recipientName, card.notes].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </div>
                  <span
                    className={`font-black tabular-nums px-2 py-0.5 rounded-lg text-[11px] shrink-0 ${
                      isDark
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'bg-rose-100 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {formatCurrency(card.balance)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
