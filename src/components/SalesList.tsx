import React, { useState, useMemo } from 'react';
import {
  Search,
  Banknote,
  CreditCard,
  ArrowLeftRight,
  Edit2,
  Trash2,
  Clock,
  SlidersHorizontal,
} from 'lucide-react';
import { SaleRecord, PaymentMethod } from '../types';
import { formatCurrency, cloudDb } from '../db/cloudDatabase';

interface SalesListProps {
  sales: SaleRecord[];
  allVendors?: string[];
  allSalesmen?: string[];
  selectedPaymentFilter: string;
  onSelectPaymentFilter: (filter: 'all' | 'cash' | 'card' | 'traded_out') => void;
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
          (s.notes && s.notes.toLowerCase().includes(q)) ||
          ((q === 'trade out' || q === 'traded out' || q === 'trade') && s.paymentMethod === 'traded_out')
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

  const renderPaymentBadge = (method: PaymentMethod | string) => {
    if (method === 'cash') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
          <Banknote className="w-3.5 h-3.5 text-emerald-600" />
          Cash
        </span>
      );
    }
    if (method === 'traded_out') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
          <ArrowLeftRight className="w-3.5 h-3.5 text-amber-700" />
          Trade Out
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
        <CreditCard className="w-3.5 h-3.5 text-blue-600" />
        Card
      </span>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-xs overflow-hidden" id="card-sales-ledger">
      {/* Header with Title and Search Controls */}
      <div className="p-4 sm:p-5 border-b border-zinc-100 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-zinc-900">Today's Sales Records</h2>
            <p className="text-xs text-zinc-500">
              Showing {filteredSales.length} of {sales.length} transactions (Cash, Card & Trade Out)
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
              placeholder="Search item, vendor name, or sale memo..."
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

          {/* Payment Filter Pills (Cash, Card, or Trade Out) */}
          <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg border border-zinc-200 text-xs flex-wrap sm:flex-nowrap">
            <button
              type="button"
              id="filter-payment-all"
              onClick={() => onSelectPaymentFilter('all')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                selectedPaymentFilter === 'all'
                  ? 'bg-white text-zinc-900 shadow-xs font-bold'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              All Sales
            </button>
            <button
              type="button"
              id="filter-payment-cash"
              onClick={() => onSelectPaymentFilter('cash')}
              className={`px-2.5 py-1 rounded-md font-medium flex items-center gap-1 transition-all cursor-pointer ${
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
              className={`px-2.5 py-1 rounded-md font-medium flex items-center gap-1 transition-all cursor-pointer ${
                selectedPaymentFilter === 'card'
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : 'text-zinc-600 hover:text-blue-700'
              }`}
            >
              <CreditCard className="w-3 h-3" /> Card
            </button>
            <button
              type="button"
              id="filter-payment-traded-out"
              onClick={() => onSelectPaymentFilter('traded_out')}
              className={`px-2.5 py-1 rounded-md font-medium flex items-center gap-1 transition-all cursor-pointer ${
                selectedPaymentFilter === 'traded_out'
                  ? 'bg-amber-600 text-white shadow-xs font-bold'
                  : 'text-amber-800 hover:text-amber-900'
              }`}
            >
              <ArrowLeftRight className="w-3 h-3" /> Trade Out
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
              <option value="amount-high">Amount: High to Low</option>
              <option value="amount-low">Amount: Low to High</option>
            </select>
          </div>
        </div>
      </div>

      {/* Sales Table / List View */}
      {filteredSales.length === 0 ? (
        <div className="text-center py-12 px-4">
          <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto mb-3">
            <SlidersHorizontal className="w-6 h-6 text-zinc-400" />
          </div>
          <h3 className="text-sm font-semibold text-zinc-800 mb-1">No sales records match your criteria</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Try adjusting your search query, selecting "All Sales", or record a new sale above.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50/80 text-zinc-500 font-semibold uppercase tracking-wider border-b border-zinc-100">
              <tr>
                <th scope="col" className="py-3 px-4">Time</th>
                <th scope="col" className="py-3 px-4">Vendor</th>
                <th scope="col" className="py-3 px-4">Item Sold</th>
                <th scope="col" className="py-3 px-4 text-right">Gross Price</th>
                <th scope="col" className="py-3 px-4 text-center">Payment / Settlement</th>
                <th scope="col" className="py-3 px-4">Notes</th>
                <th scope="col" className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredSales.map((sale) => {
                const dateObj = new Date(sale.timestamp);
                const timeString = dateObj.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true,
                });
                const isMisc = Boolean(sale.isMiscellaneous) || sale.itemDescription?.trim().toLowerCase() === 'miscellaneous';
                const isTradeOut = sale.paymentMethod === 'traded_out';
                const vendorColor = cloudDb.getVendorColor(sale.salesmanName);

                return (
                  <tr
                    key={sale.id}
                    className={`transition-colors group ${
                      isTradeOut
                        ? 'bg-amber-50/30 hover:bg-amber-50/60'
                        : 'hover:bg-zinc-50/70'
                    }`}
                  >
                    {/* Timestamp */}
                    <td className="py-3 px-4 whitespace-nowrap text-zinc-500 font-medium">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-zinc-400" />
                        {timeString}
                      </span>
                    </td>

                    {/* Vendor Name */}
                    <td className="py-3 px-4 whitespace-nowrap font-bold text-zinc-900">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                          style={{ backgroundColor: vendorColor }}
                        />
                        <span>{sale.salesmanName}</span>
                      </div>
                    </td>

                    {/* Item Description */}
                    <td className="py-3 px-4 font-medium text-zinc-800 max-w-[260px]">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isMisc ? (
                          <span className="inline-flex items-center gap-1 font-bold text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded text-[11px] border border-zinc-200">
                            Miscellaneous
                          </span>
                        ) : (
                          <span className="break-words">{sale.itemDescription}</span>
                        )}
                        {isTradeOut && (
                          <span className="inline-flex items-center gap-1 font-bold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded text-[10px] border border-amber-300">
                            <ArrowLeftRight className="w-2.5 h-2.5 text-amber-700" />
                            Trade Out
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Amount */}
                    <td className="py-3 px-4 whitespace-nowrap text-right font-black text-sm text-zinc-950 tabular-nums">
                      {formatCurrency(sale.amount)}
                    </td>

                    {/* Payment Method Badge */}
                    <td className="py-3 px-4 whitespace-nowrap text-center">
                      {renderPaymentBadge(sale.paymentMethod)}
                    </td>

                    {/* Notes */}
                    <td className="py-3 px-4 text-zinc-500 max-w-[180px] truncate" title={sale.notes}>
                      {sale.notes || '—'}
                    </td>

                    {/* Action buttons */}
                    <td className="py-3 px-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => onEditSale(sale)}
                          className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
                          title="Edit transaction"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {deleteConfirmId === sale.id ? (
                          <div className="flex items-center gap-1 animate-fade-in">
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteSale(sale.id);
                                setDeleteConfirmId(null);
                              }}
                              className="px-2 py-1 rounded bg-rose-600 text-white font-bold text-[11px] hover:bg-rose-700 cursor-pointer shadow-xs"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-1.5 py-1 rounded bg-zinc-200 text-zinc-700 font-medium text-[11px] hover:bg-zinc-300 cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(sale.id)}
                            className="p-1.5 rounded-md text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete transaction"
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
  );
};
