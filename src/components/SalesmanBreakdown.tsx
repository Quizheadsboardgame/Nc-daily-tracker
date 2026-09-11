import React from 'react';
import { Users, Banknote, CreditCard, ArrowLeftRight } from 'lucide-react';
import { VendorStat } from '../types';
import { formatCurrency, cloudDb } from '../db/cloudDatabase';

interface VendorBreakdownProps {
  vendors?: VendorStat[];
  salesmen?: VendorStat[];
  selectedVendor?: string;
  selectedSalesman?: string;
  onSelectVendor?: (name: string) => void;
  onSelectSalesman?: (name: string) => void;
  totalDayRevenue: number;
}

export const VendorBreakdown: React.FC<VendorBreakdownProps> = ({
  vendors: propVendors,
  salesmen: propSalesmen,
  selectedVendor: propSelectedVendor,
  selectedSalesman: propSelectedSalesman,
  onSelectVendor,
  onSelectSalesman,
  totalDayRevenue,
}) => {
  const vendors = propVendors || propSalesmen || [];
  const selectedVendor = propSelectedVendor ?? propSelectedSalesman ?? 'all';
  const handleSelectVendor = onSelectVendor || onSelectSalesman || (() => {});

  if (vendors.length === 0) {
    return null;
  }

  const maxVendorRevenue = Math.max(...vendors.map((s) => s.totalAmount), 1);

  return (
    <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-xs overflow-hidden" id="card-vendor-breakdown">
      <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-zinc-500" />
          <h3 className="text-sm font-bold text-zinc-900">Vendor Performance Today</h3>
          <span className="hidden sm:inline-block text-[10px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
            Gross (Before Commission)
          </span>
        </div>
        <span className="text-xs text-zinc-400 font-medium">
          {vendors.length} {vendors.length === 1 ? 'vendor active' : 'vendors active'}
        </span>
      </div>

      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {vendors.map((vendor) => {
          const isSelected = selectedVendor === vendor.name;
          const shareOfTotal = totalDayRevenue > 0 ? (vendor.totalAmount / totalDayRevenue) * 100 : 0;
          const relativeBar = (vendor.totalAmount / maxVendorRevenue) * 100;
          const vendorColor = vendor.color || cloudDb.getVendorColor(vendor.name);

          return (
            <button
              key={vendor.name}
              type="button"
              onClick={() => handleSelectVendor(isSelected ? 'all' : vendor.name)}
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
                    style={{ backgroundColor: vendorColor }}
                  />
                  <span className="font-bold text-sm truncate max-w-[150px]" title={vendor.name}>
                    {vendor.name}
                  </span>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                    isSelected ? 'bg-zinc-800 text-emerald-400' : 'bg-zinc-200 text-zinc-700'
                  }`}
                >
                  {vendor.count} {vendor.count === 1 ? 'sale' : 'sales'}
                </span>
              </div>

              <div className="flex items-baseline justify-between mb-2">
                <span className={`text-lg font-extrabold ${isSelected ? 'text-white' : 'text-zinc-900'}`}>
                  {formatCurrency(vendor.totalAmount)}
                </span>
                <span className={`text-xs font-medium ${isSelected ? 'text-zinc-400' : 'text-zinc-500'}`}>
                  {shareOfTotal.toFixed(0)}% of day
                </span>
              </div>

              {/* Relative performance bar tinted by vendor color */}
              <div className="w-full bg-zinc-200/80 h-1.5 rounded-full overflow-hidden mb-2.5">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${relativeBar}%`,
                    backgroundColor: isSelected ? '#34d399' : vendorColor,
                  }}
                />
              </div>

              {/* Payment method breakdown & Trade taken in */}
              <div className="space-y-1.5 pt-1 border-t border-zinc-200/50 text-[11px]">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-0.5 ${isSelected ? 'text-emerald-300' : 'text-emerald-700 font-medium'}`}
                    title={`Cash: ${formatCurrency(vendor.cashAmount)}`}
                  >
                    <Banknote className="w-3 h-3" />
                    {formatCurrency(vendor.cashAmount)}
                  </span>
                  <span className="text-zinc-300">•</span>
                  <span
                    className={`inline-flex items-center gap-0.5 ${isSelected ? 'text-blue-300' : 'text-blue-700 font-medium'}`}
                    title={`Card: ${formatCurrency(vendor.cardAmount)}`}
                  >
                    <CreditCard className="w-3 h-3" />
                    {formatCurrency(vendor.cardAmount)}
                  </span>
                  <span className="text-zinc-300">•</span>
                  <span
                    className={`inline-flex items-center gap-0.5 ${isSelected ? 'text-amber-300' : 'text-amber-700 font-medium'}`}
                    title={`Trade: ${formatCurrency(vendor.tradeAmount)}`}
                  >
                    <ArrowLeftRight className="w-3 h-3" />
                    {formatCurrency(vendor.tradeAmount)}
                  </span>
                </div>

                {/* Trade taken in badge */}
                {(vendor.tradeTakenInAmount !== undefined && vendor.tradeTakenInAmount > 0) && (
                  <div className={`flex items-center justify-between px-2 py-0.5 rounded text-[10px] font-bold ${
                    isSelected ? 'bg-amber-950/60 text-amber-300 border border-amber-500/30' : 'bg-amber-100/70 text-amber-900 border border-amber-200'
                  }`}>
                    <span>Trades Taken In:</span>
                    <span>{formatCurrency(vendor.tradeTakenInAmount)} ({vendor.tradeTakenInCount || 0})</span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const SalesmanBreakdown = VendorBreakdown;

