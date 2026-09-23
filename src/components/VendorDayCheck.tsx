import React, { useState, useMemo } from 'react';
import { 
  User, 
  Banknote, 
  CreditCard, 
  ArrowLeftRight, 
  Receipt, 
  Calendar, 
  Clock, 
  ShoppingBag,
  Printer,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Download,
  CalendarDays,
  Ticket,
  FileSpreadsheet
} from 'lucide-react';
import { SaleRecord, DaySummary } from '../types';
import { 
  cloudDb, 
  formatCurrency, 
  formatDisplayDate,
  getWeekRangeInfo,
  shiftWeek,
  WeekRangeInfo,
  getLocalDateKey
} from '../db/cloudDatabase';

interface VendorDayCheckProps {
  currentDateKey: string;
  allVendors: string[];
  sales: SaleRecord[];
  summary: DaySummary;
}

type PeriodViewMode = 'weekly' | 'daily';

export const VendorDayCheck: React.FC<VendorDayCheckProps> = ({
  currentDateKey,
  allVendors,
  sales,
}) => {
  const [selectedVendorName, setSelectedVendorName] = useState<string>(() => {
    return allVendors.length > 0 ? allVendors[0] : '';
  });

  // Mode: Weekly (Sunday to Saturday) vs Daily
  const [viewMode, setViewMode] = useState<PeriodViewMode>('weekly');

  // Sunday-to-Saturday active week state
  const [currentWeek, setCurrentWeek] = useState<WeekRangeInfo>(() => {
    return getWeekRangeInfo(currentDateKey);
  });

  // Selected single day for daily view (defaults to currentDateKey)
  const [selectedDailyDateKey, setSelectedDailyDateKey] = useState<string>(currentDateKey);

  // Filter by a specific day within the weekly view (optional drilldown)
  const [weekFilterDayKey, setWeekFilterDayKey] = useState<string | 'all'>('all');

  // Ensure active vendor is valid
  const activeVendor = useMemo(() => {
    if (allVendors.includes(selectedVendorName)) {
      return selectedVendorName;
    }
    return allVendors.length > 0 ? allVendors[0] : '';
  }, [allVendors, selectedVendorName]);

  const vendorColor = activeVendor ? cloudDb.getVendorColor(activeVendor) : '#2563eb';

  // Weekly data computation for the Sunday-to-Saturday week
  const weekData = useMemo(() => {
    if (!activeVendor) return null;
    return cloudDb.getVendorWeekDetails(currentWeek.startDateKey, currentWeek.endDateKey, activeVendor);
  }, [currentWeek.startDateKey, currentWeek.endDateKey, activeVendor, sales]);

  // Daily data computation for selected single day
  const dayData = useMemo(() => {
    if (!activeVendor) return null;
    return cloudDb.getVendorDayDetails(selectedDailyDateKey, activeVendor);
  }, [selectedDailyDateKey, activeVendor, sales]);

  // Filtered sales and trades for week if user clicked a specific day in the 7-day strip
  const displayedWeekSales = useMemo(() => {
    if (!weekData) return [];
    if (weekFilterDayKey === 'all') return weekData.sales;
    return weekData.sales.filter((s) => s.dateKey === weekFilterDayKey);
  }, [weekData, weekFilterDayKey]);

  const displayedWeekTrades = useMemo(() => {
    if (!weekData) return [];
    if (weekFilterDayKey === 'all') return weekData.tradesTakenIn;
    return weekData.tradesTakenIn.filter((t) => t.dateKey === weekFilterDayKey);
  }, [weekData, weekFilterDayKey]);

  // Week navigation
  const handlePrevWeek = () => {
    setCurrentWeek((prev) => shiftWeek(prev.startDateKey, -1));
    setWeekFilterDayKey('all');
  };

  const handleNextWeek = () => {
    setCurrentWeek((prev) => shiftWeek(prev.startDateKey, 1));
    setWeekFilterDayKey('all');
  };

  const handleCurrentWeek = () => {
    setCurrentWeek(getWeekRangeInfo(new Date()));
    setWeekFilterDayKey('all');
  };

  const handlePrintSummary = () => {
    window.print();
  };

  const handleExportCsv = () => {
    if (!activeVendor) return;
    let csvContent = '';
    let filename = '';

    if (viewMode === 'weekly') {
      csvContent = cloudDb.exportWeekToCsv(currentWeek.startDateKey, currentWeek.endDateKey, activeVendor);
      filename = `vendor_${activeVendor.toLowerCase()}_week${currentWeek.weekNumber}_${currentWeek.startDateKey}_to_${currentWeek.endDateKey}.csv`;
    } else {
      csvContent = cloudDb.exportDayToCsv(selectedDailyDateKey);
      filename = `vendor_${activeVendor.toLowerCase()}_${selectedDailyDateKey}.csv`;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (allVendors.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-zinc-200 p-8 text-center shadow-xs" id="vendor-portal-empty">
        <User className="w-10 h-10 text-zinc-400 mx-auto mb-3" />
        <h3 className="text-base font-bold text-zinc-900">No Vendors Found</h3>
        <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
          Please add vendors in the &quot;Manage Vendors&quot; tab to enable vendor-specific reporting.
        </p>
      </div>
    );
  }

  const isCurrentWeekActive = currentWeek.startDateKey === getWeekRangeInfo(new Date()).startDateKey;

  return (
    <div className="space-y-6" id="vendor-daily-check-view">
      {/* Top Header Card: Vendor Selection & View Period Switcher */}
      <div className="bg-white rounded-2xl border border-zinc-200/90 p-4.5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                Vendor Performance Portal
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                Sunday – Saturday Weeks
              </span>
            </div>
            <h2 className="text-lg font-bold text-zinc-900 mt-0.5">
              Sales Ledger (Cash/Card) & Cards Trade-In Overview
            </h2>
          </div>

          {/* Period View Mode (Weekly vs Daily) & Export Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Segmented Toggle: Weekly vs Daily */}
            <div className="bg-zinc-100 p-1 rounded-xl flex items-center border border-zinc-200/80 shadow-2xs">
              <button
                type="button"
                id="btn-vendor-view-weekly"
                onClick={() => setViewMode('weekly')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'weekly'
                    ? 'bg-white text-zinc-900 shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5 text-blue-600" />
                <span>Weekly (Sun–Sat)</span>
              </button>

              <button
                type="button"
                id="btn-vendor-view-daily"
                onClick={() => setViewMode('daily')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'daily'
                    ? 'bg-white text-zinc-900 shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                <span>Daily</span>
              </button>
            </div>

            <button
              type="button"
              id="btn-vendor-export-csv"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-zinc-50 border border-zinc-300 text-zinc-700 text-xs font-semibold cursor-pointer shadow-2xs transition-colors"
              title="Download CSV for this vendor"
            >
              <Download className="w-3.5 h-3.5 text-zinc-500" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            <button
              type="button"
              id="btn-vendor-print-slip"
              onClick={handlePrintSummary}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold cursor-pointer shadow-xs transition-colors"
              title="Print summary slip"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print Slip</span>
            </button>
          </div>
        </div>

        {/* Vendor Selector Pills */}
        <div>
          <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block mb-2">
            Select Vendor:
          </span>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {allVendors.map((vendor) => {
              const isSelected = vendor === activeVendor;
              const color = cloudDb.getVendorColor(vendor);
              return (
                <button
                  key={vendor}
                  type="button"
                  id={`btn-vendor-tab-${vendor.toLowerCase()}`}
                  onClick={() => setSelectedVendorName(vendor)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2.5 transition-all shrink-0 cursor-pointer border ${
                    isSelected
                      ? 'bg-zinc-900 text-white border-zinc-900 shadow-sm ring-2 ring-zinc-900/15'
                      : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-200'
                  }`}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full ring-2 ring-white shrink-0 shadow-2xs"
                    style={{ backgroundColor: color }}
                  />
                  <span>{vendor}</span>
                  {isSelected && (
                    <span className="text-[10px] uppercase font-bold text-emerald-400 bg-zinc-800 px-1.5 py-0.5 rounded">
                      Active
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Period Selector Bar */}
        {viewMode === 'weekly' ? (
          /* Sunday-to-Saturday Week Navigator */
          <div className="pt-2 border-t border-zinc-100 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="btn-week-prev"
                  onClick={handlePrevWeek}
                  className="p-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-100 text-zinc-700 transition-colors cursor-pointer"
                  title="Previous Week"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-xs font-extrabold">
                    Week {currentWeek.weekNumber} ({currentWeek.year})
                  </span>
                  <span className="text-xs font-bold text-zinc-900">
                    {currentWeek.startDisplay} – {currentWeek.endDisplay}
                  </span>
                </div>

                <button
                  type="button"
                  id="btn-week-next"
                  onClick={handleNextWeek}
                  className="p-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-100 text-zinc-700 transition-colors cursor-pointer"
                  title="Next Week"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                {!isCurrentWeekActive && (
                  <button
                    type="button"
                    onClick={handleCurrentWeek}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer ml-1"
                  >
                    Jump to Current Week
                  </button>
                )}
              </div>

              <div className="text-xs text-zinc-500 font-medium">
                Business week runs <strong className="text-zinc-800">Sunday to Saturday</strong>
              </div>
            </div>

            {/* Sunday-to-Saturday 7-Day Filter & Status Strip */}
            <div className="overflow-x-auto pb-1.5 -mx-1 px-1">
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2 min-w-[580px] sm:min-w-0">
                {currentWeek.days.map((day) => {
                  const dayStat = weekData?.dayBreakdown.find((d) => d.dateKey === day.dateKey);
                  const isDaySelected = weekFilterDayKey === day.dateKey;
                  const hasSales = (dayStat?.totalRevenue || 0) > 0;
                  const hasTrade = (dayStat?.tradeTakenInAmount || 0) > 0;

                  return (
                    <button
                      key={day.dateKey}
                      type="button"
                      onClick={() => setWeekFilterDayKey(isDaySelected ? 'all' : day.dateKey)}
                      className={`p-2 rounded-xl text-center transition-all cursor-pointer border ${
                        isDaySelected
                          ? 'bg-blue-900 text-white border-blue-900 ring-2 ring-blue-500/30 shadow-xs'
                          : day.isToday
                          ? 'bg-blue-50/80 border-blue-300 text-blue-950 font-bold'
                          : 'bg-zinc-50/80 hover:bg-zinc-100/80 border-zinc-200 text-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span className={`text-[11px] font-extrabold uppercase ${isDaySelected ? 'text-white' : 'text-zinc-600'}`}>
                          {day.dayName}
                        </span>
                        {day.isToday && (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600" title="Today" />
                        )}
                      </div>
                      <span className={`text-[10px] block font-medium ${isDaySelected ? 'text-blue-200' : 'text-zinc-500'}`}>
                        {day.formattedDate}
                      </span>

                      <div className="mt-1">
                        <span className={`text-xs font-black block leading-tight ${
                          isDaySelected 
                            ? 'text-white' 
                            : hasSales 
                            ? 'text-emerald-700' 
                            : 'text-zinc-400'
                        }`}>
                          {hasSales ? formatCurrency(dayStat!.totalRevenue) : '—'}
                        </span>

                        {hasTrade && (
                          <span className={`text-[9px] font-extrabold px-1 rounded block mt-0.5 ${
                            isDaySelected
                              ? 'bg-amber-400 text-zinc-900'
                              : 'bg-amber-100 text-amber-900'
                          }`} title={`Trade taken in: ${formatCurrency(dayStat!.tradeTakenInAmount)}`}>
                            Trade: {formatCurrency(dayStat!.tradeTakenInAmount)}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {weekFilterDayKey !== 'all' && (
              <div className="flex items-center justify-between text-xs bg-blue-50 border border-blue-200 text-blue-900 px-3 py-1.5 rounded-xl">
                <span>
                  Filtering view for <strong>{formatDisplayDate(weekFilterDayKey)}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setWeekFilterDayKey('all')}
                  className="font-bold underline hover:text-blue-950 cursor-pointer"
                >
                  Show Full Week
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Daily Date Selector */
          <div className="pt-2 border-t border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="vendor-daily-date-select" className="text-xs font-bold text-zinc-700">
                Viewing Date:
              </label>
              <input
                type="date"
                id="vendor-daily-date-select"
                value={selectedDailyDateKey}
                onChange={(e) => setSelectedDailyDateKey(e.target.value || getLocalDateKey())}
                className="px-3 py-1.5 rounded-xl border border-zinc-300 text-xs font-semibold text-zinc-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-zinc-900 cursor-pointer"
              />
              {selectedDailyDateKey !== getLocalDateKey() && (
                <button
                  type="button"
                  onClick={() => setSelectedDailyDateKey(getLocalDateKey())}
                  className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                >
                  Today
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setCurrentWeek(getWeekRangeInfo(selectedDailyDateKey));
                setViewMode('weekly');
              }}
              className="text-xs font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>See full week (Sun – Sat) containing this date</span>
            </button>
          </div>
        )}
      </div>

      {/* MANDATORY DISCLAIMER BANNER: All figures are before commission reductions */}
      <div 
        id="banner-vendor-commission-disclaimer" 
        className="bg-amber-50/90 border-2 border-amber-300/90 rounded-2xl p-4 flex items-start gap-3.5 shadow-xs"
      >
        <div className="p-2 rounded-xl bg-amber-100 text-amber-800 shrink-0 mt-0.5">
          <AlertCircle className="w-5 h-5 text-amber-700" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-xs font-black uppercase tracking-wider text-amber-950">
              Vendor Notice & Disclaimer
            </h4>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-200 text-amber-900 border border-amber-300">
              Before Commission Reductions
            </span>
          </div>
          <p className="text-xs text-amber-900/90 leading-relaxed font-medium">
            All sales figures (cash and card) and cards trade-in valuations (cash payouts and vendor credit) displayed in this portal are <strong>gross amounts before commission reductions</strong>. Payouts and settlements will be calculated after standard commission deductions are applied.
          </p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* WEEKLY VIEW CONTENT */}
      {/* ========================================================================= */}
      {viewMode === 'weekly' && weekData && (
        <div className="space-y-6" id="vendor-weekly-content">
          {/* Vendor Profile Header Banner */}
          <div 
            className="rounded-2xl p-6 text-white shadow-md relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4"
            style={{
              background: `linear-gradient(135deg, ${vendorColor} 0%, #18181b 100%)`,
            }}
          >
            <div className="flex items-center gap-4 relative z-10">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-lg ring-4 ring-white/20"
                style={{ backgroundColor: vendorColor }}
              >
                {weekData.vendorName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs uppercase tracking-widest text-white/90 font-bold">
                    Week {currentWeek.weekNumber} Summary
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-xs text-white/80">
                    {currentWeek.startDisplay} – {currentWeek.endDisplay}
                  </span>
                </div>
                <h1 className="text-2xl font-black tracking-tight mt-0.5">
                  {weekData.vendorName}
                </h1>
                <p className="text-xs text-white/80 mt-0.5 flex items-center gap-2 flex-wrap">
                  <span>{weekData.salesCount} {weekData.salesCount === 1 ? 'sale' : 'sales'} (cash/card)</span>
                  <span>•</span>
                  <span>{weekData.tradeTakenInCount} {weekData.tradeTakenInCount === 1 ? 'trade-in taken in' : 'trade-ins taken in'}</span>
                  <span>•</span>
                  <span className="text-amber-300 font-bold">Gross figures before commission</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 relative z-10 self-start md:self-auto bg-black/30 backdrop-blur-xs px-4 py-2.5 rounded-xl border border-white/10">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-zinc-300 font-bold block">
                  Gross Sales (Cash/Card)
                </span>
                <span className="text-2xl font-black text-white">
                  {formatCurrency(weekData.totalRevenue)}
                </span>
                <span className="text-[9px] text-zinc-400 block">Before commission</span>
              </div>
              <div className="h-8 w-px bg-white/20" />
              <div>
                <span className="text-[10px] uppercase tracking-wider text-amber-300 font-bold block">
                  Cards Traded In
                </span>
                <span className="text-2xl font-black text-amber-400">
                  {formatCurrency(weekData.totalTradeTakenInAmount)}
                </span>
                <span className="text-[9px] text-amber-200/80 block">{weekData.tradeTakenInCount} items</span>
              </div>
            </div>
          </div>

          {/* Primary Weekly KPI Cards (4 Cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Gross Sales */}
            <div className="bg-white rounded-2xl border border-zinc-200 p-4.5 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Weekly Gross Sales
                </span>
                <div className="p-2 rounded-lg bg-zinc-100 text-zinc-700">
                  <Receipt className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-zinc-900">
                {formatCurrency(weekData.totalRevenue)}
              </div>
              <div className="text-xs text-zinc-500 mt-1 flex items-center justify-between">
                <span>{weekData.salesCount} sales logged</span>
                <span className="font-semibold text-zinc-700">
                  Avg: {formatCurrency(weekData.averageTicket)}
                </span>
              </div>
              <div className="mt-2 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded inline-block">
                Before commission reductions
              </div>
            </div>

            {/* KPI 2: Cash & Card Sales Split */}
            <div className="bg-white rounded-2xl border border-zinc-200 p-4.5 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Sales Payment Split
                </span>
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
                  <Banknote className="w-4 h-4" />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <Banknote className="w-3.5 h-3.5" /> Cash:
                  </span>
                  <span className="font-black text-zinc-900">{formatCurrency(weekData.cashRevenue)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-blue-700 font-bold flex items-center gap-1">
                    <CreditCard className="w-3.5 h-3.5" /> Card:
                  </span>
                  <span className="font-black text-zinc-900">{formatCurrency(weekData.cardRevenue)}</span>
                </div>
              </div>
              <div className="mt-2 text-[10px] text-zinc-500 font-medium">
                {weekData.cashCount} cash • {weekData.cardCount} card
              </div>
            </div>

            {/* KPI 3: Total Cards Traded In */}
            <div className="bg-amber-50/60 rounded-2xl border-2 border-amber-300/80 p-4.5 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-900">
                    Cards Traded In
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-amber-200 text-amber-800">
                  <ArrowLeftRight className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-amber-950">
                {formatCurrency(weekData.totalTradeTakenInAmount)}
              </div>
              <div className="text-xs text-amber-800 mt-1 font-medium">
                {weekData.tradeTakenInCount} {weekData.tradeTakenInCount === 1 ? 'card trade' : 'card trades'} taken in
              </div>
              <div className="mt-2 text-[10px] font-bold text-amber-800/90 bg-amber-200/60 px-2 py-0.5 rounded inline-block">
                Before commission reductions
              </div>
            </div>

            {/* KPI 4: Trade Compensation Split (Cash vs Credit) */}
            <div className="bg-white rounded-2xl border border-zinc-200 p-4.5 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Trade Compensation
                </span>
                <div className="p-2 rounded-lg bg-purple-50 text-purple-700">
                  <Ticket className="w-4 h-4" />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <Banknote className="w-3.5 h-3.5" /> Cash Payout:
                  </span>
                  <span className="font-black text-zinc-900">{formatCurrency(weekData.cashTradeValue)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-purple-700 font-bold flex items-center gap-1">
                    <Ticket className="w-3.5 h-3.5" /> Vendor Credit:
                  </span>
                  <span className="font-black text-zinc-900">{formatCurrency(weekData.creditTradeValue)}</span>
                </div>
              </div>
              <div className="mt-2 text-[10px] text-zinc-500 font-medium">
                {weekData.cashTradeCount} cash payouts • {weekData.creditTradeCount} credit issued
              </div>
            </div>
          </div>

          {/* Sunday-to-Saturday Day-by-Day Table */}
          <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-zinc-50/60">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                  <span>Day-by-Day Breakdown (Sunday to Saturday)</span>
                  <span className="text-xs font-normal text-zinc-500">
                    • Week {currentWeek.weekNumber}
                  </span>
                </h3>
                <p className="text-xs text-zinc-500">
                  Daily sales (cash/card) and cards traded in (cash payout / vendor credit). Gross amounts before commission reductions.
                </p>
              </div>

              {weekFilterDayKey !== 'all' && (
                <button
                  type="button"
                  onClick={() => setWeekFilterDayKey('all')}
                  className="text-xs text-blue-600 font-bold hover:underline cursor-pointer"
                >
                  Show Full Week
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50/50 text-zinc-500 uppercase tracking-wider font-semibold">
                    <th className="py-3 px-4">Day</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Sales Count</th>
                    <th className="py-3 px-4 text-right">Gross Sales</th>
                    <th className="py-3 px-4 text-right">Cash Sales</th>
                    <th className="py-3 px-4 text-right">Card Sales</th>
                    <th className="py-3 px-4 text-right text-amber-800">Cards Traded In</th>
                    <th className="py-3 px-4 text-center">Filter Day</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {weekData.dayBreakdown.map((day) => {
                    const isSelected = weekFilterDayKey === day.dateKey;
                    const hasActivity = day.salesCount > 0 || day.tradeTakenInCount > 0;

                    return (
                      <tr
                        key={day.dateKey}
                        className={`transition-colors ${
                          isSelected
                            ? 'bg-blue-50/80 font-semibold'
                            : day.isToday
                            ? 'bg-blue-50/30'
                            : 'hover:bg-zinc-50/70'
                        }`}
                      >
                        <td className="py-3 px-4 font-bold text-zinc-900">
                          <div className="flex items-center gap-1.5">
                            <span>{day.fullDayName}</span>
                            {day.isToday && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-blue-100 text-blue-800">
                                Today
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-zinc-600">
                          {day.formattedDate}
                        </td>
                        <td className="py-3 px-4 text-zinc-700">
                          {day.salesCount > 0 ? (
                            <span className="font-semibold">{day.salesCount} {day.salesCount === 1 ? 'sale' : 'sales'}</span>
                          ) : (
                            <span className="text-zinc-400">0</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-zinc-900">
                          {day.totalRevenue > 0 ? formatCurrency(day.totalRevenue) : <span className="text-zinc-400 font-normal">£0.00</span>}
                        </td>
                        <td className="py-3 px-4 text-right text-emerald-700 font-semibold">
                          {day.cashRevenue > 0 ? formatCurrency(day.cashRevenue) : <span className="text-zinc-400 font-normal">—</span>}
                        </td>
                        <td className="py-3 px-4 text-right text-blue-700 font-semibold">
                          {day.cardRevenue > 0 ? formatCurrency(day.cardRevenue) : <span className="text-zinc-400 font-normal">—</span>}
                        </td>
                        <td className="py-3 px-4 text-right text-amber-800 font-bold">
                          {day.tradeTakenInAmount > 0 ? (
                            <div>
                              <span>{formatCurrency(day.tradeTakenInAmount)}</span>
                              <span className="text-[10px] text-amber-700 block font-normal">
                                ({day.tradeTakenInCount} {day.tradeTakenInCount === 1 ? 'trade' : 'trades'})
                              </span>
                            </div>
                          ) : (
                            <span className="text-zinc-400 font-normal">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {hasActivity ? (
                            <button
                              type="button"
                              onClick={() => setWeekFilterDayKey(isSelected ? 'all' : day.dateKey)}
                              className={`text-xs px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-zinc-900 text-white'
                                  : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                              }`}
                            >
                              {isSelected ? 'Viewing' : 'View'}
                            </button>
                          ) : (
                            <span className="text-zinc-300 text-[11px]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-zinc-200 bg-zinc-100/70 font-black text-zinc-900">
                    <td className="py-3 px-4">Week {currentWeek.weekNumber} Total</td>
                    <td className="py-3 px-4 text-zinc-500 font-semibold text-[11px]">Sun – Sat</td>
                    <td className="py-3 px-4">{weekData.salesCount}</td>
                    <td className="py-3 px-4 text-right text-sm">{formatCurrency(weekData.totalRevenue)}</td>
                    <td className="py-3 px-4 text-right text-emerald-700">{formatCurrency(weekData.cashRevenue)}</td>
                    <td className="py-3 px-4 text-right text-blue-700">{formatCurrency(weekData.cardRevenue)}</td>
                    <td className="py-3 px-4 text-right text-amber-800">{formatCurrency(weekData.totalTradeTakenInAmount)}</td>
                    <td className="py-3 px-4 text-center text-[10px] font-bold text-amber-800">
                      Gross Total
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* SECTION: Cards Traded In to this Vendor */}
          <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-xs overflow-hidden" id="section-weekly-trades-taken-in">
            <div className="px-5 py-4 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-amber-50/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500 text-white shadow-xs">
                  <ArrowLeftRight className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                    <span>Cards Traded In to {weekData.vendorName}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
                      {displayedWeekTrades.length}
                    </span>
                    {weekFilterDayKey !== 'all' && (
                      <span className="text-xs text-amber-900 font-medium">
                        ({formatDisplayDate(weekFilterDayKey)})
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Cards traded in for cash payout or vendor credit. Figures before commission reductions.
                  </p>
                </div>
              </div>

              <div className="text-right sm:self-auto self-start">
                <span className="text-[11px] text-zinc-500 block uppercase font-semibold">Total Cards Traded Value:</span>
                <span className="text-base font-black text-amber-700">
                  {formatCurrency(
                    displayedWeekTrades.reduce((sum, t) => sum + t.tradeValue, 0)
                  )}
                </span>
                <span className="text-[10px] text-amber-800/80 block font-medium">Before commission</span>
              </div>
            </div>

            {displayedWeekTrades.length === 0 ? (
              <div className="p-8 text-center text-zinc-500">
                <ArrowLeftRight className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-zinc-700">
                  No cards trade-ins recorded for {weekData.vendorName} {weekFilterDayKey === 'all' ? 'this week' : 'on this date'}
                </p>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Cards logged on the Trades page for {weekData.vendorName} will automatically appear here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {displayedWeekTrades.map((trade, idx) => {
                  const isCash = trade.tradeType === 'cash';
                  return (
                    <div key={trade.id || idx} className="p-4 hover:bg-zinc-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            Trade #{idx + 1}
                          </span>
                          {/* Compensation Type Badge */}
                          {isCash ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                              <Banknote className="w-3 h-3 text-emerald-700" />
                              Cash Payout
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-black bg-purple-100 text-purple-900 border border-purple-300">
                              <Ticket className="w-3 h-3 text-purple-700" />
                              Vendor's Credit
                            </span>
                          )}

                          <span className="text-xs font-bold text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded-md">
                            {formatDisplayDate(trade.dateKey)}
                          </span>
                          <span className="text-xs text-zinc-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(trade.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <div className="text-sm font-bold text-zinc-900 flex items-center gap-1.5 pt-0.5">
                          <ShoppingBag className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>Cards Traded: </span>
                          <span className="text-zinc-900">{trade.itemDescription}</span>
                        </div>

                        {trade.customerName && (
                          <div className="text-xs text-zinc-600">
                            Customer: <strong className="text-zinc-800">{trade.customerName}</strong>
                          </div>
                        )}

                        {trade.notes && (
                          <p className="text-xs text-zinc-500 italic bg-zinc-50 px-2 py-1 rounded border border-zinc-100 mt-1">
                            Note: {trade.notes}
                          </p>
                        )}
                      </div>

                      <div className="sm:text-right bg-amber-50 sm:bg-transparent p-3 sm:p-0 rounded-xl shrink-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
                          Assessed Trade Value (Before Comm.)
                        </span>
                        <span className="text-xl font-black text-amber-700">
                          {formatCurrency(trade.tradeValue)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECTION: Sales Logged this Week (Cash or Card) */}
          <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-xs overflow-hidden" id="section-weekly-sales-logged">
            <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-zinc-900 text-white shadow-xs">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                    <span>Sales Ledger Records for {weekData.vendorName}</span>
                    <span className="text-xs font-normal text-zinc-500">
                      • Week {currentWeek.weekNumber}
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Gross sales in cash or card before commission reductions
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-zinc-600 px-2.5 py-1 bg-zinc-100 rounded-lg">
                {displayedWeekSales.length} {displayedWeekSales.length === 1 ? 'sale' : 'sales'}
              </span>
            </div>

            {displayedWeekSales.length === 0 ? (
              <div className="p-8 text-center text-zinc-500">
                <ShoppingBag className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-zinc-700">
                  No sales logged for {weekData.vendorName} {weekFilterDayKey === 'all' ? 'this week' : 'on this date'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {displayedWeekSales.map((sale) => {
                  const isCash = sale.paymentMethod === 'cash';

                  return (
                    <div key={sale.id} className="p-4 hover:bg-zinc-50/60 transition-colors flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isCash ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <Banknote className="w-3 h-3 text-emerald-600" /> Cash
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                              <CreditCard className="w-3 h-3 text-blue-600" /> Card
                            </span>
                          )}
                          <span className="text-xs font-bold text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded-md">
                            {formatDisplayDate(sale.dateKey)}
                          </span>
                          <span className="text-xs text-zinc-400">
                            {new Date(sale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <h4 className="text-sm font-semibold text-zinc-900 flex items-center gap-1.5 flex-wrap">
                          <span>{sale.itemDescription}</span>
                          {(sale.isMiscellaneous || sale.itemDescription.trim().toLowerCase() === 'miscellaneous') && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              Misc
                            </span>
                          )}
                        </h4>
                        {sale.notes && (
                          <p className="text-xs text-zinc-500 italic">
                            Note: {sale.notes}
                          </p>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-base font-black text-zinc-900">
                          {formatCurrency(sale.amount)}
                        </span>
                        <span className="text-[10px] text-zinc-400 block">Gross amount</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DAILY VIEW CONTENT */}
      {/* ========================================================================= */}
      {viewMode === 'daily' && dayData && (
        <div className="space-y-6" id="vendor-daily-content">
          {/* Vendor Profile Header Banner (Daily) */}
          <div 
            className="rounded-2xl p-6 text-white shadow-md relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4"
            style={{
              background: `linear-gradient(135deg, ${vendorColor} 0%, #18181b 100%)`,
            }}
          >
            <div className="flex items-center gap-4 relative z-10">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-lg ring-4 ring-white/20"
                style={{ backgroundColor: vendorColor }}
              >
                {dayData.vendorName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-widest text-white/80 font-bold">
                    Daily Summary
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-xs text-white/80">{dayData.formattedDate}</span>
                </div>
                <h1 className="text-2xl font-black tracking-tight mt-0.5">{dayData.vendorName}</h1>
                <p className="text-xs text-white/80 mt-0.5">
                  {dayData.salesCount} {dayData.salesCount === 1 ? 'sale logged' : 'sales logged'} • {dayData.tradeTakenInCount} {dayData.tradeTakenInCount === 1 ? 'trade taken in' : 'trades taken in'} today
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 relative z-10 self-start md:self-auto bg-black/25 backdrop-blur-xs px-4 py-2.5 rounded-xl border border-white/10">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-zinc-300 font-semibold block">
                  Gross Sales (Cash/Card)
                </span>
                <span className="text-2xl font-black text-white">
                  {formatCurrency(dayData.totalRevenue)}
                </span>
                <span className="text-[9px] text-zinc-300 block">Before commission</span>
              </div>
              <div className="h-8 w-px bg-white/20" />
              <div>
                <span className="text-[10px] uppercase tracking-wider text-amber-300 font-semibold block">
                  Cards Traded In
                </span>
                <span className="text-2xl font-black text-amber-400">
                  {formatCurrency(dayData.totalTradeTakenInAmount)}
                </span>
                <span className="text-[9px] text-amber-200/80 block">{dayData.tradeTakenInCount} items</span>
              </div>
            </div>
          </div>

          {/* Daily Primary KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-zinc-200 p-4.5 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Gross Sales Today
                </span>
                <div className="p-2 rounded-lg bg-zinc-100 text-zinc-700">
                  <Receipt className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-zinc-900">
                {formatCurrency(dayData.totalRevenue)}
              </div>
              <div className="text-xs text-zinc-500 mt-1 flex items-center justify-between">
                <span>{dayData.salesCount} completed sales</span>
                <span className="font-semibold text-zinc-700">
                  Avg: {formatCurrency(dayData.averageTicket)}
                </span>
              </div>
              <div className="mt-2 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded inline-block">
                Before commission reductions
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-zinc-200 p-4.5 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Sales Payment Split
                </span>
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
                  <Banknote className="w-4 h-4" />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <Banknote className="w-3.5 h-3.5" /> Cash:
                  </span>
                  <span className="font-black text-zinc-900">{formatCurrency(dayData.cashRevenue)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-blue-700 font-bold flex items-center gap-1">
                    <CreditCard className="w-3.5 h-3.5" /> Card:
                  </span>
                  <span className="font-black text-zinc-900">{formatCurrency(dayData.cardRevenue)}</span>
                </div>
              </div>
              <div className="mt-2 text-[10px] text-zinc-500 font-medium">
                {dayData.cashCount} cash • {dayData.cardCount} card
              </div>
            </div>

            <div className="bg-amber-50/60 rounded-2xl border-2 border-amber-300/80 p-4.5 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-900">
                    Cards Traded In
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-amber-200 text-amber-800">
                  <ArrowLeftRight className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-amber-950">
                {formatCurrency(dayData.totalTradeTakenInAmount)}
              </div>
              <div className="text-xs text-amber-800 mt-1 font-medium">
                {dayData.tradeTakenInCount} {dayData.tradeTakenInCount === 1 ? 'trade taken in' : 'trades taken in'}
              </div>
              <div className="mt-2 text-[10px] font-bold text-amber-800/90 bg-amber-200/60 px-2 py-0.5 rounded inline-block">
                Before commission reductions
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-zinc-200 p-4.5 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Trade Compensation
                </span>
                <div className="p-2 rounded-lg bg-purple-50 text-purple-700">
                  <Ticket className="w-4 h-4" />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <Banknote className="w-3.5 h-3.5" /> Cash Payout:
                  </span>
                  <span className="font-black text-zinc-900">{formatCurrency(dayData.cashTradeValue)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-purple-700 font-bold flex items-center gap-1">
                    <Ticket className="w-3.5 h-3.5" /> Vendor Credit:
                  </span>
                  <span className="font-black text-zinc-900">{formatCurrency(dayData.creditTradeValue)}</span>
                </div>
              </div>
              <div className="mt-2 text-[10px] text-zinc-500 font-medium">
                {dayData.cashTradeCount} cash payouts • {dayData.creditTradeCount} credit issued
              </div>
            </div>
          </div>

          {/* Cards Traded In to Vendor Today */}
          <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-amber-50/30">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500 text-white shadow-xs">
                  <ArrowLeftRight className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                    <span>Cards Traded In to {dayData.vendorName} Today</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
                      {dayData.tradeTakenInCount}
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Gross trade valuations before commission reductions
                  </p>
                </div>
              </div>

              <div className="text-right sm:self-auto self-start">
                <span className="text-xs text-zinc-500 block">Total Cards Traded Value:</span>
                <span className="text-base font-black text-amber-700">
                  {formatCurrency(dayData.totalTradeTakenInAmount)}
                </span>
              </div>
            </div>

            {dayData.tradesTakenIn.length === 0 ? (
              <div className="p-8 text-center text-zinc-500">
                <ArrowLeftRight className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-zinc-700">No cards trade-ins taken in today by {dayData.vendorName}</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {dayData.tradesTakenIn.map((trade, idx) => {
                  const isCash = trade.tradeType === 'cash';
                  return (
                    <div key={trade.id || idx} className="p-4 hover:bg-zinc-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            Trade #{idx + 1}
                          </span>
                          {isCash ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                              <Banknote className="w-3 h-3 text-emerald-700" />
                              Cash Payout
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-black bg-purple-100 text-purple-900 border border-purple-300">
                              <Ticket className="w-3 h-3 text-purple-700" />
                              Vendor's Credit
                            </span>
                          )}
                          <span className="text-xs text-zinc-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(trade.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <div className="text-sm font-bold text-zinc-900 flex items-center gap-1.5 pt-0.5">
                          <ShoppingBag className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>Cards Traded: </span>
                          <span className="text-zinc-900">{trade.itemDescription}</span>
                        </div>

                        {trade.customerName && (
                          <div className="text-xs text-zinc-600">
                            Customer: <strong className="text-zinc-800">{trade.customerName}</strong>
                          </div>
                        )}

                        {trade.notes && (
                          <p className="text-xs text-zinc-500 italic bg-zinc-50 px-2 py-1 rounded border border-zinc-100 mt-1">
                            Note: {trade.notes}
                          </p>
                        )}
                      </div>

                      <div className="sm:text-right bg-amber-50 sm:bg-transparent p-3 sm:p-0 rounded-xl shrink-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
                          Assessed Value (Before Comm.)
                        </span>
                        <span className="text-xl font-black text-amber-700">
                          {formatCurrency(trade.tradeValue)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sales Logged Today */}
          <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-zinc-900 text-white shadow-xs">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900">
                    Sales Logged by {dayData.vendorName} Today
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Gross amounts in cash or card before commission reductions
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-zinc-600 px-2.5 py-1 bg-zinc-100 rounded-lg">
                {dayData.sales.length} {dayData.sales.length === 1 ? 'sale' : 'sales'}
              </span>
            </div>

            {dayData.sales.length === 0 ? (
              <div className="p-8 text-center text-zinc-500">
                <ShoppingBag className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-zinc-700">No sales logged yet today by {dayData.vendorName}</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {dayData.sales.map((sale) => {
                  const isCash = sale.paymentMethod === 'cash';

                  return (
                    <div key={sale.id} className="p-4 hover:bg-zinc-50/60 transition-colors flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {isCash ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <Banknote className="w-3 h-3 text-emerald-600" /> Cash
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                              <CreditCard className="w-3 h-3 text-blue-600" /> Card
                            </span>
                          )}
                          <span className="text-xs text-zinc-400">
                            {new Date(sale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <h4 className="text-sm font-semibold text-zinc-900 flex items-center gap-1.5 flex-wrap">
                          <span>{sale.itemDescription}</span>
                          {(sale.isMiscellaneous || sale.itemDescription.trim().toLowerCase() === 'miscellaneous') && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              Misc
                            </span>
                          )}
                        </h4>
                        {sale.notes && (
                          <p className="text-xs text-zinc-500 italic">
                            Note: {sale.notes}
                          </p>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-base font-black text-zinc-900">
                          {formatCurrency(sale.amount)}
                        </span>
                        <span className="text-[10px] text-zinc-400 block">Gross amount</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
