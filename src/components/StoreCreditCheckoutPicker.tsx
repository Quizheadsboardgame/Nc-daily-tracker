import React, { useState, useEffect, useMemo } from 'react';
import { Ticket, Search, X, CheckCircle2, Sparkles } from 'lucide-react';
import { StoreCreditCustomer } from '../types';
import { cloudDb, formatCurrency } from '../db/cloudDatabase';

interface StoreCreditCheckoutPickerProps {
  theme?: 'light' | 'dark';
  checkoutTotal: number;
  selectedCustomerId: string | null;
  appliedAmount: number;
  onApplyStoreCredit: (selection: {
    customer: StoreCreditCustomer;
    amountToUse: number;
  } | null) => void;
}

export const StoreCreditCheckoutPicker: React.FC<StoreCreditCheckoutPickerProps> = ({
  theme = 'light',
  checkoutTotal,
  selectedCustomerId,
  appliedAmount,
  onApplyStoreCredit,
}) => {
  const [customers, setCustomers] = useState<StoreCreditCustomer[]>(() =>
    cloudDb.getStoreCreditCustomers().filter((c) => c.balance > 0.004)
  );
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [customInput, setCustomInput] = useState('');

  useEffect(() => {
    const sync = () => {
      setCustomers(cloudDb.getStoreCreditCustomers().filter((c) => c.balance > 0.004));
    };
    sync();
    return cloudDb.subscribe(sync);
  }, []);

  const selectedCustomer = useMemo(
    () => (selectedCustomerId ? cloudDb.getStoreCreditCustomer(selectedCustomerId) : undefined),
    [selectedCustomerId, customers]
  );

  useEffect(() => {
    if (selectedCustomer && appliedAmount > 0) {
      setCustomInput(appliedAmount.toFixed(2));
    } else {
      setCustomInput('');
    }
  }, [selectedCustomer, appliedAmount]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.toLowerCase().includes(q))
    );
  }, [customers, search]);

  const handleSelectCustomer = (cust: StoreCreditCustomer) => {
    const targetTotal = checkoutTotal > 0 ? checkoutTotal : cust.balance;
    const maxApplicable = Math.round(Math.min(cust.balance, targetTotal) * 100) / 100;
    onApplyStoreCredit({
      customer: cust,
      amountToUse: maxApplicable,
    });
    setIsOpen(false);
    setSearch('');
  };

  const handleCustomAmountChange = (valStr: string) => {
    setCustomInput(valStr);
    if (!selectedCustomer) return;
    const parsed = Math.max(0, Math.round((parseFloat(valStr) || 0) * 100) / 100);
    const maxCap =
      checkoutTotal > 0
        ? Math.min(selectedCustomer.balance, checkoutTotal)
        : selectedCustomer.balance;
    const clamped = Math.round(Math.min(parsed, maxCap) * 100) / 100;
    if (clamped > 0) {
      onApplyStoreCredit({ customer: selectedCustomer, amountToUse: clamped });
    }
  };

  const isDark = theme === 'dark';

  if (customers.length === 0 && !selectedCustomer) {
    return null;
  }

  return (
    <div
      className={`rounded-2xl border p-3 sm:p-3.5 transition-all ${
        selectedCustomer
          ? isDark
            ? 'bg-purple-500/25 border-purple-400 shadow-md shadow-purple-500/20'
            : 'bg-purple-50/90 border-purple-300'
          : isDark
          ? 'bg-purple-500/15 border-purple-400/60'
          : 'bg-zinc-50/80 border-zinc-200'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Ticket
            className={`w-4 h-4 shrink-0 ${
              isDark ? 'text-purple-300' : 'text-purple-700'
            }`}
          />
          <span
            className={`text-xs font-black uppercase tracking-wider ${
              isDark ? 'text-purple-100' : 'text-purple-950'
            }`}
          >
            Customer Store Credit
          </span>
          {!selectedCustomer && (
            <span
              className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                isDark
                  ? 'bg-purple-400 text-zinc-950'
                  : 'bg-purple-100 text-purple-800 border border-purple-200'
              }`}
            >
              {customers.length} active
            </span>
          )}
        </div>

        {selectedCustomer ? (
          <button
            type="button"
            onClick={() => onApplyStoreCredit(null)}
            className={`text-[11px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 cursor-pointer ${
              isDark
                ? 'bg-zinc-900 text-rose-400 hover:text-rose-300 border border-zinc-700'
                : 'bg-white text-rose-600 hover:bg-rose-50 border border-rose-200'
            }`}
          >
            <X className="w-3 h-3" />
            <span>Remove Credit</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsOpen((v) => !v)}
            className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-colors cursor-pointer ${
              isDark
                ? 'bg-purple-600/20 hover:bg-purple-600/30 text-purple-200 border-purple-500/50'
                : 'bg-white hover:bg-purple-50 text-purple-800 border-purple-300'
            }`}
          >
            {isOpen ? 'Close Lookup' : 'Use Store Credit'}
          </button>
        )}
      </div>

      {/* Selected Customer Credit Breakdown */}
      {selectedCustomer && (
        <div className="mt-2.5 pt-2.5 border-t border-purple-500/20 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <CheckCircle2
                className={`w-3.5 h-3.5 shrink-0 ${
                  isDark ? 'text-purple-400' : 'text-purple-600'
                }`}
              />
              <span className={`font-black ${isDark ? 'text-white' : 'text-zinc-950'}`}>
                {selectedCustomer.name}
              </span>
              {selectedCustomer.phone && (
                <span className={isDark ? 'text-zinc-400' : 'text-zinc-500'}>
                  ({selectedCustomer.phone})
                </span>
              )}
            </div>
            <span
              className={`font-bold tabular-nums ${
                isDark ? 'text-purple-300' : 'text-purple-800'
              }`}
            >
              Available: {formatCurrency(selectedCustomer.balance)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[130px]">
              <span
                className={`absolute left-2.5 top-2 text-xs font-black pointer-events-none ${
                  isDark ? 'text-purple-400' : 'text-purple-700'
                }`}
              >
                £
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={
                  checkoutTotal > 0
                    ? Math.min(selectedCustomer.balance, checkoutTotal)
                    : selectedCustomer.balance
                }
                value={customInput}
                onChange={(e) => handleCustomAmountChange(e.target.value)}
                className={`w-full pl-6 pr-2.5 py-1.5 text-xs font-black tabular-nums rounded-xl border focus:outline-hidden ${
                  isDark
                    ? 'bg-zinc-950 border-purple-500/60 text-white'
                    : 'bg-white border-purple-300 text-zinc-950'
                }`}
              />
            </div>

            {checkoutTotal > 0 && (
              <button
                type="button"
                onClick={() => handleSelectCustomer(selectedCustomer)}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                  isDark
                    ? 'bg-purple-500/30 hover:bg-purple-500/40 text-purple-100 border border-purple-400/50'
                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                }`}
              >
                <Sparkles className="w-3 h-3" />
                <span>
                  Use Max ({formatCurrency(Math.min(selectedCustomer.balance, checkoutTotal))})
                </span>
              </button>
            )}
          </div>

          {checkoutTotal > 0 && appliedAmount < checkoutTotal && (
            <p
              className={`text-[11px] font-semibold ${
                isDark ? 'text-amber-300' : 'text-amber-800'
              }`}
            >
              Remaining balance to pay via Cash / Card:{' '}
              <strong className="tabular-nums">
                {formatCurrency(Math.max(0, checkoutTotal - appliedAmount))}
              </strong>
            </p>
          )}
        </div>
      )}

      {/* Searchable Customer Dropdown */}
      {!selectedCustomer && isOpen && (
        <div className="mt-2.5 pt-2.5 border-t border-zinc-500/20 space-y-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer name or phone..."
              autoFocus
              className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border focus:outline-hidden ${
                isDark
                  ? 'bg-zinc-900 border-zinc-700 text-white placeholder-zinc-500 focus:border-purple-400'
                  : 'bg-white border-zinc-300 text-zinc-900 focus:border-purple-600'
              }`}
            />
          </div>

          <div className="max-h-44 overflow-y-auto space-y-1">
            {filtered.length === 0 ? (
              <p className="text-center text-[11px] text-zinc-500 py-2">
                No matching customers with active store credit.
              </p>
            ) : (
              filtered.map((cust) => (
                <button
                  key={cust.id}
                  type="button"
                  onClick={() => handleSelectCustomer(cust)}
                  className={`w-full px-3 py-2 rounded-xl text-left text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                    isDark
                      ? 'bg-zinc-900 hover:bg-purple-950/60 text-white border border-zinc-800'
                      : 'bg-white hover:bg-purple-50 text-zinc-900 border border-zinc-200'
                  }`}
                >
                  <div className="min-w-0">
                    <span className="font-bold truncate block">{cust.name}</span>
                    {cust.phone && (
                      <span className="text-[10px] text-zinc-400">{cust.phone}</span>
                    )}
                  </div>
                  <span
                    className={`font-black tabular-nums px-2 py-0.5 rounded-lg text-[11px] shrink-0 ${
                      isDark
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                        : 'bg-purple-100 text-purple-800 border border-purple-200'
                    }`}
                  >
                    {formatCurrency(cust.balance)}
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
