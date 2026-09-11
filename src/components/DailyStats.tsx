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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Day Revenue */}
        <div className="bg-white rounded-2xl border border-zinc-200/90 p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Total Day Revenue
            </span>
            <div className="p-1.5 rounded-lg bg-zinc-900 text-white">
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-extrabold tracking-tight text-zinc-900">
              {formatCurrency(summary.totalRevenue)}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-zinc-500">
              <Receipt className="w-3.5 h-3.5" />
              <span>{summary.totalCount} sales recorded today</span>
            </div>
          </div>
        </div>

        {/* Cash Sales Card (Clickable Filter) */}
        <button
          type="button"
          onClick={() => onSelectPaymentFilter(selectedPaymentFilter === 'cash' ? 'all' : 'cash')}
          className={`text-left rounded-2xl border p-4 shadow-xs transition-all cursor-pointer relative ${
            selectedPaymentFilter === 'cash'
              ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20'
              : 'bg-white border-zinc-200/90 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
              <Banknote className="w-3.5 h-3.5" /> Cash Sales
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              {summary.cashCount} {summary.cashCount === 1 ? 'sale' : 'sales'}
            </span>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-extrabold tracking-tight text-emerald-950">
              {formatCurrency(summary.cashRevenue)}
            </div>
            <div className="text-xs text-emerald-700 mt-1">
              {cashPct.toFixed(1)}% of day volume
            </div>
          </div>
        </button>

        {/* Card Sales Card (Clickable Filter) */}
        <button
          type="button"
          onClick={() => onSelectPaymentFilter(selectedPaymentFilter === 'card' ? 'all' : 'card')}
          className={`text-left rounded-2xl border p-4 shadow-xs transition-all cursor-pointer relative ${
            selectedPaymentFilter === 'card'
              ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20'
              : 'bg-white border-zinc-200/90 hover:border-blue-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-800 flex items-center gap-1">
              <CreditCard className="w-3.5 h-3.5" /> Card Sales
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
              {summary.cardCount} {summary.cardCount === 1 ? 'sale' : 'sales'}
            </span>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-extrabold tracking-tight text-blue-950">
              {formatCurrency(summary.cardRevenue)}
            </div>
            <div className="text-xs text-blue-700 mt-1">
              {cardPct.toFixed(1)}% of day volume
            </div>
          </div>
        </button>

        {/* Trade Sales Card (Clickable Filter) */}
        <button
          type="button"
          onClick={() => onSelectPaymentFilter(selectedPaymentFilter === 'trade' ? 'all' : 'trade')}
          className={`text-left rounded-2xl border p-4 shadow-xs transition-all cursor-pointer relative ${
            selectedPaymentFilter === 'trade'
              ? 'bg-amber-50/80 border-amber-500 ring-2 ring-amber-500/20'
              : 'bg-white border-zinc-200/90 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-800 flex items-center gap-1">
              <ArrowLeftRight className="w-3.5 h-3.5" /> Trade Deals
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
              {summary.tradeCount} {summary.tradeCount === 1 ? 'deal' : 'deals'}
            </span>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-extrabold tracking-tight text-amber-950">
              {formatCurrency(summary.tradeRevenue)}
            </div>
            <div className="text-xs text-amber-700 mt-1">
              {tradePct.toFixed(1)}% of day volume
            </div>
          </div>
        </button>
      </div>

      {/* Breakdown Ribbon: Average Ticket & Top Salesman of the Day */}
      <div className="bg-white rounded-2xl border border-zinc-200/90 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-zinc-100 text-zinc-700">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs text-zinc-500 font-medium">Average Sale Ticket:</span>{' '}
            <span className="text-sm font-bold text-zinc-900">{formatCurrency(summary.averageTicket)}</span>
          </div>
        </div>

        {(summary.topVendor || summary.topSalesman) && (
          <div className="flex items-center gap-2 bg-amber-50/80 border border-amber-200/80 px-3 py-1.5 rounded-xl">
            <Trophy className="w-4 h-4 text-amber-600 shrink-0" />
            <div className="text-xs">
              <span className="text-zinc-600">Leading Vendor Today:</span>{' '}
              <span className="font-bold text-zinc-900">{(summary.topVendor || summary.topSalesman)!.name}</span>{' '}
              <span className="text-amber-800 font-semibold">
                ({formatCurrency((summary.topVendor || summary.topSalesman)!.totalAmount)} • {(summary.topVendor || summary.topSalesman)!.count} {(summary.topVendor || summary.topSalesman)!.count === 1 ? 'sale' : 'sales'})
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
