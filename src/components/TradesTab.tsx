import React, { useState } from 'react';
import {
  ArrowLeftRight,
  PlusCircle,
  Search,
  Download,
  Filter,
  Trash2,
  Edit2,
  CheckCircle2,
  Calendar,
  DollarSign,
  Tag,
  User,
  FileText,
  Building2,
  Sparkles,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { TradeRecord, TradeDaySummary } from '../types';
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
  const [isStandalone, setIsStandalone] = useState<boolean>(true);
  const [soldItemDescription, setSoldItemDescription] = useState<string>('');
  const [saleAmount, setSaleAmount] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [showSuccessToast, setShowSuccessToast] = useState<boolean>(false);
  const [lastLoggedItem, setLastLoggedItem] = useState<string>('');

  // Search and filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterVendor, setFilterVendor] = useState<string>('all');
  const [filterType, setFilterType] = useState<'all' | 'standalone' | 'against-sale'>('all');

  // Edit trade modal state
  const [editingTrade, setEditingTrade] = useState<TradeRecord | null>(null);
  const [editItemDesc, setEditItemDesc] = useState<string>('');
  const [editValue, setEditValue] = useState<string>('');
  const [editVendor, setEditVendor] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editCustomer, setEditCustomer] = useState<string>('');

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
    if (filterType === 'standalone' && !t.isStandalone) {
      return false;
    }
    if (filterType === 'against-sale' && t.isStandalone) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchItem = t.itemDescription.toLowerCase().includes(q);
      const matchVendor = t.vendorName.toLowerCase().includes(q);
      const matchCustomer = t.customerName?.toLowerCase().includes(q);
      const matchSold = t.soldItemDescription?.toLowerCase().includes(q);
      const matchNotes = t.notes?.toLowerCase().includes(q);
      if (!matchItem && !matchVendor && !matchCustomer && !matchSold && !matchNotes) {
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
      errors.vendorName = 'Please select a vendor';
    }
    if (!itemDescription.trim()) {
      errors.itemDescription = 'Please describe the traded-in item';
    }
    const val = parseFloat(tradeValue);
    if (!tradeValue.trim() || isNaN(val) || val <= 0) {
      errors.tradeValue = 'Please enter a valid trade value greater than £0.00';
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
      dateKey: currentDateKey,
      isStandalone,
      soldItemDescription: !isStandalone ? soldItemDescription.trim() : undefined,
      saleAmount: !isStandalone && saleAmount.trim() ? parseFloat(saleAmount) : undefined,
      customerName: customerName.trim() || undefined,
      notes: notes.trim() || undefined,
    });

    setLastLoggedItem(`${itemDescription.trim()} (${formatCurrency(val)})`);
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 3500);

    // Reset item specific fields while keeping vendor for fast sequential entries
    setItemDescription('');
    setTradeValue('');
    setSoldItemDescription('');
    setSaleAmount('');
    setCustomerName('');
    setNotes('');
  };

  const handleOpenEdit = (trade: TradeRecord) => {
    setEditingTrade(trade);
    setEditItemDesc(trade.itemDescription);
    setEditValue(trade.tradeValue.toString());
    setEditVendor(trade.vendorName);
    setEditCustomer(trade.customerName || '');
    setEditNotes(trade.notes || '');
  };

  const handleSaveEdit = async () => {
    if (!editingTrade) return;
    const val = parseFloat(editValue);
    if (!editItemDesc.trim() || isNaN(val) || val <= 0) return;

    await cloudDb.updateTrade(editingTrade.id, {
      itemDescription: editItemDesc.trim(),
      tradeValue: val,
      vendorName: editVendor.trim() || editingTrade.vendorName,
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
    const csvContent = cloudDb.exportTradesToCsv(currentDateKey, filterVendor !== 'all' ? filterVendor : undefined);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `trades-record-${currentDateKey}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectedVendorColor = vendorName.trim() ? cloudDb.getVendorColor(vendorName.trim()) : null;

  return (
    <div className="space-y-6 animate-fade-in" id="trades-tab-container">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-950">
              Trades & Valuations
            </h2>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-950 border border-amber-300 shadow-2xs">
              <ArrowLeftRight className="w-3.5 h-3.5 text-amber-700" />
              <span>{summary.totalCount} {summary.totalCount === 1 ? 'Trade' : 'Trades'} Logged</span>
            </span>
          </div>
          <p className="text-xs font-medium text-zinc-500 mt-1">
            Dedicated trade-in ledger for {formatDisplayDate(currentDateKey)} — standalone items or trades against sales
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            id="btn-switch-to-ledger-from-trades"
            onClick={onSwitchToLedger}
            className="text-xs font-bold text-zinc-700 bg-white hover:bg-zinc-100 border border-zinc-300 px-3.5 py-2 rounded-xl flex items-center gap-2 shadow-2xs transition-all cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-zinc-500" />
            <span>Sales Ledger</span>
          </button>

          <button
            type="button"
            id="btn-export-trades-csv"
            onClick={handleExportCsv}
            disabled={trades.length === 0}
            className="text-xs font-bold text-zinc-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Trades CSV</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards - Mobile Friendly Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        {/* Total Trade Valuation */}
        <div className="bg-zinc-950 text-white rounded-2xl p-4 sm:p-5 border border-zinc-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] sm:text-xs font-bold tracking-wider uppercase text-zinc-400">
              Trade Valuation
            </span>
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight break-words">
              {formatCurrency(summary.totalTradeValue)}
            </div>
            <div className="text-[11px] text-zinc-400 mt-1">
              Total value of traded items
            </div>
          </div>
        </div>

        {/* Total Items Traded */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-zinc-250 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] sm:text-xs font-bold tracking-wider uppercase text-zinc-600">
              Items Taken In
            </span>
            <div className="p-1.5 rounded-lg bg-zinc-100 text-zinc-700">
              <ArrowLeftRight className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl lg:text-3xl font-black text-zinc-950 tracking-tight">
              {summary.totalCount}
            </div>
            <div className="text-[11px] text-zinc-500 mt-1 flex items-center gap-2">
              <span className="font-semibold text-emerald-700">{summary.standaloneCount} standalone</span>
              <span>•</span>
              <span className="font-semibold text-blue-700">{summary.againstSaleCount} against sale</span>
            </div>
          </div>
        </div>

        {/* Average Trade Ticket */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-zinc-250 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] sm:text-xs font-bold tracking-wider uppercase text-zinc-600">
              Avg Valuation
            </span>
            <div className="p-1.5 rounded-lg bg-zinc-100 text-zinc-700">
              <Sparkles className="w-4 h-4 text-amber-600" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl lg:text-3xl font-black text-zinc-950 tracking-tight break-words">
              {formatCurrency(summary.averageTradeValue)}
            </div>
            <div className="text-[11px] text-zinc-500 mt-1">
              Per trade-in item
            </div>
          </div>
        </div>

        {/* Top Trade Vendor */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-zinc-250 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] sm:text-xs font-bold tracking-wider uppercase text-zinc-600">
              Top Vendor
            </span>
            <div className="p-1.5 rounded-lg bg-zinc-100 text-zinc-700">
              <Building2 className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <div>
            <div className="text-base sm:text-lg lg:text-xl font-black text-zinc-950 tracking-tight truncate">
              {summary.topVendor ? summary.topVendor.vendorName : 'None Yet'}
            </div>
            <div className="text-[11px] text-zinc-500 mt-1">
              {summary.topVendor
                ? `${formatCurrency(summary.topVendor.totalTradeValue)} (${summary.topVendor.tradeCount} items)`
                : 'No trades recorded today'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout: Record Trade Form & Trades List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Record Trade Form (5 cols on lg) */}
        <div className="lg:col-span-5 space-y-4">
          <div
            className="bg-white rounded-2xl border transition-all duration-300 overflow-hidden shadow-xs"
            id="card-record-trade-form"
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
                  className="p-2.5 rounded-xl font-bold shadow-2xs transition-all"
                  style={
                    selectedVendorColor
                      ? { backgroundColor: selectedVendorColor, color: '#ffffff' }
                      : { backgroundColor: '#18181b', color: '#f59e0b' }
                  }
                >
                  <ArrowLeftRight className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-zinc-950 tracking-tight">
                    Log Trade-In Item
                  </h3>
                  <p className="text-xs text-zinc-500 font-medium">
                    Doesn't need to be against a sale
                  </p>
                </div>
              </div>

              {showSuccessToast && (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-black rounded-full shadow-2xs animate-fade-in">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Logged: {lastLoggedItem}</span>
                </div>
              )}
            </div>

            {/* Form Body */}
            <form onSubmit={handleRecordTrade} className="p-5 space-y-4" id="form-log-trade">
              {/* Standalone vs Against Sale Switch */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 mb-1.5">
                  Trade Category
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-100 rounded-xl border border-zinc-250">
                  <button
                    type="button"
                    id="btn-trade-standalone"
                    onClick={() => setIsStandalone(true)}
                    className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      isStandalone
                        ? 'bg-zinc-950 text-white shadow-xs font-black'
                        : 'text-zinc-600 hover:text-zinc-950'
                    }`}
                  >
                    <Tag className="w-3.5 h-3.5" />
                    <span>Standalone Trade</span>
                  </button>

                  <button
                    type="button"
                    id="btn-trade-against-sale"
                    onClick={() => setIsStandalone(false)}
                    className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      !isStandalone
                        ? 'bg-zinc-950 text-white shadow-xs font-black'
                        : 'text-zinc-600 hover:text-zinc-950'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Against a Sale</span>
                  </button>
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">
                  {isStandalone
                    ? 'Independent trade item taken into inventory (no sale required).'
                    : 'Customer exchanged this item towards a sale purchase.'}
                </p>
              </div>

              {/* Vendor Selector */}
              <div>
                <label htmlFor="select-trade-vendor" className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 mb-1.5">
                  Vendor Taking In Trade <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    id="select-trade-vendor"
                    value={vendorName}
                    onChange={(e) => {
                      setVendorName(e.target.value);
                      if (formErrors.vendorName) setFormErrors((prev) => ({ ...prev, vendorName: '' }));
                    }}
                    className={`w-full px-3.5 py-2.5 text-sm font-semibold rounded-xl border bg-white focus:outline-hidden focus:ring-2 cursor-pointer transition-all ${
                      formErrors.vendorName
                        ? 'border-rose-400 focus:ring-rose-200 text-rose-900'
                        : 'border-zinc-300 focus:border-zinc-900 focus:ring-zinc-900/10 text-zinc-900'
                    }`}
                  >
                    <option value="">-- Choose Vendor --</option>
                    {knownVendors.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
                {formErrors.vendorName && (
                  <p className="text-xs text-rose-600 mt-1 font-medium">{formErrors.vendorName}</p>
                )}
              </div>

              {/* Traded Item Description */}
              <div>
                <label htmlFor="input-traded-item-desc" className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 mb-1.5">
                  Traded Item Description <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                    <Tag className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    id="input-traded-item-desc"
                    value={itemDescription}
                    onChange={(e) => {
                      setItemDescription(e.target.value);
                      if (formErrors.itemDescription) setFormErrors((prev) => ({ ...prev, itemDescription: '' }));
                    }}
                    placeholder="e.g. iPhone 13 128GB, 9ct Gold Ring, DeWalt Jigsaw"
                    className={`w-full pl-9 pr-3 py-2 text-sm rounded-xl border transition-all ${
                      formErrors.itemDescription
                        ? 'border-rose-400 focus:ring-rose-200 text-rose-900 bg-white'
                        : 'border-zinc-300 focus:border-zinc-900 focus:ring-zinc-900/10 text-zinc-900 bg-white'
                    }`}
                  />
                </div>
                {formErrors.itemDescription && (
                  <p className="text-xs text-rose-600 mt-1 font-medium">{formErrors.itemDescription}</p>
                )}
              </div>

              {/* Trade Valuation (£) */}
              <div>
                <label htmlFor="input-trade-val" className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 mb-1.5">
                  Trade Valuation (£) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500 font-bold text-sm">
                    £
                  </div>
                  <input
                    type="number"
                    id="input-trade-val"
                    step="0.01"
                    min="0.01"
                    value={tradeValue}
                    onChange={(e) => {
                      setTradeValue(e.target.value);
                      if (formErrors.tradeValue) setFormErrors((prev) => ({ ...prev, tradeValue: '' }));
                    }}
                    placeholder="0.00"
                    className={`w-full pl-8 pr-3 py-2 text-sm font-semibold rounded-xl border bg-white focus:outline-hidden focus:ring-2 transition-all ${
                      formErrors.tradeValue
                        ? 'border-rose-400 focus:ring-rose-200 text-rose-900'
                        : 'border-zinc-300 focus:border-zinc-900 focus:ring-zinc-900/10 text-zinc-900'
                    }`}
                  />
                </div>
                {formErrors.tradeValue && (
                  <p className="text-xs text-rose-600 mt-1 font-medium">{formErrors.tradeValue}</p>
                )}

                {/* Quick Increment Buttons */}
                <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                  <span className="text-[10px] text-zinc-400 mr-0.5">Add:</span>
                  {[20, 50, 100, 200].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => handleQuickAddValue(v)}
                      className="px-2 py-0.5 text-[11px] font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded border border-zinc-200 transition-colors cursor-pointer"
                    >
                      +£{v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Conditional Against-Sale Fields */}
              {!isStandalone && (
                <div className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-250 space-y-3 animate-fade-in">
                  <div className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-zinc-600" />
                    <span>Associated Sale Details (Optional)</span>
                  </div>

                  <div>
                    <label htmlFor="input-sold-item-desc" className="block text-[11px] font-semibold text-zinc-600 mb-1">
                      What Was Sold
                    </label>
                    <input
                      type="text"
                      id="input-sold-item-desc"
                      value={soldItemDescription}
                      onChange={(e) => setSoldItemDescription(e.target.value)}
                      placeholder="e.g. Gaming PC, Diamond Pendant"
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-300 bg-white text-zinc-900"
                    />
                  </div>

                  <div>
                    <label htmlFor="input-sale-amount-val" className="block text-[11px] font-semibold text-zinc-600 mb-1">
                      Sale Price (£)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1.5 text-xs text-zinc-500 font-bold">£</span>
                      <input
                        type="number"
                        id="input-sale-amount-val"
                        step="0.01"
                        value={saleAmount}
                        onChange={(e) => setSaleAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border border-zinc-300 bg-white text-zinc-900"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Optional Customer & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="input-customer-name" className="block text-xs font-semibold text-zinc-600 mb-1">
                    Customer Name (Optional)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-zinc-400">
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="text"
                      id="input-customer-name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g. John S."
                      className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-zinc-300 bg-white text-zinc-900"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="input-trade-notes" className="block text-xs font-semibold text-zinc-600 mb-1">
                    Notes / Serial No. (Optional)
                  </label>
                  <input
                    type="text"
                    id="input-trade-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Battery health 91%, boxed"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-300 bg-white text-zinc-900"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                id="btn-submit-log-trade"
                className="w-full py-3 px-4 rounded-xl text-xs font-black text-zinc-950 bg-amber-400 hover:bg-amber-300 active:scale-[0.99] transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4 text-zinc-950" />
                <span>Log Trade-In Item</span>
              </button>
            </form>
          </div>

          {/* Breakdown By Vendor Card */}
          {summary.vendorStats.length > 0 && (
            <div className="bg-white rounded-2xl border border-zinc-250 p-4 shadow-2xs">
              <h4 className="text-xs font-black uppercase tracking-wider text-zinc-700 mb-3 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-zinc-500" />
                <span>Today's Trades by Vendor</span>
              </h4>
              <div className="space-y-2">
                {summary.vendorStats.map((vs) => (
                  <div
                    key={vs.vendorName}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 border border-zinc-200"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: vs.color }}
                      />
                      <span className="text-xs font-bold text-zinc-900">{vs.vendorName}</span>
                      <span className="text-[10px] text-zinc-500 font-medium">
                        ({vs.tradeCount} {vs.tradeCount === 1 ? 'item' : 'items'})
                      </span>
                    </div>
                    <span className="text-xs font-black text-zinc-950">
                      {formatCurrency(vs.totalTradeValue)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Filter & Trades Ledger List (7 cols on lg) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Filter Bar */}
          <div className="bg-white rounded-2xl p-4 border border-zinc-250 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Search Box */}
              <div className="relative flex-1 min-w-0">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  id="input-search-trades"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search item, vendor, customer, notes..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-zinc-300 bg-zinc-50 focus:bg-white text-zinc-900"
                />
              </div>

              {/* Vendor Filter */}
              <div className="flex items-center gap-2">
                <select
                  id="select-filter-trade-vendor"
                  value={filterVendor}
                  onChange={(e) => setFilterVendor(e.target.value)}
                  className="text-xs font-bold text-zinc-800 bg-zinc-50 border border-zinc-300 rounded-xl px-3 py-2 cursor-pointer focus:bg-white"
                >
                  <option value="all">All Vendors</option>
                  {knownVendors.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>

                {/* Type Filter */}
                <select
                  id="select-filter-trade-type"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                  className="text-xs font-bold text-zinc-800 bg-zinc-50 border border-zinc-300 rounded-xl px-3 py-2 cursor-pointer focus:bg-white"
                >
                  <option value="all">All Types</option>
                  <option value="standalone">Standalone Only</option>
                  <option value="against-sale">Against Sale Only</option>
                </select>
              </div>
            </div>
          </div>

          {/* Trades Ledger Cards List */}
          {filteredTrades.length === 0 ? (
            <div className="bg-white rounded-2xl border border-zinc-250 p-8 sm:p-12 text-center shadow-2xs">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3 border border-amber-200">
                <ArrowLeftRight className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-zinc-900">
                {trades.length === 0
                  ? `No trades recorded for ${formatDisplayDate(currentDateKey)}`
                  : 'No trades match your search filters'}
              </h3>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                {trades.length === 0
                  ? 'Use the form on the left to log standalone trade-in items or items taken in against sales.'
                  : 'Try clearing your search query or adjusting the vendor/type filters.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3" id="trades-list-records">
              {filteredTrades.map((trade) => {
                const vendorColor = cloudDb.getVendorColor(trade.vendorName);
                const timeString = new Date(trade.timestamp).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                });

                return (
                  <div
                    key={trade.id}
                    id={`trade-card-${trade.id}`}
                    className="bg-white rounded-2xl border border-zinc-250 hover:border-zinc-350 p-4 shadow-2xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    {/* Left: Item, Vendor, Category details */}
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Vendor Badge */}
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-black text-white shadow-2xs"
                          style={{ backgroundColor: vendorColor }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-white" />
                          <span>{trade.vendorName}</span>
                        </span>

                        {/* Category Badge */}
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            trade.isStandalone
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                              : 'bg-blue-50 text-blue-800 border border-blue-300'
                          }`}
                        >
                          {trade.isStandalone ? 'Standalone Trade' : 'Against Sale'}
                        </span>

                        <span className="text-[11px] text-zinc-400 font-medium">
                          {timeString}
                        </span>
                      </div>

                      {/* Traded Item Description */}
                      <h4 className="text-sm sm:text-base font-black text-zinc-950 tracking-tight break-words">
                        {trade.itemDescription}
                      </h4>

                      {/* Sold Item Details if Against Sale */}
                      {!trade.isStandalone && trade.soldItemDescription && (
                        <div className="text-xs text-zinc-600 flex items-center gap-1 flex-wrap font-medium">
                          <span className="text-zinc-400">Sold against:</span>
                          <strong className="text-zinc-800">{trade.soldItemDescription}</strong>
                          {trade.saleAmount !== undefined && (
                            <span className="text-zinc-500">
                              (Sale price: {formatCurrency(trade.saleAmount)})
                            </span>
                          )}
                        </div>
                      )}

                      {/* Notes / Customer */}
                      {(trade.customerName || trade.notes) && (
                        <div className="text-[11px] text-zinc-500 flex items-center gap-2 flex-wrap">
                          {trade.customerName && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3 text-zinc-400" />
                              <span>Customer: <strong className="text-zinc-700">{trade.customerName}</strong></span>
                            </span>
                          )}
                          {trade.notes && (
                            <span className="italic text-zinc-500">"{trade.notes}"</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Right: Valuation & Actions */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-150">
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-zinc-400 block sm:inline mr-1">
                          Valuation:
                        </span>
                        <span className="text-lg sm:text-xl font-black text-amber-700 tracking-tight">
                          {formatCurrency(trade.tradeValue)}
                        </span>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          id={`btn-edit-trade-${trade.id}`}
                          onClick={() => handleOpenEdit(trade)}
                          className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
                          title="Edit trade details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          id={`btn-delete-trade-${trade.id}`}
                          onClick={() => setDeletingTradeId(trade.id)}
                          className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete trade"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Edit Trade Modal */}
      {editingTrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl border border-zinc-300 max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
                  <Edit2 className="w-4 h-4" />
                </div>
                <h3 className="text-base font-black text-zinc-950">Edit Trade Item</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingTrade(null)}
                className="text-zinc-400 hover:text-zinc-700 font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Vendor</label>
                <select
                  value={editVendor}
                  onChange={(e) => setEditVendor(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 bg-white"
                >
                  {knownVendors.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Traded Item Description</label>
                <input
                  type="text"
                  value={editItemDesc}
                  onChange={(e) => setEditItemDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Valuation (£)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Customer Name</label>
                <input
                  type="text"
                  value={editCustomer}
                  onChange={(e) => setEditCustomer(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 bg-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setEditingTrade(null)}
                className="px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-4 py-2 text-xs font-bold text-zinc-950 bg-amber-400 hover:bg-amber-300 rounded-xl cursor-pointer shadow-xs"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingTradeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl border border-zinc-300 max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-100 text-rose-600">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-black text-zinc-950">Delete Trade Item?</h4>
                <p className="text-xs text-zinc-500 mt-0.5">
                  This action will remove the item from the trade ledger.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingTradeId(null)}
                className="px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteTrade(deletingTradeId)}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl cursor-pointer shadow-xs"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
