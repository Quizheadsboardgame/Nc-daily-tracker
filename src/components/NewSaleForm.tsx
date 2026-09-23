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
    const finalItemDesc = isMiscellaneous ? 'Miscellaneous' : itemDescription.trim();

    onSubmitSale({
      salesmanName: vendorName.trim(),
      itemDescription: finalItemDesc,
      isMiscellaneous,
      amount: numAmount,
      paymentMethod,
      notes: notes.trim() || undefined,
    });

    setLastRecordedInfo(
      `${vendorName.trim()} • ${finalItemDesc} • £${numAmount.toFixed(2)} (${paymentMethod.toUpperCase()})`
    );
    setShowSuccessBadge(true);
    setTimeout(() => {
      setShowSuccessBadge(false);
    }, 3500);

    // Reset item fields, maintain selected vendor for fast sequential entries
    if (!isMiscellaneous) {
      setItemDescription('');
    }
    setAmount('');
    setNotes('');
    setErrors({});

    // Refocus item input
    setTimeout(() => {
      if (isMiscellaneous) {
        amountInputRef.current?.focus();
      } else {
        itemInputRef.current?.focus();
      }
    }, 50);
  };

  const handleQuickAddAmount = (addVal: number) => {
    const current = parseFloat(amount) || 0;
    setAmount((current + addVal).toFixed(2));
    if (errors.amount) {
      setErrors((prev) => ({ ...prev, amount: '' }));
    }
  };

  const handleCreateInlineVendor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlineVendorName.trim()) return;
    const clean = inlineVendorName.trim();
    if (handleAddVendor) {
      handleAddVendor(clean);
    } else {
      cloudDb.addVendor(clean);
    }
    setVendorName(clean);
    setInlineVendorName('');
    setIsAddingInline(false);
    if (errors.vendor) {
      setErrors((prev) => ({ ...prev, vendor: '' }));
    }
  };

  const selectedVendorColor = vendorName ? cloudDb.getVendorColor(vendorName) : '#2563eb';

  return (
    <div
      className="bg-white rounded-2xl border border-zinc-200/90 shadow-xs relative overflow-hidden transition-all duration-200"
      id="card-new-sale-form"
    >
      {/* Decorative top accent strip */}
      <div className="h-1 bg-gradient-to-r from-emerald-500 via-blue-500 to-emerald-400" />

      {/* Header bar */}
      <div className="px-5 py-3.5 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-zinc-50/70">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
            +£
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-900 tracking-tight flex items-center gap-2">
              <span>Record New Sale</span>
              <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                Cash • Card • Traded Out
              </span>
            </h2>
            <p className="text-[11px] text-zinc-500">
              Till gross transactions • For customer cards traded in (cash payout / credit), use the independent{' '}
              <button
                type="button"
                onClick={onNavigateToTrades}
                className="text-amber-700 hover:text-amber-900 font-bold underline cursor-pointer"
              >
                Trades page
              </button>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {handleOpenManageVendors && (
            <button
              type="button"
              id="btn-open-manage-vendors-top"
              onClick={handleOpenManageVendors}
              className="text-xs font-semibold text-zinc-700 bg-white hover:bg-zinc-100 border border-zinc-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              title="Manage vendor names and assigned colors"
            >
              <Users className="w-3.5 h-3.5 text-zinc-500" />
              <span>Vendors</span>
            </button>
          )}

          {showSuccessBadge && (
            <div className="animate-fade-in flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold shadow-2xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="truncate max-w-[220px]">Logged: {lastRecordedInfo}</span>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        {/* ROW 1: Vendor Selection & Item Description */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Vendor Selector */}
          <div className="md:col-span-5 space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="select-vendor-name" className="block text-xs font-bold text-zinc-800">
                Vendor / Seller <span className="text-rose-500">*</span>
              </label>

              {!isAddingInline ? (
                <button
                  type="button"
                  onClick={() => setIsAddingInline(true)}
                  className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>New Vendor</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddingInline(false)}
                  className="text-[11px] font-semibold text-zinc-400 hover:text-zinc-600 flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                  <span>Cancel</span>
                </button>
              )}
            </div>

            {isAddingInline ? (
              <div className="flex items-center gap-1.5 animate-fade-in">
                <input
                  type="text"
                  id="input-inline-vendor-name"
                  value={inlineVendorName}
                  onChange={(e) => setInlineVendorName(e.target.value)}
                  placeholder="Enter vendor name..."
                  autoFocus
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-emerald-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 bg-emerald-50/40 text-zinc-900 font-semibold"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateInlineVendor(e);
                    }
                  }}
                />
                <button
                  type="button"
                  id="btn-save-inline-vendor"
                  onClick={handleCreateInlineVendor}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Add
                </button>
              </div>
            ) : (
              <div className="relative">
                <div
                  className="w-3.5 h-3.5 rounded-full absolute left-3 top-3 pointer-events-none transition-colors border border-white shadow-2xs"
                  style={{ backgroundColor: selectedVendorColor }}
                />
                <select
                  id="select-vendor-name"
                  value={vendorName}
                  onChange={(e) => {
                    setVendorName(e.target.value);
                    if (errors.vendor) setErrors((prev) => ({ ...prev, vendor: '' }));
                  }}
                  className={`w-full pl-9 pr-8 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                    errors.vendor
                      ? 'border-rose-400 bg-rose-50/30 text-rose-900 focus:ring-rose-500/20'
                      : 'border-zinc-300 bg-white text-zinc-900 hover:border-zinc-400 focus:ring-zinc-900/10 focus:border-zinc-900'
                  }`}
                >
                  <option value="">-- Choose Vendor --</option>
                  {knownVendors.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {errors.vendor && <p className="text-[11px] font-semibold text-rose-600">{errors.vendor}</p>}
          </div>

          {/* Item Sold Description */}
          <div className="md:col-span-7 space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="input-item-sold" className="block text-xs font-bold text-zinc-800">
                Item Sold <span className="text-rose-500">*</span>
              </label>

              {/* Quick Miscellaneous Toggle */}
              <label
                htmlFor="check-misc-sale"
                className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-700 hover:text-zinc-950 cursor-pointer select-none bg-zinc-100 px-2 py-0.5 rounded-md border border-zinc-200"
              >
                <input
                  type="checkbox"
                  id="check-misc-sale"
                  checked={isMiscellaneous}
                  onChange={(e) => handleToggleMisc(e.target.checked)}
                  className="rounded-xs text-zinc-900 focus:ring-zinc-900 cursor-pointer w-3.5 h-3.5"
                />
                <span>Miscellaneous</span>
              </label>
            </div>

            <div className="relative">
              <Tag className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400 pointer-events-none" />
              <input
                ref={itemInputRef}
                type="text"
                id="input-item-sold"
                value={itemDescription}
                disabled={isMiscellaneous}
                onChange={(e) => {
                  setItemDescription(e.target.value);
                  if (errors.item) setErrors((prev) => ({ ...prev, item: '' }));
                }}
                placeholder={isMiscellaneous ? 'Miscellaneous' : 'e.g. 151 Booster Pack, PSA 10 Pikachu, Binder...'}
                className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border transition-all ${
                  isMiscellaneous
                    ? 'bg-zinc-100 text-zinc-600 font-bold border-zinc-200 cursor-not-allowed'
                    : errors.item
                    ? 'border-rose-400 bg-rose-50/30 text-rose-900 focus:ring-rose-500/20'
                    : 'border-zinc-300 bg-white text-zinc-900 hover:border-zinc-400 focus:ring-zinc-900/10 focus:border-zinc-900'
                }`}
              />
            </div>

            {errors.item && <p className="text-[11px] font-semibold text-rose-600">{errors.item}</p>}
          </div>
        </div>

        {/* ROW 2: Price (£) and Payment Method (Cash or Card) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-1">
          {/* Amount / Price */}
          <div className="md:col-span-5 space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="input-sale-amount" className="block text-xs font-bold text-zinc-800">
                Sale Price (£ GBP) <span className="text-rose-500">*</span>
              </label>

              {/* Quick increment buttons */}
              <div className="flex items-center gap-1">
                {[1, 5, 10].map((inc) => (
                  <button
                    key={inc}
                    type="button"
                    onClick={() => handleQuickAddAmount(inc)}
                    className="text-[10px] font-bold px-1.5 py-0.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-md border border-zinc-200 transition-colors cursor-pointer"
                  >
                    +{inc}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative">
              <span className="absolute left-3.5 top-2 text-sm font-black text-zinc-500 pointer-events-none">
                £
              </span>
              <input
                ref={amountInputRef}
                type="number"
                step="0.01"
                min="0.01"
                id="input-sale-amount"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  if (errors.amount) setErrors((prev) => ({ ...prev, amount: '' }));
                }}
                placeholder="0.00"
                className={`w-full pl-8 pr-3 py-2 text-sm font-black tracking-tight rounded-xl border tabular-nums transition-all ${
                  errors.amount
                    ? 'border-rose-400 bg-rose-50/30 text-rose-900 focus:ring-rose-500/20'
                    : 'border-zinc-300 bg-white text-zinc-950 hover:border-zinc-400 focus:ring-zinc-900/10 focus:border-zinc-900'
                }`}
              />
            </div>

            {errors.amount && <p className="text-[11px] font-semibold text-rose-600">{errors.amount}</p>}
          </div>

          {/* Payment Method Selector (Cash, Card, or Traded Out) */}
          <div className="md:col-span-7 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-zinc-800">
                Payment / Settlement Method <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-zinc-400 font-medium hidden sm:inline">
                Traded Out = item leaving stock in deal
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {/* Cash Button */}
              <button
                type="button"
                id="btn-payment-cash"
                onClick={() => setPaymentMethod('cash')}
                className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  paymentMethod === 'cash'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm ring-2 ring-emerald-600/25 font-black'
                    : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-300'
                }`}
              >
                <Banknote className="w-4 h-4 shrink-0" />
                <span>Cash</span>
              </button>

              {/* Card Button */}
              <button
                type="button"
                id="btn-payment-card"
                onClick={() => setPaymentMethod('card')}
                className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  paymentMethod === 'card'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-600/25 font-black'
                    : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-300'
                }`}
              >
                <CreditCard className="w-4 h-4 shrink-0" />
                <span>Card</span>
              </button>

              {/* Traded Out Button */}
              <button
                type="button"
                id="btn-payment-traded-out"
                onClick={() => setPaymentMethod('traded_out')}
                className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  paymentMethod === 'traded_out'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-sm ring-2 ring-amber-600/25 font-black'
                    : 'bg-amber-50/60 hover:bg-amber-100 text-amber-900 border-amber-300'
                }`}
                title="Item traded out from vendor's inventory/till"
              >
                <ArrowLeftRight className="w-4 h-4 shrink-0 text-amber-200" />
                <span>Traded Out</span>
              </button>
            </div>

            {paymentMethod === 'traded_out' && (
              <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1 flex items-center gap-1.5 animate-fade-in">
                <span className="font-bold">Notice:</span>
                <span>This item is recorded as traded out from stock. (Cards traded in to store are logged separately on Trades page).</span>
              </div>
            )}
          </div>
        </div>

        {/* Optional Notes & Action Submit */}
        <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-zinc-100">
          <div className="flex-1">
            <input
              type="text"
              id="input-sale-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes or receipt memo..."
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-zinc-200 bg-zinc-50/60 hover:bg-white focus:bg-white focus:border-zinc-900 focus:outline-hidden text-zinc-800"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="submit"
              id="btn-submit-new-sale"
              className="w-full sm:w-auto px-6 py-2.5 bg-zinc-950 hover:bg-zinc-800 text-white font-black text-xs rounded-xl shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>
                Record Sale {amount && !isNaN(parseFloat(amount)) ? `(£${parseFloat(amount).toFixed(2)})` : ''}
              </span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
