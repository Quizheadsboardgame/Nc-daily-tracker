import React, { useState, useRef, useEffect } from 'react';
import {
  Lock,
  KeyRound,
  Database,
  PlusCircle,
  Tag,
  Banknote,
  CreditCard,
  ArrowLeftRight,
  CheckCircle2,
  AlertCircle,
  Calendar,
  ChevronDown,
  X,
  Search,
  Plus,
  Volume2,
  VolumeX,
  Ticket,
  User,
  ShoppingCart,
  Trash2,
  Split,
} from 'lucide-react';
import { PaymentMethod, TradeType, BasketItemInput, SplitPaymentBreakdown } from '../types';
import {
  cloudDb,
  formatCurrency,
  getLocalDateKey,
  formatDisplayDate,
  isConnorVendor,
  isValidFourDigitItemNumber,
} from '../db/cloudDatabase';
import { PasscodeModal } from './PasscodeModal';
import { playSaleBeep, useCheckoutSound, useAudioUnlockStatus, testMarioSound } from '../utils/sound';

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
  const [itemDescription, setItemDescription] = useState<string>('Miscellaneous');
  const [isMiscellaneous, setIsMiscellaneous] = useState<boolean>(true);
  const [amount, setAmount] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<PaymentMethod | 'split'>('card');
  const [splitAmounts, setSplitAmounts] = useState<{
    cash: string;
    card: string;
    online: string;
    traded_out: string;
  }>({ cash: '', card: '', online: '', traded_out: '' });
  const [basketItems, setBasketItems] = useState<BasketItemInput[]>([]);

  // Trade-In form states
  const [tradeVendor, setTradeVendor] = useState<string>('');
  const [tradeItemDescription, setTradeItemDescription] = useState<string>('');
  const [tradeValue, setTradeValue] = useState<string>('');
  const [tradeType, setTradeType] = useState<TradeType>('credit');
  const [tradeCustomerName, setTradeCustomerName] = useState<string>('');
  const [tradeCustomerPhone, setTradeCustomerPhone] = useState<string>('');
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
    methodLabel: string;
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
  const tradeItemInputRef = useRef<HTMLInputElement>(null);

  // Filter vendors by search
  const filteredVendors = knownVendors.filter((v) =>
    v.toLowerCase().includes(vendorSearch.toLowerCase().trim())
  );
  const filteredTradeVendors = knownVendors.filter((v) =>
    v.toLowerCase().includes(tradeVendorSearch.toLowerCase().trim())
  );

  const [frequentVendors, setFrequentVendors] = useState<string[]>(
    () => cloudDb.getFrequentVendors(3)
  );

  useEffect(() => {
    const syncDbState = () => {
      setFrequentVendors(cloudDb.getFrequentVendors(3));
    };
    syncDbState();
    return cloudDb.subscribe(syncDbState);
  }, [knownVendors]);

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

  const handleToggleMisc = (checked: boolean) => {
    if (isConnorVendor(selectedVendor)) {
      setIsMiscellaneous(false);
      return;
    }
    setIsMiscellaneous(checked);
    if (checked) {
      setItemDescription('Miscellaneous');
      setTimeout(() => amountInputRef.current?.focus(), 50);
    } else {
      if (itemDescription === 'Miscellaneous') {
        setItemDescription('');
      }
      setTimeout(() => itemInputRef.current?.focus(), 50);
    }
  };

  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newVendorName.trim();
    if (!clean) return;

    await cloudDb.addVendor(clean);
    setNewVendorName('');
    setIsAddingVendor(false);
    handleSelectVendor(clean);
  };

  const basketSubtotal = Math.round(basketItems.reduce((sum, i) => sum + i.amount, 0) * 100) / 100;
  const currentFieldAmount = parseFloat(amount) || 0;
  const checkoutTargetTotal = basketItems.length > 0 ? basketSubtotal : currentFieldAmount;

  const splitSum = (() => {
    const c = parseFloat(splitAmounts.cash) || 0;
    const d = parseFloat(splitAmounts.card) || 0;
    const o = parseFloat(splitAmounts.online) || 0;
    const t = parseFloat(splitAmounts.traded_out) || 0;
    return Math.round((c + d + o + t) * 100) / 100;
  })();

  const splitRemaining = Math.round((checkoutTargetTotal - splitSum) * 100) / 100;
  const isSplitBalanced = Math.abs(splitRemaining) < 0.005 && checkoutTargetTotal > 0;

  const isConnorSelected = isConnorVendor(selectedVendor);
  const isConnorCodeValid = isValidFourDigitItemNumber(itemDescription);

  const handleSelectVendor = (vendor: string) => {
    setSelectedVendor(vendor);
    setIsVendorDropdownOpen(false);
    setVendorSearch('');
    setFormError(null);

    if (isConnorVendor(vendor)) {
      setIsMiscellaneous(false);
      if (!isValidFourDigitItemNumber(itemDescription)) {
        setItemDescription('');
      }
      setTimeout(() => itemInputRef.current?.focus(), 50);
      return;
    }

    setTimeout(() => {
      if (isMiscellaneous || itemDescription.trim()) {
        amountInputRef.current?.focus();
      } else {
        itemInputRef.current?.focus();
      }
    }, 50);
  };

  const handleAddToBasket = () => {
    setFormError(null);

    if (!selectedVendor.trim()) {
      setFormError('Please select a vendor before adding to basket.');
      return;
    }

    if (isConnorVendor(selectedVendor)) {
      if (isMiscellaneous || !isValidFourDigitItemNumber(itemDescription)) {
        playSaleBeep(false);
        setFormError('For Connor, Miscellaneous cannot be used — enter a 4-digit number (e.g. 1234).');
        return;
      }
    }

    const finalItemDesc = !isConnorVendor(selectedVendor) && isMiscellaneous ? 'Miscellaneous' : itemDescription.trim();
    if (!finalItemDesc) {
      setFormError('Please enter an item description or tick Miscellaneous.');
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError('Please enter a valid amount greater than £0.00.');
      return;
    }

    const newItem: BasketItemInput = {
      id: 'bkt_' + Math.random().toString(36).substring(2, 9),
      salesmanName: selectedVendor.trim(),
      itemDescription: finalItemDesc,
      isMiscellaneous: !isConnorVendor(selectedVendor) && isMiscellaneous,
      amount: Math.round(parsedAmount * 100) / 100,
    };

    setBasketItems((prev) => [...prev, newItem]);
    if (!isMiscellaneous || isConnorVendor(selectedVendor)) setItemDescription('');
    setAmount('');

    setTimeout(() => {
      if (!isConnorVendor(selectedVendor) && isMiscellaneous) amountInputRef.current?.focus();
      else itemInputRef.current?.focus();
    }, 50);
  };

  const handleRemoveBasketItem = (id: string) => {
    setBasketItems((prev) => prev.filter((item) => item.id !== id));
    setFormError(null);
  };

  const handleFillRemainder = (target: PaymentMethod) => {
    const currentOther =
      (target === 'cash' ? 0 : parseFloat(splitAmounts.cash) || 0) +
      (target === 'card' ? 0 : parseFloat(splitAmounts.card) || 0) +
      (target === 'online' ? 0 : parseFloat(splitAmounts.online) || 0) +
      (target === 'traded_out' ? 0 : parseFloat(splitAmounts.traded_out) || 0);
    const rem = Math.max(0, Math.round((checkoutTargetTotal - currentOther) * 100) / 100);
    setSplitAmounts((prev) => ({
      ...prev,
      [target]: rem > 0 ? rem.toFixed(2) : '',
    }));
    setFormError(null);
  };

  const handleSubmitSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    let itemsToCheckout: BasketItemInput[] = [...basketItems];

    if (itemsToCheckout.length === 0) {
      if (!selectedVendor.trim()) {
        setFormError('Please select a vendor.');
        return;
      }

      if (isConnorVendor(selectedVendor)) {
        if (isMiscellaneous || !isValidFourDigitItemNumber(itemDescription)) {
          playSaleBeep(false);
          setFormError('For Connor, Miscellaneous cannot be used — enter a 4-digit number (e.g. 1234).');
          return;
        }
      }

      const finalItemDesc = !isConnorVendor(selectedVendor) && isMiscellaneous ? 'Miscellaneous' : itemDescription.trim();
      if (!finalItemDesc) {
        setFormError('Please enter an item description or tick Miscellaneous.');
        return;
      }

      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        setFormError('Please enter a valid amount greater than £0.00.');
        return;
      }

      itemsToCheckout = [
        {
          id: 'single_' + Date.now(),
          salesmanName: selectedVendor.trim(),
          itemDescription: finalItemDesc,
          isMiscellaneous: !isConnorVendor(selectedVendor) && isMiscellaneous,
          amount: Math.round(parsedAmount * 100) / 100,
        },
      ];
    }

    const totalVal = Math.round(itemsToCheckout.reduce((s, i) => s + i.amount, 0) * 100) / 100;

    let payments: SplitPaymentBreakdown;
    if (paymentMode === 'split') {
      const c = Math.max(0, Math.round((parseFloat(splitAmounts.cash) || 0) * 100) / 100);
      const d = Math.max(0, Math.round((parseFloat(splitAmounts.card) || 0) * 100) / 100);
      const o = Math.max(0, Math.round((parseFloat(splitAmounts.online) || 0) * 100) / 100);
      const t = Math.max(0, Math.round((parseFloat(splitAmounts.traded_out) || 0) * 100) / 100);
      const enteredSum = Math.round((c + d + o + t) * 100) / 100;

      if (Math.abs(enteredSum - totalVal) >= 0.005) {
        playSaleBeep(false);
        setFormError(
          `Split payment amounts (£${enteredSum.toFixed(2)}) must equal the checkout total (£${totalVal.toFixed(2)}).`
        );
        return;
      }
      payments = { cash: c, card: d, online: o, traded_out: t };
    } else {
      payments = { [paymentMode]: totalVal };
    }

    setIsSubmitting(true);
    try {
      const isSinglePurePayment = itemsToCheckout.length === 1 && paymentMode !== 'split';

      if (isSinglePurePayment) {
        await cloudDb.insertSale({
          salesmanName: itemsToCheckout[0].salesmanName,
          itemDescription: itemsToCheckout[0].itemDescription,
          isMiscellaneous: itemsToCheckout[0].isMiscellaneous,
          amount: itemsToCheckout[0].amount,
          paymentMethod: paymentMode as PaymentMethod,
          dateKey: currentDateKey,
        });
      } else {
        await cloudDb.insertBasketCheckout({
          items: itemsToCheckout,
          payments,
          dateKey: currentDateKey,
        });
      }

      const uniqueVendors = Array.from(new Set(itemsToCheckout.map((i) => i.salesmanName)));
      const methodLabel =
        paymentMode === 'split'
          ? 'SPLIT PAYMENT'
          : paymentMode === 'cash'
          ? 'CASH'
          : paymentMode === 'card'
          ? 'CARD'
          : paymentMode === 'traded_out'
          ? 'TRADE OUT'
          : 'ONLINE';

      setSuccessNotice({
        vendor: uniqueVendors.join(' & '),
        item:
          itemsToCheckout.length > 1
            ? `Basket (${itemsToCheckout.length} items): ${itemsToCheckout[0].itemDescription} + ${itemsToCheckout.length - 1} more`
            : itemsToCheckout[0].itemDescription,
        amount: totalVal,
        methodLabel,
      });

      setBasketItems([]);
      if (isConnorVendor(selectedVendor)) {
        setIsMiscellaneous(false);
        setItemDescription('');
      } else {
        setIsMiscellaneous(true);
        setItemDescription('Miscellaneous');
      }
      setAmount('');
      setSplitAmounts({ cash: '', card: '', online: '', traded_out: '' });
      if (paymentMode === 'split') setPaymentMode('card');

      onSaleRecorded?.();

      setTimeout(() => {
        setSuccessNotice(null);
      }, 5000);

      setTimeout(() => {
        if (isConnorVendor(selectedVendor)) {
          itemInputRef.current?.focus();
        } else {
          amountInputRef.current?.focus();
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
        customerPhone: tradeCustomerPhone.trim() || undefined,
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
      setTradeCustomerPhone('');
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
              <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-gradient-to-br from-emerald-500/35 to-teal-500/25 border border-emerald-400/70 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
                <Database className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-300" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-sm sm:text-lg font-black tracking-tight text-white truncate">
                    Daily Sales Tracker
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black bg-amber-400 text-zinc-950 shadow-sm shadow-amber-500/30 whitespace-nowrap shrink-0">
                    <Lock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-zinc-950" />
                    <span className="sm:hidden">Locked</span>
                    <span className="hidden sm:inline">Register Terminal (Locked)</span>
                  </span>
                </div>
                <p className="hidden sm:block text-[11px] text-zinc-300 font-medium">
                  Fast counter sale entry • Ledger information &amp; reports hidden
                </p>
              </div>
            </div>

            <div className="flex sm:hidden items-center gap-1 text-[11px] text-cyan-300 font-bold shrink-0 whitespace-nowrap">
              <Calendar className="w-3 h-3 text-cyan-400" />
              <span>{currentDateKey}</span>
            </div>
          </div>

          {/* Right Status & Log In Action */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:justify-end">
            <div className="hidden md:flex items-center gap-2 text-xs text-cyan-200 font-semibold whitespace-nowrap">
              <Calendar className="w-3.5 h-3.5 text-cyan-400" />
              <span>{formatDisplayDate(currentDateKey)}</span>
            </div>

            {/* Audio Unlock Warning / Prompt if device browser blocked audio */}
            {!isAudioActive && soundEnabled && (
              <button
                type="button"
                id="btn-pos-activate-audio"
                onClick={unlockAudio}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 min-h-[40px] text-xs font-black rounded-xl bg-amber-400 text-zinc-950 border border-amber-200 hover:bg-amber-300 transition animate-pulse cursor-pointer shadow-lg shadow-amber-500/30 whitespace-nowrap"
                title="Browser requires 1 tap to allow sound on this device. Click to activate!"
              >
                <Volume2 className="w-3.5 h-3.5 text-zinc-950 shrink-0" />
                <span>Tap to Enable Sound</span>
              </button>
            )}

            {/* Checkout Sound Effect Toggle */}
            <button
              type="button"
              id="btn-pos-sound-toggle"
              onClick={toggleSound}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 min-h-[40px] text-xs font-extrabold rounded-xl border transition-all cursor-pointer shadow-sm whitespace-nowrap ${
                soundEnabled
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 hover:bg-emerald-500/30 shadow-emerald-500/15'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white'
              }`}
              title={soundEnabled ? 'Checkout sound is ON (click to mute)' : 'Checkout sound is OFF (click to turn on)'}
              aria-label="Toggle checkout chime sound"
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-4 h-4 text-emerald-300 shrink-0" />
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
                className="inline-flex items-center justify-center gap-1 px-3 min-h-[40px] text-xs font-extrabold rounded-xl border border-cyan-400/60 bg-cyan-500/20 text-cyan-200 hover:text-white hover:bg-cyan-500/30 transition cursor-pointer whitespace-nowrap shrink-0"
                title="Test Mario Coin sound effect on this device"
              >
                <span>Test 🪙</span>
              </button>
            )}

            <button
              type="button"
              id="btn-login-full-experience"
              onClick={() => setIsPasscodeModalOpen(true)}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 min-h-[40px] text-xs font-black text-zinc-950 bg-gradient-to-r from-emerald-400 via-green-400 to-lime-400 hover:from-emerald-300 hover:to-lime-300 active:scale-98 rounded-xl shadow-lg shadow-emerald-500/30 transition-all cursor-pointer whitespace-nowrap"
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
                ? 'bg-gradient-to-r from-emerald-400 to-green-400 text-zinc-950 shadow-lg shadow-emerald-500/30'
                : 'text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/15 border border-emerald-500/25'
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
                ? 'bg-gradient-to-r from-amber-400 to-orange-400 text-zinc-950 shadow-lg shadow-amber-500/30'
                : 'text-amber-300 hover:text-amber-200 hover:bg-amber-500/15 border border-amber-500/25'
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
                {successNotice.methodLabel}
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

              {/* 1-Tap Top 3 Vendor Quick Buttons (Full width matching dropdown) */}
              {frequentVendors.length > 0 && (
                <div
                  className={`grid gap-2 w-full mb-2.5 ${
                    frequentVendors.length === 1
                      ? 'grid-cols-1'
                      : frequentVendors.length === 2
                      ? 'grid-cols-2'
                      : 'grid-cols-3'
                  }`}
                  aria-label="Top 3 frequent vendors"
                >
                  {frequentVendors.map((vendor) => {
                    const isSelected = selectedVendor.toLowerCase() === vendor.toLowerCase();
                    const color = cloudDb.getVendorColor(vendor);
                    return (
                      <button
                        key={vendor}
                        type="button"
                        id={`btn-pos-vendor-quick-${vendor.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                        onClick={() => handleSelectVendor(vendor)}
                        className={`min-w-0 min-h-[40px] px-2.5 py-1.5 rounded-xl border-2 text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-white text-zinc-950 border-emerald-400 ring-2 ring-emerald-400/50 shadow-md'
                            : 'bg-zinc-950/90 text-zinc-100 border-zinc-700 hover:border-emerald-400/70 hover:bg-zinc-800'
                        }`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-white/40 shadow-2xs"
                          style={{ backgroundColor: color }}
                        />
                        <span className="truncate">{vendor}</span>
                      </button>
                    );
                  })}
                </div>
              )}

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
                          onClick={() => handleSelectVendor(vendor)}
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

            {/* 2. Item Description & Misc Toggle */}
            <div>
              <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-300">
                  <span>{isConnorSelected ? '4-Digit Item Number' : 'Item Description'}</span>
                  <span className="text-emerald-400">*</span>
                  {isConnorSelected && (
                    <span className="text-[10px] font-black normal-case tracking-normal px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-200 border border-rose-400/60">
                      Connor: 4 digits required
                    </span>
                  )}
                </label>
                <label
                  title={
                    isConnorSelected
                      ? 'Miscellaneous cannot be used when Connor is selected — enter a 4-digit number'
                      : 'Tick to record as Miscellaneous'
                  }
                  className={`flex items-center gap-1.5 text-xs font-semibold select-none ${
                    isConnorSelected
                      ? 'text-zinc-500 cursor-not-allowed line-through opacity-70'
                      : 'text-zinc-300 cursor-pointer'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isConnorSelected ? false : isMiscellaneous}
                    disabled={isConnorSelected}
                    onChange={(e) => {
                      if (isConnorSelected) return;
                      handleToggleMisc(e.target.checked);
                    }}
                    className="w-4 h-4 rounded-md border-zinc-700 bg-zinc-950 text-emerald-500 focus:ring-emerald-500 cursor-pointer disabled:cursor-not-allowed"
                  />
                  <span>Miscellaneous Sale</span>
                </label>
              </div>

              <div className="relative">
                <Tag className="w-4 h-4 absolute left-3.5 top-3.5 text-zinc-500 pointer-events-none" />
                <input
                  ref={itemInputRef}
                  type="text"
                  inputMode={isConnorSelected ? 'numeric' : undefined}
                  maxLength={isConnorSelected ? 4 : undefined}
                  pattern={isConnorSelected ? '[0-9]{4}' : undefined}
                  disabled={!isConnorSelected && isMiscellaneous}
                  value={itemDescription}
                  onChange={(e) => {
                    const nextVal = isConnorSelected
                      ? e.target.value.replace(/\D/g, '').slice(0, 4)
                      : e.target.value;
                    setItemDescription(nextVal);
                    if (formError) setFormError(null);
                  }}
                  placeholder={
                    isConnorSelected
                      ? 'Enter 4-digit number (e.g. 1234)'
                      : isMiscellaneous
                      ? 'Miscellaneous'
                      : 'e.g. Charizard Base Set, Boosters, Slab...'
                  }
                  className={`w-full pl-10 ${isConnorSelected ? 'pr-20 font-mono tracking-widest' : 'pr-4'} py-3 text-sm font-bold rounded-2xl border transition-all ${
                    !isConnorSelected && isMiscellaneous
                      ? 'bg-zinc-800 text-zinc-400 border-zinc-700 cursor-not-allowed'
                      : isConnorSelected && isConnorCodeValid
                      ? 'bg-zinc-950 border-emerald-400 text-white placeholder-zinc-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500'
                      : 'bg-zinc-950 border-zinc-700 text-white placeholder-zinc-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500'
                  }`}
                />
                {isConnorSelected && (
                  <span
                    className={`absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-black px-2 py-0.5 rounded-lg tabular-nums border ${
                      isConnorCodeValid
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/60'
                        : 'bg-amber-500/20 text-amber-200 border-amber-400/60'
                    }`}
                  >
                    {itemDescription.trim().length}/4{isConnorCodeValid ? ' ✓' : ''}
                  </span>
                )}
              </div>
            </div>

            {/* 3. Sale Amount (£) + Add to Basket */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
                Sale Amount (£) <span className="text-emerald-400">*</span>
              </label>
              <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
                <div className="relative flex-1 min-w-0">
                  <span className="absolute left-4 top-3.5 text-xl font-black text-emerald-400 pointer-events-none">
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

                <button
                  type="button"
                  id="btn-pos-add-to-basket"
                  onClick={handleAddToBasket}
                  className="min-h-[48px] px-4 py-3 rounded-2xl bg-indigo-500 hover:bg-indigo-400 border border-indigo-300 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 shadow-lg shadow-indigo-500/30"
                  title="Add item to multi-item basket before checkout"
                >
                  <ShoppingCart className="w-4 h-4 text-white shrink-0" />
                  <span>+ Add to Basket</span>
                </button>
              </div>
            </div>

            {/* Multi-Item Basket Card (POS Terminal) */}
            {basketItems.length > 0 && (
              <div
                id="panel-pos-basket"
                className="rounded-2xl bg-indigo-950/40 border border-indigo-500/50 p-3.5 sm:p-4 space-y-3 animate-fade-in"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span className="text-xs font-black uppercase tracking-wider text-indigo-200">
                      Customer Basket ({basketItems.length} {basketItems.length === 1 ? 'item' : 'items'})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-white tabular-nums bg-zinc-950 px-2.5 py-1 rounded-lg border border-indigo-500/40">
                      {formatCurrency(basketSubtotal)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setBasketItems([])}
                      className="text-xs font-bold text-rose-400 hover:text-rose-300 px-2 py-1 cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-zinc-800 bg-zinc-950/90 rounded-xl border border-zinc-800 overflow-hidden">
                  {basketItems.map((item, idx) => (
                    <div key={item.id} className="px-3 py-2.5 flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-bold text-zinc-500">#{idx + 1}</span>
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: cloudDb.getVendorColor(item.salesmanName) }}
                        />
                        <span className="font-bold text-white shrink-0">{item.salesmanName}</span>
                        <span className="text-zinc-600">•</span>
                        <span className="text-zinc-300 truncate">{item.itemDescription}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-black text-emerald-300 tabular-nums">
                          {formatCurrency(item.amount)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveBasketItem(item.id)}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-zinc-900 cursor-pointer"
                          aria-label={`Remove ${item.itemDescription}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Payment Method Selection (Cash, Card, Online, Trade Out, Split) */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-200 mb-2">
                Payment Method <span className="text-emerald-400">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <button
                  type="button"
                  id="btn-pos-method-cash"
                  onClick={() => setPaymentMode('cash')}
                  className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                    paymentMode === 'cash'
                      ? 'bg-gradient-to-br from-emerald-400 to-green-500 border-emerald-200 ring-2 ring-emerald-400/40 text-zinc-950 shadow-lg shadow-emerald-500/35'
                      : 'bg-emerald-500/15 border-emerald-400/60 text-emerald-100 hover:bg-emerald-500/25 hover:border-emerald-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider">Cash</span>
                    <Banknote className={`w-4 h-4 ${paymentMode === 'cash' ? 'text-zinc-950' : 'text-emerald-300'}`} />
                  </div>
                  <span className={`text-[10px] font-bold ${paymentMode === 'cash' ? 'text-zinc-900' : 'text-emerald-300'}`}>Till / Notes</span>
                </button>

                <button
                  type="button"
                  id="btn-pos-method-card"
                  onClick={() => setPaymentMode('card')}
                  className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                    paymentMode === 'card'
                      ? 'bg-gradient-to-br from-sky-400 to-blue-500 border-sky-200 ring-2 ring-sky-400/40 text-zinc-950 shadow-lg shadow-sky-500/35'
                      : 'bg-sky-500/15 border-sky-400/60 text-sky-100 hover:bg-sky-500/25 hover:border-sky-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider">Card</span>
                    <CreditCard className={`w-4 h-4 ${paymentMode === 'card' ? 'text-zinc-950' : 'text-sky-300'}`} />
                  </div>
                  <span className={`text-[10px] font-bold ${paymentMode === 'card' ? 'text-zinc-900' : 'text-sky-300'}`}>PDQ / Reader</span>
                </button>

                <button
                  type="button"
                  id="btn-pos-method-traded-out"
                  onClick={() => setPaymentMode('traded_out')}
                  className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                    paymentMode === 'traded_out'
                      ? 'bg-gradient-to-br from-amber-400 to-orange-500 border-amber-200 ring-2 ring-amber-400/40 text-zinc-950 shadow-lg shadow-amber-500/35'
                      : 'bg-amber-500/15 border-amber-400/60 text-amber-100 hover:bg-amber-500/25 hover:border-amber-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider">Trade Out</span>
                    <ArrowLeftRight className={`w-4 h-4 ${paymentMode === 'traded_out' ? 'text-zinc-950' : 'text-amber-300'}`} />
                  </div>
                  <span className={`text-[10px] font-bold ${paymentMode === 'traded_out' ? 'text-zinc-900' : 'text-amber-300'}`}>Card deal trade</span>
                </button>

                <button
                  type="button"
                  id="btn-pos-method-split"
                  onClick={() => setPaymentMode('split')}
                  className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                    paymentMode === 'split'
                      ? 'bg-gradient-to-br from-cyan-400 to-teal-400 border-cyan-200 ring-2 ring-cyan-400/40 text-zinc-950 shadow-lg shadow-cyan-500/35'
                      : 'bg-cyan-500/15 border-cyan-400/60 text-cyan-100 hover:bg-cyan-500/25 hover:border-cyan-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider">Split Pay</span>
                    <Split className={`w-4 h-4 ${paymentMode === 'split' ? 'text-zinc-950' : 'text-cyan-300'}`} />
                  </div>
                  <span className={`text-[10px] font-bold ${paymentMode === 'split' ? 'text-zinc-900' : 'text-cyan-300'}`}>Cash + Card mix</span>
                </button>
              </div>
            </div>

            {/* Split Payment Breakdown Box (POS Terminal) */}
            {paymentMode === 'split' && (
              <div
                id="panel-pos-split-payment"
                className="rounded-2xl bg-cyan-500/15 border border-cyan-400/60 p-3.5 sm:p-4 space-y-3 animate-fade-in"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-cyan-200">
                    <Split className="w-4 h-4 text-cyan-300" />
                    <span>Split Breakdown</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-cyan-100">
                      Target: <strong className="text-white tabular-nums">{formatCurrency(checkoutTargetTotal)}</strong>
                    </span>
                    {checkoutTargetTotal > 0 && (
                      <span
                        className={`px-2 py-0.5 rounded-md font-extrabold text-[11px] tabular-nums border ${
                          isSplitBalanced
                            ? 'bg-emerald-400 text-zinc-950 border-emerald-200'
                            : splitRemaining > 0
                            ? 'bg-amber-400 text-zinc-950 border-amber-200'
                            : 'bg-rose-500 text-white border-rose-300'
                        }`}
                      >
                        {isSplitBalanced
                          ? 'Balanced ✓'
                          : splitRemaining > 0
                          ? `Rem: ${formatCurrency(splitRemaining)}`
                          : `Over: ${formatCurrency(Math.abs(splitRemaining))}`}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {(
                    [
                      { key: 'cash', label: 'Cash (£)' },
                      { key: 'card', label: 'Card (£)' },
                      { key: 'traded_out', label: 'Trade Out (£)' },
                    ] as const
                  ).map(({ key, label }) => (
                    <div
                      key={key}
                      className="bg-zinc-950 rounded-xl border border-cyan-500/40 p-2.5 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <label className="text-[11px] font-bold text-zinc-200">
                          {label}
                        </label>
                        {checkoutTargetTotal > 0 && (
                          <button
                            type="button"
                            onClick={() => handleFillRemainder(key)}
                            className="text-[10px] font-extrabold text-zinc-950 bg-cyan-400 hover:bg-cyan-300 px-1.5 py-0.5 rounded cursor-pointer"
                          >
                            Rem
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <span className="absolute left-2.5 top-2 text-xs font-bold text-zinc-400 pointer-events-none">£</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={splitAmounts[key]}
                          onChange={(e) => setSplitAmounts((prev) => ({ ...prev, [key]: e.target.value }))}
                          placeholder="0.00"
                          className="w-full pl-6 pr-2 py-1.5 text-sm font-black tabular-nums rounded-lg border border-zinc-700 focus:border-cyan-400 bg-zinc-900 text-white focus:outline-hidden"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 5. Big Submit Button */}
            <button
              type="submit"
              id="btn-terminal-submit-sale"
              disabled={isSubmitting}
              className="w-full min-h-[48px] px-4 py-3.5 sm:py-4 rounded-2xl bg-gradient-to-r from-emerald-400 via-green-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 disabled:opacity-50 text-zinc-950 font-black text-sm sm:text-base shadow-xl shadow-emerald-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer text-center"
            >
              <PlusCircle className="w-5 h-5 text-zinc-950 shrink-0" />
              <span className="truncate">
                {isSubmitting
                  ? 'Adding to Ledger...'
                  : basketItems.length > 0
                  ? `Checkout Basket (${basketItems.length} items • ${formatCurrency(basketSubtotal)})`
                  : paymentMode === 'split'
                  ? `Record Split Sale (${formatCurrency(currentFieldAmount)})`
                  : `Record & Add (${formatCurrency(currentFieldAmount)})`}
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
          <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-400/60 flex items-start gap-2.5">
            <ArrowLeftRight className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-100 leading-relaxed">
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

              {/* 1-Tap Top 3 Vendor Quick Buttons (Trade-In, full width matching dropdown) */}
              {frequentVendors.length > 0 && (
                <div
                  className={`grid gap-2 w-full mb-2.5 ${
                    frequentVendors.length === 1
                      ? 'grid-cols-1'
                      : frequentVendors.length === 2
                      ? 'grid-cols-2'
                      : 'grid-cols-3'
                  }`}
                  aria-label="Top 3 frequent trade vendors"
                >
                  {frequentVendors.map((vendor) => {
                    const isSelected = tradeVendor.toLowerCase() === vendor.toLowerCase();
                    const color = cloudDb.getVendorColor(vendor);
                    return (
                      <button
                        key={`trade-${vendor}`}
                        type="button"
                        id={`btn-pos-trade-vendor-quick-${vendor.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                        onClick={() => {
                          setTradeVendor(vendor);
                          setIsTradeVendorDropdownOpen(false);
                          setFormError(null);
                          tradeItemInputRef.current?.focus();
                        }}
                        className={`min-w-0 min-h-[40px] px-2.5 py-1.5 rounded-xl border-2 text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-white text-zinc-950 border-amber-400 ring-2 ring-amber-400/50 shadow-md'
                            : 'bg-zinc-950/90 text-zinc-100 border-zinc-700 hover:border-amber-400/70 hover:bg-zinc-800'
                        }`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-white/40 shadow-2xs"
                          style={{ backgroundColor: color }}
                        />
                        <span className="truncate">{vendor}</span>
                      </button>
                    );
                  })}
                </div>
              )}

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
                      className="text-[11px] font-black px-2.5 py-1.5 sm:py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 text-amber-200 border border-amber-400/50 transition-colors cursor-pointer text-center"
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
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-200 mb-2">
                Cards Traded In For <span className="text-amber-400">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  id="btn-lockscreen-trade-cash"
                  onClick={() => setTradeType('cash')}
                  className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer flex items-center gap-3 ${
                    tradeType === 'cash'
                      ? 'bg-gradient-to-br from-emerald-400 to-green-500 border-emerald-200 ring-2 ring-emerald-400/40 text-zinc-950 shadow-lg shadow-emerald-500/30'
                      : 'bg-emerald-500/15 border-emerald-400/60 text-emerald-100 hover:bg-emerald-500/25 hover:border-emerald-300'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    tradeType === 'cash' ? 'bg-zinc-950 text-emerald-300' : 'bg-emerald-500/25 text-emerald-300'
                  }`}>
                    <Banknote className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="block text-sm font-black">Cash Payout</span>
                    <span className={`text-[11px] font-semibold ${tradeType === 'cash' ? 'text-zinc-900' : 'text-emerald-300'}`}>Cash paid out to customer</span>
                  </div>
                </button>

                <button
                  type="button"
                  id="btn-lockscreen-trade-credit"
                  onClick={() => setTradeType('credit')}
                  className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer flex items-center gap-3 ${
                    tradeType === 'credit'
                      ? 'bg-gradient-to-br from-fuchsia-500 to-purple-500 border-fuchsia-300 ring-2 ring-fuchsia-400/40 text-white shadow-lg shadow-fuchsia-500/30'
                      : 'bg-fuchsia-500/15 border-fuchsia-400/60 text-fuchsia-100 hover:bg-fuchsia-500/25 hover:border-fuchsia-300'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    tradeType === 'credit' ? 'bg-zinc-950 text-fuchsia-300' : 'bg-fuchsia-500/25 text-fuchsia-300'
                  }`}>
                    <Ticket className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="block text-sm font-black">Vendor&apos;s Credit</span>
                    <span className={`text-[11px] font-semibold ${tradeType === 'credit' ? 'text-fuchsia-100' : 'text-fuchsia-300'}`}>Store / vendor credit issued</span>
                  </div>
                </button>
              </div>
            </div>

            {/* 5. Customer Name (Linked to Store Credit) & Condition Memo */}
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                    Customer Name{' '}
                    <span className="text-zinc-500 font-normal">
                      {tradeType === 'credit' ? '(Saves Store Credit)' : '(Optional)'}
                    </span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3.5 top-2.5 text-zinc-500 pointer-events-none" />
                    <input
                      id="input-lockscreen-trade-customer"
                      type="text"
                      list="lockscreen-store-credit-customers"
                      value={tradeCustomerName}
                      onChange={(e) => setTradeCustomerName(e.target.value)}
                      placeholder="e.g. Alex, Sam..."
                      className="w-full pl-10 pr-3 py-2.5 text-xs rounded-xl border border-zinc-700 bg-zinc-950 text-white placeholder-zinc-500 focus:outline-hidden focus:border-amber-500"
                    />
                    <datalist id="lockscreen-store-credit-customers">
                      {cloudDb.getStoreCreditCustomers().map((c) => (
                        <option key={c.id} value={c.name} />
                      ))}
                    </datalist>
                  </div>
                </div>

                {tradeType === 'credit' ? (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Customer Phone / Handle <span className="text-zinc-500 font-normal">(Optional)</span>
                    </label>
                    <input
                      id="input-lockscreen-trade-phone"
                      type="text"
                      value={tradeCustomerPhone}
                      onChange={(e) => setTradeCustomerPhone(e.target.value)}
                      placeholder="e.g. 07700 900123 or @handle"
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-zinc-700 bg-zinc-950 text-white placeholder-zinc-500 focus:outline-hidden focus:border-purple-400"
                    />
                  </div>
                ) : (
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
                )}
              </div>

              {tradeType === 'credit' && (
                <>
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

                  {tradeCustomerName.trim() && (
                    <div className="px-3.5 py-2 rounded-xl bg-purple-950/60 border border-purple-500/40 text-xs text-purple-200 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Ticket className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        <span>
                          Store Credit for <strong className="text-white">{tradeCustomerName.trim()}</strong>
                          {(() => {
                            const existing = cloudDb.findStoreCreditCustomerByExactName(tradeCustomerName);
                            return existing
                              ? ` (Current balance: ${formatCurrency(existing.balance)})`
                              : ' (New customer account)';
                          })()}
                        </span>
                      </div>
                      {parseFloat(tradeValue) > 0 && (
                        <span className="font-black text-purple-300 tabular-nums">
                          +{formatCurrency(parseFloat(tradeValue))} credit
                        </span>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* 6. Big Submit Trade Button */}
            <button
              type="submit"
              id="btn-terminal-submit-trade"
              disabled={isSubmitting}
              className="w-full min-h-[48px] px-4 py-3.5 sm:py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 hover:from-amber-300 hover:to-orange-300 disabled:opacity-50 text-zinc-950 font-black text-sm sm:text-base shadow-xl shadow-amber-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer text-center"
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
