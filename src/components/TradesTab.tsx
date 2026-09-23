import React, { useState } from 'react';
import {
  ArrowLeftRight,
  PlusCircle,
  Search,
  Download,
  Trash2,
  Edit2,
  CheckCircle2,
  Calendar,
  Banknote,
  Tag,
  User,
  Users,
  AlertCircle,
  Clock,
  Save,
  X,
  CreditCard,
  Ticket,
} from 'lucide-react';
import { TradeRecord, TradeDaySummary, TradeType } from '../types';
import { cloudDb, formatCurrency, formatDisplayDate, getLocalDateKey } from '../db/cloudDatabase';

interface TradesTabProps {
  currentDateKey: string;
  onDateChange: (dateKey: string) => void;
  knownVendors: string[];
  onSwitchToLedger: () => void;
}

export const TradesTab: React.FC<TradesTabProps> = ({
  currentDateKey,
  onDateChange,
  knownVendors,
  onSwitchToLedger,
}) => {
  // Form state
  const [vendorName, setVendorName] = useState<string>('');
  const [itemDescription, setItemDescription] = useState<string>('');
  const [tradeValue, setTradeValue] = useState<string>('');
  const [tradeType, setTradeType] = useState<TradeType>('credit'); // default to vendor credit
  const [customerName, setCustomerName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [showSuccessToast, setShowSuccessToast] = useState<boolean>(false);
  const [lastLoggedItem, setLastLoggedItem] = useState<string>('');

  // Search and filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterVendor, setFilterVendor] = useState<string>('all');
  const [filterType, setFilterType] = useState<'all' | 'cash' | 'credit'>('all');

  // Edit trade modal state
  const [editingTrade, setEditingTrade] = useState<TradeRecord | null>(null);
  const [editItemDesc, setEditItemDesc] = useState<string>('');
  const [editValue, setEditValue] = useState<string>('');
  const [editVendor, setEditVendor] = useState<string>('');
  const [editType, setEditType] = useState<TradeType>('credit');
  const [editCustomer, setEditCustomer] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editError, setEditError] = useState<string>('');

  // Delete confirmation
  const [deletingTradeId, setDeletingTradeId] = useState<string | null>(null);

  // Data fetching from cloudDb
  const trades = cloudDb.getTradesForDay(currentDateKey);
  const summary: TradeDaySummary = cloudDb.getDailyTradeSummary(currentDateKey);

  // Filtered trades
  const filteredTrades = trades.filter((t) => {
    if (filterVendor !== 'all' && t.vendorName.toLowerCase() !== filterVendor.toLowerCase()) {
      return false;
    }
    if (filterType !== 'all' && t.tradeType !== filterType) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchItem = t.itemDescription.toLowerCase().includes(q);
      const matchVendor = t.vendorName.toLowerCase().includes(q);
      const matchCustomer = t.customerName?.toLowerCase().includes(q);
      const matchNotes = t.notes?.toLowerCase().includes(q);
      if (!matchItem && !matchVendor && !matchCustomer && !matchNotes) {
        return false;
      }
    }
    return true;
  });

  const handleQuickAddValue = (val: number) => {
    const current = parseFloat(tradeValue) || 0;
    setTradeValue((current + val).toFixed(2));
    if (formErrors.tradeValue) {
      setFormErrors((prev) => ({ ...prev, tradeValue: '' }));
    }
  };

  const handleRecordTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!vendorName.trim()) {
      errors.vendorName = 'Please select the vendor taking in the cards';
    }
    if (!itemDescription.trim()) {
      errors.itemDescription = 'Please describe the cards traded in';
    }
    const val = parseFloat(tradeValue);
    if (!tradeValue.trim() || isNaN(val) || val <= 0) {
      errors.tradeValue = 'Please enter a valid trade valuation greater than £0.00';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});

    await cloudDb.insertTrade({
      vendorName: vendorName.trim(),
      itemDescription: itemDescription.trim(),
      tradeValue: val,
      tradeType,
      dateKey: currentDateKey,
      customerName: customerName.trim() || undefined,
      notes: notes.trim() || undefined,
    });

    const typeLabel = tradeType === 'cash' ? 'Cash Payout' : "Vendor's Credit";
    setLastLoggedItem(`${itemDescription.trim()} • ${formatCurrency(val)} (${typeLabel})`);
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 3500);

    // Keep vendor selected for sequential entries
    setItemDescription('');
    setTradeValue('');
    setCustomerName('');
    setNotes('');
  };

  const openEditModal = (t: TradeRecord) => {
    setEditingTrade(t);
    setEditItemDesc(t.itemDescription);
    setEditValue(t.tradeValue.toString());
    setEditVendor(t.vendorName);
    setEditType(t.tradeType || 'credit');
    setEditCustomer(t.customerName || '');
    setEditNotes(t.notes || '');
    setEditError('');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTrade) return;

    if (!editVendor.trim() || !editItemDesc.trim()) {
      setEditError('Vendor and cards description are required');
      return;
    }

    const val = parseFloat(editValue);
    if (isNaN(val) || val <= 0) {
      setEditError('Trade valuation must be greater than £0');
      return;
    }

    await cloudDb.updateTrade(editingTrade.id, {
      vendorName: editVendor.trim(),
      itemDescription: editItemDesc.trim(),
      tradeValue: val,
      tradeType: editType,
      customerName: editCustomer.trim() || undefined,
      notes: editNotes.trim() || undefined,
    });

    setEditingTrade(null);
  };

  const handleDeleteTrade = async (id: string) => {
    await cloudDb.deleteTrade(id);
    setDeletingTradeId(null);
  };

  const handleExportCsv = () => {
    const csv = cloudDb.exportTradesToCsv(currentDateKey, filterVendor !== 'all' ? filterVendor : undefined);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `trades_${currentDateKey}${filterVendor !== 'all' ? `_${filterVendor}` : ''}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectedVendorColor = vendorName ? cloudDb.getVendorColor(vendorName) : '#2563eb';

  return (
    <div className="space-y-6" id="view-trades-tab">
      {/* Top Controls Bar */}
      <div className="bg-white rounded-2xl border border-zinc-200/90 p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="p-2 rounded-xl bg-amber-50 text-amber-900 border border-amber-200">
              <ArrowLeftRight className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-zinc-900 tracking-tight">
                Cards Trade-In Ledger
              </h2>
              <p className="text-xs text-zinc-500 font-medium">
                Independent page for cards traded in for <strong>cash</strong> or for <strong>credit (vendor's credit)</strong>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap self-start md:self-auto">
          {/* Date Picker */}
          <div className="flex items-center gap-1.5 bg-zinc-50 px-2.5 py-1.5 rounded-xl border border-zinc-200 text-xs font-semibold">
            <Calendar className="w-4 h-4 text-zinc-500" />
            <input
              type="date"
              id="input-trade-date-picker"
              value={currentDateKey}
              onChange={(e) => onDateChange(e.target.value || getLocalDateKey())}
              className="bg-transparent text-zinc-900 focus:outline-hidden cursor-pointer"
            />
            {currentDateKey !== getLocalDateKey() && (
              <button
                type="button"
                onClick={() => onDateChange(getLocalDateKey())}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-800 ml-1 cursor-pointer"
              >
                Today
              </button>
            )}
          </div>

          {/* Export Trades CSV */}
          <button
            type="button"
            id="btn-export-trades-csv"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-zinc-50 border border-zinc-300 text-zinc-700 text-xs font-semibold cursor-pointer shadow-2xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-zinc-500" />
            <span>Export CSV</span>
          </button>

          {/* Switch to Sales Ledger Shortcut */}
          <button
            type="button"
            onClick={onSwitchToLedger}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold cursor-pointer shadow-2xs transition-colors"
          >
            <span>Go to Sales Ledger</span>
          </button>
        </div>
      </div>

      {/* Mandatory Disclaimer Banner */}
      <div className="bg-amber-50/90 border border-amber-300 rounded-2xl p-4 flex items-start gap-3 shadow-2xs">
        <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800 shrink-0 mt-0.5">
          <AlertCircle className="w-4 h-4 text-amber-700" />
        </div>
        <div>
          <h4 className="text-xs font-extrabold uppercase tracking-wide text-amber-950">
            Trade-In Ledger Notice (Before Commission Reductions)
          </h4>
          <p className="text-xs text-amber-900/90 mt-0.5 font-medium leading-relaxed">
            All card trade valuations, cash payouts, and store credit figures shown below are <strong>gross amounts before commission reductions</strong>. Trades are tracked independently from till sales (cash or card) and feed directly into each vendor's portal.
          </p>
        </div>
      </div>

      {/* RECORD TRADE-IN FORM */}
      <div
        className="bg-white rounded-2xl border border-zinc-200/90 shadow-xs relative overflow-hidden"
        id="card-record-trade-form"
      >
        <div className="h-1 bg-gradient-to-r from-amber-500 via-purple-500 to-emerald-500" />

        <div className="px-5 py-3.5 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-zinc-50/70">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
              <ArrowLeftRight className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900">Record Cards Trade-In</h3>
              <p className="text-[11px] text-zinc-500">
                Log cards traded in for <strong>cash payout</strong> or for <strong>vendor's credit</strong>
              </p>
            </div>
          </div>

          {showSuccessToast && (
            <div className="animate-fade-in flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold shadow-2xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="truncate max-w-[260px]">Logged: {lastLoggedItem}</span>
            </div>
          )}
        </div>

        <form onSubmit={handleRecordTrade} className="p-5 space-y-4">
          {/* Row 1: Vendor taking trade & Cards description */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Vendor taking trade */}
            <div className="md:col-span-4 space-y-1.5">
              <label htmlFor="trade-vendor-select" className="block text-xs font-bold text-zinc-800">
                Vendor Taking In Cards <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div
                  className="w-3.5 h-3.5 rounded-full absolute left-3 top-3 pointer-events-none transition-colors border border-white shadow-2xs"
                  style={{ backgroundColor: selectedVendorColor }}
                />
                <select
                  id="trade-vendor-select"
                  value={vendorName}
                  onChange={(e) => {
                    setVendorName(e.target.value);
                    if (formErrors.vendorName) setFormErrors((prev) => ({ ...prev, vendorName: '' }));
                  }}
                  className={`w-full pl-9 pr-8 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                    formErrors.vendorName
                      ? 'border-rose-400 bg-rose-50/30 text-rose-900'
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
              {formErrors.vendorName && (
                <p className="text-[11px] font-semibold text-rose-600">{formErrors.vendorName}</p>
              )}
            </div>

            {/* Cards Traded In description */}
            <div className="md:col-span-8 space-y-1.5">
              <label htmlFor="input-trade-cards-desc" className="block text-xs font-bold text-zinc-800">
                Cards / Item Traded In <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Tag className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400 pointer-events-none" />
                <input
                  type="text"
                  id="input-trade-cards-desc"
                  value={itemDescription}
                  onChange={(e) => {
                    setItemDescription(e.target.value);
                    if (formErrors.itemDescription) setFormErrors((prev) => ({ ...prev, itemDescription: '' }));
                  }}
                  placeholder="e.g. Charizard Base Set Holo, Modern Singles Binder, PSA 9 Rayquaza..."
                  className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border transition-all ${
                    formErrors.itemDescription
                      ? 'border-rose-400 bg-rose-50/30 text-rose-900'
                      : 'border-zinc-300 bg-white text-zinc-900 hover:border-zinc-400 focus:ring-zinc-900/10 focus:border-zinc-900'
                  }`}
                />
              </div>
              {formErrors.itemDescription && (
                <p className="text-[11px] font-semibold text-rose-600">{formErrors.itemDescription}</p>
              )}
            </div>
          </div>

          {/* Row 2: Trade Valuation (£) and Compensation Selector (Cash vs Credit) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-1">
            {/* Trade Valuation (£) */}
            <div className="md:col-span-4 space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="input-trade-value" className="block text-xs font-bold text-zinc-800">
                  Trade Valuation (£) <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-1">
                  {[5, 10, 20, 50].map((inc) => (
                    <button
                      key={inc}
                      type="button"
                      onClick={() => handleQuickAddValue(inc)}
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
                  type="number"
                  step="0.01"
                  min="0.01"
                  id="input-trade-value"
                  value={tradeValue}
                  onChange={(e) => {
                    setTradeValue(e.target.value);
                    if (formErrors.tradeValue) setFormErrors((prev) => ({ ...prev, tradeValue: '' }));
                  }}
                  placeholder="0.00"
                  className={`w-full pl-8 pr-3 py-2 text-sm font-black tracking-tight rounded-xl border tabular-nums transition-all ${
                    formErrors.tradeValue
                      ? 'border-rose-400 bg-rose-50/30 text-rose-900'
                      : 'border-zinc-300 bg-white text-zinc-950 hover:border-zinc-400 focus:ring-zinc-900/10 focus:border-zinc-900'
                  }`}
                />
              </div>
              {formErrors.tradeValue && (
                <p className="text-[11px] font-semibold text-rose-600">{formErrors.tradeValue}</p>
              )}
            </div>

            {/* Traded In For: Cash or Vendor's Credit */}
            <div className="md:col-span-8 space-y-1.5">
              <label className="block text-xs font-bold text-zinc-800">
                Cards Traded In For <span className="text-rose-500">*</span>
              </label>

              <div className="grid grid-cols-2 gap-2.5">
                {/* For Cash Button */}
                <button
                  type="button"
                  id="btn-trade-type-cash"
                  onClick={() => setTradeType('cash')}
                  className={`py-2 px-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                    tradeType === 'cash'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm ring-2 ring-emerald-600/30'
                      : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-300'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      tradeType === 'cash' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-xs font-black leading-tight">Cash Payout</span>
                    <span
                      className={`text-[10px] block leading-tight ${
                        tradeType === 'cash' ? 'text-emerald-100' : 'text-zinc-500'
                      }`}
                    >
                      Cash paid out to customer
                    </span>
                  </div>
                </button>

                {/* For Vendor Credit Button */}
                <button
                  type="button"
                  id="btn-trade-type-credit"
                  onClick={() => setTradeType('credit')}
                  className={`py-2 px-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                    tradeType === 'credit'
                      ? 'bg-purple-600 text-white border-purple-600 shadow-sm ring-2 ring-purple-600/30'
                      : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-300'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      tradeType === 'credit' ? 'bg-purple-700 text-white' : 'bg-purple-100 text-purple-800'
                    }`}
                  >
                    <Ticket className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-xs font-black leading-tight">Vendor's Credit</span>
                    <span
                      className={`text-[10px] block leading-tight ${
                        tradeType === 'credit' ? 'text-purple-100' : 'text-zinc-500'
                      }`}
                    >
                      Store / vendor credit issued
                    </span>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Row 3: Customer Name & Notes & Submit */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1">
            <div className="md:col-span-4 space-y-1">
              <label htmlFor="input-trade-customer" className="block text-[11px] font-bold text-zinc-700">
                Customer Name (Optional)
              </label>
              <div className="relative">
                <User className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-400 pointer-events-none" />
                <input
                  type="text"
                  id="input-trade-customer"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Alex, Sam Smith..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-zinc-300 bg-white text-zinc-900 focus:outline-hidden focus:border-zinc-900"
                />
              </div>
            </div>

            <div className="md:col-span-5 space-y-1">
              <label htmlFor="input-trade-notes" className="block text-[11px] font-bold text-zinc-700">
                Notes / Condition Memo (Optional)
              </label>
              <input
                type="text"
                id="input-trade-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Near Mint, sleeved & toploader, credit slip #41..."
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-zinc-300 bg-white text-zinc-900 focus:outline-hidden focus:border-zinc-900"
              />
            </div>

            <div className="md:col-span-3 flex items-end">
              <button
                type="submit"
                id="btn-submit-trade-entry"
                className="w-full py-2 px-4 bg-zinc-950 hover:bg-zinc-800 text-white font-black text-xs rounded-xl shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-98"
              >
                <PlusCircle className="w-4 h-4 text-amber-400" />
                <span>
                  Log Cards Trade {tradeValue && !isNaN(parseFloat(tradeValue)) ? `(£${parseFloat(tradeValue).toFixed(2)})` : ''}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* INDEPENDENT TRADE KPI STATS (4 CARDS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5" id="section-trades-kpis">
        {/* Total Cards Traded In */}
        <div className="bg-zinc-950 text-white rounded-2xl border border-zinc-800 p-4 sm:p-5 shadow-md relative overflow-hidden ring-1 ring-white/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Total Cards Traded In
            </span>
            <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-700/80 text-white">
              <ArrowLeftRight className="w-4 h-4 text-amber-400" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black tracking-tight text-white tabular-nums">
              {formatCurrency(summary.totalTradeValue)}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-zinc-400 font-medium">
              <span>
                <strong className="text-white font-bold">{summary.totalCount}</strong>{' '}
                {summary.totalCount === 1 ? 'trade' : 'trades'} recorded today
              </span>
            </div>
          </div>
        </div>

        {/* Traded for Cash Card (Clickable Filter) */}
        <button
          type="button"
          id="btn-filter-trades-cash"
          onClick={() => setFilterType(filterType === 'cash' ? 'all' : 'cash')}
          className={`text-left rounded-2xl border p-4 sm:p-5 shadow-xs transition-all cursor-pointer relative ${
            filterType === 'cash'
              ? 'bg-emerald-950 text-white border-emerald-500 ring-2 ring-emerald-500/50 shadow-md'
              : 'bg-white border-zinc-300 hover:border-emerald-500 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between gap-1 flex-wrap">
            <span
              className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                filterType === 'cash' ? 'text-emerald-300' : 'text-emerald-800'
              }`}
            >
              <Banknote className="w-4 h-4 shrink-0" /> Traded for Cash
            </span>
            <span
              className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${
                filterType === 'cash'
                  ? 'bg-emerald-500 text-zinc-950 font-black'
                  : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
              }`}
            >
              {summary.cashTradeCount} {summary.cashTradeCount === 1 ? 'trade' : 'trades'}
            </span>
          </div>
          <div className="mt-3">
            <div
              className={`text-2xl sm:text-3xl font-black tracking-tight tabular-nums ${
                filterType === 'cash' ? 'text-white' : 'text-zinc-950'
              }`}
            >
              {formatCurrency(summary.cashTradeValue)}
            </div>
            <div
              className={`text-xs font-bold mt-1.5 ${
                filterType === 'cash' ? 'text-emerald-300' : 'text-emerald-700'
              }`}
            >
              Cash payouts to customers
            </div>
          </div>
        </button>

        {/* Traded for Vendor Credit Card (Clickable Filter) */}
        <button
          type="button"
          id="btn-filter-trades-credit"
          onClick={() => setFilterType(filterType === 'credit' ? 'all' : 'credit')}
          className={`text-left rounded-2xl border p-4 sm:p-5 shadow-xs transition-all cursor-pointer relative ${
            filterType === 'credit'
              ? 'bg-purple-950 text-white border-purple-500 ring-2 ring-purple-500/50 shadow-md'
              : 'bg-white border-zinc-300 hover:border-purple-500 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between gap-1 flex-wrap">
            <span
              className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                filterType === 'credit' ? 'text-purple-300' : 'text-purple-800'
              }`}
            >
              <Ticket className="w-4 h-4 shrink-0" /> Traded for Credit
            </span>
            <span
              className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${
                filterType === 'credit'
                  ? 'bg-purple-400 text-zinc-950 font-black'
                  : 'bg-purple-100 text-purple-900 border border-purple-300'
              }`}
            >
              {summary.creditTradeCount} {summary.creditTradeCount === 1 ? 'trade' : 'trades'}
            </span>
          </div>
          <div className="mt-3">
            <div
              className={`text-2xl sm:text-3xl font-black tracking-tight tabular-nums ${
                filterType === 'credit' ? 'text-white' : 'text-zinc-950'
              }`}
            >
              {formatCurrency(summary.creditTradeValue)}
            </div>
            <div
              className={`text-xs font-bold mt-1.5 ${
                filterType === 'credit' ? 'text-purple-300' : 'text-purple-700'
              }`}
            >
              Vendor's credit issued
            </div>
          </div>
        </button>

        {/* Average Trade Valuation */}
        <div className="bg-white rounded-2xl border border-zinc-300 p-4 sm:p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-600">
              Avg Trade Valuation
            </span>
            <div className="p-2 rounded-xl bg-zinc-100 border border-zinc-200 text-zinc-800">
              <Tag className="w-4 h-4 text-amber-600" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-950 tabular-nums">
              {formatCurrency(summary.averageTradeValue)}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-zinc-500 font-medium">
              <span>Avg valuation per trade-in</span>
            </div>
          </div>
        </div>
      </div>

      {/* VENDOR TRADE BREAKDOWN */}
      {summary.vendorStats.length > 0 && (
        <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-zinc-500" />
              <h3 className="text-sm font-bold text-zinc-900">Trades by Vendor Today</h3>
              <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                Gross Before Commission
              </span>
            </div>
            <span className="text-xs text-zinc-400 font-medium">
              {summary.vendorStats.length} vendors accepted trades
            </span>
          </div>

          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {summary.vendorStats.map((vs) => {
              const isSelected = filterVendor.toLowerCase() === vs.vendorName.toLowerCase();
              return (
                <button
                  key={vs.vendorName}
                  type="button"
                  onClick={() => setFilterVendor(isSelected ? 'all' : vs.vendorName)}
                  className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-zinc-900 text-white border-zinc-900 shadow-md ring-2 ring-zinc-900/20'
                      : 'bg-zinc-50/70 border-zinc-200 hover:bg-zinc-100/80 text-zinc-900'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className="w-3 h-3 rounded-full shrink-0 shadow-2xs"
                        style={{ backgroundColor: vs.color }}
                      />
                      <span className="font-bold text-sm truncate max-w-[150px]">{vs.vendorName}</span>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        isSelected ? 'bg-zinc-800 text-amber-400' : 'bg-zinc-200 text-zinc-700'
                      }`}
                    >
                      {vs.tradeCount} {vs.tradeCount === 1 ? 'item' : 'items'}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between mb-2">
                    <span className={`text-lg font-extrabold ${isSelected ? 'text-white' : 'text-zinc-900'}`}>
                      {formatCurrency(vs.totalTradeValue)}
                    </span>
                    <span className={`text-xs font-medium ${isSelected ? 'text-zinc-400' : 'text-zinc-500'}`}>
                      Total Cards Taken In
                    </span>
                  </div>

                  {/* Cash vs Credit split */}
                  <div className="flex items-center justify-between pt-1 border-t border-zinc-200/50 text-[11px]">
                    <span
                      className={`inline-flex items-center gap-1 font-semibold ${
                        isSelected ? 'text-emerald-300' : 'text-emerald-700'
                      }`}
                    >
                      <Banknote className="w-3 h-3" />
                      Cash: {formatCurrency(vs.cashTradeValue)}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 font-semibold ${
                        isSelected ? 'text-purple-300' : 'text-purple-700'
                      }`}
                    >
                      <Ticket className="w-3 h-3" />
                      Credit: {formatCurrency(vs.creditTradeValue)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* TRADES LEDGER TABLE & FILTERS */}
      <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-xs overflow-hidden">
        {/* Table header and search controls */}
        <div className="p-4 sm:p-5 border-b border-zinc-100 space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-zinc-900">Today's Cards Trade Records</h3>
              <p className="text-xs text-zinc-500">
                Showing {filteredTrades.length} of {trades.length} trades recorded for {formatDisplayDate(currentDateKey)}
              </p>
            </div>

            <div className="text-right">
              <span className="text-xs text-zinc-400 font-medium">Filtered Total:</span>{' '}
              <span className="text-base font-extrabold text-zinc-900">
                {formatCurrency(filteredTrades.reduce((sum, t) => sum + t.tradeValue, 0))}
              </span>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-2.5 pt-1">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
              <input
                type="text"
                id="input-search-trades"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search cards, vendor, customer, or notes..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-zinc-200 bg-zinc-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 text-zinc-900"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-xs text-zinc-400 hover:text-zinc-600"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Filter by Compensation: All, Cash, Credit */}
            <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg border border-zinc-200 text-xs">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                  filterType === 'all'
                    ? 'bg-white text-zinc-900 shadow-xs font-bold'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                All Trades
              </button>
              <button
                type="button"
                onClick={() => setFilterType('cash')}
                className={`px-2.5 py-1 rounded-md font-medium flex items-center gap-1 transition-all cursor-pointer ${
                  filterType === 'cash'
                    ? 'bg-emerald-600 text-white shadow-xs font-bold'
                    : 'text-zinc-600 hover:text-emerald-700'
                }`}
              >
                <Banknote className="w-3 h-3" /> Traded for Cash
              </button>
              <button
                type="button"
                onClick={() => setFilterType('credit')}
                className={`px-2.5 py-1 rounded-md font-medium flex items-center gap-1 transition-all cursor-pointer ${
                  filterType === 'credit'
                    ? 'bg-purple-600 text-white shadow-xs font-bold'
                    : 'text-zinc-600 hover:text-purple-700'
                }`}
              >
                <Ticket className="w-3 h-3" /> Traded for Credit
              </button>
            </div>

            {/* Vendor Filter */}
            <div className="flex items-center gap-1.5">
              <select
                id="select-trade-vendor-filter"
                value={filterVendor}
                onChange={(e) => setFilterVendor(e.target.value)}
                className="text-xs font-medium text-zinc-800 bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-zinc-900/10 cursor-pointer"
              >
                <option value="all">All Vendors</option>
                {knownVendors.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Table View */}
        {filteredTrades.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto mb-3">
              <ArrowLeftRight className="w-6 h-6 text-zinc-400" />
            </div>
            <h4 className="text-sm font-semibold text-zinc-800 mb-1">No cards trade-in records found</h4>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              Use the form above to record cards traded in for cash payout or vendor credit.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50/80 text-zinc-500 font-semibold uppercase tracking-wider border-b border-zinc-100">
                <tr>
                  <th scope="col" className="py-3 px-4">Time</th>
                  <th scope="col" className="py-3 px-4">Vendor Taking In Cards</th>
                  <th scope="col" className="py-3 px-4">Cards / Item Traded In</th>
                  <th scope="col" className="py-3 px-4 text-right">Valuation (£)</th>
                  <th scope="col" className="py-3 px-4 text-center">Traded In For</th>
                  <th scope="col" className="py-3 px-4">Customer</th>
                  <th scope="col" className="py-3 px-4">Notes</th>
                  <th scope="col" className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredTrades.map((t) => {
                  const dateObj = new Date(t.timestamp);
                  const timeString = dateObj.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                  });
                  const vendorColor = cloudDb.getVendorColor(t.vendorName);
                  const isCash = t.tradeType === 'cash';

                  return (
                    <tr key={t.id} className="hover:bg-zinc-50/70 transition-colors group">
                      {/* Time */}
                      <td className="py-3 px-4 whitespace-nowrap text-zinc-500 font-medium">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-zinc-400" />
                          {timeString}
                        </span>
                      </td>

                      {/* Vendor */}
                      <td className="py-3 px-4 whitespace-nowrap font-bold text-zinc-900">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                            style={{ backgroundColor: vendorColor }}
                          />
                          <span>{t.vendorName}</span>
                        </div>
                      </td>

                      {/* Cards Item */}
                      <td className="py-3 px-4 font-semibold text-zinc-900 max-w-[240px]">
                        <span className="break-words">{t.itemDescription}</span>
                      </td>

                      {/* Valuation */}
                      <td className="py-3 px-4 whitespace-nowrap text-right font-black text-sm text-zinc-950 tabular-nums">
                        {formatCurrency(t.tradeValue)}
                      </td>

                      {/* Compensation Badge */}
                      <td className="py-3 px-4 whitespace-nowrap text-center">
                        {isCash ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                            <Banknote className="w-3.5 h-3.5 text-emerald-700" />
                            Cash Payout
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-black bg-purple-100 text-purple-900 border border-purple-300">
                            <Ticket className="w-3.5 h-3.5 text-purple-700" />
                            Vendor's Credit
                          </span>
                        )}
                      </td>

                      {/* Customer */}
                      <td className="py-3 px-4 whitespace-nowrap text-zinc-700 font-medium">
                        {t.customerName ? (
                          <span className="inline-flex items-center gap-1">
                            <User className="w-3 h-3 text-zinc-400" />
                            {t.customerName}
                          </span>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>

                      {/* Notes */}
                      <td className="py-3 px-4 text-zinc-500 max-w-[180px] truncate" title={t.notes}>
                        {t.notes || '—'}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(t)}
                            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
                            title="Edit trade record"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {deletingTradeId === t.id ? (
                            <div className="flex items-center gap-1 animate-fade-in">
                              <button
                                type="button"
                                onClick={() => handleDeleteTrade(t.id)}
                                className="px-2 py-1 rounded bg-rose-600 text-white font-bold text-[11px] hover:bg-rose-700 cursor-pointer shadow-xs"
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingTradeId(null)}
                                className="px-1.5 py-1 rounded bg-zinc-200 text-zinc-700 font-medium text-[11px] hover:bg-zinc-300 cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeletingTradeId(t.id)}
                              className="p-1.5 rounded-md text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Delete trade record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* EDIT TRADE MODAL */}
      {editingTrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-zinc-200 overflow-hidden animate-fade-in">
            <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-zinc-900">Edit Cards Trade-In</h3>
                <p className="text-xs text-zinc-500">Update cards, valuation, or compensation</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingTrade(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4">
              {editError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold text-rose-800">
                  {editError}
                </div>
              )}

              {/* Vendor */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Vendor Taking In Cards
                </label>
                <select
                  value={editVendor}
                  onChange={(e) => setEditVendor(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 font-medium text-zinc-900 cursor-pointer"
                  required
                >
                  <option value="">-- Select Vendor --</option>
                  {knownVendors.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              {/* Cards Description */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Cards / Item Traded In
                </label>
                <input
                  type="text"
                  value={editItemDesc}
                  onChange={(e) => setEditItemDesc(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 font-medium text-zinc-900"
                  required
                />
              </div>

              {/* Valuation & Compensation */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Trade Valuation (£)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-sm font-bold text-zinc-400">£</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 text-sm font-bold rounded-lg border border-zinc-300"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Traded In For
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setEditType('cash')}
                      className={`py-2 px-1 text-center rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                        editType === 'cash'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-300'
                      }`}
                    >
                      Cash
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditType('credit')}
                      className={`py-2 px-1 text-center rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                        editType === 'credit'
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-300'
                      }`}
                    >
                      Credit
                    </button>
                  </div>
                </div>
              </div>

              {/* Customer */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Customer Name (Optional)
                </label>
                <input
                  type="text"
                  value={editCustomer}
                  onChange={(e) => setEditCustomer(e.target.value)}
                  placeholder="Optional customer name..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Notes / Terms (Optional)
                </label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Optional notes..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300"
                />
              </div>

              <div className="pt-3 border-t border-zinc-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTrade(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-zinc-300 text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
