import React, { useState, useRef } from 'react';
import { User, Tag, Banknote, CreditCard, ArrowLeftRight, CheckCircle2, Plus, Users, UserPlus, X } from 'lucide-react';
import { PaymentMethod } from '../types';

interface NewSaleFormProps {
  currentDateKey: string;
  knownSalesmen: string[];
  onSubmitSale: (sale: {
    salesmanName: string;
    itemDescription: string;
    amount: number;
    paymentMethod: PaymentMethod;
    tradeDetails?: string;
    notes?: string;
  }) => void;
  onAddSalesman?: (name: string) => void;
  onOpenManageSalesmen?: () => void;
}

export const NewSaleForm: React.FC<NewSaleFormProps> = ({
  currentDateKey,
  knownSalesmen,
  onSubmitSale,
  onAddSalesman,
  onOpenManageSalesmen,
}) => {
  const [salesmanName, setSalesmanName] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [tradeDetails, setTradeDetails] = useState('');
  const [notes, setNotes] = useState('');
  const [showSuccessBadge, setShowSuccessBadge] = useState(false);
  const [lastRecordedInfo, setLastRecordedInfo] = useState('');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Inline Quick Add Salesman State
  const [isAddingInline, setIsAddingInline] = useState(false);
  const [inlineSalesmanName, setInlineSalesmanName] = useState('');

  const itemInputRef = useRef<HTMLInputElement>(null);

  const validate = (): boolean => {
    const errs: { [key: string]: string } = {};

    if (!salesmanName.trim()) {
      errs.salesman = "Salesman's name is required";
    }

    if (!itemDescription.trim()) {
      errs.item = 'Item description is required';
    }

    const numAmount = parseFloat(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      errs.amount = 'Valid sale amount greater than £0 is required';
    }

    if (paymentMethod === 'trade' && !tradeDetails.trim()) {
      errs.trade = 'Please specify what was traded in or trade conditions';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const numAmount = parseFloat(amount);
    onSubmitSale({
      salesmanName: salesmanName.trim(),
      itemDescription: itemDescription.trim(),
      amount: numAmount,
      paymentMethod,
      tradeDetails: paymentMethod === 'trade' ? tradeDetails.trim() : undefined,
      notes: notes.trim() || undefined,
    });

    const recordedMsg = `£${numAmount.toFixed(2)} (${itemDescription.trim()}) by ${salesmanName.trim()}`;
    setLastRecordedInfo(recordedMsg);
    setShowSuccessBadge(true);
    setTimeout(() => setShowSuccessBadge(false), 3500);

    // Reset item and amount while keeping salesman name for fast consecutive entries
    setItemDescription('');
    setAmount('');
    setTradeDetails('');
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
        {/* Salesman Name */}
        <div>
          <label htmlFor="input-salesman-name" className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 mb-1.5">
            Salesman's Name <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
              <User className="w-4 h-4" />
            </div>
            <input
              type="text"
              id="input-salesman-name"
              value={salesmanName}
              onChange={(e) => {
                setSalesmanName(e.target.value);
                if (errors.salesman) setErrors((prev) => ({ ...prev, salesman: '' }));
              }}
              placeholder="e.g. Marcus Vance or Elena Rostova"
              className={`w-full pl-9 pr-3 py-2 text-sm rounded-lg border bg-white focus:outline-hidden focus:ring-2 transition-all ${
                errors.salesman
                  ? 'border-rose-400 focus:ring-rose-200 text-rose-900'
                  : 'border-zinc-300 focus:border-zinc-900 focus:ring-zinc-900/10 text-zinc-900'
              }`}
            />
          </div>
          {errors.salesman && <p className="text-xs text-rose-600 mt-1 font-medium">{errors.salesman}</p>}

          {/* Quick Salesman Selector Chips & Team Management */}
          <div className="mt-2 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-zinc-400 font-medium">Quick select:</span>
              {knownSalesmen.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    setSalesmanName(name);
                    if (errors.salesman) setErrors((prev) => ({ ...prev, salesman: '' }));
                  }}
                  className={`px-2 py-0.5 text-xs rounded-md border transition-all cursor-pointer ${
                    salesmanName === name
                      ? 'bg-zinc-900 text-white border-zinc-900 font-medium'
                      : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100 hover:border-zinc-300'
                  }`}
                >
                  {name}
                </button>
              ))}

              {/* Inline Add Button Toggle */}
              {!isAddingInline && (
                <button
                  type="button"
                  onClick={() => setIsAddingInline(true)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 rounded-md font-medium transition-colors cursor-pointer"
                  title="Quick add a new salesman to the cloud roster"
                >
                  <UserPlus className="w-3 h-3" />
                  <span>+ Add Salesman</span>
                </button>
              )}

              {/* Open Full Management Modal */}
              {onOpenManageSalesmen && (
                <button
                  type="button"
                  onClick={onOpenManageSalesmen}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-zinc-500 hover:text-zinc-800 bg-zinc-100/80 hover:bg-zinc-200 border border-zinc-200 rounded-md transition-colors cursor-pointer ml-auto"
                  title="Add or remove salesmen from your saved list"
                >
                  <Users className="w-3 h-3" />
                  <span>Manage Team</span>
                </button>
              )}
            </div>

            {/* Inline Quick Add Input */}
            {isAddingInline && (
              <div className="flex items-center gap-1.5 p-2 bg-emerald-50/60 border border-emerald-200 rounded-lg animate-fade-in">
                <input
                  type="text"
                  value={inlineSalesmanName}
                  onChange={(e) => setInlineSalesmanName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const clean = inlineSalesmanName.trim();
                      if (clean) {
                        if (onAddSalesman) onAddSalesman(clean);
                        setSalesmanName(clean);
                        setInlineSalesmanName('');
                        setIsAddingInline(false);
                      }
                    } else if (e.key === 'Escape') {
                      setIsAddingInline(false);
                    }
                  }}
                  placeholder="Enter new salesman name..."
                  autoFocus
                  className="flex-1 px-2.5 py-1 text-xs bg-white border border-emerald-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-emerald-400 text-zinc-900"
                />
                <button
                  type="button"
                  onClick={() => {
                    const clean = inlineSalesmanName.trim();
                    if (clean) {
                      if (onAddSalesman) onAddSalesman(clean);
                      setSalesmanName(clean);
                      setInlineSalesmanName('');
                      setIsAddingInline(false);
                    }
                  }}
                  className="px-2.5 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors cursor-pointer"
                >
                  Save to Roster
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingInline(false);
                    setInlineSalesmanName('');
                  }}
                  className="p-1 text-zinc-400 hover:text-zinc-600 rounded-md cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
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
          <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1.5 animate-fade-in">
            <label htmlFor="input-trade-details" className="block text-xs font-bold text-amber-900">
              Trade-in Details & Exchange Terms <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              id="input-trade-details"
              value={tradeDetails}
              onChange={(e) => {
                setTradeDetails(e.target.value);
                if (errors.trade) setErrors((prev) => ({ ...prev, trade: '' }));
              }}
              placeholder="e.g. Traded in 2018 Yamaha Acoustic Guitar + £150 cash difference"
              className={`w-full px-3 py-2 text-xs rounded-lg border bg-white focus:outline-hidden focus:ring-2 text-zinc-900 ${
                errors.trade
                  ? 'border-rose-400 focus:ring-rose-200'
                  : 'border-amber-300 focus:border-amber-500 focus:ring-amber-500/20'
              }`}
            />
            {errors.trade ? (
              <p className="text-xs text-rose-600 font-medium">{errors.trade}</p>
            ) : (
              <p className="text-[11px] text-amber-800">
                Specify what item was taken in on trade and any differential balance.
              </p>
            )}
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
