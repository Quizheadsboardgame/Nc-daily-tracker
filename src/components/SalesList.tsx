import React, { useState, useMemo } from 'react';
import {
  Search,
  Banknote,
  CreditCard,
  ArrowLeftRight,
  Edit2,
  Trash2,
  Clock,
  User,
  SlidersHorizontal,
  ArrowUpDown,
  FileText,
} from 'lucide-react';
import { SaleRecord, PaymentMethod } from '../types';
import { formatCurrency, cloudDb } from '../db/cloudDatabase';

interface SalesListProps {
  sales: SaleRecord[];
  allVendors?: string[];
  allSalesmen?: string[];
  selectedPaymentFilter: string;
  onSelectPaymentFilter: (filter: 'all' | 'cash' | 'card' | 'trade') => void;
  selectedVendor?: string;
  selectedSalesman?: string;
  onSelectVendor?: (name: string) => void;
  onSelectSalesman?: (name: string) => void;
  onEditSale: (sale: SaleRecord) => void;
  onDeleteSale: (id: string) => void;
}

export const SalesList: React.FC<SalesListProps> = ({
  sales,
  allVendors: propAllVendors,
  allSalesmen: propAllSalesmen,
  selectedPaymentFilter,
  onSelectPaymentFilter,
  selectedVendor: propSelectedVendor,
  selectedSalesman: propSelectedSalesman,
  onSelectVendor,
  onSelectSalesman,
  onEditSale,
  onDeleteSale,
}) => {
  const allVendors = propAllVendors || propAllSalesmen || [];
  const selectedVendor = propSelectedVendor ?? propSelectedSalesman ?? 'all';
  const handleSelectVendor = onSelectVendor || onSelectSalesman || (() => {});

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'amount-high' | 'amount-low'>('newest');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Filter and sort sales
  const filteredSales = useMemo(() => {
    let result = [...sales];

    // Filter by payment method
    if (selectedPaymentFilter !== 'all') {
      result = result.filter((s) => s.paymentMethod === selectedPaymentFilter);
    }

    // Filter by vendor
    if (selectedVendor !== 'all') {
      result = result.filter((s) => s.salesmanName === selectedVendor);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (s) =>
          s.itemDescription.toLowerCase().includes(q) ||
          s.salesmanName.toLowerCase().includes(q) ||
          (s.tradeAcceptingVendor && s.tradeAcceptingVendor.toLowerCase().includes(q)) ||
          (s.tradeItemDescription && s.tradeItemDescription.toLowerCase().includes(q)) ||
          (s.tradeDetails && s.tradeDetails.toLowerCase().includes(q)) ||
          (s.notes && s.notes.toLowerCase().includes(q))
      );
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'newest') return b.timestamp - a.timestamp;
      if (sortBy === 'oldest') return a.timestamp - b.timestamp;
      if (sortBy === 'amount-high') return b.amount - a.amount;
      if (sortBy === 'amount-low') return a.amount - b.amount;
      return 0;
    });

    return result;
  }, [sales, selectedPaymentFilter, selectedVendor, searchQuery, sortBy]);

  const filteredTotalRevenue = useMemo(() => {
    return filteredSales.reduce((sum, s) => sum + s.amount, 0);
  }, [filteredSales]);

  const renderPaymentBadge = (method: PaymentMethod, tradeDetails?: string) => {
    switch (method) {
      case 'cash':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <Banknote className="w-3.5 h-3.5 text-emerald-600" />
            Cash
          </span>
        );
      case 'card':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
            <CreditCard className="w-3.5 h-3.5 text-blue-600" />
            Card
          </span>
        );
      case 'trade':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <ArrowLeftRight className="w-3.5 h-3.5 text-amber-600" />
            Trade
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-xs overflow-hidden" id="card-sales-ledger">
      {/* Header with Title and Search Controls */}
      <div className="p-4 sm:p-5 border-b border-zinc-100 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-zinc-900">Today's Sales Records</h2>
            <p className="text-xs text-zinc-500">
              Showing {filteredSales.length} of {sales.length} transactions recorded in memory
            </p>
          </div>

          <div className="text-right">
            <span className="text-xs text-zinc-400 font-medium">Filtered Total:</span>{' '}
            <span className="text-base font-extrabold text-zinc-900">{formatCurrency(filteredTotalRevenue)}</span>
          </div>
        </div>

        {/* Search and Filters Bar */}
        <div className="flex flex-col md:flex-row gap-2.5 pt-1">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
            <input
              type="text"
              id="input-search-sales"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search item, salesman name, or trade note..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-zinc-200 bg-zinc-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 text-zinc-900 transition-all"
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

          {/* Payment Filter Pills */}
          <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg border border-zinc-200 text-xs">
            <button
              type="button"
              id="filter-payment-all"
              onClick={() => onSelectPaymentFilter('all')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                selectedPaymentFilter === 'all'
                  ? 'bg-white text-zinc-900 shadow-xs font-bold'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              All
            </button>
            <button
              type="button"
              id="filter-payment-cash"
              onClick={() => onSelectPaymentFilter('cash')}
              className={`px-2.5 py-1 rounded-md font-medium flex items-center gap-1 transition-all ${
                selectedPaymentFilter === 'cash'
                  ? 'bg-emerald-600 text-white shadow-xs font-bold'
                  : 'text-zinc-600 hover:text-emerald-700'
              }`}
            >
              <Banknote className="w-3 h-3" /> Cash
            </button>
            <button
              type="button"
              id="filter-payment-card"
              onClick={() => onSelectPaymentFilter('card')}
              className={`px-2.5 py-1 rounded-md font-medium flex items-center gap-1 transition-all ${
                selectedPaymentFilter === 'card'
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : 'text-zinc-600 hover:text-blue-700'
              }`}
            >
              <CreditCard className="w-3 h-3" /> Card
            </button>
            <button
              type="button"
              id="filter-payment-trade"
              onClick={() => onSelectPaymentFilter('trade')}
              className={`px-2.5 py-1 rounded-md font-medium flex items-center gap-1 transition-all ${
                selectedPaymentFilter === 'trade'
                  ? 'bg-amber-600 text-white shadow-xs font-bold'
                  : 'text-zinc-600 hover:text-amber-700'
              }`}
            >
              <ArrowLeftRight className="w-3 h-3" /> Trade
            </button>
          </div>

          {/* Vendor Filter Dropdown */}
          <div className="flex items-center gap-1.5">
            <select
              id="select-vendor-filter"
              value={selectedVendor}
              onChange={(e) => handleSelectVendor(e.target.value)}
              className="text-xs font-medium text-zinc-800 bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-zinc-900/10 cursor-pointer"
            >
              <option value="all">All Vendors</option>
              {allVendors.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>

            {/* Sort Dropdown */}
            <select
              id="select-sort-by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-xs font-medium text-zinc-800 bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-zinc-900/10 cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="amount-high">Amount (High to Low)</option>
              <option value="amount-low">Amount (Low to High)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Sales Records List */}
      {filteredSales.length === 0 ? (
        <div className="p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto mb-3 text-zinc-400">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-zinc-900">No Sales Records Found</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1">
            {sales.length === 0
              ? "No sales have been recorded for this date yet. Use the 'Record New Sale' form to add transactions."
              : 'No sales match your current search or filter criteria. Try resetting your filters.'}
          </p>
          {(selectedPaymentFilter !== 'all' || selectedVendor !== 'all' || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                onSelectPaymentFilter('all');
                handleSelectVendor('all');
                setSearchQuery('');
              }}
              className="mt-3 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-zinc-100 overflow-x-auto">
          {/* Table Header on Desktop */}
          <div className="hidden md:grid md:grid-cols-12 px-5 py-2.5 bg-zinc-50/80 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            <div className="col-span-2">Time</div>
            <div className="col-span-3">Vendor</div>
            <div className="col-span-4">Item Sold & Details</div>
            <div className="col-span-2 text-right">Price / Method</div>
            <div className="col-span-1 text-right">Actions</div>
          </div>

          {filteredSales.map((sale) => {
            const timeStr = new Date(sale.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={sale.id}
                id={`sale-row-${sale.id}`}
                className="p-4 md:px-5 md:py-3.5 hover:bg-zinc-50/70 transition-colors grid grid-cols-1 md:grid-cols-12 items-start md:items-center gap-2 md:gap-3"
              >
                {/* Time & Date */}
                <div className="md:col-span-2 flex items-center gap-1.5 text-xs text-zinc-500">
                  <Clock className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="font-medium text-zinc-700">{timeStr}</span>
                </div>

                {/* Vendor Name with Brand Color Badge */}
                <div className="md:col-span-3 flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-2xs"
                    style={{ backgroundColor: cloudDb.getVendorColor(sale.salesmanName) }}
                  >
                    {sale.salesmanName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-zinc-900">{sale.salesmanName}</span>
                      <span
                        className="w-2 h-2 rounded-full inline-block shrink-0"
                        style={{ backgroundColor: cloudDb.getVendorColor(sale.salesmanName) }}
                      />
                    </div>
                    <span className="text-[10px] text-zinc-400">Vendor</span>
                  </div>
                </div>

                {/* Item Sold and Trade Details */}
                <div className="md:col-span-4 space-y-1">
                  <span className="text-sm font-semibold text-zinc-900 block leading-snug">
                    {sale.itemDescription}
                  </span>

                  {sale.paymentMethod === 'trade' && (
                    <div className="p-2 rounded-lg bg-amber-50/80 border border-amber-200/90 text-amber-950 text-[11px] space-y-0.5">
                      <div className="flex items-center gap-1 font-semibold text-amber-900">
                        <ArrowLeftRight className="w-3 h-3 text-amber-700 shrink-0" />
                        <span>Trade-in</span>
                        {sale.tradeValue !== undefined && (
                          <span className="ml-auto font-bold text-amber-800">
                            Valued at £{sale.tradeValue.toFixed(2)}
                          </span>
                        )}
                      </div>
                      {sale.tradeAcceptingVendor && (
                        <div className="text-[11px] text-amber-900 flex items-center gap-1.5">
                          <span>Accepted by:</span>
                          <span className="inline-flex items-center gap-1 font-bold text-zinc-900 bg-white/80 px-1.5 py-0.5 rounded border border-amber-200">
                            <span
                              className="w-2 h-2 rounded-full inline-block"
                              style={{ backgroundColor: cloudDb.getVendorColor(sale.tradeAcceptingVendor) }}
                            />
                            {sale.tradeAcceptingVendor}
                          </span>
                        </div>
                      )}
                      {sale.tradeItemDescription && (
                        <div className="text-[10px] text-zinc-600">
                          Item: {sale.tradeItemDescription}
                        </div>
                      )}
                      {!sale.tradeAcceptingVendor && sale.tradeValue === undefined && sale.tradeDetails && (
                        <div className="text-[10px] text-amber-800">{sale.tradeDetails}</div>
                      )}
                    </div>
                  )}

                  {sale.notes && (
                    <p className="text-[11px] text-zinc-500 italic">"{sale.notes}"</p>
                  )}
                </div>

                {/* Amount & Payment Method */}
                <div className="md:col-span-2 flex md:flex-col md:items-end justify-between items-center gap-1.5">
                  <span className="text-base font-extrabold text-zinc-900">
                    {formatCurrency(sale.amount)}
                  </span>
                  <div>{renderPaymentBadge(sale.paymentMethod, sale.tradeDetails)}</div>
                </div>

                {/* Actions: Edit / Delete */}
                <div className="md:col-span-1 flex items-center justify-end gap-1 pt-2 md:pt-0 border-t md:border-t-0 border-zinc-100">
                  <button
                    type="button"
                    onClick={() => onEditSale(sale)}
                    className="p-1.5 text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
                    title="Edit Sale"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  {deleteConfirmId === sale.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteSale(sale.id);
                          setDeleteConfirmId(null);
                        }}
                        className="px-2 py-1 text-[10px] font-bold text-white bg-rose-600 hover:bg-rose-700 rounded transition-colors"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(null)}
                        className="px-1.5 py-1 text-[10px] text-zinc-500 hover:text-zinc-700"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(sale.id)}
                      className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Delete Sale"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
