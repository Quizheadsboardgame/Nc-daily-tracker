import React, { useState, useRef } from 'react';
import { User, Tag, Banknote, CreditCard, ArrowLeftRight, CheckCircle2, Plus, Users, UserPlus, X } from 'lucide-react';
import { PaymentMethod } from '../types';
import { cloudDb } from '../db/cloudDatabase';

interface NewSaleFormProps {
  currentDateKey: string;
  knownVendors?: string[];
  knownSalesmen?: string[];
  onSubmitSale: (sale: {
    salesmanName: string;
    itemDescription: string;
    isMiscellaneous?: boolean;
    amount: number;
    paymentMethod: PaymentMethod;
    tradeDetails?: string;
    tradeAcceptingVendor?: string;
    tradeValue?: number;
    tradeItemDescription?: string;
    notes?: string;
  }) => void;
  onAddVendor?: (name: string) => void;
  onAddSalesman?: (name: string) => void;
  onOpenManageVendors?: () => void;
  onOpenManageSalesmen?: () => void;
  onNavigateToTrades?: () => void;
}

export const NewSaleForm: React.FC<NewSaleFormProps> = ({
  currentDateKey: _currentDateKey,
  knownVendors: propKnownVendors,
  knownSalesmen: propKnownSalesmen,
  onSubmitSale,
  onAddVendor,
  onAddSalesman,
  onOpenManageVendors,
  onOpenManageSalesmen,
  onNavigateToTrades,
}) => {
  const knownVendors = propKnownVendors || propKnownSalesmen || [];
  const handleAddVendor = onAddVendor || onAddSalesman;
  const handleOpenManageVendors = onOpenManageVendors || onOpenManageSalesmen;

  const [vendorName, setVendorName] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [isMiscellaneous, setIsMiscellaneous] = useState(false);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');

  // Trade-in specific state
  const [tradeAcceptingVendor, setTradeAcceptingVendor] = useState('');
  const [tradeValue, setTradeValue] = useState('');
  const [tradeItemDescription, setTradeItemDescription] = useState('');

  const [notes, setNotes] = useState('');
  const [showSuccessBadge, setShowSuccessBadge] = useState(false);
  const [lastRecordedInfo, setLastRecordedInfo] = useState('');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Inline Quick Add Vendor State
  const [isAddingInline, setIsAddingInline] = useState(false);
  const [inlineVendorName, setInlineVendorName] = useState('');

  const itemInputRef = useRef<HTMLInputElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);

  const handleToggleMisc = (checked: boolean) => {
    setIsMiscellaneous(checked);
    if (checked) {
      setItemDescription('Miscellaneous');
      if (errors.item) setErrors((prev) => ({ ...prev, item: '' }));
      // Conveniently focus the price input since item is filled
      setTimeout(() => {
        amountInputRef.current?.focus();
      }, 50);
    } else {
      if (itemDescription === 'Miscellaneous') {
        setItemDescription('');
      }
      setTimeout(() => {
        itemInputRef.current?.focus();
      }, 50);
    }
  };

  const validate = (): boolean => {
    const errs: { [key: string]: string } = {};

    if (!vendorName.trim()) {
      errs.vendor = 'Please select a vendor from the dropdown';
    }

    if (!isMiscellaneous && !itemDescription.trim()) {
      errs.item = 'Item description is required (or tick Miscellaneous)';
    }

    const numAmount = parseFloat(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      errs.amount = 'Valid sale amount greater than £0 is required';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const numAmount = parseFloat(amount);
    const finalTradeVal = parseFloat(tradeValue) || numAmount;
    const finalTradeVendor = tradeAcceptingVendor.trim() || vendorName.trim();
    const finalItemDesc = isMiscellaneous ? 'Miscellaneous' : itemDescription.trim();

    // Build human-readable trade details string if trade method
    let compiledTradeDetails: string | undefined = undefined;
    if (paymentMethod === 'trade') {
      const parts = [
        `Accepted by: ${finalTradeVendor}`,
        `Valuation: £${finalTradeVal.toFixed(2)}`,
      ];
      if (tradeItemDescription.trim()) {
        parts.push(`Item: ${tradeItemDescription.trim()}`);
      }
      compiledTradeDetails = parts.join(' • ');
    }

    onSubmitSale({
      salesmanName: vendorName.trim(),
      itemDescription: finalItemDesc,
      isMiscellaneous,
      amount: numAmount,
      paymentMethod,
      tradeDetails: compiledTradeDetails,
      tradeAcceptingVendor: paymentMethod === 'trade' ? finalTradeVendor : undefined,
      tradeValue: paymentMethod === 'trade' ? finalTradeVal : undefined,
      tradeItemDescription: paymentMethod === 'trade' && tradeItemDescription.trim() ? tradeItemDescription.trim() : undefined,
      notes: notes.trim() || undefined,
    });

    const recordedMsg = `£${numAmount.toFixed(2)} (${finalItemDesc}) by ${vendorName.trim()}`;
    setLastRecordedInfo(recordedMsg);
    setShowSuccessBadge(true);
    setTimeout(() => setShowSuccessBadge(false), 3500);

    // Reset item, amount, and trade fields while keeping vendor name for fast consecutive entries
    setIsMiscellaneous(false);
    setItemDescription('');
    setAmount('');
    setTradeAcceptingVendor('');
    setTradeValue('');
    setTradeItemDescription('');
    setNotes('');
    setErrors({});

    // Refocus item input
    setTimeout(() => {
      itemInputRef.current?.focus();
    }, 50);
  };

  const handleQuickAddAmount = (addValue: number) => {
    const current = parseFloat(amount) || 0;
    setAmount((current + addValue).toFixed(2));
    if (errors.amount) {
      setErrors((prev) => ({ ...prev, amount: '' }));
    }
  };

  const selectedVendorColor = vendorName.trim() ? cloudDb.getVendorColor(vendorName.trim()) : null;

  return (
    <div
      className="bg-white rounded-2xl border transition-all duration-300 overflow-hidden shadow-xs"
      id="card-new-sale-form"
      style={
        selectedVendorColor
          ? {
              borderColor: selectedVendorColor,
              borderWidth: '2px',
              boxShadow: `0 0 0 1px ${selectedVendorColor}33, 0 8px 24px -4px ${selectedVendorColor}25`,
            }
          : {
              borderColor: '#d4d4d8',
              borderWidth: '1px',
            }
      }
    >
      {/* Form Header */}
      <div
        className="px-5 py-4 border-b transition-all duration-300 flex items-center justify-between flex-wrap gap-2.5"
        style={
          selectedVendorColor
            ? {
                background: `linear-gradient(135deg, ${selectedVendorColor}18 0%, ${selectedVendorColor}08 100%)`,
                borderBottomColor: `${selectedVendorColor}35`,
              }
            : {
                background: 'linear-gradient(to right, #f4f4f5, #ffffff)',
                borderBottomColor: '#e4e4e7',
              }
        }
      >
        <div className="flex items-center gap-3">
          <div
            className="p-2.5 rounded-xl transition-all duration-300 shadow-2xs font-bold"
            style={
              selectedVendorColor
                ? { backgroundColor: selectedVendorColor, color: '#ffffff' }
                : { backgroundColor: '#18181b', color: '#34d399' }
            }
          >
            <Plus className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-zinc-950 tracking-tight">Record New Sale</h2>
              {selectedVendorColor && vendorName && (
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-black text-white shadow-2xs animate-fade-in"
                  style={{ backgroundColor: selectedVendorColor }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  <span>{vendorName}</span>
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 font-medium mt-0.5">
              {vendorName
                ? `Recording sale for ${vendorName} — box matched to vendor's color`
                : "Add transaction into today's memory ledger"}
            </p>
          </div>
        </div>

        {showSuccessBadge && (
          <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-black rounded-full shadow-2xs animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Recorded: {lastRecordedInfo}</span>
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="p-5 space-y-4.5 transition-all duration-300"
        id="form-record-sale"
        style={
          selectedVendorColor
            ? {
                background: `linear-gradient(180deg, ${selectedVendorColor}08 0%, transparent 60%)`,
              }
            : undefined
        }
      >
        {/* Vendor Name - Drop Down Box */}
        <div>
          <label htmlFor="select-vendor-name" className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 mb-1.5">
            Vendor's Name <span className="text-rose-500">*</span>
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                {selectedVendorColor ? (
                  <span
                    className="w-3.5 h-3.5 rounded-full inline-block border border-white shadow-2xs"
                    style={{ backgroundColor: selectedVendorColor }}
                  />
                ) : (
                  <User className="w-4 h-4 text-zinc-400" />
                )}
              </div>
              <select
                id="select-vendor-name"
                value={vendorName}
                onChange={(e) => {
                  setVendorName(e.target.value);
                  if (errors.vendor) setErrors((prev) => ({ ...prev, vendor: '' }));
                }}
                style={
                  selectedVendorColor
                    ? {
                        borderColor: selectedVendorColor,
                        borderWidth: '2px',
                        boxShadow: `0 0 0 1px ${selectedVendorColor}40`,
                      }
                    : undefined
                }
                className={`w-full pl-9 pr-8 py-2 text-sm rounded-lg border bg-white focus:outline-hidden focus:ring-2 transition-all cursor-pointer ${
                  errors.vendor
                    ? 'border-rose-400 focus:ring-rose-200 text-rose-900'
                    : selectedVendorColor
                    ? 'font-bold text-zinc-900'
                    : 'border-zinc-300 focus:border-zinc-900 focus:ring-zinc-900/10 text-zinc-900 font-medium'
                }`}
              >
                <option value="">-- Select Vendor --</option>
                {knownVendors.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
                {vendorName && !knownVendors.includes(vendorName) && (
                  <option value={vendorName}>{vendorName}</option>
                )}
              </select>
            </div>

            {/* Quick Add Inline Button */}
            {!isAddingInline && (
              <button
                type="button"
                onClick={() => setIsAddingInline(true)}
                className="inline-flex items-center gap-1 px-2.5 py-2 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 rounded-lg font-medium transition-colors cursor-pointer shrink-0"
                title="Quick add a new vendor to the cloud roster"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Add</span>
              </button>
            )}

            {/* Open Full Management Modal */}
            {handleOpenManageVendors && (
              <button
                type="button"
                onClick={handleOpenManageVendors}
                className="inline-flex items-center gap-1 px-2.5 py-2 text-xs text-zinc-600 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 rounded-lg font-medium transition-colors cursor-pointer shrink-0"
                title="Add or remove vendors from your saved roster"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Manage</span>
              </button>
            )}
          </div>
          {errors.vendor && <p className="text-xs text-rose-600 mt-1 font-medium">{errors.vendor}</p>}

          {/* Inline Quick Add Input */}
          {isAddingInline && (
            <div className="mt-2 flex items-center gap-1.5 p-2 bg-emerald-50/70 border border-emerald-200 rounded-lg animate-fade-in">
              <input
                type="text"
                value={inlineVendorName}
                onChange={(e) => setInlineVendorName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const clean = inlineVendorName.trim();
                    if (clean) {
                      if (handleAddVendor) handleAddVendor(clean);
                      setVendorName(clean);
                      setInlineVendorName('');
                      setIsAddingInline(false);
                      if (errors.vendor) setErrors((prev) => ({ ...prev, vendor: '' }));
                    }
                  } else if (e.key === 'Escape') {
                    setIsAddingInline(false);
                  }
                }}
                placeholder="Enter new vendor name..."
                autoFocus
                className="flex-1 px-2.5 py-1 text-xs bg-white border border-emerald-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-emerald-400 text-zinc-900"
              />
              <button
                type="button"
                onClick={() => {
                  const clean = inlineVendorName.trim();
                  if (clean) {
                    if (handleAddVendor) handleAddVendor(clean);
                    setVendorName(clean);
                    setInlineVendorName('');
                    setIsAddingInline(false);
                    if (errors.vendor) setErrors((prev) => ({ ...prev, vendor: '' }));
                  }
                }}
                className="px-2.5 py-1 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md cursor-pointer"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAddingInline(false);
                  setInlineVendorName('');
                }}
                className="p-1 text-zinc-400 hover:text-zinc-600 rounded-md cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Item Description & Sale Amount Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
          {/* What we sold */}
          <div className="md:col-span-7">
            <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
              <label htmlFor="input-item-sold" className="block text-xs font-semibold uppercase tracking-wider text-zinc-600">
                What We Sold {!isMiscellaneous && <span className="text-rose-500">*</span>}
              </label>

              {/* Miscellaneous tick box */}
              <label
                htmlFor="checkbox-misc-item"
                id="label-checkbox-misc"
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg border text-xs font-bold cursor-pointer select-none transition-all ${
                  isMiscellaneous
                    ? 'bg-amber-100 border-amber-300 text-amber-950 shadow-2xs'
                    : 'bg-zinc-100 hover:bg-zinc-200/80 border-zinc-200 text-zinc-700'
                }`}
                title="Tick to record a miscellaneous sale instead of typing an item description"
              >
                <input
                  type="checkbox"
                  id="checkbox-misc-item"
                  checked={isMiscellaneous}
                  onChange={(e) => handleToggleMisc(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-300 text-amber-600 focus:ring-amber-500 cursor-pointer accent-amber-600"
                />
                <span className="flex items-center gap-1">
                  Miscellaneous
                  {isMiscellaneous && <span className="text-[10px] text-amber-800 font-extrabold uppercase">(Ticked)</span>}
                </span>
              </label>
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                <Tag className="w-4 h-4" />
              </div>
              <input
                ref={itemInputRef}
                type="text"
                id="input-item-sold"
                value={isMiscellaneous ? 'Miscellaneous' : itemDescription}
                disabled={isMiscellaneous}
                onChange={(e) => {
                  setItemDescription(e.target.value);
                  if (errors.item) setErrors((prev) => ({ ...prev, item: '' }));
                }}
                placeholder={isMiscellaneous ? 'Miscellaneous item selected' : 'e.g. 18V Milwaukee Drill Kit, Gold Chain, etc.'}
                className={`w-full pl-9 pr-3 py-2 text-sm rounded-lg border transition-all ${
                  isMiscellaneous
                    ? 'bg-amber-50/70 border-amber-300 text-amber-950 font-semibold cursor-not-allowed italic shadow-inner'
                    : errors.item
                    ? 'border-rose-400 focus:ring-rose-200 text-rose-900 bg-white focus:outline-hidden focus:ring-2'
                    : 'border-zinc-300 focus:border-zinc-900 focus:ring-zinc-900/10 text-zinc-900 bg-white focus:outline-hidden focus:ring-2'
                }`}
              />
            </div>
            {isMiscellaneous ? (
              <p className="text-[11px] text-amber-800 font-medium mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Miscellaneous ticked instead of an item — enter price to record</span>
              </p>
            ) : errors.item ? (
              <p className="text-xs text-rose-600 mt-1 font-medium">{errors.item}</p>
            ) : null}
          </div>

          {/* How much for */}
          <div className="md:col-span-5">
            <label htmlFor="input-sale-amount" className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 mb-1.5">
              Price / Amount (£) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500 font-bold text-sm">
                £
              </div>
              <input
                ref={amountInputRef}
                type="number"
                id="input-sale-amount"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  if (errors.amount) setErrors((prev) => ({ ...prev, amount: '' }));
                }}
                placeholder="0.00"
                className={`w-full pl-8 pr-3 py-2 text-sm font-semibold rounded-lg border bg-white focus:outline-hidden focus:ring-2 transition-all ${
                  errors.amount
                    ? 'border-rose-400 focus:ring-rose-200 text-rose-900'
                    : 'border-zinc-300 focus:border-zinc-900 focus:ring-zinc-900/10 text-zinc-900'
                }`}
              />
            </div>
            {errors.amount && <p className="text-xs text-rose-600 mt-1 font-medium">{errors.amount}</p>}

            {/* Quick Increment Buttons */}
            <div className="flex items-center gap-1 mt-1.5">
              <span className="text-[10px] text-zinc-400 mr-0.5">Add:</span>
              {[20, 50, 100, 250].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleQuickAddAmount(val)}
                  className="px-1.5 py-0.5 text-[11px] font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded border border-zinc-200 transition-colors"
                >
                  +£{val}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Payment Method Selector: Cash, Card, Trade */}
        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-zinc-700 mb-2">
            Payment Method <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-3 gap-3" id="group-payment-methods">
            {/* Cash Option */}
            <button
              type="button"
              id="option-payment-cash"
              onClick={() => setPaymentMethod('cash')}
              className={`flex flex-col items-center justify-center p-3.5 rounded-xl border text-center transition-all cursor-pointer ${
                paymentMethod === 'cash'
                  ? 'border-emerald-600 bg-emerald-600 text-white ring-2 ring-emerald-600/30 shadow-sm font-black'
                  : 'border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700 hover:border-emerald-400 font-bold'
              }`}
            >
              <Banknote className={`w-5 h-5 mb-1.5 ${paymentMethod === 'cash' ? 'text-white' : 'text-emerald-700'}`} />
              <span className="text-xs font-black">Cash</span>
              <span className={`text-[10px] ${paymentMethod === 'cash' ? 'text-emerald-100 font-semibold' : 'text-zinc-500'}`}>Bills / Coins</span>
            </button>

            {/* Card Option */}
            <button
              type="button"
              id="option-payment-card"
              onClick={() => setPaymentMethod('card')}
              className={`flex flex-col items-center justify-center p-3.5 rounded-xl border text-center transition-all cursor-pointer ${
                paymentMethod === 'card'
                  ? 'border-blue-600 bg-blue-600 text-white ring-2 ring-blue-600/30 shadow-sm font-black'
                  : 'border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700 hover:border-blue-400 font-bold'
              }`}
            >
              <CreditCard className={`w-5 h-5 mb-1.5 ${paymentMethod === 'card' ? 'text-white' : 'text-blue-700'}`} />
              <span className="text-xs font-black">Card</span>
              <span className={`text-[10px] ${paymentMethod === 'card' ? 'text-blue-100 font-semibold' : 'text-zinc-500'}`}>Credit / Debit</span>
            </button>

            {/* Trade Option */}
            <button
              type="button"
              id="option-payment-trade"
              onClick={() => setPaymentMethod('trade')}
              className={`flex flex-col items-center justify-center p-3.5 rounded-xl border text-center transition-all cursor-pointer ${
                paymentMethod === 'trade'
                  ? 'border-amber-600 bg-amber-600 text-white ring-2 ring-amber-600/30 shadow-sm font-black'
                  : 'border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700 hover:border-amber-400 font-bold'
              }`}
            >
              <ArrowLeftRight className={`w-5 h-5 mb-1.5 ${paymentMethod === 'trade' ? 'text-white' : 'text-amber-700'}`} />
              <span className="text-xs font-black">Trade</span>
              <span className={`text-[10px] ${paymentMethod === 'trade' ? 'text-amber-100 font-semibold' : 'text-zinc-500'}`}>Item Exchange</span>
            </button>
          </div>
        </div>

        {/* Conditional Trade Notice & Link */}
        {paymentMethod === 'trade' && (
          <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-xl space-y-2.5 animate-fade-in" id="panel-trade-in-details">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2 text-amber-950">
                <ArrowLeftRight className="w-4 h-4 text-amber-700 shrink-0" />
                <span className="text-xs font-black uppercase tracking-wider">Trade Payment Selected</span>
              </div>

              {onNavigateToTrades && (
                <button
                  type="button"
                  id="btn-link-to-trades-tab"
                  onClick={onNavigateToTrades}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-950 bg-amber-200 hover:bg-amber-300 px-3 py-1 rounded-lg transition-colors cursor-pointer self-start sm:self-auto shadow-2xs"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 text-amber-800" />
                  <span>Open Trades Tab</span>
                </button>
              )}
            </div>

            <p className="text-xs text-amber-900 font-medium leading-relaxed">
              This sale will be logged as a <strong>Trade</strong>. Full trade-in valuations, customer records, and standalone trades are managed on the dedicated <strong>Trades</strong> page.
            </p>

            {/* Quick Traded In Item Memo (Optional) */}
            <div>
              <label htmlFor="input-trade-item" className="block text-xs font-semibold text-amber-950 mb-1">
                Traded Item Memo <span className="text-zinc-500 font-normal">(Optional — full details managed on Trades tab)</span>
              </label>
              <input
                type="text"
                id="input-trade-item"
                value={tradeItemDescription}
                onChange={(e) => setTradeItemDescription(e.target.value)}
                placeholder="e.g. 2018 Yamaha Acoustic Guitar, iPhone 12, Gold Ring..."
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-amber-300 bg-white focus:outline-hidden focus:ring-2 focus:border-amber-500 focus:ring-amber-500/20 text-zinc-900"
              />
            </div>
          </div>
        )}

        {/* Optional Notes */}
        <div>
          <label htmlFor="input-sale-notes" className="block text-xs font-medium text-zinc-500 mb-1">
            Optional Notes / Receipt Memo
          </label>
          <input
            type="text"
            id="input-sale-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Customer requested gift receipt or warranty #4892"
            className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 bg-white text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
          />
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            id="btn-submit-record-sale"
            style={
              selectedVendorColor
                ? {
                    backgroundColor: selectedVendorColor,
                    color: '#ffffff',
                    boxShadow: `0 4px 14px -2px ${selectedVendorColor}66`,
                  }
                : undefined
            }
            className={`w-full py-2.5 px-4 text-sm font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] ${
              selectedVendorColor
                ? 'hover:brightness-95'
                : 'bg-zinc-900 hover:bg-zinc-800 text-white'
            }`}
          >
            <Plus className={`w-4 h-4 ${selectedVendorColor ? 'text-white' : 'text-emerald-400'}`} />
            <span>
              {vendorName.trim()
                ? `Record Sale for ${vendorName.trim()}`
                : "Record Sale to Today's Database"}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
};
