import React, { useState } from 'react';
import { Banknote, CreditCard, Receipt, TrendingUp, DollarSign, ArrowLeftRight, Globe, Lock, Unlock, KeyRound } from 'lucide-react';
import { DaySummary } from '../types';
import { formatCurrency } from '../db/cloudDatabase';
import { useTotalSalesAuth } from '../utils/auth';
import { PasscodeModal } from './PasscodeModal';

interface DailyStatsProps {
  summary: DaySummary;
  selectedPaymentFilter: string;
  onSelectPaymentFilter: (filter: 'all' | 'cash' | 'card' | 'traded_out' | 'online') => void;
}

export const DailyStats: React.FC<DailyStatsProps> = ({
  summary,
  selectedPaymentFilter,
  onSelectPaymentFilter,
}) => {
  const { isUnlocked, lock } = useTotalSalesAuth();
  const [isPasscodeModalOpen, setIsPasscodeModalOpen] = useState(false);

  const cashPct = summary.totalRevenue > 0 ? (summary.cashRevenue / summary.totalRevenue) * 100 : 0;
  const cardPct = summary.totalRevenue > 0 ? (summary.cardRevenue / summary.totalRevenue) * 100 : 0;
  const onlinePct = summary.totalRevenue > 0 ? ((summary.onlineRevenue || 0) / summary.totalRevenue) * 100 : 0;
  const tradedOutPct = summary.totalRevenue > 0 ? (summary.tradedOutRevenue / summary.totalRevenue) * 100 : 0;

  return (
    <div className="space-y-4" id="section-daily-stats">
      {/* 6 Sales Ledger KPI Cards - Locked securely to mobile screen */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3.5 w-full max-w-full">
        {/* Total Day Gross Sales Revenue - Protected behind passcode */}
        <div
          id="card-total-sales-gross"
          className="col-span-2 sm:col-span-1 bg-zinc-950 text-white rounded-2xl border border-zinc-800 p-4 sm:p-5 shadow-md relative overflow-hidden ring-1 ring-white/10 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Total Sales
            </span>
            {isUnlocked ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 bg-emerald-950 border border-emerald-500/40 px-2 py-0.5 rounded-md">
                  Unlocked
                </span>
                <button
                  type="button"
                  id="btn-lock-total-sales"
                  onClick={lock}
                  className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700 transition-colors cursor-pointer"
                  title="Lock Total Sales"
                >
                  <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                id="btn-unlock-total-sales"
                onClick={() => setIsPasscodeModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-amber-400 hover:text-amber-300 border border-zinc-700/80 transition-all text-xs font-bold cursor-pointer"
                title="Sign in to unlock total sales"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Locked</span>
              </button>
            )}
          </div>

          <div className="mt-3">
            {isUnlocked ? (
              <div className="text-2xl sm:text-3xl font-black tracking-tight text-white tabular-nums break-words animate-fade-in">
                {formatCurrency(summary.totalRevenue)}
              </div>
            ) : (
              <div
                onClick={() => setIsPasscodeModalOpen(true)}
                className="cursor-pointer group py-1"
                title="Sign in with authorization code to view total sales"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-2xl sm:text-3xl font-mono tracking-widest text-zinc-500 font-bold select-none group-hover:text-zinc-400 transition-colors">
                    ••••••••
                  </span>
                  <span className="text-[10px] font-black uppercase text-emerald-400 bg-emerald-950/80 border border-emerald-500/50 px-2 py-0.5 rounded-md group-hover:bg-emerald-900 transition-colors flex items-center gap-1">
                    <KeyRound className="w-3 h-3" /> Sign In
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 mt-1 font-medium group-hover:text-zinc-400 transition-colors">
                  Tap to enter code & view
                </p>
              </div>
            )}

            <div className="flex items-center gap-1.5 mt-2 text-xs text-zinc-400 font-medium flex-wrap">
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
              {isUnlocked ? (
                formatCurrency(summary.cashRevenue)
              ) : (
                <span className="font-mono tracking-widest text-zinc-400 select-none">••••••••</span>
              )}
            </div>
            <div
              className={`text-xs font-bold mt-1.5 ${
                selectedPaymentFilter === 'cash' ? 'text-emerald-300' : 'text-emerald-700'
              }`}
            >
              {isUnlocked ? `${cashPct.toFixed(1)}% volume` : '••% volume'}
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
              {isUnlocked ? (
                formatCurrency(summary.cardRevenue)
              ) : (
                <span className="font-mono tracking-widest text-zinc-400 select-none">••••••••</span>
              )}
            </div>
            <div
              className={`text-xs font-bold mt-1.5 ${
                selectedPaymentFilter === 'card' ? 'text-blue-300' : 'text-blue-700'
              }`}
            >
              {isUnlocked ? `${cardPct.toFixed(1)}% volume` : '••% volume'}
            </div>
          </div>
        </button>

        {/* Online Sales Card (Clickable Filter) */}
        <button
          type="button"
          id="btn-stat-filter-online"
          onClick={() => onSelectPaymentFilter(selectedPaymentFilter === 'online' ? 'all' : 'online')}
          className={`text-left rounded-2xl border p-4 sm:p-5 shadow-xs transition-all cursor-pointer relative ${
            selectedPaymentFilter === 'online'
              ? 'bg-violet-950 text-white border-violet-500 ring-2 ring-violet-500/50 shadow-md'
              : 'bg-white border-zinc-300 hover:border-violet-500 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between gap-1 flex-wrap">
            <span
              className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                selectedPaymentFilter === 'online' ? 'text-violet-300' : 'text-violet-900'
              }`}
            >
              <Globe className="w-4 h-4 shrink-0 text-violet-500" /> Online
            </span>
            <span
              className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${
                selectedPaymentFilter === 'online'
                  ? 'bg-violet-400 text-zinc-950 font-black'
                  : 'bg-violet-100 text-violet-900 border border-violet-300'
              }`}
            >
              {summary.onlineCount || 0}
            </span>
          </div>
          <div className="mt-3">
            <div
              className={`text-2xl font-black tracking-tight tabular-nums break-words ${
                selectedPaymentFilter === 'online' ? 'text-white' : 'text-zinc-950'
              }`}
            >
              {isUnlocked ? (
                formatCurrency(summary.onlineRevenue || 0)
              ) : (
                <span className="font-mono tracking-widest text-zinc-400 select-none">••••••••</span>
              )}
            </div>
            <div
              className={`text-xs font-bold mt-1.5 ${
                selectedPaymentFilter === 'online' ? 'text-violet-300' : 'text-violet-700'
              }`}
            >
              {isUnlocked ? `${onlinePct.toFixed(1)}% volume` : '••% volume'}
            </div>
          </div>
        </button>

        {/* Trade Out Sales Card (Clickable Filter) */}
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
              <ArrowLeftRight className="w-4 h-4 shrink-0" /> Trade Out
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
              {isUnlocked ? (
                formatCurrency(summary.tradedOutRevenue)
              ) : (
                <span className="font-mono tracking-widest text-zinc-400 select-none">••••••••</span>
              )}
            </div>
            <div
              className={`text-xs font-bold mt-1.5 ${
                selectedPaymentFilter === 'traded_out' ? 'text-amber-300' : 'text-amber-700'
              }`}
            >
              {isUnlocked ? `${tradedOutPct.toFixed(1)}% volume` : '••% volume'}
            </div>
          </div>
        </button>

        {/* Average Ticket Card */}
        <div className="bg-white rounded-2xl border border-zinc-300 p-4 sm:p-5 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-600">
              Avg Ticket
            </span>
            <div className="p-2 rounded-xl bg-zinc-100 border border-zinc-200 text-zinc-800">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <div className="mt-3">
            {isUnlocked ? (
              <>
                <div className="text-2xl font-black tracking-tight text-zinc-950 tabular-nums break-words animate-fade-in">
                  {formatCurrency(summary.averageTicket)}
                </div>
                <div className="flex items-center gap-1.5 mt-1.5 text-xs text-zinc-500 font-medium">
                  <span>Avg per recorded sale</span>
                </div>
              </>
            ) : (
              <div
                onClick={() => setIsPasscodeModalOpen(true)}
                className="cursor-pointer group py-1"
                title="Sign in with authorization code to view"
              >
                <div className="text-2xl font-mono tracking-widest text-zinc-400 select-none group-hover:text-zinc-600 transition-colors">
                  ••••••••
                </div>
                <div className="flex items-center gap-1 text-[11px] text-zinc-400 mt-1 font-medium group-hover:text-emerald-700 transition-colors">
                  <Lock className="w-3 h-3" />
                  <span>Requires code</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Manager Passcode Modal */}
      <PasscodeModal
        isOpen={isPasscodeModalOpen}
        onClose={() => setIsPasscodeModalOpen(false)}
      />
    </div>
  );
};
