import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  Filter,
  Calendar,
  X,
  Download,
  Banknote,
  CreditCard,
  Globe,
  ArrowLeftRight,
  Edit2,
  Trash2,
  Clock,
  ArrowUpDown,
  Tag,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ShoppingBag,
  Store,
} from 'lucide-react';
import { SaleRecord, PaymentMethod } from '../types';
import { cloudDb, formatCurrency, getLocalDateKey } from '../db/cloudDatabase';
import { VendorDropdown } from './VendorDropdown';

interface SalesSearchTabProps {
  knownVendors: string[];
  onEditSale: (sale: SaleRecord) => void;
  onDeleteSale: (id: string) => void;
  onNavigateToLedger?: () => void;
}

type DateScope = 'all' | 'today' | '7days' | '30days' | 'custom';
type SortOption = 'newest' | 'oldest' | 'amount_desc' | 'amount_asc';
type ChannelFilter = 'all' | 'in_person' | 'online';

export const SalesSearchTab: React.FC<SalesSearchTabProps> = ({
  knownVendors,
  onEditSale,
  onDeleteSale,
  onNavigateToLedger,
}) => {
  // All sales loaded from cloud DB
  const [allSales, setAllSales] = useState<SaleRecord[]>(() => cloudDb.getAllSales());

  // Filter states
  const [descriptionQuery, setDescriptionQuery] = useState('');
  const [selectedVendor, setSelectedVendor] = useState<string>('all');
  const [dateScope, setDateScope] = useState<DateScope>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'cash' | 'card' | 'online' | 'traded_out'>('all');
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  // Deletion state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Subscribe to real-time changes
  useEffect(() => {
    const updateSales = () => {
      setAllSales(cloudDb.getAllSales());
    };

    updateSales();
    const unsubscribe = cloudDb.subscribe(updateSales);
    return () => unsubscribe();
  }, []);

  // Compute date boundaries
  const dateBoundaries = useMemo(() => {
    const today = new Date();
    const todayKey = getLocalDateKey(today);

    if (dateScope === 'today') {
      return { start: todayKey, end: todayKey };
    }

    if (dateScope === '7days') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return { start: getLocalDateKey(d), end: todayKey };
    }

    if (dateScope === '30days') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return { start: getLocalDateKey(d), end: todayKey };
    }

    if (dateScope === 'custom') {
      return {
        start: customStartDate || '1970-01-01',
        end: customEndDate || '2099-12-31',
      };
    }

    return null; // all time
  }, [dateScope, customStartDate, customEndDate]);

  // Filtered sales
  const filteredSales = useMemo(() => {
    let result = [...allSales];

    // Filter by Vendor
    if (selectedVendor && selectedVendor !== 'all') {
      const targetVendor = selectedVendor.trim().toLowerCase();
      result = result.filter(
        (s) => s.salesmanName.trim().toLowerCase() === targetVendor
      );
    }

    // Filter by Description (and barcode / notes)
    if (descriptionQuery.trim()) {
      const q = descriptionQuery.trim().toLowerCase();
      result = result.filter((s) => {
        const descMatch = s.itemDescription.toLowerCase().includes(q);
        const barcodeMatch = s.onlineBarcode ? s.onlineBarcode.toLowerCase().includes(q) : false;
        const notesMatch = s.notes ? s.notes.toLowerCase().includes(q) : false;
        const vendorMatch = s.salesmanName.toLowerCase().includes(q);
        return descMatch || barcodeMatch || notesMatch || vendorMatch;
      });
    }

    // Filter by Date
    if (dateBoundaries) {
      result = result.filter(
        (s) => s.dateKey >= dateBoundaries.start && s.dateKey <= dateBoundaries.end
      );
    }

    // Filter by Payment Method
    if (paymentFilter !== 'all') {
      result = result.filter((s) => s.paymentMethod === paymentFilter);
    }

    // Filter by Channel (In-Person vs Online)
    if (channelFilter === 'online') {
      result = result.filter((s) => s.isOnlineSale || s.paymentMethod === 'online');
    } else if (channelFilter === 'in_person') {
      result = result.filter((s) => !s.isOnlineSale && s.paymentMethod !== 'online');
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'newest') return b.timestamp - a.timestamp;
      if (sortBy === 'oldest') return a.timestamp - b.timestamp;
      if (sortBy === 'amount_desc') return b.amount - a.amount;
      if (sortBy === 'amount_asc') return a.amount - b.amount;
      return 0;
    });

    return result;
  }, [allSales, selectedVendor, descriptionQuery, dateBoundaries, paymentFilter, channelFilter, sortBy]);

  // Aggregate stats
  const stats = useMemo(() => {
    let totalRevenue = 0;
    let cashRevenue = 0;
    let cashCount = 0;
    let cardRevenue = 0;
    let cardCount = 0;
    let onlineRevenue = 0;
    let onlineCount = 0;
    let tradedOutRevenue = 0;
    let tradedOutCount = 0;

    for (const s of filteredSales) {
      totalRevenue += s.amount;
      if (s.paymentMethod === 'cash') {
        cashRevenue += s.amount;
        cashCount++;
      } else if (s.paymentMethod === 'traded_out') {
        tradedOutRevenue += s.amount;
        tradedOutCount++;
      } else if (s.paymentMethod === 'online' || s.isOnlineSale) {
        onlineRevenue += s.amount;
        onlineCount++;
      } else {
        cardRevenue += s.amount;
        cardCount++;
      }
    }

    const count = filteredSales.length;
    const avgTicket = count > 0 ? totalRevenue / count : 0;

    return {
      count,
      totalRevenue,
      avgTicket,
      cashRevenue,
      cashCount,
      cardRevenue,
      cardCount,
      onlineRevenue,
      onlineCount,
      tradedOutRevenue,
      tradedOutCount,
    };
  }, [filteredSales]);

  // Check if any filter is active
  const hasActiveFilters = useMemo(() => {
    return (
      descriptionQuery.trim() !== '' ||
      selectedVendor !== 'all' ||
      dateScope !== 'all' ||
      paymentFilter !== 'all' ||
      channelFilter !== 'all' ||
      sortBy !== 'newest'
    );
  }, [descriptionQuery, selectedVendor, dateScope, paymentFilter, channelFilter, sortBy]);

  const handleResetFilters = () => {
    setDescriptionQuery('');
    setSelectedVendor('all');
    setDateScope('all');
    setCustomStartDate('');
    setCustomEndDate('');
    setPaymentFilter('all');
    setChannelFilter('all');
    setSortBy('newest');
  };

  const handleExportCsv = useCallback(() => {
    if (filteredSales.length === 0) return;
    const csvContent = cloudDb.exportSalesListToCsv(filteredSales);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
    link.href = url;
    link.setAttribute('download', `sales_search_results_${timestampStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setNotification(`Exported ${filteredSales.length} sales to CSV`);
    setTimeout(() => setNotification(null), 3000);
  }, [filteredSales]);

  const handleDeleteConfirmed = async (id: string) => {
    try {
      await cloudDb.deleteSale(id);
      onDeleteSale(id);
      setDeleteConfirmId(null);
      setNotification('Sale successfully removed');
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      console.error('Failed to delete sale:', err);
    }
  };

  const renderPaymentBadge = (method: PaymentMethod | string, isOnline?: boolean) => {
    if (method === 'cash') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
          <Banknote className="w-3.5 h-3.5 text-emerald-600" />
          <span>Cash</span>
        </span>
      );
    }
    if (method === 'traded_out') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
          <ArrowLeftRight className="w-3.5 h-3.5 text-amber-600" />
          <span>Trade Out</span>
        </span>
      );
    }
    if (method === 'online' || isOnline) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
          <Globe className="w-3.5 h-3.5 text-blue-600" />
          <span>Online</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200">
        <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
        <span>Card</span>
      </span>
    );
  };

  return (
    <div className="space-y-6" id="search-sales-tab">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 bg-zinc-900 text-white px-4 py-3 rounded-xl shadow-xl border border-zinc-700 animate-fade-in text-sm font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{notification}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-850 to-zinc-900 rounded-2xl p-6 text-white border border-zinc-800 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30">
                <Search className="w-6 h-6" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight">Search Sales</h1>
            </div>
            <p className="text-sm text-zinc-400">
              Find any sale across all historical records by vendor, description, barcode, or transaction notes.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition flex items-center gap-1.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredSales.length === 0}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm ${
                filteredSales.length === 0
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/50'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>Export Results ({filteredSales.length})</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="mt-6 pt-5 border-t border-zinc-800/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* 1. Description Search Input */}
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
            <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-blue-400" />
              <span>Search Description / Barcode</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={descriptionQuery}
                onChange={(e) => setDescriptionQuery(e.target.value)}
                placeholder="e.g. Charizard, Pokémon Booster, 100234, Comic..."
                className="w-full bg-zinc-950/80 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition pr-9"
              />
              {descriptionQuery && (
                <button
                  type="button"
                  onClick={() => setDescriptionQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* 2. Vendor Dropdown */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-amber-400" />
              <span>Filter Vendor</span>
            </label>
            <VendorDropdown
              vendors={knownVendors}
              selectedVendor={selectedVendor}
              onSelectVendor={setSelectedVendor}
              allVendorsOptionLabel="All Vendors"
            />
          </div>

          {/* 3. Date Scope Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              <span>Date Range</span>
            </label>
            <select
              value={dateScope}
              onChange={(e) => setDateScope(e.target.value as DateScope)}
              className="w-full bg-zinc-950/80 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">All Time (All Records)</option>
              <option value="today">Today Only</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="custom">Custom Date Range...</option>
            </select>
          </div>
        </div>

        {/* Custom Date Range Picker (shown only when custom is selected) */}
        {dateScope === 'custom' && (
          <div className="mt-3 p-3 bg-zinc-950/70 border border-zinc-700/80 rounded-xl flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 font-medium">From:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 font-medium">To:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:ring-1 focus:ring-blue-500"
              />
            </div>
            {(customStartDate || customEndDate) && (
              <button
                type="button"
                onClick={() => {
                  setCustomStartDate('');
                  setCustomEndDate('');
                }}
                className="text-xs text-zinc-400 hover:text-white underline"
              >
                Clear Dates
              </button>
            )}
          </div>
        )}

        {/* Secondary Filters Bar: Payment, Channel, Sort */}
        <div className="mt-4 pt-4 border-t border-zinc-800/60 flex items-center justify-between gap-3 flex-wrap text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-zinc-400 font-medium flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" />
              <span>Payment:</span>
            </span>
            <div className="inline-flex rounded-lg bg-zinc-950 p-1 border border-zinc-800">
              {(['all', 'cash', 'card', 'online', 'traded_out'] as const).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentFilter(method)}
                  className={`px-2.5 py-1 rounded-md capitalize font-semibold transition cursor-pointer ${
                    paymentFilter === method
                      ? 'bg-blue-600 text-white'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {method === 'traded_out' ? 'Traded Out' : method}
                </button>
              ))}
            </div>

            <span className="text-zinc-400 font-medium ml-2 flex items-center gap-1">
              <Store className="w-3.5 h-3.5" />
              <span>Channel:</span>
            </span>
            <div className="inline-flex rounded-lg bg-zinc-950 p-1 border border-zinc-800">
              <button
                type="button"
                onClick={() => setChannelFilter('all')}
                className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                  channelFilter === 'all' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setChannelFilter('in_person')}
                className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                  channelFilter === 'in_person' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                In-Person
              </button>
              <button
                type="button"
                onClick={() => setChannelFilter('online')}
                className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                  channelFilter === 'online' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Online
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-zinc-400 font-medium flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>Sort:</span>
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="amount_desc">Highest Amount (£)</option>
              <option value="amount_asc">Lowest Amount (£)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Matching Sales */}
        <div className="bg-white rounded-2xl p-4 border border-zinc-200 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Matching Sales</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-zinc-900">{stats.count}</span>
            <span className="text-xs text-zinc-400 font-medium">transactions</span>
          </div>
        </div>

        {/* Total Revenue */}
        <div className="bg-white rounded-2xl p-4 border border-zinc-200 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Total Sales Volume</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-emerald-600">
              {formatCurrency(stats.totalRevenue)}
            </span>
          </div>
        </div>

        {/* Average Ticket */}
        <div className="bg-white rounded-2xl p-4 border border-zinc-200 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Average Sale</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-zinc-800">
              {formatCurrency(stats.avgTicket)}
            </span>
          </div>
        </div>

        {/* Payment Breakdown Summary */}
        <div className="bg-white rounded-2xl p-4 border border-zinc-200 shadow-xs flex flex-col justify-between text-xs space-y-1.5">
          <span className="font-bold text-zinc-500 uppercase tracking-wider">Method Breakdown</span>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-zinc-600 font-medium">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Cash: {formatCurrency(stats.cashRevenue)} ({stats.cashCount})
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
              Card: {formatCurrency(stats.cardRevenue)} ({stats.cardCount})
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              Online: {formatCurrency(stats.onlineRevenue)} ({stats.onlineCount})
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Trade: {formatCurrency(stats.tradedOutRevenue)} ({stats.tradedOutCount})
            </span>
          </div>
        </div>
      </div>

      {/* Results List / Table */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
        {/* Table Header Bar */}
        <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50/70">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-zinc-900">
              Results ({filteredSales.length})
            </h2>
            {hasActiveFilters && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold">
                Filters Applied
              </span>
            )}
          </div>
          {onNavigateToLedger && (
            <button
              type="button"
              onClick={onNavigateToLedger}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
            >
              Go to Daily Ledger &rarr;
            </button>
          )}
        </div>

        {/* Empty State */}
        {filteredSales.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-zinc-100 text-zinc-400 flex items-center justify-center">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-zinc-800">No Sales Found</h3>
            <p className="text-sm text-zinc-500 max-w-md mx-auto">
              No sales matched your search criteria. Try clearing description terms, selecting "All Vendors", or switching to "All Time".
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-zinc-900 text-white hover:bg-zinc-800 transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear All Filters</span>
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-600">
                <thead className="bg-zinc-100/80 text-zinc-700 uppercase font-bold text-[11px] tracking-wider border-b border-zinc-200">
                  <tr>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Vendor</th>
                    <th className="py-3 px-4">Item Description</th>
                    <th className="py-3 px-4">Channel</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 font-medium">
                  {filteredSales.map((sale) => {
                    const vendorColor = cloudDb.getVendorColor(sale.salesmanName);
                    const formattedDate = new Date(sale.timestamp).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    });
                    const formattedTime = new Date(sale.timestamp).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    });
                    const isOnline = sale.isOnlineSale || sale.paymentMethod === 'online';

                    return (
                      <tr key={sale.id} className="hover:bg-zinc-50/80 transition-colors">
                        {/* Date & Time */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-bold text-zinc-900">{formattedDate}</div>
                          <div className="text-[11px] text-zinc-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{formattedTime}</span>
                          </div>
                        </td>

                        {/* Vendor */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-zinc-100 text-zinc-800 border border-zinc-200/80">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: vendorColor }}
                            />
                            <span>{sale.salesmanName}</span>
                          </div>
                        </td>

                        {/* Description */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-zinc-900 max-w-md truncate">
                            {sale.itemDescription || 'Miscellaneous'}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {sale.onlineBarcode && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-200">
                                <span>Barcode:</span>
                                <span className="font-bold">{sale.onlineBarcode}</span>
                              </span>
                            )}
                            {sale.notes && (
                              <span className="text-[11px] text-zinc-500 italic truncate max-w-xs">
                                Note: {sale.notes}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Channel */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {isOnline ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-violet-50 text-violet-700 border border-violet-200">
                              <Globe className="w-3 h-3 text-violet-600" />
                              <span>Online</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-zinc-100 text-zinc-700 border border-zinc-200">
                              <Store className="w-3 h-3 text-zinc-500" />
                              <span>In-Person</span>
                            </span>
                          )}
                        </td>

                        {/* Payment */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {renderPaymentBadge(sale.paymentMethod, sale.isOnlineSale)}
                        </td>

                        {/* Amount */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <span className="text-sm font-black text-zinc-950">
                            {formatCurrency(sale.amount)}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onEditSale(sale)}
                              title="Edit Sale"
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(sale.id)}
                              title="Delete Sale"
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-zinc-200">
              {filteredSales.map((sale) => {
                const vendorColor = cloudDb.getVendorColor(sale.salesmanName);
                const formattedDate = new Date(sale.timestamp).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                });
                const formattedTime = new Date(sale.timestamp).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true,
                });
                const isOnline = sale.isOnlineSale || sale.paymentMethod === 'online';

                return (
                  <div key={sale.id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-zinc-100 text-zinc-800 border border-zinc-200">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: vendorColor }}
                          />
                          <span>{sale.salesmanName}</span>
                        </div>
                        <h4 className="font-bold text-zinc-900 mt-1 text-sm">
                          {sale.itemDescription || 'Miscellaneous'}
                        </h4>
                      </div>
                      <span className="text-base font-black text-zinc-950 shrink-0">
                        {formatCurrency(sale.amount)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      {renderPaymentBadge(sale.paymentMethod, sale.isOnlineSale)}
                      {isOnline && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-200">
                          Online
                        </span>
                      )}
                      {sale.onlineBarcode && (
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 border border-zinc-200">
                          #{sale.onlineBarcode}
                        </span>
                      )}
                    </div>

                    {sale.notes && (
                      <p className="text-xs text-zinc-500 italic bg-zinc-50 p-2 rounded-lg border border-zinc-200/60">
                        {sale.notes}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-zinc-100 text-xs text-zinc-400">
                      <span>
                        {formattedDate} at {formattedTime}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onEditSale(sale)}
                          className="px-2.5 py-1 rounded-md text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 cursor-pointer flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(sale.id)}
                          className="px-2.5 py-1 rounded-md text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 cursor-pointer flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-zinc-200 space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-zinc-900">Delete This Sale?</h3>
              <p className="text-xs text-zinc-500">
                This transaction will be permanently removed from all ledgers, daily totals, and synced devices.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2.5 rounded-xl border border-zinc-300 text-xs font-bold text-zinc-700 hover:bg-zinc-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteConfirmed(deleteConfirmId)}
                className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-bold text-white shadow-sm cursor-pointer"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
