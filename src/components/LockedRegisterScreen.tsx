import React, { useState, useRef, useEffect } from 'react';
import {
  Lock,
  KeyRound,
  Database,
  PlusCircle,
  Tag,
  Banknote,
  CreditCard,
  Globe,
  ArrowLeftRight,
  Barcode,
  CheckCircle2,
  AlertCircle,
  Cloud,
  Calendar,
  Sparkles,
  ShoppingBag,
  Layers,
  ChevronDown,
  X,
  Search,
  Plus,
  BookOpen,
  Boxes,
  Volume2,
  VolumeX,
  Ticket,
  User,
} from 'lucide-react';
import { PaymentMethod, OnlineCard, TradeType } from '../types';
import { cloudDb, formatCurrency, getLocalDateKey, formatDisplayDate } from '../db/cloudDatabase';
import { PasscodeModal } from './PasscodeModal';
import { playSaleBeep, playCheckoutSound, useCheckoutSound, useAudioUnlockStatus, testMarioSound } from '../utils/sound';

interface LockedRegisterScreenProps {
  onSaleRecorded?: () => void;
  knownVendors: string[];
}

export const LockedRegisterScreen: React.FC<LockedRegisterScreenProps> = ({
  onSaleRecorded,
  knownVendors,
}) => {
  const [isPasscodeModalOpen, setIsPasscodeModalOpen] = useState(false);
  const { soundEnabled, toggle: toggleSound } = useCheckoutSound();
  const { isUnlocked: isAudioActive, unlock: unlockAudio } = useAudioUnlockStatus();
  const currentDateKey = getLocalDateKey();

  // Terminal Mode: 'sale' (Counter Sale) vs 'trade' (Trade In)
  const [terminalMode, setTerminalMode] = useState<'sale' | 'trade'>('sale');

  // Sale form states
  const [selectedVendor, setSelectedVendor] = useState<string>('');
  const [itemDescription, setItemDescription] = useState<string>('');
  const [isMiscellaneous, setIsMiscellaneous] = useState<boolean>(false);
  const [amount, setAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [notes, setNotes] = useState<string>('');
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  const [scannedCardInfo, setScannedCardInfo] = useState<OnlineCard | null>(null);

  // Trade-In form states
  const [tradeVendor, setTradeVendor] = useState<string>('');
  const [tradeItemDescription, setTradeItemDescription] = useState<string>('');
  const [tradeValue, setTradeValue] = useState<string>('');
  const [tradeType, setTradeType] = useState<TradeType>('credit');
  const [tradeCustomerName, setTradeCustomerName] = useState<string>('');
  const [tradeNotes, setTradeNotes] = useState<string>('');
  const [isTradeVendorDropdownOpen, setIsTradeVendorDropdownOpen] = useState(false);
  const [tradeVendorSearch, setTradeVendorSearch] = useState('');
  const [isAddingTradeVendor, setIsAddingTradeVendor] = useState(false);
  const [newTradeVendorName, setNewTradeVendorName] = useState('');

  // Quick Add Vendor modal/inline state
  const [isAddingVendor, setIsAddingVendor] = useState(false);
  const [newVendorName, setNewVendorName] = useState('');

  // UI Feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<{
    vendor: string;
    item: string;
    amount: number;
    method: PaymentMethod;
  } | null>(null);
  const [tradeSuccessNotice, setTradeSuccessNotice] = useState<{
    vendor: string;
    item: string;
    value: number;
    tradeType: TradeType;
  } | null>(null);

  // Searchable Vendor Dropdown state
  const [isVendorDropdownOpen, setIsVendorDropdownOpen] = useState(false);
  const [vendorSearch, setVendorSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const tradeDropdownRef = useRef<HTMLDivElement>(null);

  // Form input refs
  const itemInputRef = useRef<HTMLInputElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const tradeItemInputRef = useRef<HTMLInputElement>(null);

  // Filter vendors by search
  const filteredVendors = knownVendors.filter((v) =>
    v.toLowerCase().includes(vendorSearch.toLowerCase().trim())
  );
  const filteredTradeVendors = knownVendors.filter((v) =>
    v.toLowerCase().includes(tradeVendorSearch.toLowerCase().trim())
  );

  // Close vendor dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsVendorDropdownOpen(false);
      }
      if (tradeDropdownRef.current && !tradeDropdownRef.current.contains(e.target as Node)) {
        setIsTradeVendorDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle Barcode Scan / Lookup
  const handleBarcodeLookup = (codeToLookup?: string) => {
    const code = (codeToLookup || barcodeInput).trim();
    if (!code) return;

    setFormError(null);

    // 1. Strict duplicate check
    if (cloudDb.isOnlineCardAlreadySold(code)) {
      playSaleBeep(false);
      const existingCard = cloudDb.getOnlineCardByBarcode(code);
      setFormError(
        `DUPLICATE BLOCKED: Card "${existingCard ? existingCard.cardName : code}" (${code}) is ALREADY sold and logged in sales! Duplicate sales are prevented.`
      );
      setScannedCardInfo(null);
      return;
    }

    const card = cloudDb.getOnlineCardByBarcode(code);
    if (!card) {
      playSaleBeep(false);
      setFormError(`No cataloged card found matching barcode "${code}". You can enter details manually below.`);
      return;
    }

    if (card.status === 'sold') {
      playSaleBeep(false);
      setFormError(`Card "${card.cardName}" (${card.barcode}) was already sold and cannot be entered again.`);
      setScannedCardInfo(null);
      return;
    }

    // Auto-populate form
    playSaleBeep(true);
    setScannedCardInfo(card);
    setSelectedVendor(card.vendorName);
    setItemDescription(card.cardName);
    setIsMiscellaneous(false);
    setAmount(card.price.toFixed(2));
    setPaymentMethod('card'); // Default to card or user can change
    setNotes(`Scanned Barcode: ${card.barcode}`);
    setBarcodeInput('');
    amountInputRef.current?.focus();
  };

  const handleToggleMisc = (checked: boolean) => {
    setIsMiscellaneous(checked);
    if (checked) {
      setItemDescription('Miscellaneous');
      setScannedCardInfo(null);
      setTimeout(() => amountInputRef.current?.focus(), 50);
    } else {
      if (itemDescription === 'Miscellaneous') {
        setItemDescription('');
      }
      setTimeout(() => itemInputRef.current?.focus(), 50);
    }
  };

  const resolveTargetVendor = (target: 'Kieron' | 'Newtons'): string => {
    if (target === 'Kieron') {
      const found = knownVendors.find(
        (v) => v.toLowerCase() === 'kieron'
      );
      return found || '';
    }
    if (target === 'Newtons') {
      const found = knownVendors.find(
        (v) => v.toLowerCase().startsWith('newton')
      );
      return found || '';
    }
    return '';
  };

  const handleSelectQuickCategory = (category: 'misc' | 'comics' | 'accessories' | 'packs') => {
    setScannedCardInfo(null);
    setFormError(null);

    if (category === 'misc') {
      setIsMiscellaneous(true);
      setItemDescription('Miscellaneous');
      setTimeout(() => amountInputRef.current?.focus(), 50);
      return;
    }

    setIsMiscellaneous(false);

    if (category === 'comics') {
      setItemDescription('Comics');
      const vendor = resolveTargetVendor('Kieron');
      setSelectedVendor(vendor);
      setTimeout(() => amountInputRef.current?.focus(), 50);
    } else if (category === 'accessories') {
      setItemDescription('Accessories');
      const vendor = resolveTargetVendor('Newtons');
      setSelectedVendor(vendor);
      setTimeout(() => amountInputRef.current?.focus(), 50);
    } else if (category === 'packs') {
      setItemDescription('Packs');
      // Packs can be any vendor: if a vendor is already selected, focus amount, else prompt vendor
      if (selectedVendor) {
        setTimeout(() => amountInputRef.current?.focus(), 50);
      } else {
        setTimeout(() => {
          setIsVendorDropdownOpen(true);
        }, 50);
      }
    }
  };

  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newVendorName.trim();
    if (!clean) return;

    await cloudDb.addVendor(clean);
    setSelectedVendor(clean);
    setNewVendorName('');
    setIsAddingVendor(false);
    setIsVendorDropdownOpen(false);
    itemInputRef.current?.focus();
  };

  const handleSubmitSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedVendor.trim()) {
      setFormError('Please select a vendor.');
      return;
    }

    const finalItemDesc = isMiscellaneous ? 'Miscellaneous' : itemDescription.trim();
    if (!finalItemDesc) {
      setFormError('Please enter an item description or tick Miscellaneous.');
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError('Please enter a valid amount greater than £0.00.');
      return;
    }

    // If card was scanned, double check duplicate
    if (scannedCardInfo) {
      if (cloudDb.isOnlineCardAlreadySold(scannedCardInfo.barcode)) {
        playSaleBeep(false);
        setFormError(`Duplicate prevented: Card "${scannedCardInfo.cardName}" is already sold.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (scannedCardInfo) {
        // Record via sellOnlineCard to update inventory card status and sales ledger in sync
        await cloudDb.sellOnlineCard(scannedCardInfo.id, {
          targetDateKey: currentDateKey,
          customPrice: parsedAmount,
          notes: notes.trim() || undefined,
          paymentMethod,
        });
      } else {
        // Manual sale entry
        await cloudDb.insertSale({
          salesmanName: selectedVendor.trim(),
          itemDescription: finalItemDesc,
          isMiscellaneous,
          amount: parsedAmount,
          paymentMethod,
          notes: notes.trim() || undefined,
          dateKey: currentDateKey,
        });
      }

      playCheckoutSound(false, undefined, parsedAmount);
      setSuccessNotice({
        vendor: selectedVendor.trim(),
        item: finalItemDesc,
        amount: parsedAmount,
        method: paymentMethod,
      });

      // Clear fields while retaining vendor for speed
      if (!isMiscellaneous) {
        setItemDescription('');
      }
      setAmount('');
      setNotes('');
      setScannedCardInfo(null);
      setBarcodeInput('');

      onSaleRecorded?.();

      setTimeout(() => {
        setSuccessNotice(null);
      }, 5000);

      // Focus back to item for next transaction
      setTimeout(() => {
        if (isMiscellaneous) {
          amountInputRef.current?.focus();
        } else {
          itemInputRef.current?.focus();
        }
      }, 100);
    } catch (err: any) {
      playSaleBeep(false);
      setFormError(err.message || 'Error recording sale.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateTradeVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newTradeVendorName.trim();
    if (!clean) return;

    await cloudDb.addVendor(clean);
    setTradeVendor(clean);
    setNewTradeVendorName('');
    setIsAddingTradeVendor(false);
    setIsTradeVendorDropdownOpen(false);
    tradeItemInputRef.current?.focus();
  };

  const handleQuickAddTradeValue = (inc: number) => {
    const current = parseFloat(tradeValue) || 0;
    setTradeValue((current + inc).toFixed(2));
  };

  const handleSubmitTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!tradeVendor.trim()) {
      setFormError('Please select the vendor taking in the cards.');
      return;
    }

    if (!tradeItemDescription.trim()) {
      setFormError('Please describe the cards or item traded in.');
      return;
    }

    const parsedValue = parseFloat(tradeValue);
    if (isNaN(parsedValue) || parsedValue <= 0) {
      setFormError('Please enter a valid trade valuation greater than £0.00.');
      return;
    }

    setIsSubmitting(true);
    try {
      await cloudDb.insertTrade({
        vendorName: tradeVendor.trim(),
        itemDescription: tradeItemDescription.trim(),
        tradeValue: parsedValue,
        tradeType,
        dateKey: currentDateKey,
        customerName: tradeCustomerName.trim() || undefined,
        notes: tradeNotes.trim() || undefined,
      });

      setTradeSuccessNotice({
        vendor: tradeVendor.trim(),
        item: tradeItemDescription.trim(),
        value: parsedValue,
        tradeType,
      });

      // Retain vendor for quick back-to-back trade entries
      setTradeItemDescription('');
      setTradeValue('');
      setTradeCustomerName('');
      setTradeNotes('');

      onSaleRecorded?.();

      setTimeout(() => {
        setTradeSuccessNotice(null);
      }, 5000);

      setTimeout(() => {
        tradeItemInputRef.current?.focus();
      }, 100);
    } catch (err: any) {
      setFormError(err.message || 'Error recording trade-in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col font-sans selection:bg-emerald-500 selection:text-zinc-950">
      {/* Top Bar - Minimal POS Terminal Header */}
      <header className="border-b border-zinc-800/80 bg-zinc-900/95 backdrop-blur-md sm:sticky sm:top-0 z-30 shadow-md">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3">
          {/* Brand & Locked Badge */}
          <div className="flex items-center justify-between gap-2.5 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700/80 text-white flex items-center justify-center shadow-inner shrink-0">
                <Database className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-sm sm:text-lg font-black tracking-tight text-white truncate">
                    Daily Sales Tracker
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-extrabold bg-amber-950/80 text-amber-300 border border-amber-600/40 whitespace-nowrap shrink-0">
                    <Lock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-400" />
                    <span className="sm:hidden">Locked</span>
                    <span className="hidden sm:inline">Register Terminal (Locked)</span>
                  </span>
                </div>
                <p className="hidden sm:block text-[11px] text-zinc-400 font-medium">
                  Fast counter sale entry • Ledger information & reports hidden
                </p>
              </div>
            </div>

            <div className="flex sm:hidden items-center gap-1 text-[11px] text-zinc-400 font-semibold shrink-0 whitespace-nowrap">
              <Calendar className="w-3 h-3 text-zinc-400" />
              <span>{currentDateKey}</span>
            </div>
          </div>

          {/* Right Status & Log In Action */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:justify-end">
            <div className="hidden md:flex items-center gap-2 text-xs text-zinc-400 font-medium whitespace-nowrap">
              <Calendar className="w-3.5 h-3.5 text-zinc-400" />
              <span>{formatDisplayDate(currentDateKey)}</span>
            </div>

            {/* Audio Unlock Warning / Prompt if device browser blocked audio */}
            {!isAudioActive && soundEnabled && (
              <button
                type="button"
                id="btn-pos-activate-audio"
                onClick={unlockAudio}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 min-h-[40px] text-xs font-black rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/50 hover:bg-amber-500/30 transition animate-pulse cursor-pointer shadow-xs whitespace-nowrap"
                title="Browser requires 1 tap to allow sound on this device. Click to activate!"
              >
                <Volume2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Tap to Enable Sound</span>
              </button>
            )}

            {/* Checkout Sound Effect Toggle */}
            <button
              type="button"
              id="btn-pos-sound-toggle"
              onClick={toggleSound}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 min-h-[40px] text-xs font-bold rounded-xl border transition-all cursor-pointer shadow-xs whitespace-nowrap ${
                soundEnabled
                  ? 'bg-zinc-900 border-emerald-500/50 text-emerald-300 hover:bg-zinc-800'
                  : 'bg-zinc-900 border-zinc-750 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
              title={soundEnabled ? 'Checkout sound is ON (click to mute)' : 'Checkout sound is OFF (click to turn on)'}
              aria-label="Toggle checkout chime sound"
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Sound: ON</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 text-zinc-400 shrink-0" />
                  <span>Sound: OFF</span>
                </>
              )}
            </button>

            {/* Test Sound Button */}
            {soundEnabled && isAudioActive && (
              <button
                type="button"
                id="btn-pos-test-sound"
                onClick={testMarioSound}
                className="inline-flex items-center justify-center gap-1 px-3 min-h-[40px] text-xs font-bold rounded-xl border border-zinc-800 bg-zinc-900/90 text-zinc-300 hover:text-white hover:bg-zinc-800 transition cursor-pointer whitespace-nowrap shrink-0"
                title="Test Mario Coin sound effect on this device"
              >
                <span>Test 🪙</span>
              </button>
            )}

            <button
              type="button"
              id="btn-login-full-experience"
              onClick={() => setIsPasscodeModalOpen(true)}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 min-h-[40px] text-xs font-black text-zinc-950 bg-emerald-400 hover:bg-emerald-300 active:scale-98 rounded-xl shadow-md shadow-emerald-950/50 transition-all cursor-pointer whitespace-nowrap"
              title="Enter passcode to unlock full dashboard and tabs"
            >
              <KeyRound className="w-4 h-4 text-zinc-950 shrink-0" />
              <span className="sm:hidden">Log In</span>
              <span className="hidden sm:inline">Log In for Full Access</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Terminal Body */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-5">
        {/* Security & Terminal Mode Banner */}
        <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 text-zinc-300 shadow-sm flex items-start sm:items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                Locked Register Mode Active
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Record counter sales and card trade-ins here. Historical totals, ledgers, and reports remain hidden until a manager logs in.
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-950/70 text-emerald-300 border border-emerald-500/40 shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <Cloud className="w-3.5 h-3.5 text-emerald-400" />
            <span>Cloud Synced</span>
          </div>
        </div>

        {/* Terminal Mode Switcher: Record Sale vs Trade In */}
        <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-inner">
          <button
            type="button"
            id="btn-lockscreen-mode-sale"
            onClick={() => {
              setTerminalMode('sale');
              setFormError(null);
            }}
            className={`min-h-[44px] py-2.5 px-2.5 sm:px-4 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer whitespace-nowrap ${
              terminalMode === 'sale'
                ? 'bg-emerald-500 text-zinc-950 shadow-md'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/70'
            }`}
          >
            <PlusCircle className={`w-4 h-4 shrink-0 ${terminalMode === 'sale' ? 'text-zinc-950' : 'text-emerald-400'}`} />
            <span>Record Sale</span>
          </button>

          <button
            type="button"
            id="btn-lockscreen-mode-trade"
            onClick={() => {
              setTerminalMode('trade');
              setFormError(null);
            }}
            className={`min-h-[44px] py-2.5 px-2.5 sm:px-4 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer whitespace-nowrap ${
              terminalMode === 'trade'
                ? 'bg-amber-400 text-zinc-950 shadow-md'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/70'
            }`}
          >
            <ArrowLeftRight className={`w-4 h-4 shrink-0 ${terminalMode === 'trade' ? 'text-zinc-950' : 'text-amber-400'}`} />
            <span>Trade In</span>
          </button>
        </div>

        {/* Success Notice Toast Banner (Sale) */}
        {successNotice && terminalMode === 'sale' && (
          <div className="p-4 rounded-2xl bg-emerald-950/90 border-2 border-emerald-500/80 text-white shadow-xl animate-scale-up space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-black text-sm text-emerald-300">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>Sale Recorded & Added to Sales Ledger!</span>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-300 bg-emerald-900/60 px-2.5 py-0.5 rounded-lg border border-emerald-500/40">
                {successNotice.method === 'cash'
                  ? 'CASH'
                  : successNotice.method === 'card'
                  ? 'CARD'
                  : successNotice.method === 'traded_out'
                  ? 'TRADE OUT'
                  : 'ONLINE'}
              </span>
            </div>
            <div className="text-base font-extrabold text-white flex items-center justify-between pt-1">
              <span>{successNotice.item}</span>
              <span className="text-xl text-emerald-300 tabular-nums font-black">
                {formatCurrency(successNotice.amount)}
              </span>
            </div>
            <p className="text-xs text-emerald-200/80 font-medium">
              Vendor credited: <strong className="text-white">{successNotice.vendor}</strong> • Ready for next sale.
            </p>
          </div>
        )}

        {/* Success Notice Toast Banner (Trade In) */}
        {tradeSuccessNotice && terminalMode === 'trade' && (
          <div className="p-4 rounded-2xl bg-amber-950/90 border-2 border-amber-500/80 text-white shadow-xl animate-scale-up space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-black text-sm text-amber-300">
                <CheckCircle2 className="w-5 h-5 text-amber-400" />
                <span>Trade-In Recorded & Added to Trade Ledger!</span>
              </div>
              <span className="text-xs font-mono font-bold text-amber-300 bg-amber-900/60 px-2.5 py-0.5 rounded-lg border border-amber-500/40">
                {tradeSuccessNotice.tradeType === 'cash' ? 'CASH PAYOUT' : "VENDOR'S CREDIT"}
              </span>
            </div>
            <div className="text-base font-extrabold text-white flex items-center justify-between pt-1">
              <span>{tradeSuccessNotice.item}</span>
              <span className="text-xl text-amber-300 tabular-nums font-black">
                {formatCurrency(tradeSuccessNotice.value)}
              </span>
            </div>
            <p className="text-xs text-amber-200/80 font-medium">
              Vendor taking trade: <strong className="text-white">{tradeSuccessNotice.vendor}</strong> • Ready for next trade.
            </p>
          </div>
        )}

        {/* Error Notice */}
        {formError && (
          <div className="p-4 rounded-2xl bg-rose-950/90 border border-rose-500 text-rose-200 shadow-md flex items-center gap-2.5 animate-fade-in text-xs font-bold">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span className="flex-1">{formError}</span>
            <button
              type="button"
              onClick={() => setFormError(null)}
              className="text-rose-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Sale Entry Terminal Card */}
        {terminalMode === 'sale' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-4 sm:p-7 shadow-2xl relative overflow-hidden ring-1 ring-white/5">
          {/* Optional Barcode Quick-Scan Input */}
          <div className="mb-5 pb-5 border-b border-zinc-800">
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
              Scan Barcode or Enter Card Code <span className="text-zinc-500 font-normal">(Optional)</span>
            </label>
            <div className="flex items-stretch gap-2">
              <div className="relative flex-1 min-w-0">
                <Barcode className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleBarcodeLookup();
                    }
                  }}
                  placeholder="Scan barcode or type code..."
                  className="w-full pl-10 pr-3 py-2.5 text-sm font-mono font-bold tracking-wider rounded-xl border border-zinc-700 bg-zinc-950 text-white placeholder-zinc-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <button
                type="button"
                onClick={() => handleBarcodeLookup()}
                disabled={!barcodeInput.trim()}
                className="px-3.5 sm:px-4 min-h-[44px] rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-white font-bold text-xs border border-zinc-700 transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                Lookup
              </button>
            </div>
            {scannedCardInfo && (
              <div className="mt-2.5 px-3 py-2 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-xs flex items-center justify-between text-emerald-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>
                    Card loaded: <strong>{scannedCardInfo.cardName}</strong> ({scannedCardInfo.barcode})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setScannedCardInfo(null)}
                  className="text-xs text-zinc-400 hover:text-white underline cursor-pointer"
                >
                  Clear card
                </button>
              </div>
            )}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmitSale} className="space-y-5">
            {/* 1. Vendor Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300">
                  Vendor <span className="text-emerald-400">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsAddingVendor(true)}
                  className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add New Vendor</span>
                </button>
              </div>

              {/* Vendor Selector Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsVendorDropdownOpen(!isVendorDropdownOpen)}
                  className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                    selectedVendor
                      ? 'bg-zinc-950 border-emerald-500/60 ring-2 ring-emerald-500/20'
                      : 'bg-zinc-950 border-zinc-700 hover:border-zinc-600'
                  }`}
                >
                  {selectedVendor ? (
                    <div className="flex items-center gap-2.5 truncate">
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                        style={{ backgroundColor: cloudDb.getVendorColor(selectedVendor) }}
                      />
                      <span className="font-bold text-sm text-white truncate">
                        {selectedVendor}
                      </span>
                    </div>
                  ) : (
                    <span className="text-zinc-500 text-sm font-medium">
                      Select vendor...
                    </span>
                  )}
                  <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${isVendorDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {isVendorDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden p-2 space-y-1 animate-scale-up max-h-64 overflow-y-auto">
                    <div className="relative mb-1">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-500" />
                      <input
                        type="text"
                        value={vendorSearch}
                        onChange={(e) => setVendorSearch(e.target.value)}
                        placeholder="Search vendors..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-zinc-950 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-hidden focus:border-emerald-500"
                        autoFocus
                      />
                    </div>

                    {filteredVendors.length === 0 ? (
                      <div className="p-3 text-center text-xs text-zinc-500">
                        No vendor found matching "{vendorSearch}"
                      </div>
                    ) : (
                      filteredVendors.map((vendor) => (
                        <button
                          key={vendor}
                          type="button"
                          onClick={() => {
                            setSelectedVendor(vendor);
                            setIsVendorDropdownOpen(false);
                            setVendorSearch('');
                            itemInputRef.current?.focus();
                          }}
                          className={`w-full px-3 py-2 rounded-xl text-left text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                            selectedVendor === vendor
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'text-zinc-200 hover:bg-zinc-800'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: cloudDb.getVendorColor(vendor) }}
                            />
                            <span className="truncate">{vendor}</span>
                          </div>
                          {selectedVendor === vendor && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Inline Vendor Quick Creator */}
              {isAddingVendor && (
                <div className="mt-2.5 p-3 rounded-2xl bg-zinc-950 border border-emerald-500/50 flex flex-wrap sm:flex-nowrap items-center gap-2 animate-fade-in">
                  <input
                    type="text"
                    value={newVendorName}
                    onChange={(e) => setNewVendorName(e.target.value)}
                    placeholder="New vendor name..."
                    className="flex-1 min-w-[140px] px-3 py-2 text-xs rounded-xl bg-zinc-900 border border-zinc-700 text-white focus:outline-hidden focus:border-emerald-500"
                    autoFocus
                  />
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleCreateVendor}
                      disabled={!newVendorName.trim()}
                      className="px-3.5 min-h-[38px] bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-zinc-950 font-bold text-xs rounded-xl cursor-pointer"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingVendor(false);
                        setNewVendorName('');
                      }}
                      className="px-2.5 min-h-[38px] text-zinc-400 hover:text-white text-xs cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Categories: Miscellaneous, Comics (Kieron), Accessories (Newtons), Packs (Any Vendor) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Quick Categories</span>
                </span>
                <span className="text-[11px] text-zinc-400 font-medium">
                  1-tap item & auto-vendor
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {/* 1. Miscellaneous */}
                <button
                  type="button"
                  id="btn-quick-cat-misc"
                  onClick={() => handleSelectQuickCategory('misc')}
                  className={`min-w-0 min-h-[58px] p-2.5 sm:p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                    isMiscellaneous
                      ? 'bg-zinc-800 border-zinc-500 ring-2 ring-zinc-500/30 text-white shadow-sm'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] sm:text-xs font-black truncate">Miscellaneous</span>
                    <Layers className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  </div>
                  <span className="text-[10px] text-zinc-400 font-semibold truncate">Any vendor</span>
                </button>

                {/* 2. Comics (Auto Kieron) */}
                <button
                  type="button"
                  id="btn-quick-cat-comics"
                  onClick={() => handleSelectQuickCategory('comics')}
                  className={`min-w-0 min-h-[58px] p-2.5 sm:p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                    !isMiscellaneous && itemDescription.toLowerCase() === 'comics'
                      ? 'bg-emerald-950/80 border-emerald-500 ring-2 ring-emerald-500/30 text-white shadow-sm'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-emerald-500/50 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] sm:text-xs font-black truncate">Comics</span>
                    <BookOpen className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  </div>
                  <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-500/40 self-start truncate max-w-full">
                    Auto: Kieron
                  </span>
                </button>

                {/* 3. Accessories (Auto Newtons) */}
                <button
                  type="button"
                  id="btn-quick-cat-accessories"
                  onClick={() => handleSelectQuickCategory('accessories')}
                  className={`min-w-0 min-h-[58px] p-2.5 sm:p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                    !isMiscellaneous && itemDescription.toLowerCase() === 'accessories'
                      ? 'bg-purple-950/80 border-purple-500 ring-2 ring-purple-500/30 text-white shadow-sm'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-purple-500/50 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] sm:text-xs font-black truncate">Accessories</span>
                    <ShoppingBag className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  </div>
                  <span className="text-[10px] font-extrabold text-purple-300 bg-purple-950/80 px-1.5 py-0.5 rounded border border-purple-500/40 self-start truncate max-w-full">
                    Auto: Newtons
                  </span>
                </button>

                {/* 4. Packs (Any Vendor) */}
                <button
                  type="button"
                  id="btn-quick-cat-packs"
                  onClick={() => handleSelectQuickCategory('packs')}
                  className={`min-w-0 min-h-[58px] p-2.5 sm:p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                    !isMiscellaneous && itemDescription.toLowerCase() === 'packs'
                      ? 'bg-blue-950/80 border-blue-500 ring-2 ring-blue-500/30 text-white shadow-sm'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-blue-500/50 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] sm:text-xs font-black truncate">Packs</span>
                    <Boxes className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  </div>
                  <span className="text-[10px] text-zinc-400 font-semibold truncate">Any vendor</span>
                </button>
              </div>
            </div>

            {/* 2. Item Description & Misc Toggle */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300">
                  Item Description <span className="text-emerald-400">*</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs text-zinc-300 font-semibold cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isMiscellaneous}
                    onChange={(e) => handleToggleMisc(e.target.checked)}
                    className="w-4 h-4 rounded-md border-zinc-700 bg-zinc-950 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span>Miscellaneous Sale</span>
                </label>
              </div>

              <div className="relative">
                <Tag className="w-4 h-4 absolute left-3.5 top-3.5 text-zinc-500 pointer-events-none" />
                <input
                  ref={itemInputRef}
                  type="text"
                  disabled={isMiscellaneous}
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  placeholder={isMiscellaneous ? 'Miscellaneous' : 'e.g. Charizard Base Set, Boosters, Slab...'}
                  className={`w-full pl-10 pr-4 py-3 text-sm font-bold rounded-2xl border transition-all ${
                    isMiscellaneous
                      ? 'bg-zinc-800 text-zinc-400 border-zinc-700 cursor-not-allowed'
                      : 'bg-zinc-950 border-zinc-700 text-white placeholder-zinc-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500'
                  }`}
                />
              </div>
            </div>

            {/* 3. Sale Amount (£) */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
                Sale Amount (£) <span className="text-emerald-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-3 text-xl font-black text-emerald-400 pointer-events-none">
                  £
                </span>
                <input
                  ref={amountInputRef}
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-9 pr-4 py-3 text-2xl font-black tabular-nums tracking-tight rounded-2xl border border-zinc-700 bg-zinc-950 text-white placeholder-zinc-600 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>

            {/* 4. Payment Method Selection (4 Large Buttons) */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
                Payment Method <span className="text-emerald-400">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* Cash */}
                <button
                  type="button"
                  id="btn-pos-method-cash"
                  onClick={() => setPaymentMethod('cash')}
                  className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                    paymentMethod === 'cash'
                      ? 'bg-emerald-950/80 border-emerald-500 ring-2 ring-emerald-500/30 text-white shadow-md'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider">Cash</span>
                    <Banknote className="w-4 h-4 text-emerald-400" />
                  </div>
                  <span className="text-[10px] text-zinc-400 font-medium">Till / Notes</span>
                </button>

                {/* Card */}
                <button
                  type="button"
                  id="btn-pos-method-card"
                  onClick={() => setPaymentMethod('card')}
                  className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                    paymentMethod === 'card'
                      ? 'bg-blue-950/80 border-blue-500 ring-2 ring-blue-500/30 text-white shadow-md'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider">Card</span>
                    <CreditCard className="w-4 h-4 text-blue-400" />
                  </div>
                  <span className="text-[10px] text-zinc-400 font-medium">PDQ / Reader</span>
                </button>

                {/* Online */}
                <button
                  type="button"
                  id="btn-pos-method-online"
                  onClick={() => setPaymentMethod('online')}
                  className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                    paymentMethod === 'online'
                      ? 'bg-violet-950/80 border-violet-500 ring-2 ring-violet-500/30 text-white shadow-md'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider">Online</span>
                    <Globe className="w-4 h-4 text-violet-400" />
                  </div>
                  <span className="text-[10px] text-zinc-400 font-medium">Web order</span>
                </button>

                {/* Trade Out */}
                <button
                  type="button"
                  id="btn-pos-method-traded-out"
                  onClick={() => setPaymentMethod('traded_out')}
                  className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                    paymentMethod === 'traded_out'
                      ? 'bg-amber-950/80 border-amber-500 ring-2 ring-amber-500/30 text-white shadow-md'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider">Trade Out</span>
                    <ArrowLeftRight className="w-4 h-4 text-amber-400" />
                  </div>
                  <span className="text-[10px] text-zinc-400 font-medium">Card deal trade</span>
                </button>
              </div>
            </div>

            {/* 5. Optional Notes / Memo */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Memo / Customer Reference <span className="text-zinc-500 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional memo, order number, counter notes..."
                className="w-full px-4 py-2.5 text-xs rounded-xl border border-zinc-700 bg-zinc-950 text-white placeholder-zinc-500 focus:outline-hidden focus:border-emerald-500"
              />
            </div>

            {/* 6. Big Submit Button */}
            <button
              type="submit"
              id="btn-terminal-submit-sale"
              disabled={isSubmitting}
              className="w-full min-h-[48px] px-4 py-3.5 sm:py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 disabled:opacity-50 text-zinc-950 font-black text-sm sm:text-base shadow-xl shadow-emerald-950/50 transition-all flex items-center justify-center gap-2 cursor-pointer text-center"
            >
              <PlusCircle className="w-5 h-5 text-zinc-950 shrink-0" />
              <span className="truncate">
                {isSubmitting
                  ? 'Adding to Ledger...'
                  : `Record & Add (${formatCurrency(parseFloat(amount) || 0)})`}
              </span>
            </button>
          </form>
        </div>
        )}

        {/* Trade-In Entry Terminal Card (Accessible on Lock Screen without showing totals) */}
        {terminalMode === 'trade' && (
        <div
          id="card-lockscreen-trade-form"
          className="bg-zinc-900 border border-zinc-800 rounded-3xl p-4 sm:p-7 shadow-2xl relative overflow-hidden ring-1 ring-white/5 space-y-5"
        >
          {/* Trade-In Banner */}
          <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/30 flex items-start gap-2.5">
            <ArrowLeftRight className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-200/90 leading-relaxed">
              <strong className="text-amber-300">Cards Trade-In Entry:</strong> Log cards traded in for <strong>Cash Payout</strong> or <strong>Vendor&apos;s Credit</strong>. All valuations are gross amounts before commission reductions.
            </div>
          </div>

          <form onSubmit={handleSubmitTrade} className="space-y-5">
            {/* 1. Vendor Taking In Cards */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300">
                  Vendor Taking In Cards <span className="text-amber-400">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsAddingTradeVendor(true)}
                  className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add New Vendor</span>
                </button>
              </div>

              <div className="relative" ref={tradeDropdownRef}>
                <button
                  type="button"
                  id="btn-lockscreen-trade-vendor-select"
                  onClick={() => setIsTradeVendorDropdownOpen(!isTradeVendorDropdownOpen)}
                  className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                    tradeVendor
                      ? 'bg-zinc-950 border-amber-500/60 ring-2 ring-amber-500/20'
                      : 'bg-zinc-950 border-zinc-700 hover:border-zinc-600'
                  }`}
                >
                  {tradeVendor ? (
                    <div className="flex items-center gap-2.5 truncate">
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                        style={{ backgroundColor: cloudDb.getVendorColor(tradeVendor) }}
                      />
                      <span className="font-bold text-sm text-white truncate">
                        {tradeVendor}
                      </span>
                    </div>
                  ) : (
                    <span className="text-zinc-500 text-sm font-medium">
                      Select vendor taking trade...
                    </span>
                  )}
                  <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${isTradeVendorDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isTradeVendorDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden p-2 space-y-1 animate-scale-up max-h-64 overflow-y-auto">
                    <div className="relative mb-1">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-500" />
                      <input
                        type="text"
                        value={tradeVendorSearch}
                        onChange={(e) => setTradeVendorSearch(e.target.value)}
                        placeholder="Search vendors..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-zinc-950 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-hidden focus:border-amber-500"
                        autoFocus
                      />
                    </div>

                    {filteredTradeVendors.length === 0 ? (
                      <div className="p-3 text-center text-xs text-zinc-500">
                        No vendor found matching &ldquo;{tradeVendorSearch}&rdquo;
                      </div>
                    ) : (
                      filteredTradeVendors.map((vendor) => (
                        <button
                          key={vendor}
                          type="button"
                          onClick={() => {
                            setTradeVendor(vendor);
                            setIsTradeVendorDropdownOpen(false);
                            setTradeVendorSearch('');
                            tradeItemInputRef.current?.focus();
                          }}
                          className={`w-full px-3 py-2 rounded-xl text-left text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                            tradeVendor === vendor
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'text-zinc-200 hover:bg-zinc-800'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: cloudDb.getVendorColor(vendor) }}
                            />
                            <span className="truncate">{vendor}</span>
                          </div>
                          {tradeVendor === vendor && (
                            <CheckCircle2 className="w-4 h-4 text-amber-400" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {isAddingTradeVendor && (
                <div className="mt-2.5 p-3 rounded-2xl bg-zinc-950 border border-amber-500/50 flex flex-wrap sm:flex-nowrap items-center gap-2 animate-fade-in">
                  <input
                    type="text"
                    value={newTradeVendorName}
                    onChange={(e) => setNewTradeVendorName(e.target.value)}
                    placeholder="New vendor name..."
                    className="flex-1 min-w-[140px] px-3 py-2 text-xs rounded-xl bg-zinc-900 border border-zinc-700 text-white focus:outline-hidden focus:border-amber-500"
                    autoFocus
                  />
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleCreateTradeVendor}
                      disabled={!newTradeVendorName.trim()}
                      className="px-3.5 min-h-[38px] bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-zinc-950 font-bold text-xs rounded-xl cursor-pointer"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingTradeVendor(false);
                        setNewTradeVendorName('');
                      }}
                      className="px-2.5 min-h-[38px] text-zinc-400 hover:text-white text-xs cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Cards / Item Traded In */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
                Cards / Item Traded In <span className="text-amber-400">*</span>
              </label>
              <div className="relative">
                <Tag className="w-4 h-4 absolute left-3.5 top-3.5 text-zinc-500 pointer-events-none" />
                <input
                  ref={tradeItemInputRef}
                  id="input-lockscreen-trade-desc"
                  type="text"
                  value={tradeItemDescription}
                  onChange={(e) => setTradeItemDescription(e.target.value)}
                  placeholder="e.g. Charizard Base Set Holo, Singles Binder, PSA 9 Slab..."
                  className="w-full pl-10 pr-4 py-3 text-sm font-bold rounded-2xl border border-zinc-700 bg-zinc-950 text-white placeholder-zinc-500 focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
            </div>

            {/* 3. Trade Valuation (£) */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300">
                  Trade Valuation (£) <span className="text-amber-400">*</span>
                </label>
                <div className="grid grid-cols-4 sm:flex items-center gap-1.5 w-full sm:w-auto">
                  {[5, 10, 20, 50].map((inc) => (
                    <button
                      key={inc}
                      type="button"
                      onClick={() => handleQuickAddTradeValue(inc)}
                      className="text-[11px] font-bold px-2.5 py-1.5 sm:py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors cursor-pointer text-center"
                    >
                      +£{inc}
                    </button>
                  ))}
                </div>
              </div>
              <div className="relative">
                <span className="absolute left-4 top-3 text-xl font-black text-amber-400 pointer-events-none">
                  £
                </span>
                <input
                  id="input-lockscreen-trade-value"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={tradeValue}
                  onChange={(e) => setTradeValue(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-9 pr-4 py-3 text-2xl font-black tabular-nums tracking-tight rounded-2xl border border-zinc-700 bg-zinc-950 text-white placeholder-zinc-600 focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
            </div>

            {/* 4. Traded In For: Cash Payout vs Vendor's Credit */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
                Cards Traded In For <span className="text-amber-400">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  id="btn-lockscreen-trade-cash"
                  onClick={() => setTradeType('cash')}
                  className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer flex items-center gap-3 ${
                    tradeType === 'cash'
                      ? 'bg-emerald-950/80 border-emerald-500 ring-2 ring-emerald-500/30 text-white shadow-md'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    tradeType === 'cash' ? 'bg-emerald-500 text-zinc-950' : 'bg-zinc-800 text-emerald-400'
                  }`}>
                    <Banknote className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="block text-sm font-black">Cash Payout</span>
                    <span className="text-[11px] text-zinc-400 font-medium">Cash paid out to customer</span>
                  </div>
                </button>

                <button
                  type="button"
                  id="btn-lockscreen-trade-credit"
                  onClick={() => setTradeType('credit')}
                  className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer flex items-center gap-3 ${
                    tradeType === 'credit'
                      ? 'bg-purple-950/80 border-purple-500 ring-2 ring-purple-500/30 text-white shadow-md'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    tradeType === 'credit' ? 'bg-purple-400 text-zinc-950' : 'bg-zinc-800 text-purple-400'
                  }`}>
                    <Ticket className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="block text-sm font-black">Vendor&apos;s Credit</span>
                    <span className="text-[11px] text-zinc-400 font-medium">Store / vendor credit issued</span>
                  </div>
                </button>
              </div>
            </div>

            {/* 5. Customer Name & Condition Memo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Customer Name <span className="text-zinc-500 font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-2.5 text-zinc-500 pointer-events-none" />
                  <input
                    id="input-lockscreen-trade-customer"
                    type="text"
                    value={tradeCustomerName}
                    onChange={(e) => setTradeCustomerName(e.target.value)}
                    placeholder="e.g. Alex, Sam..."
                    className="w-full pl-10 pr-3 py-2.5 text-xs rounded-xl border border-zinc-700 bg-zinc-950 text-white placeholder-zinc-500 focus:outline-hidden focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Notes / Condition Memo <span className="text-zinc-500 font-normal">(Optional)</span>
                </label>
                <input
                  id="input-lockscreen-trade-notes"
                  type="text"
                  value={tradeNotes}
                  onChange={(e) => setTradeNotes(e.target.value)}
                  placeholder="e.g. NM, toploader, credit slip #41..."
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-zinc-700 bg-zinc-950 text-white placeholder-zinc-500 focus:outline-hidden focus:border-amber-500"
                />
              </div>
            </div>

            {/* 6. Big Submit Trade Button */}
            <button
              type="submit"
              id="btn-terminal-submit-trade"
              disabled={isSubmitting}
              className="w-full min-h-[48px] px-4 py-3.5 sm:py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 disabled:opacity-50 text-zinc-950 font-black text-sm sm:text-base shadow-xl shadow-amber-950/50 transition-all flex items-center justify-center gap-2 cursor-pointer text-center"
            >
              <ArrowLeftRight className="w-5 h-5 text-zinc-950 shrink-0" />
              <span className="truncate">
                {isSubmitting
                  ? 'Logging Trade-In...'
                  : `Log Cards Trade (${formatCurrency(parseFloat(tradeValue) || 0)})`}
              </span>
            </button>
          </form>
        </div>
        )}
      </main>

      {/* Footer Info */}
      <footer className="py-4 border-t border-zinc-900 text-center text-xs text-zinc-500">
        <span>Locked POS Mode • Sales &amp; trade-ins sync live across all store devices</span>
      </footer>

      {/* Manager Passcode Modal */}
      <PasscodeModal
        isOpen={isPasscodeModalOpen}
        onClose={() => setIsPasscodeModalOpen(false)}
        title="Manager Sign In"
        subtitle="Enter authorization code to unlock the full app experience."
      />
    </div>
  );
};
