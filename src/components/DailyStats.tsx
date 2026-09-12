import React from 'react';
import { Banknote, CreditCard, ArrowLeftRight, TrendingUp, Receipt, Trophy, DollarSign } from 'lucide-react';
import { DaySummary } from '../types';
import { formatCurrency } from '../db/cloudDatabase';

interface DailyStatsProps {
  summary: DaySummary;
  selectedPaymentFilter: string;
  onSelectPaymentFilter: (filter: 'all' | 'cash' | 'card' | 'trade') => void;
}

export const DailyStats: React.FC<DailyStatsProps> = ({
  summary,
  selectedPaymentFilter,
  onSelectPaymentFilter,
}) => {
  const cashPct = summary.totalRevenue > 0 ? (summary.cashRevenue / summary.totalRevenue) * 100 : 0;
  const cardPct = summary.totalRevenue > 0 ? (summary.cardRevenue / summary.totalRevenue) * 100 : 0;
  const tradePct = summary.totalRevenue > 0 ? (summary.tradeRevenue / summary.totalRevenue) * 100 : 0;

  return (
    <div className="space-y-4" id="section-daily-stats">
      {/* Top Banner with Total Revenue and Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Day Revenue - Executive Dark Hero Card */}
        <div className="bg-zinc-950 text-white rounded-2xl border border-zinc-800 p-4 sm:p-5 shadow-md relative overflow-hidden ring-1 ring-white/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Total Day Revenue
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
                <strong className="text-white font-bold">{summary.totalCount}</strong> {summary.totalCount === 1 ? 'sale' : 'sales'} recorded today
              </span>
            </div>
          </div>
        </div>

        {/* Cash Sales Card (Clickable Filter) */}
        <button
          type="button"
          onClick={() => onSelectPaymentFilter(selectedPaymentFilter === 'cash' ? 'all' : 'cash')}
          className={`text-left rounded-2xl border p-4 sm:p-5 shadow-xs transition-all cursor-pointer relative ${
            selectedPaymentFilter === 'cash'
              ? 'bg-emerald-950 text-white border-emerald-500 ring-2 ring-emerald-500/50 shadow-md'
              : 'bg-white border-zinc-300 hover:border-emerald-500 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between gap-1 flex-wrap">
            <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
              selectedPaymentFilter === 'cash' ? 'text-emerald-300' : 'text-emerald-800'
            }`}>
              <Banknote className="w-4 h-4 shrink-0" /> Cash Sales
            </span>
            <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${
              selectedPaymentFilter === 'cash'
                ? 'bg-emerald-500 text-zinc-950 font-black'
                : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
            }`}>
              {summary.cashCount} {summary.cashCount === 1 ? 'sale' : 'sales'}
            </span>
          </div>
          <div className="mt-3">
            <div className={`text-2xl sm:text-3xl font-black tracking-tight tabular-nums break-words ${
              selectedPaymentFilter === 'cash' ? 'text-white' : 'text-zinc-950'
            }`}>
              {formatCurrency(summary.cashRevenue)}
            </div>
            <div className={`text-xs font-bold mt-1.5 ${
              selectedPaymentFilter === 'cash' ? 'text-emerald-300' : 'text-emerald-700'
            }`}>
              {cashPct.toFixed(1)}% of total volume
            </div>
          </div>
        </button>

        {/* Card Sales Card (Clickable Filter) */}
        <button
          type="button"
          onClick={() => onSelectPaymentFilter(selectedPaymentFilter === 'card' ? 'all' : 'card')}
          className={`text-left rounded-2xl border p-4 sm:p-5 shadow-xs transition-all cursor-pointer relative ${
            selectedPaymentFilter === 'card'
              ? 'bg-blue-950 text-white border-blue-500 ring-2 ring-blue-500/50 shadow-md'
              : 'bg-white border-zinc-300 hover:border-blue-500 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between gap-1 flex-wrap">
            <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
              selectedPaymentFilter === 'card' ? 'text-blue-300' : 'text-blue-800'
            }`}>
              <CreditCard className="w-4 h-4 shrink-0" /> Card Sales
            </span>
            <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${
              selectedPaymentFilter === 'card'
                ? 'bg-blue-400 text-zinc-950 font-black'
                : 'bg-blue-100 text-blue-900 border border-blue-300'
            }`}>
              {summary.cardCount} {summary.cardCount === 1 ? 'sale' : 'sales'}
            </span>
          </div>
          <div className="mt-3">
            <div className={`text-2xl sm:text-3xl font-black tracking-tight tabular-nums break-words ${
              selectedPaymentFilter === 'card' ? 'text-white' : 'text-zinc-950'
            }`}>
              {formatCurrency(summary.cardRevenue)}
            </div>
            <div className={`text-xs font-bold mt-1.5 ${
              selectedPaymentFilter === 'card' ? 'text-blue-300' : 'text-blue-700'
            }`}>
              {cardPct.toFixed(1)}% of total volume
            </div>
          </div>
        </button>

        {/* Trade Deals Card (Clickable Filter) */}
        <button
          type="button"
          onClick={() => onSelectPaymentFilter(selectedPaymentFilter === 'trade' ? 'all' : 'trade')}
          className={`text-left rounded-2xl border p-4 sm:p-5 shadow-xs transition-all cursor-pointer relative ${
            selectedPaymentFilter === 'trade'
              ? 'bg-amber-950 text-white border-amber-500 ring-2 ring-amber-500/50 shadow-md'
              : 'bg-white border-zinc-300 hover:border-amber-500 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between gap-1 flex-wrap">
            <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
              selectedPaymentFilter === 'trade' ? 'text-amber-300' : 'text-amber-800'
            }`}>
              <ArrowLeftRight className="w-4 h-4 shrink-0" /> Trade Deals
            </span>
            <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${
              selectedPaymentFilter === 'trade'
                ? 'bg-amber-400 text-zinc-950 font-black'
                : 'bg-amber-100 text-amber-900 border border-amber-300'
            }`}>
              {summary.tradeCount} {summary.tradeCount === 1 ? 'deal' : 'deals'}
            </span>
          </div>
          <div className="mt-3">
            <div className={`text-2xl sm:text-3xl font-black tracking-tight tabular-nums break-words ${
              selectedPaymentFilter === 'trade' ? 'text-white' : 'text-zinc-950'
            }`}>
              {formatCurrency(summary.tradeRevenue)}
            </div>
            <div className={`text-xs font-bold mt-1.5 ${
              selectedPaymentFilter === 'trade' ? 'text-amber-300' : 'text-amber-700'
            }`}>
              {tradePct.toFixed(1)}% of total volume
            </div>
          </div>
        </button>
      </div>

      {/* Breakdown Ribbon: Average Ticket & Top Vendor of the Day */}
      <div className="bg-white rounded-2xl border border-zinc-300/80 px-5 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-zinc-900 text-white shadow-2xs">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Average Sale Ticket:</span>{' '}
            <span className="text-base font-black text-zinc-950 tabular-nums ml-1">
              {formatCurrency(summary.averageTicket)}
            </span>
          </div>
        </div>

        {(summary.topVendor || summary.topSalesman) && (
          <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-300 px-3.5 py-1.5 rounded-xl shadow-2xs">
            <Trophy className="w-4 h-4 text-amber-600 shrink-0" />
            <div className="text-xs">
              <span className="text-zinc-600 font-semibold">Leading Vendor Today:</span>{' '}
              <span className="font-extrabold text-zinc-950">{(summary.topVendor || summary.topSalesman)!.name}</span>{' '}
              <span className="text-amber-900 font-bold">
                ({formatCurrency((summary.topVendor || summary.topSalesman)!.totalAmount)} • {(summary.topVendor || summary.topSalesman)!.count} {(summary.topVendor || summary.topSalesman)!.count === 1 ? 'sale' : 'sales'})
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
