import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Trophy,
  Medal,
  Crown,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  TrendingUp,
  Banknote,
  CreditCard,
  Globe,
  ArrowLeftRight,
  Sparkles,
  ShoppingBag,
  Award,
  CheckCircle2,
  Users,
} from 'lucide-react';
import { cloudDb, formatCurrency, getLocalDateKey } from '../db/cloudDatabase';
import { VendorLeaderboardSummary, VendorLeaderboardEntry } from '../types';

interface VendorLeaderboardTabProps {
  onNavigateToVendorPortal?: (vendorName?: string) => void;
}

type PeriodType = 'weekly' | 'monthly' | 'all-time';

export const VendorLeaderboardTab: React.FC<VendorLeaderboardTabProps> = ({
  onNavigateToVendorPortal,
}) => {
  const [period, setPeriod] = useState<PeriodType>('weekly');
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() => getLocalDateKey());
  const [notification, setNotification] = useState<string | null>(null);

  // Re-fetch trigger state for real-time db changes
  const [dataVersion, setDataVersion] = useState(0);

  // Subscribe to cloud database updates so leaderboard updates live on any device sale
  useEffect(() => {
    const unsubscribe = cloudDb.subscribe(() => {
      setDataVersion((v) => v + 1);
    });
    return () => unsubscribe();
  }, []);

  // Compute leaderboard summary
  const summary: VendorLeaderboardSummary = useMemo(() => {
    // dataVersion dependency triggers recalculation
    void dataVersion;
    return cloudDb.getVendorLeaderboard({
      period,
      dateKey: selectedDateKey,
    });
  }, [period, selectedDateKey, dataVersion]);

  // Weekly navigation handlers
  const handlePrevWeek = () => {
    const [y, m, d] = selectedDateKey.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() - 7);
    setSelectedDateKey(getLocalDateKey(date));
  };

  const handleNextWeek = () => {
    const [y, m, d] = selectedDateKey.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + 7);
    setSelectedDateKey(getLocalDateKey(date));
  };

  // Monthly navigation handlers
  const handlePrevMonth = () => {
    const [y, m, d] = selectedDateKey.split('-').map(Number);
    const date = new Date(y, m - 2, 1);
    setSelectedDateKey(getLocalDateKey(date));
  };

  const handleNextMonth = () => {
    const [y, m, d] = selectedDateKey.split('-').map(Number);
    const date = new Date(y, m, 1);
    setSelectedDateKey(getLocalDateKey(date));
  };

  const handleResetToCurrent = () => {
    setSelectedDateKey(getLocalDateKey());
  };

  // Export CSV handler
  const handleExportCsv = useCallback(() => {
    if (summary.entries.length === 0) return;
    const csvContent = cloudDb.exportLeaderboardToCsv(summary);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safePeriod = summary.periodType;
    link.href = url;
    link.setAttribute('download', `vendor_leaderboard_${safePeriod}_${selectedDateKey}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setNotification(`Leaderboard for ${summary.periodLabel} exported to CSV`);
    setTimeout(() => setNotification(null), 3000);
  }, [summary, selectedDateKey]);

  // Separate top 3 podium entries from the rest
  const topThree = summary.entries.slice(0, 3);
  const remainingEntries = summary.entries.slice(3);

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-400 text-amber-950 font-black shadow-xs ring-2 ring-amber-300">
          🥇
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-300 text-slate-900 font-black shadow-xs ring-2 ring-slate-200">
          🥈
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-700 text-amber-100 font-black shadow-xs ring-2 ring-amber-600">
          🥉
        </span>
      );
    }
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-zinc-100 text-zinc-700 text-xs font-black border border-zinc-200">
        #{rank}
      </span>
    );
  };

  return (
    <div className="space-y-6" id="vendor-leaderboard-tab">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 bg-zinc-900 text-white px-4 py-3 rounded-xl shadow-xl border border-zinc-700 animate-fade-in text-sm font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{notification}</span>
        </div>
      )}

      {/* Hero Header & Timeframe Switcher */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-850 to-zinc-900 rounded-2xl p-6 text-white border border-zinc-800 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                <Trophy className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
                  <span>Vendor Leaderboard</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 font-bold uppercase tracking-wider">
                    {summary.periodType === 'weekly'
                      ? 'Weekly'
                      : summary.periodType === 'monthly'
                      ? 'Monthly'
                      : 'All Time'}
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
                  Top performing vendors ranked by sales volume, transactions, and store market share.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={summary.entries.length === 0}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm ${
                summary.entries.length === 0
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/50'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>Export Leaderboard (CSV)</span>
            </button>
          </div>
        </div>

        {/* Timeframe Toggle Buttons (Weekly / Monthly / All-Time) */}
        <div className="mt-6 pt-5 border-t border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="inline-flex rounded-xl bg-zinc-950 p-1 border border-zinc-800 shadow-inner">
            <button
              type="button"
              id="btn-leaderboard-weekly"
              onClick={() => setPeriod('weekly')}
              className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                period === 'weekly'
                  ? 'bg-white text-zinc-950 shadow-sm font-black'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <Crown className={`w-3.5 h-3.5 ${period === 'weekly' ? 'text-amber-600' : 'text-amber-400'}`} />
              <span>Weekly Leaderboard</span>
            </button>

            <button
              type="button"
              id="btn-leaderboard-monthly"
              onClick={() => setPeriod('monthly')}
              className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                period === 'monthly'
                  ? 'bg-white text-zinc-950 shadow-sm font-black'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <Calendar className={`w-3.5 h-3.5 ${period === 'monthly' ? 'text-blue-600' : 'text-blue-400'}`} />
              <span>Monthly Leaderboard</span>
            </button>

            <button
              type="button"
              id="btn-leaderboard-all-time"
              onClick={() => setPeriod('all-time')}
              className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                period === 'all-time'
                  ? 'bg-white text-zinc-950 shadow-sm font-black'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <Trophy className={`w-3.5 h-3.5 ${period === 'all-time' ? 'text-amber-500' : 'text-amber-400'}`} />
              <span>All-Time Leaderboard</span>
            </button>
          </div>

          {/* Period Selector & Date Controls */}
          {period !== 'all-time' && (
            <div className="flex items-center gap-2 bg-zinc-950 px-3 py-1.5 rounded-xl border border-zinc-800 text-xs">
              <button
                type="button"
                onClick={period === 'weekly' ? handlePrevWeek : handlePrevMonth}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
                title={period === 'weekly' ? 'Previous Week' : 'Previous Month'}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="font-bold text-white px-2">
                {summary.periodLabel}
              </span>

              <button
                type="button"
                onClick={period === 'weekly' ? handleNextWeek : handleNextMonth}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
                title={period === 'weekly' ? 'Next Week' : 'Next Month'}
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleResetToCurrent}
                className="ml-1 text-[11px] font-bold text-blue-400 hover:text-blue-300 underline cursor-pointer"
              >
                Current
              </button>
            </div>
          )}
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Period Revenue */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-zinc-200 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            <span>Total Sales Volume</span>
          </span>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-emerald-600">
              {formatCurrency(summary.totalRevenue)}
            </div>
            <div className="text-xs text-zinc-400 mt-0.5 font-medium">
              Across all vendors in period
            </div>
          </div>
        </div>

        {/* Current Champion / Leader */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-zinc-200 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
            <Crown className="w-3.5 h-3.5 text-amber-500" />
            <span>#1 Top Vendor</span>
          </span>
          <div className="mt-3">
            {summary.leader ? (
              <div className="flex items-center gap-2.5">
                <span
                  className="w-4 h-4 rounded-full shrink-0 shadow-xs"
                  style={{ backgroundColor: summary.leader.color }}
                />
                <div>
                  <div className="text-xl sm:text-2xl font-black text-zinc-900 truncate">
                    {summary.leader.vendorName}
                  </div>
                  <div className="text-xs font-bold text-amber-600">
                    {formatCurrency(summary.leader.totalRevenue)} ({summary.leader.percentageOfTotal}% share)
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm font-bold text-zinc-400">No sales recorded yet</div>
            )}
          </div>
        </div>

        {/* Total Transactions */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-zinc-200 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
            <ShoppingBag className="w-3.5 h-3.5 text-blue-600" />
            <span>Total Transactions</span>
          </span>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-zinc-900">
              {summary.totalSalesCount}
            </div>
            <div className="text-xs text-zinc-400 mt-0.5 font-medium">
              Average sale: {formatCurrency(summary.averageTicket)}
            </div>
          </div>
        </div>

        {/* Active Vendors */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-zinc-200 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-indigo-600" />
            <span>Active Vendors</span>
          </span>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-zinc-900">
              {summary.activeVendorsCount} <span className="text-sm text-zinc-400 font-normal">/ {summary.entries.length}</span>
            </div>
            <div className="text-xs text-zinc-400 mt-0.5 font-medium">
              Vendors with recorded sales
            </div>
          </div>
        </div>
      </div>

      {/* Top 3 Podium Cards */}
      {topThree.length > 0 && topThree[0].totalRevenue > 0 && (
        <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl p-5 sm:p-6 text-white border border-zinc-800 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
              <Award className="w-4 h-4" />
              <span>Top 3 Champions ({summary.periodLabel})</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1st Place Card (Centered or Left, styled with Gold) */}
            {topThree[0] && (
              <div className="relative order-1 md:order-2 bg-gradient-to-b from-amber-950/40 via-zinc-900 to-zinc-900 rounded-2xl p-5 border-2 border-amber-500/70 shadow-lg shadow-amber-950/40 flex flex-col justify-between space-y-4">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-amber-400 text-amber-950 font-black text-xs flex items-center gap-1 shadow-md uppercase tracking-wider">
                  <Crown className="w-3.5 h-3.5" />
                  <span>1st Place</span>
                </div>

                <div className="pt-2 text-center space-y-1">
                  <div className="inline-flex items-center justify-center p-3 rounded-full bg-amber-500/10 border border-amber-500/30 mx-auto">
                    <span
                      className="w-6 h-6 rounded-full shadow-md"
                      style={{ backgroundColor: topThree[0].color }}
                    />
                  </div>
                  <h3 className="text-lg font-black text-white">{topThree[0].vendorName}</h3>
                  <div className="text-2xl font-black text-amber-400">
                    {formatCurrency(topThree[0].totalRevenue)}
                  </div>
                  <div className="text-xs font-bold text-amber-200/80">
                    {topThree[0].percentageOfTotal}% of total store sales
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-zinc-800 text-xs">
                  <div className="flex justify-between text-zinc-400 font-medium">
                    <span>Transactions:</span>
                    <span className="font-bold text-white">{topThree[0].salesCount} sales</span>
                  </div>
                  <div className="flex justify-between text-zinc-400 font-medium">
                    <span>Average Ticket:</span>
                    <span className="font-bold text-white">{formatCurrency(topThree[0].averageTicket)}</span>
                  </div>
                  {topThree[0].topSaleAmount && (
                    <div className="flex justify-between text-zinc-400 font-medium">
                      <span>Highest Sale:</span>
                      <span className="font-bold text-emerald-400">
                        {formatCurrency(topThree[0].topSaleAmount)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2nd Place Card */}
            {topThree[1] && (
              <div className="order-2 md:order-1 bg-zinc-900/90 rounded-2xl p-5 border border-slate-400/40 shadow-sm flex flex-col justify-between space-y-4">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-300 text-slate-900 font-black text-xs self-start uppercase tracking-wider">
                  <span>🥈 2nd Place</span>
                </div>

                <div className="text-center space-y-1">
                  <div className="inline-flex items-center justify-center p-2.5 rounded-full bg-slate-400/10 border border-slate-400/30 mx-auto">
                    <span
                      className="w-5 h-5 rounded-full shadow-md"
                      style={{ backgroundColor: topThree[1].color }}
                    />
                  </div>
                  <h3 className="text-base font-black text-white">{topThree[1].vendorName}</h3>
                  <div className="text-xl font-black text-slate-200">
                    {formatCurrency(topThree[1].totalRevenue)}
                  </div>
                  <div className="text-xs font-bold text-slate-400">
                    {topThree[1].percentageOfTotal}% share ({topThree[1].salesCount} sales)
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-zinc-800 text-xs">
                  <div className="flex justify-between text-zinc-400 font-medium">
                    <span>Avg Ticket:</span>
                    <span className="font-bold text-white">{formatCurrency(topThree[1].averageTicket)}</span>
                  </div>
                  {topThree[1].topSaleAmount && (
                    <div className="flex justify-between text-zinc-400 font-medium">
                      <span>Top Sale:</span>
                      <span className="font-bold text-emerald-400">
                        {formatCurrency(topThree[1].topSaleAmount)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3rd Place Card */}
            {topThree[2] && (
              <div className="order-3 md:order-3 bg-zinc-900/90 rounded-2xl p-5 border border-amber-700/40 shadow-sm flex flex-col justify-between space-y-4">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-700 text-amber-100 font-black text-xs self-start uppercase tracking-wider">
                  <span>🥉 3rd Place</span>
                </div>

                <div className="text-center space-y-1">
                  <div className="inline-flex items-center justify-center p-2.5 rounded-full bg-amber-700/10 border border-amber-700/30 mx-auto">
                    <span
                      className="w-5 h-5 rounded-full shadow-md"
                      style={{ backgroundColor: topThree[2].color }}
                    />
                  </div>
                  <h3 className="text-base font-black text-white">{topThree[2].vendorName}</h3>
                  <div className="text-xl font-black text-amber-200">
                    {formatCurrency(topThree[2].totalRevenue)}
                  </div>
                  <div className="text-xs font-bold text-amber-400/80">
                    {topThree[2].percentageOfTotal}% share ({topThree[2].salesCount} sales)
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-zinc-800 text-xs">
                  <div className="flex justify-between text-zinc-400 font-medium">
                    <span>Avg Ticket:</span>
                    <span className="font-bold text-white">{formatCurrency(topThree[2].averageTicket)}</span>
                  </div>
                  {topThree[2].topSaleAmount && (
                    <div className="flex justify-between text-zinc-400 font-medium">
                      <span>Top Sale:</span>
                      <span className="font-bold text-emerald-400">
                        {formatCurrency(topThree[2].topSaleAmount)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Full Leaderboard Table & Rankings */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50/70">
          <div>
            <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              <span>Full Standings ({summary.entries.length} Vendors)</span>
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Rankings based on gross sales in {summary.periodLabel}
            </p>
          </div>
          {onNavigateToVendorPortal && (
            <button
              type="button"
              onClick={() => onNavigateToVendorPortal()}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
            >
              Vendor Portal &rarr;
            </button>
          )}
        </div>

        {summary.entries.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Trophy className="w-10 h-10 text-zinc-300 mx-auto" />
            <p className="text-sm font-bold text-zinc-700">No vendor sales found for this period</p>
            <p className="text-xs text-zinc-400">Record a sale or navigate to another week/month.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-600">
                <thead className="bg-zinc-100/80 text-zinc-700 uppercase font-bold text-[11px] tracking-wider border-b border-zinc-200">
                  <tr>
                    <th className="py-3 px-4 text-center w-16">Rank</th>
                    <th className="py-3 px-4">Vendor</th>
                    <th className="py-3 px-4 text-right">Total Revenue</th>
                    <th className="py-3 px-4 text-left w-48">Store Share (%)</th>
                    <th className="py-3 px-4 text-center">Sales Count</th>
                    <th className="py-3 px-4 text-right">Avg Ticket</th>
                    <th className="py-3 px-4">Payment Breakdown</th>
                    <th className="py-3 px-4">Top Item Sold</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 font-medium">
                  {summary.entries.map((entry) => (
                    <tr
                      key={entry.vendorName}
                      className={`hover:bg-zinc-50/80 transition-colors ${
                        entry.rank === 1 ? 'bg-amber-50/30' : ''
                      }`}
                    >
                      {/* Rank */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center">
                          {getRankBadge(entry.rank)}
                        </div>
                      </td>

                      {/* Vendor */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="inline-flex items-center gap-2 font-bold text-zinc-900 text-sm">
                          <span
                            className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs"
                            style={{ backgroundColor: entry.color }}
                          />
                          <span>{entry.vendorName}</span>
                          {entry.rank === 1 && entry.totalRevenue > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-black">
                              LEADER
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Total Revenue */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <span className="text-base font-black text-zinc-950">
                          {formatCurrency(entry.totalRevenue)}
                        </span>
                      </td>

                      {/* Store Share Bar */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-bold text-zinc-700">
                            <span>{entry.percentageOfTotal}%</span>
                          </div>
                          <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden border border-zinc-200">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.min(100, entry.percentageOfTotal)}%`,
                                backgroundColor: entry.color || '#2563eb',
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Sales Count */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-zinc-100 text-zinc-800 border border-zinc-200">
                          {entry.salesCount} {entry.salesCount === 1 ? 'sale' : 'sales'}
                        </span>
                      </td>

                      {/* Average Ticket */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap font-bold text-zinc-800">
                        {formatCurrency(entry.averageTicket)}
                      </td>

                      {/* Payment Breakdown */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-600">
                          {entry.cashRevenue > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <Banknote className="w-3 h-3 text-emerald-600" />
                              <span>{formatCurrency(entry.cashRevenue)}</span>
                            </span>
                          )}
                          {entry.cardRevenue > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200">
                              <CreditCard className="w-3 h-3 text-indigo-600" />
                              <span>{formatCurrency(entry.cardRevenue)}</span>
                            </span>
                          )}
                          {entry.onlineRevenue > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                              <Globe className="w-3 h-3 text-blue-600" />
                              <span>{formatCurrency(entry.onlineRevenue)}</span>
                            </span>
                          )}
                          {entry.tradedOutRevenue > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                              <ArrowLeftRight className="w-3 h-3 text-amber-600" />
                              <span>{formatCurrency(entry.tradedOutRevenue)}</span>
                            </span>
                          )}
                          {entry.totalRevenue === 0 && (
                            <span className="text-zinc-400 italic text-[11px]">No sales</span>
                          )}
                        </div>
                      </td>

                      {/* Top Item */}
                      <td className="py-3.5 px-4 max-w-xs truncate">
                        {entry.topSaleAmount ? (
                          <div className="truncate">
                            <span className="font-bold text-zinc-900">
                              {formatCurrency(entry.topSaleAmount)}
                            </span>
                            <span className="text-zinc-400 ml-1 truncate">
                              • {entry.topSaleDescription}
                            </span>
                          </div>
                        ) : (
                          <span className="text-zinc-400 italic">None</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View */}
            <div className="md:hidden divide-y divide-zinc-200">
              {summary.entries.map((entry) => (
                <div key={entry.vendorName} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      {getRankBadge(entry.rank)}
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: entry.color }}
                          />
                          <h4 className="font-black text-zinc-900 text-sm">
                            {entry.vendorName}
                          </h4>
                          {entry.rank === 1 && entry.totalRevenue > 0 && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-black">
                              #1
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-500 font-medium mt-0.5">
                          {entry.salesCount} {entry.salesCount === 1 ? 'sale' : 'sales'} • Avg ticket {formatCurrency(entry.averageTicket)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-black text-zinc-950">
                        {formatCurrency(entry.totalRevenue)}
                      </div>
                      <div className="text-xs font-bold text-amber-600">
                        {entry.percentageOfTotal}% share
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden border border-zinc-200">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, entry.percentageOfTotal)}%`,
                        backgroundColor: entry.color || '#2563eb',
                      }}
                    />
                  </div>

                  {/* Payment pills */}
                  <div className="flex items-center gap-1.5 flex-wrap text-xs pt-1 border-t border-zinc-100">
                    {entry.cashRevenue > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-semibold">
                        Cash: {formatCurrency(entry.cashRevenue)}
                      </span>
                    )}
                    {entry.cardRevenue > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 text-[11px] font-semibold">
                        Card: {formatCurrency(entry.cardRevenue)}
                      </span>
                    )}
                    {entry.onlineRevenue > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 text-[11px] font-semibold">
                        Online: {formatCurrency(entry.onlineRevenue)}
                      </span>
                    )}
                    {entry.tradedOutRevenue > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-semibold">
                        Trade: {formatCurrency(entry.tradedOutRevenue)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
