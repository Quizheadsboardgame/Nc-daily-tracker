import React from 'react';
import { Banknote, CreditCard, Receipt, TrendingUp, DollarSign, ArrowLeftRight } from 'lucide-react';
import { DaySummary } from '../types';
import { formatCurrency } from '../db/cloudDatabase';

interface DailyStatsProps {
  summary: DaySummary;
  selectedPaymentFilter: string;
  onSelectPaymentFilter: (filter: 'all' | 'cash' | 'card' | 'traded_out') => void;
}

export const DailyStats: React.FC<DailyStatsProps> = ({
  summary,
  selectedPaymentFilter,
  onSelectPaymentFilter,
}) => {
  const cashPct = summary.totalRevenue > 0 ? (summary.cashRevenue / summary.totalRevenue) * 100 : 0;
  const cardPct = summary.totalRevenue > 0 ? (summary.cardRevenue / summary.totalRevenue) * 100 : 0;
  const tradedOutPct = summary.totalRevenue > 0 ? (summary.tradedOutRevenue / summary.totalRevenue) * 100 : 0;

  return (
    <div className="space-y-4" id="section-daily-stats">
      {/* 5 Sales Ledger KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Total Day Gross Sales Revenue */}
        <div className="bg-zinc-950 text-white rounded-2xl border border-zinc-800 p-4 sm:p-5 shadow-md relative overflow-hidden ring-1 ring-white/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Total Sales
            </span>
            <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-700/80 text-white">
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black tracking-tight text-white tabular-nums break-words">
              {formatCurrency(summary.totalRevenue)}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-zinc-400 font-medium flex-wrap">
              <Receipt className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>
                <strong className="text-white font-bold">{summary.totalCount}</strong>{' '}
                {summary.totalCount === 1 ? 'sale' : 'sales'} logged
              </span>
            </div>
          </div>
        </div>

        {/* Cash Sales Card (Clickable Filter) */}
        <button
          type="button"
          id="btn-stat-filter-cash"
          onClick={() => onSelectPaymentFilter(selectedPaymentFilter === 'cash' ? 'all' : 'cash')}
          className={`text-left rounded-2xl border p-4 sm:p-5 shadow-xs transition-all cursor-pointer relative ${
            selectedPaymentFilter === 'cash'
              ? 'bg-emerald-950 text-white border-emerald-500 ring-2 ring-emerald-500/50 shadow-md'
              : 'bg-white border-zinc-300 hover:border-emerald-500 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between gap-1 flex-wrap">
            <span
              className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                selectedPaymentFilter === 'cash' ? 'text-emerald-300' : 'text-emerald-800'
              }`}
            >
              <Banknote className="w-4 h-4 shrink-0" /> Cash
            </span>
            <span
              className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${
                selectedPaymentFilter === 'cash'
                  ? 'bg-emerald-500 text-zinc-950 font-black'
                  : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
              }`}
            >
              {summary.cashCount}
            </span>
          </div>
          <div className="mt-3">
            <div
              className={`text-2xl font-black tracking-tight tabular-nums break-words ${
                selectedPaymentFilter === 'cash' ? 'text-white' : 'text-zinc-950'
              }`}
            >
              {formatCurrency(summary.cashRevenue)}
            </div>
            <div
              className={`text-xs font-bold mt-1.5 ${
                selectedPaymentFilter === 'cash' ? 'text-emerald-300' : 'text-emerald-700'
              }`}
            >
              {cashPct.toFixed(1)}% volume
            </div>
          </div>
        </button>

        {/* Card Sales Card (Clickable Filter) */}
        <button
          type="button"
          id="btn-stat-filter-card"
          onClick={() => onSelectPaymentFilter(selectedPaymentFilter === 'card' ? 'all' : 'card')}
          className={`text-left rounded-2xl border p-4 sm:p-5 shadow-xs transition-all cursor-pointer relative ${
            selectedPaymentFilter === 'card'
              ? 'bg-blue-950 text-white border-blue-500 ring-2 ring-blue-500/50 shadow-md'
              : 'bg-white border-zinc-300 hover:border-blue-500 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between gap-1 flex-wrap">
            <span
              className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                selectedPaymentFilter === 'card' ? 'text-blue-300' : 'text-blue-800'
              }`}
            >
              <CreditCard className="w-4 h-4 shrink-0" /> Card
            </span>
            <span
              className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${
                selectedPaymentFilter === 'card'
                  ? 'bg-blue-400 text-zinc-950 font-black'
                  : 'bg-blue-100 text-blue-900 border border-blue-300'
              }`}
            >
              {summary.cardCount}
            </span>
          </div>
          <div className="mt-3">
            <div
              className={`text-2xl font-black tracking-tight tabular-nums break-words ${
                selectedPaymentFilter === 'card' ? 'text-white' : 'text-zinc-950'
              }`}
            >
              {formatCurrency(summary.cardRevenue)}
            </div>
            <div
              className={`text-xs font-bold mt-1.5 ${
                selectedPaymentFilter === 'card' ? 'text-blue-300' : 'text-blue-700'
              }`}
            >
              {cardPct.toFixed(1)}% volume
            </div>
          </div>
        </button>

        {/* Traded Out Sales Card (Clickable Filter) */}
        <button
          type="button"
          id="btn-stat-filter-traded-out"
          onClick={() => onSelectPaymentFilter(selectedPaymentFilter === 'traded_out' ? 'all' : 'traded_out')}
          className={`text-left rounded-2xl border p-4 sm:p-5 shadow-xs transition-all cursor-pointer relative ${
            selectedPaymentFilter === 'traded_out'
              ? 'bg-amber-950 text-white border-amber-500 ring-2 ring-amber-500/50 shadow-md'
              : 'bg-white border-zinc-300 hover:border-amber-500 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between gap-1 flex-wrap">
            <span
              className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                selectedPaymentFilter === 'traded_out' ? 'text-amber-300' : 'text-amber-900'
              }`}
            >
              <ArrowLeftRight className="w-4 h-4 shrink-0" /> Traded Out
            </span>
            <span
              className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${
                selectedPaymentFilter === 'traded_out'
                  ? 'bg-amber-400 text-zinc-950 font-black'
                  : 'bg-amber-100 text-amber-900 border border-amber-300'
              }`}
            >
              {summary.tradedOutCount}
            </span>
          </div>
          <div className="mt-3">
            <div
              className={`text-2xl font-black tracking-tight tabular-nums break-words ${
                selectedPaymentFilter === 'traded_out' ? 'text-white' : 'text-zinc-950'
              }`}
            >
              {formatCurrency(summary.tradedOutRevenue)}
            </div>
            <div
              className={`text-xs font-bold mt-1.5 ${
                selectedPaymentFilter === 'traded_out' ? 'text-amber-300' : 'text-amber-700'
              }`}
            >
              {tradedOutPct.toFixed(1)}% volume
            </div>
          </div>
        </button>

        {/* Average Ticket Card */}
        <div className="bg-white rounded-2xl border border-zinc-300 p-4 sm:p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-600">
              Avg Ticket
            </span>
            <div className="p-2 rounded-xl bg-zinc-100 border border-zinc-200 text-zinc-800">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black tracking-tight text-zinc-950 tabular-nums break-words">
              {formatCurrency(summary.averageTicket)}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-zinc-500 font-medium">
              <span>Avg per recorded sale</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
