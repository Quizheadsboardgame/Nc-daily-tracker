import React, { useState, useRef } from 'react';
import { User, Tag, Banknote, CreditCard, ArrowLeftRight, CheckCircle2, Plus, Users, UserPlus, X } from 'lucide-react';
import { PaymentMethod } from '../types';

interface NewSaleFormProps {
  currentDateKey: string;
  knownVendors?: string[];
  knownSalesmen?: string[];
  onSubmitSale: (sale: {
    salesmanName: string;
    itemDescription: string;
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
}) => {
  const knownVendors = propKnownVendors || propKnownSalesmen || [];
  const handleAddVendor = onAddVendor || onAddSalesman;
  const handleOpenManageVendors = onOpenManageVendors || onOpenManageSalesmen;

  const [vendorName, setVendorName] = useState('');
  const [itemDescription, setItemDescription] = useState('');
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

  const validate = (): boolean => {
    const errs: { [key: string]: string } = {};

    if (!vendorName.trim()) {
      errs.vendor = 'Please select a vendor from the dropdown';
    }

    if (!itemDescription.trim()) {
      errs.item = 'Item description is required';
    }

    const numAmount = parseFloat(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      errs.amount = 'Valid sale amount greater than £0 is required';
    }

    if (paymentMethod === 'trade') {
      if (!tradeAcceptingVendor.trim()) {
        errs.tradeAcceptingVendor = 'Please select the vendor accepting the trade';
      }
      const numTradeValue = parseFloat(tradeValue);
      if (!tradeValue || isNaN(numTradeValue) || numTradeValue < 0) {
        errs.tradeValue = 'Please enter a valid trade-in value (£)';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const numAmount = parseFloat(amount);
    const numTradeValue = paymentMethod === 'trade' ? parseFloat(tradeValue) || 0 : undefined;

    // Build human-readable trade details string
    let compiledTradeDetails: string | undefined = undefined;
    if (paymentMethod === 'trade') {
      const parts = [
        `Accepted by: ${tradeAcceptingVendor.trim()}`,
        `Value: £${numTradeValue !== undefined ? numTradeValue.toFixed(2) : '0.00'}`,
      ];
      if (tradeItemDescription.trim()) {
        parts.push(`Item: ${tradeItemDescription.trim()}`);
      }
      compiledTradeDetails = parts.join(' • ');
    }

    onSubmitSale({
      salesmanName: vendorName.trim(),
      itemDescription: itemDescription.trim(),
      amount: numAmount,
      paymentMethod,
      tradeDetails: compiledTradeDetails,
      tradeAcceptingVendor: paymentMethod === 'trade' ? tradeAcceptingVendor.trim() : undefined,
      tradeValue: numTradeValue,
      tradeItemDescription: paymentMethod === 'trade' && tradeItemDescription.trim() ? tradeItemDescription.trim() : undefined,
      notes: notes.trim() || undefined,
    });

    const recordedMsg = `£${numAmount.toFixed(2)} (${itemDescription.trim()}) by ${vendorName.trim()}`;
    setLastRecordedInfo(recordedMsg);
    setShowSuccessBadge(true);
    setTimeout(() => setShowSuccessBadge(false), 3500);

    // Reset item, amount, and trade fields while keeping vendor name for fast consecutive entries
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

  return (
    <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-sm overflow-hidden" id="card-new-sale-form">
      {/* Form Header */}
      <div className="px-5 py-4 border-b border-zinc-100 bg-linear-to-r from-zinc-50 to-white flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800">
            <Plus className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-900">Record New Sale</h2>
            <p className="text-xs text-zinc-500">Add transaction into today's memory ledger</p>
          </div>
        </div>

        {showSuccessBadge && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-full animate-fade-in">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Recorded: {lastRecordedInfo}</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-4.5" id="form-record-sale">
        {/* Vendor Name - Drop Down Box */}
        <div>
          <label htmlFor="select-vendor-name" className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 mb-1.5">
            Vendor's Name <span className="text-rose-500">*</span>
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                <User className="w-4 h-4" />
              </div>
              <select
                id="select-vendor-name"
                value={vendorName}
                onChange={(e) => {
                  setVendorName(e.target.value);
                  if (errors.vendor) setErrors((prev) => ({ ...prev, vendor: '' }));
                }}
                className={`w-full pl-9 pr-8 py-2 text-sm rounded-lg border bg-white focus:outline-hidden focus:ring-2 transition-all cursor-pointer ${
                  errors.vendor
                    ? 'border-rose-400 focus:ring-rose-200 text-rose-900'
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
            <label htmlFor="input-item-sold" className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 mb-1.5">
              What We Sold (Item / Description) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                <Tag className="w-4 h-4" />
              </div>
              <input
                ref={itemInputRef}
                type="text"
                id="input-item-sold"
                value={itemDescription}
                onChange={(e) => {
                  setItemDescription(e.target.value);
                  if (errors.item) setErrors((prev) => ({ ...prev, item: '' }));
                }}
                placeholder="e.g. 18V Milwaukee Drill Kit, Gold Chain, etc."
                className={`w-full pl-9 pr-3 py-2 text-sm rounded-lg border bg-white focus:outline-hidden focus:ring-2 transition-all ${
                  errors.item
                    ? 'border-rose-400 focus:ring-rose-200 text-rose-900'
                    : 'border-zinc-300 focus:border-zinc-900 focus:ring-zinc-900/10 text-zinc-900'
                }`}
              />
            </div>
            {errors.item && <p className="text-xs text-rose-600 mt-1 font-medium">{errors.item}</p>}
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
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 mb-2">
            Payment Method <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-3 gap-2.5" id="group-payment-methods">
            {/* Cash Option */}
            <button
              type="button"
              id="option-payment-cash"
              onClick={() => setPaymentMethod('cash')}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                paymentMethod === 'cash'
                  ? 'border-emerald-600 bg-emerald-50/80 text-emerald-900 ring-2 ring-emerald-500/20 shadow-xs'
                  : 'border-zinc-200 bg-zinc-50 hover:bg-zinc-100/70 text-zinc-600'
              }`}
            >
              <Banknote className={`w-5 h-5 mb-1 ${paymentMethod === 'cash' ? 'text-emerald-700' : 'text-zinc-500'}`} />
              <span className="text-xs font-bold">Cash</span>
              <span className="text-[10px] text-zinc-500">Bills / Coins</span>
            </button>

            {/* Card Option */}
            <button
              type="button"
              id="option-payment-card"
              onClick={() => setPaymentMethod('card')}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                paymentMethod === 'card'
                  ? 'border-blue-600 bg-blue-50/80 text-blue-900 ring-2 ring-blue-500/20 shadow-xs'
                  : 'border-zinc-200 bg-zinc-50 hover:bg-zinc-100/70 text-zinc-600'
              }`}
            >
              <CreditCard className={`w-5 h-5 mb-1 ${paymentMethod === 'card' ? 'text-blue-700' : 'text-zinc-500'}`} />
              <span className="text-xs font-bold">Card</span>
              <span className="text-[10px] text-zinc-500">Credit / Debit</span>
            </button>

            {/* Trade Option */}
            <button
              type="button"
              id="option-payment-trade"
              onClick={() => setPaymentMethod('trade')}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                paymentMethod === 'trade'
                  ? 'border-amber-600 bg-amber-50/80 text-amber-900 ring-2 ring-amber-500/20 shadow-xs'
                  : 'border-zinc-200 bg-zinc-50 hover:bg-zinc-100/70 text-zinc-600'
              }`}
            >
              <ArrowLeftRight className={`w-5 h-5 mb-1 ${paymentMethod === 'trade' ? 'text-amber-700' : 'text-zinc-500'}`} />
              <span className="text-xs font-bold">Trade</span>
              <span className="text-[10px] text-zinc-500">Item Exchange</span>
            </button>
          </div>
        </div>

        {/* Conditional Trade Details Field */}
        {paymentMethod === 'trade' && (
          <div className="p-4 bg-amber-50/80 border border-amber-200/90 rounded-xl space-y-3 animate-fade-in" id="panel-trade-in-details">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-amber-900">
                <ArrowLeftRight className="w-4 h-4 text-amber-700" />
                <span className="text-xs font-bold uppercase tracking-wider">Trade-in Details</span>
              </div>
              {vendorName && (
                <button
                  type="button"
                  onClick={() => {
                    setTradeAcceptingVendor(vendorName);
                    if (errors.tradeAcceptingVendor) setErrors((prev) => ({ ...prev, tradeAcceptingVendor: '' }));
                  }}
                  className="text-[11px] font-medium text-amber-800 hover:text-amber-950 underline cursor-pointer"
                >
                  Same as vendor ({vendorName})
                </button>
              )}
            </div>

            {/* Vendor accepting trade - Drop Down Box */}
            <div>
              <label htmlFor="select-trade-accepting-vendor" className="block text-xs font-semibold text-amber-950 mb-1">
                Vendor Accepting the Trade <span className="text-rose-500">*</span>
              </label>
              <select
                id="select-trade-accepting-vendor"
                value={tradeAcceptingVendor}
                onChange={(e) => {
                  setTradeAcceptingVendor(e.target.value);
                  if (errors.tradeAcceptingVendor) setErrors((prev) => ({ ...prev, tradeAcceptingVendor: '' }));
                }}
                className={`w-full px-3 py-2 text-xs font-medium rounded-lg border bg-white focus:outline-hidden focus:ring-2 text-zinc-900 cursor-pointer ${
                  errors.tradeAcceptingVendor
                    ? 'border-rose-400 focus:ring-rose-200 text-rose-900'
                    : 'border-amber-300 focus:border-amber-500 focus:ring-amber-500/20'
                }`}
              >
                <option value="">-- Select Vendor Accepting Trade --</option>
                {knownVendors.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
                {tradeAcceptingVendor && !knownVendors.includes(tradeAcceptingVendor) && (
                  <option value={tradeAcceptingVendor}>{tradeAcceptingVendor}</option>
                )}
              </select>
              {errors.tradeAcceptingVendor && (
                <p className="text-[11px] text-rose-600 font-medium mt-1">{errors.tradeAcceptingVendor}</p>
              )}
            </div>

            {/* Trade-in Value */}
            <div>
              <label htmlFor="input-trade-value" className="block text-xs font-semibold text-amber-950 mb-1">
                Trade-in Value (£) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs font-bold text-amber-700">£</span>
                <input
                  type="number"
                  id="input-trade-value"
                  step="0.01"
                  min="0"
                  value={tradeValue}
                  onChange={(e) => {
                    setTradeValue(e.target.value);
                    if (errors.tradeValue) setErrors((prev) => ({ ...prev, tradeValue: '' }));
                  }}
                  placeholder="0.00"
                  className={`w-full pl-7 pr-3 py-1.5 text-xs font-semibold rounded-lg border bg-white focus:outline-hidden focus:ring-2 text-zinc-900 ${
                    errors.tradeValue
                      ? 'border-rose-400 focus:ring-rose-200'
                      : 'border-amber-300 focus:border-amber-500 focus:ring-amber-500/20'
                  }`}
                />
              </div>
              {errors.tradeValue && (
                <p className="text-[11px] text-rose-600 font-medium mt-1">{errors.tradeValue}</p>
              )}
            </div>

            {/* Traded In Item Description */}
            <div>
              <label htmlFor="input-trade-item" className="block text-xs font-semibold text-amber-950 mb-1">
                Item Traded In <span className="text-zinc-400 font-normal">(Optional description)</span>
              </label>
              <input
                type="text"
                id="input-trade-item"
                value={tradeItemDescription}
                onChange={(e) => setTradeItemDescription(e.target.value)}
                placeholder="e.g. 2018 Yamaha Acoustic Guitar, Serial #..."
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-amber-300/80 bg-white focus:outline-hidden focus:ring-2 focus:border-amber-500 focus:ring-amber-500/20 text-zinc-900"
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
            className="w-full py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 active:scale-[0.99] text-white text-sm font-semibold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Record Sale to Today's Database</span>
          </button>
        </div>
      </form>
    </div>
  );
};
