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
} from 'lucide-react';
import { PaymentMethod, OnlineCard } from '../types';
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

  // Sale form states
  const [selectedVendor, setSelectedVendor] = useState<string>('');
  const [itemDescription, setItemDescription] = useState<string>('');
  const [isMiscellaneous, setIsMiscellaneous] = useState<boolean>(false);
  const [amount, setAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [notes, setNotes] = useState<string>('');
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  const [scannedCardInfo, setScannedCardInfo] = useState<OnlineCard | null>(null);

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

  // Searchable Vendor Dropdown state
  const [isVendorDropdownOpen, setIsVendorDropdownOpen] = useState(false);
  const [vendorSearch, setVendorSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Form input refs
  const itemInputRef = useRef<HTMLInputElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Filter vendors by search
  const filteredVendors = knownVendors.filter((v) =>
    v.toLowerCase().includes(vendorSearch.toLowerCase().trim())
  );

  // Close vendor dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsVendorDropdownOpen(false);
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

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col font-sans selection:bg-emerald-500 selection:text-zinc-950">
      {/* Top Bar - Minimal POS Terminal Header */}
      <header className="border-b border-zinc-800/80 bg-zinc-900/90 backdrop-blur-md sticky top-0 z-30 shadow-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          {/* Brand & Locked Badge */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700/80 text-white flex items-center justify-center shadow-inner shrink-0">
              <Database className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-white">
                  Daily Sales Tracker
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-950/80 text-amber-300 border border-amber-600/40">
                  <Lock className="w-3 h-3 text-amber-400" />
                  <span>Register Terminal (Locked)</span>
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 font-medium">
                Fast counter sale entry • Ledger information & reports hidden
              </p>
            </div>
          </div>

          {/* Right Status & Log In Action */}
          <div className="flex items-center gap-2.5">
            <div className="hidden md:flex items-center gap-2 text-xs text-zinc-400 font-medium">
              <Calendar className="w-3.5 h-3.5 text-zinc-400" />
              <span>{formatDisplayDate(currentDateKey)}</span>
            </div>

            {/* Audio Unlock Warning / Prompt if device browser blocked audio */}
            {!isAudioActive && soundEnabled && (
              <button
                type="button"
                id="btn-pos-activate-audio"
                onClick={unlockAudio}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-black rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/50 hover:bg-amber-500/30 transition animate-pulse cursor-pointer shadow-xs"
                title="Browser requires 1 tap to allow sound on this device. Click to activate!"
              >
                <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Tap to Enable Sound</span>
              </button>
            )}

            {/* Checkout Sound Effect Toggle */}
            <button
              type="button"
              id="btn-pos-sound-toggle"
              onClick={toggleSound}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer shadow-xs ${
                soundEnabled
                  ? 'bg-zinc-900 border-emerald-500/50 text-emerald-300 hover:bg-zinc-800'
                  : 'bg-zinc-900 border-zinc-750 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
              title={soundEnabled ? 'Checkout sound is ON (click to mute)' : 'Checkout sound is OFF (click to turn on)'}
              aria-label="Toggle checkout chime sound"
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                  <span>Sound: ON</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 text-zinc-400" />
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
                className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-bold rounded-xl border border-zinc-800 bg-zinc-900/90 text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
                title="Test Mario Coin sound effect on this device"
              >
                <span>Test 🪙</span>
              </button>
            )}

            <button
              type="button"
              id="btn-login-full-experience"
              onClick={() => setIsPasscodeModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-black text-zinc-950 bg-emerald-400 hover:bg-emerald-300 active:scale-98 rounded-xl shadow-md shadow-emerald-950/50 transition-all cursor-pointer"
              title="Enter passcode to unlock full dashboard and tabs"
            >
              <KeyRound className="w-4 h-4 text-zinc-950" />
              <span>Log In for Full Access</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Terminal Body */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-6 space-y-5">
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
                Every sale recorded here is automatically added to the sales ledger. Historical totals, tabs, and reports are hidden until a manager logs in.
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-950/70 text-emerald-300 border border-emerald-500/40 shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <Cloud className="w-3.5 h-3.5 text-emerald-400" />
            <span>Cloud Synced</span>
          </div>
        </div>

        {/* Success Notice Toast Banner */}
        {successNotice && (
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
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 sm:p-7 shadow-2xl relative overflow-hidden ring-1 ring-white/5">
          {/* Optional Barcode Quick-Scan Input */}
          <div className="mb-5 pb-5 border-b border-zinc-800">
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
              Scan Barcode or Enter Card Code <span className="text-zinc-500 font-normal">(Optional)</span>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Barcode className="w-5 h-5 absolute left-3.5 top-3 text-zinc-500 pointer-events-none" />
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
                  placeholder="Scan card barcode with gun (e.g. ONL-XXXXXX) or type code..."
                  className="w-full pl-11 pr-4 py-2.5 text-sm font-mono font-bold tracking-wider rounded-xl border border-zinc-700 bg-zinc-950 text-white placeholder-zinc-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <button
                type="button"
                onClick={() => handleBarcodeLookup()}
                disabled={!barcodeInput.trim()}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-white font-bold text-xs border border-zinc-700 transition-all cursor-pointer whitespace-nowrap"
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
                <div className="mt-2.5 p-3 rounded-2xl bg-zinc-950 border border-emerald-500/50 flex items-center gap-2 animate-fade-in">
                  <input
                    type="text"
                    value={newVendorName}
                    onChange={(e) => setNewVendorName(e.target.value)}
                    placeholder="New vendor name..."
                    className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-zinc-900 border border-zinc-700 text-white focus:outline-hidden focus:border-emerald-500"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleCreateVendor}
                    disabled={!newVendorName.trim()}
                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-zinc-950 font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingVendor(false);
                      setNewVendorName('');
                    }}
                    className="px-2 py-1.5 text-zinc-400 hover:text-white text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
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
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                    isMiscellaneous
                      ? 'bg-zinc-800 border-zinc-500 ring-2 ring-zinc-500/30 text-white shadow-sm'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black">Miscellaneous</span>
                    <Layers className="w-3.5 h-3.5 text-zinc-400" />
                  </div>
                  <span className="text-[10px] text-zinc-400 font-semibold">Any vendor</span>
                </button>

                {/* 2. Comics (Auto Kieron) */}
                <button
                  type="button"
                  id="btn-quick-cat-comics"
                  onClick={() => handleSelectQuickCategory('comics')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                    !isMiscellaneous && itemDescription.toLowerCase() === 'comics'
                      ? 'bg-emerald-950/80 border-emerald-500 ring-2 ring-emerald-500/30 text-white shadow-sm'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-emerald-500/50 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black">Comics</span>
                    <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-500/40 self-start">
                    Auto: Kieron
                  </span>
                </button>

                {/* 3. Accessories (Auto Newtons) */}
                <button
                  type="button"
                  id="btn-quick-cat-accessories"
                  onClick={() => handleSelectQuickCategory('accessories')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                    !isMiscellaneous && itemDescription.toLowerCase() === 'accessories'
                      ? 'bg-purple-950/80 border-purple-500 ring-2 ring-purple-500/30 text-white shadow-sm'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-purple-500/50 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black">Accessories</span>
                    <ShoppingBag className="w-3.5 h-3.5 text-purple-400" />
                  </div>
                  <span className="text-[10px] font-extrabold text-purple-300 bg-purple-950/80 px-1.5 py-0.5 rounded border border-purple-500/40 self-start">
                    Auto: Newtons
                  </span>
                </button>

                {/* 4. Packs (Any Vendor) */}
                <button
                  type="button"
                  id="btn-quick-cat-packs"
                  onClick={() => handleSelectQuickCategory('packs')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                    !isMiscellaneous && itemDescription.toLowerCase() === 'packs'
                      ? 'bg-blue-950/80 border-blue-500 ring-2 ring-blue-500/30 text-white shadow-sm'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-blue-500/50 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black">Packs</span>
                    <Boxes className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <span className="text-[10px] text-zinc-400 font-semibold">Any vendor</span>
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
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 disabled:opacity-50 text-zinc-950 font-black text-base shadow-xl shadow-emerald-950/50 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <PlusCircle className="w-5 h-5 text-zinc-950" />
              <span>
                {isSubmitting
                  ? 'Adding to Ledger...'
                  : `Record & Add to Ledger (${formatCurrency(parseFloat(amount) || 0)})`}
              </span>
            </button>
          </form>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="py-4 border-t border-zinc-900 text-center text-xs text-zinc-500">
        <span>Locked POS Mode • Sales sync live across all store devices</span>
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
