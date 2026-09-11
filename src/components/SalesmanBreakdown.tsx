import React from 'react';
import { Users, Banknote, CreditCard, ArrowLeftRight } from 'lucide-react';
import { SalesmanStat } from '../types';
import { formatCurrency } from '../db/cloudDatabase';

interface SalesmanBreakdownProps {
  salesmen: SalesmanStat[];
  selectedSalesman: string;
  onSelectSalesman: (name: string) => void;
  totalDayRevenue: number;
}

export const SalesmanBreakdown: React.FC<SalesmanBreakdownProps> = ({
  salesmen,
  selectedSalesman,
  onSelectSalesman,
  totalDayRevenue,
}) => {
  if (salesmen.length === 0) {
    return null;
  }

  const maxSalesmanRevenue = Math.max(...salesmen.map((s) => s.totalAmount), 1);

  return (
    <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-xs overflow-hidden" id="card-salesman-breakdown">
      <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-zinc-500" />
          <h3 className="text-sm font-bold text-zinc-900">Salesman Performance Today</h3>
        </div>
        <span className="text-xs text-zinc-400 font-medium">
          {salesmen.length} {salesmen.length === 1 ? 'salesman active' : 'salesmen active'}
        </span>
      </div>

      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {salesmen.map((salesman) => {
          const isSelected = selectedSalesman === salesman.name;
          const shareOfTotal = totalDayRevenue > 0 ? (salesman.totalAmount / totalDayRevenue) * 100 : 0;
          const relativeBar = (salesman.totalAmount / maxSalesmanRevenue) * 100;

          return (
            <button
              key={salesman.name}
              type="button"
              onClick={() => onSelectSalesman(isSelected ? 'all' : salesman.name)}
              className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-zinc-900 text-white border-zinc-900 shadow-md ring-2 ring-zinc-900/20'
                  : 'bg-zinc-50/70 border-zinc-200 hover:bg-zinc-100/80 text-zinc-900'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-sm truncate max-w-[170px]" title={salesman.name}>
                  {salesman.name}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                    isSelected ? 'bg-zinc-800 text-emerald-400' : 'bg-zinc-200 text-zinc-700'
                  }`}
                >
                  {salesman.count} {salesman.count === 1 ? 'sale' : 'sales'}
                </span>
              </div>

              <div className="flex items-baseline justify-between mb-2">
                <span className={`text-lg font-extrabold ${isSelected ? 'text-white' : 'text-zinc-900'}`}>
                  {formatCurrency(salesman.totalAmount)}
                </span>
                <span className={`text-xs font-medium ${isSelected ? 'text-zinc-400' : 'text-zinc-500'}`}>
                  {shareOfTotal.toFixed(0)}% of day
                </span>
              </div>

              {/* Relative performance bar */}
              <div className="w-full bg-zinc-200/80 h-1.5 rounded-full overflow-hidden mb-2.5">
                <div
                  className={`h-full rounded-full ${isSelected ? 'bg-emerald-400' : 'bg-zinc-800'}`}
                  style={{ width: `${relativeBar}%` }}
                />
              </div>

              {/* Mini payment method breakdown */}
              <div className="flex items-center gap-2 pt-1 border-t border-zinc-200/50 text-[11px]">
                <span
                  className={`inline-flex items-center gap-0.5 ${isSelected ? 'text-emerald-300' : 'text-emerald-700 font-medium'}`}
                  title={`Cash: ${formatCurrency(salesman.cashAmount)}`}
                >
                  <Banknote className="w-3 h-3" />
                  {formatCurrency(salesman.cashAmount)}
                </span>
                <span className="text-zinc-300">•</span>
                <span
                  className={`inline-flex items-center gap-0.5 ${isSelected ? 'text-blue-300' : 'text-blue-700 font-medium'}`}
                  title={`Card: ${formatCurrency(salesman.cardAmount)}`}
                >
                  <CreditCard className="w-3 h-3" />
                  {formatCurrency(salesman.cardAmount)}
                </span>
                <span className="text-zinc-300">•</span>
                <span
                  className={`inline-flex items-center gap-0.5 ${isSelected ? 'text-amber-300' : 'text-amber-700 font-medium'}`}
                  title={`Trade: ${formatCurrency(salesman.tradeAmount)}`}
                >
                  <ArrowLeftRight className="w-3 h-3" />
                  {formatCurrency(salesman.tradeAmount)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
