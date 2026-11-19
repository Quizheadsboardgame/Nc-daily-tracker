import React, { useState, useEffect, useMemo } from 'react';
import {
  Flame,
  Calendar,
  Clock,
  Lock,
  TrendingUp,
  Award,
  Moon,
  BarChart3,
} from 'lucide-react';
import { HeatmapCell, HeatmapMetric } from '../types';
import { cloudDb, formatCurrency } from '../db/cloudDatabase';
import { useTotalSalesAuth } from '../utils/auth';
import { VendorDropdown } from './VendorDropdown';
import { PasscodeModal } from './PasscodeModal';

interface BusiestHoursHeatmapProps {
  knownVendors: string[];
}

export const BusiestHoursHeatmap: React.FC<BusiestHoursHeatmapProps> = ({ knownVendors }) => {
  const { isUnlocked } = useTotalSalesAuth();
  const [isPasscodeOpen, setIsPasscodeOpen] = useState(false);

  const [rangeDays, setRangeDays] = useState<30 | 90 | 'all'>(90);
  const [selectedVendor, setSelectedVendor] = useState<string>('all');
  const [metric, setMetric] = useState<HeatmapMetric>('revenue');
  const [inspectedSlot, setInspectedSlot] = useState<{ dayIndex: number; hour: number } | null>(null);

  const [syncTick, setSyncTick] = useState(0);
  useEffect(() => {
    return cloudDb.subscribe(() => setSyncTick((t) => t + 1));
  }, []);

  const liveHeatmap = useMemo(
    () =>
      cloudDb.getBusiestHoursHeatmapData({
        rangeDays,
        vendor: selectedVendor,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rangeDays, selectedVendor, syncTick]
  );

  const formatHour = (h: number) => `${String(h).padStart(2, '0')}:00`;

  const getCellMetricValue = (cell: HeatmapCell): number => {
    if (metric === 'count') return cell.salesCount;
    if (metric === 'avgTicket') return cell.avgTicket;
    return cell.totalRevenue;
  };

  const maxMetricVal = useMemo(() => {
    let max = 0;
    for (const row of liveHeatmap.cells) {
      for (const cell of row) {
        const val = getCellMetricValue(cell);
        if (val > max) max = val;
      }
    }
    return max;
  }, [liveHeatmap, metric]);

  const activeInspectedCell: HeatmapCell | null = useMemo(() => {
    if (inspectedSlot) {
      const row = liveHeatmap.cells[inspectedSlot.dayIndex];
      const match = row?.find((c) => c.hour === inspectedSlot.hour);
      if (match) return match;
    }
    return liveHeatmap.goldenSlot;
  }, [inspectedSlot, liveHeatmap]);

  const getHeatCellClasses = (val: number, salesCount: number, isInspected: boolean) => {
    const ring = isInspected ? 'ring-2 ring-zinc-950 scale-[1.03] z-10 shadow-md' : '';
    if (salesCount === 0 || val <= 0 || maxMetricVal <= 0) {
      return `bg-zinc-50 text-zinc-300 border-zinc-200/70 hover:border-zinc-400 ${ring}`;
    }
    const ratio = val / maxMetricVal;
    if (ratio >= 0.8) {
      return `bg-emerald-600 text-white border-emerald-700 font-black ${ring}`;
    }
    if (ratio >= 0.58) {
      return `bg-emerald-500 text-white border-emerald-600 font-extrabold ${ring}`;
    }
    if (ratio >= 0.36) {
      return `bg-emerald-300 text-emerald-950 border-emerald-400 font-extrabold ${ring}`;
    }
    if (ratio >= 0.16) {
      return `bg-emerald-100 text-emerald-900 border-emerald-200 font-bold ${ring}`;
    }
    return `bg-emerald-50 text-emerald-800 border-emerald-200/80 font-semibold ${ring}`;
  };

  const formatCellDisplay = (cell: HeatmapCell): string => {
    if (cell.salesCount === 0) return '—';
    if (metric === 'count') return `${cell.salesCount}`;
    if (metric === 'avgTicket') return `£${Math.round(cell.avgTicket)}`;
    return cell.totalRevenue >= 100
      ? `£${Math.round(cell.totalRevenue)}`
      : `£${cell.totalRevenue.toFixed(0)}`;
  };

  // Defense-in-depth gate: never render analytics if owner lock screen is active
  if (!isUnlocked) {
    return (
      <div className="bg-zinc-950 text-white rounded-3xl border border-zinc-800 p-8 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center mx-auto">
          <Lock className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-black">Owner Lock Required</h2>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            Busiest Hours &amp; Days Heatmap analytics are restricted to store owners. Unlock the dashboard to view trading heatmaps.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsPasscodeOpen(true)}
          className="px-5 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-black text-xs cursor-pointer"
        >
          Enter Owner Passcode
        </button>
        <PasscodeModal isOpen={isPasscodeOpen} onClose={() => setIsPasscodeOpen(false)} />
      </div>
    );
  }

  return (
    <div className="space-y-6" id="view-busiest-hours-heatmap">
      {/* Header & Controls Bar */}
      <div className="bg-zinc-950 text-white rounded-2xl border border-zinc-800 p-5 shadow-md space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 shrink-0">
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black tracking-tight">
                  Busiest Hours &amp; Days Heatmap
                </h2>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-400 text-zinc-950">
                  Owner Only
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Identify peak trading hours, weekend rushes, and quiet restocking windows from real till timestamps.
              </p>
            </div>
          </div>

          {/* Interactive Filters */}
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5">
            {/* Timeframe */}
            <div className="grid grid-cols-3 bg-zinc-900 p-1 rounded-xl border border-zinc-800 text-xs">
              {(
                [
                  { id: 30, label: '30 Days' },
                  { id: 90, label: '90 Days' },
                  { id: 'all', label: 'All Time' },
                ] as const
              ).map((opt) => (
                <button
                  key={String(opt.id)}
                  type="button"
                  onClick={() => setRangeDays(opt.id)}
                  className={`min-h-[34px] px-3 py-1 rounded-lg font-bold cursor-pointer transition-all whitespace-nowrap ${
                    rangeDays === opt.id
                      ? 'bg-white text-zinc-950 font-black'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Metric Selector */}
            <div className="grid grid-cols-3 bg-zinc-900 p-1 rounded-xl border border-zinc-800 text-xs">
              {(
                [
                  { id: 'revenue', label: 'Revenue (£)' },
                  { id: 'count', label: 'Sales Count' },
                  { id: 'avgTicket', label: 'Avg Ticket' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMetric(m.id)}
                  className={`min-h-[34px] px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-all whitespace-nowrap ${
                    metric === m.id
                      ? 'bg-emerald-400 text-zinc-950 font-black'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Vendor Filter */}
            <div className="w-full sm:w-44">
              <VendorDropdown
                value={selectedVendor}
                onChange={setSelectedVendor}
                vendors={knownVendors}
                includeAllOption={true}
                allOptionLabel="All Vendors"
                placeholder="All Vendors"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4 Owner KPI Insight Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Busiest Day</span>
            <Calendar className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-zinc-950">
            {liveHeatmap.busiestDay ? liveHeatmap.busiestDay.label : '—'}
          </div>
          <div className="text-xs text-zinc-500 tabular-nums">
            {liveHeatmap.busiestDay
              ? `${formatCurrency(liveHeatmap.busiestDay.revenue)} (${liveHeatmap.busiestDay.count} sales)`
              : 'No data in window'}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Peak Hour</span>
            <Clock className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-zinc-950 tabular-nums">
            {liveHeatmap.peakHour ? liveHeatmap.peakHour.label : '—'}
          </div>
          <div className="text-xs text-zinc-500 tabular-nums">
            {liveHeatmap.peakHour
              ? `${formatCurrency(liveHeatmap.peakHour.revenue)} (${liveHeatmap.peakHour.count} sales)`
              : 'No data in window'}
          </div>
        </div>

        <div className="bg-emerald-950 text-white rounded-2xl border border-emerald-700 p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-emerald-300">
            <span className="text-[11px] font-bold uppercase tracking-wider">Golden Slot</span>
            <Award className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black tabular-nums">
            {liveHeatmap.goldenSlot
              ? `${liveHeatmap.goldenSlot.dayLabel} • ${formatHour(liveHeatmap.goldenSlot.hour)}`
              : '—'}
          </div>
          <div className="text-xs text-emerald-200 tabular-nums">
            {liveHeatmap.goldenSlot
              ? `${formatCurrency(liveHeatmap.goldenSlot.totalRevenue)} (${liveHeatmap.goldenSlot.salesCount} sales)`
              : 'No data in window'}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Quietest Active Hour</span>
            <Moon className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-zinc-950 tabular-nums">
            {liveHeatmap.quietestHour ? liveHeatmap.quietestHour.label : '—'}
          </div>
          <div className="text-xs text-zinc-500 tabular-nums">
            {liveHeatmap.quietestHour
              ? `${formatCurrency(liveHeatmap.quietestHour.revenue)} (${liveHeatmap.quietestHour.count} sales)`
              : 'Good for binder prep'}
          </div>
        </div>
      </div>

      {/* Heatmap Matrix */}
      <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-zinc-100 flex flex-wrap items-center justify-between gap-3 bg-zinc-50/70">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-zinc-700" />
            <h3 className="text-sm font-bold text-zinc-900">
              Trading Activity Matrix ({liveHeatmap.totalSalesCount} sales • {formatCurrency(liveHeatmap.totalRevenue)})
            </h3>
          </div>

          {/* Intensity Scale Legend */}
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500">
            <span>Quiet</span>
            <span className="w-4 h-4 rounded bg-zinc-50 border border-zinc-200" />
            <span className="w-4 h-4 rounded bg-emerald-100 border border-emerald-200" />
            <span className="w-4 h-4 rounded bg-emerald-300 border border-emerald-400" />
            <span className="w-4 h-4 rounded bg-emerald-500 border border-emerald-600" />
            <span className="w-4 h-4 rounded bg-emerald-600 border border-emerald-700" />
            <span>Peak</span>
          </div>
        </div>

        {liveHeatmap.totalSalesCount === 0 ? (
          <div className="p-12 text-center space-y-2">
            <TrendingUp className="w-10 h-10 text-zinc-300 mx-auto" />
            <h4 className="text-sm font-bold text-zinc-800">No sales recorded in this filter</h4>
            <p className="text-xs text-zinc-500">
              Try switching to All Time or All Vendors to see historical trading intensity.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto p-4">
            <table className="w-full border-separate border-spacing-1 text-center min-w-[680px]">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-white text-left text-[11px] font-black uppercase text-zinc-500 px-2 py-1.5 w-16">
                    Day
                  </th>
                  {liveHeatmap.hours.map((hr) => (
                    <th
                      key={hr}
                      className="text-[10px] font-bold text-zinc-500 pb-1.5 tabular-nums"
                    >
                      {formatHour(hr)}
                    </th>
                  ))}
                  <th className="text-[10px] font-black uppercase text-zinc-600 pl-2 pb-1.5 text-right">
                    Day Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {liveHeatmap.cells.map((dayRow, dIdx) => {
                  const dayTotal = liveHeatmap.dayTotals[dIdx];
                  return (
                    <tr key={liveHeatmap.dayLabels[dIdx]}>
                      <td className="sticky left-0 z-10 bg-white text-left text-xs font-black text-zinc-900 px-2 py-1">
                        {liveHeatmap.dayLabels[dIdx]}
                      </td>
                      {dayRow.map((cell) => {
                        const val = getCellMetricValue(cell);
                        const isInspected =
                          activeInspectedCell?.dayIndex === cell.dayIndex &&
                          activeInspectedCell?.hour === cell.hour;

                        return (
                          <td key={`${cell.dayIndex}-${cell.hour}`}>
                            <button
                              type="button"
                              onClick={() =>
                                setInspectedSlot({ dayIndex: cell.dayIndex, hour: cell.hour })
                              }
                              title={`${cell.dayLabel} ${formatHour(cell.hour)}: ${formatCurrency(cell.totalRevenue)} across ${cell.salesCount} sales`}
                              className={`w-full min-h-[38px] px-1 py-1 rounded-lg border text-[11px] tabular-nums transition-all cursor-pointer ${getHeatCellClasses(
                                val,
                                cell.salesCount,
                                isInspected
                              )}`}
                            >
                              {formatCellDisplay(cell)}
                            </button>
                          </td>
                        );
                      })}
                      <td className="pl-2 text-right whitespace-nowrap">
                        <span className="text-xs font-black text-zinc-900 tabular-nums">
                          {metric === 'count'
                            ? `${dayTotal.count}`
                            : formatCurrency(dayTotal.revenue)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td className="sticky left-0 z-10 bg-white text-left text-[10px] font-black uppercase text-zinc-500 px-2 pt-2">
                    Hour Total
                  </td>
                  {liveHeatmap.hourTotals.map((ht) => (
                    <td
                      key={`ht-${ht.hour}`}
                      className="pt-2 text-[10px] font-bold text-zinc-600 tabular-nums"
                    >
                      {ht.count === 0
                        ? '—'
                        : metric === 'count'
                        ? ht.count
                        : `£${Math.round(ht.revenue)}`}
                    </td>
                  ))}
                  <td className="pl-2 pt-2 text-right text-xs font-black text-emerald-700 tabular-nums">
                    {metric === 'count'
                      ? liveHeatmap.totalSalesCount
                      : formatCurrency(liveHeatmap.totalRevenue)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Selected Slot Inspector Card */}
      {activeInspectedCell && (
        <div
          id="card-heatmap-slot-inspector"
          className="bg-white rounded-2xl border border-zinc-200 p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-lg bg-zinc-950 text-white text-xs font-black">
                {activeInspectedCell.dayLabel} • {formatHour(activeInspectedCell.hour)}–
                {formatHour((activeInspectedCell.hour + 1) % 24)}
              </span>
              {activeInspectedCell.topPaymentMethod && (
                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold uppercase">
                  Top: {activeInspectedCell.topPaymentMethod.replace('_', ' ')}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500">
              Click any cell in the grid above to inspect exact hourly breakdown &amp; payment mix.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 tabular-nums text-xs">
            <div>
              <span className="block text-[10px] font-bold uppercase text-zinc-400">Revenue</span>
              <span className="text-base font-black text-zinc-950">
                {formatCurrency(activeInspectedCell.totalRevenue)}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase text-zinc-400">Sales Count</span>
              <span className="text-base font-black text-zinc-950">
                {activeInspectedCell.salesCount}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase text-zinc-400">Avg Ticket</span>
              <span className="text-base font-black text-zinc-950">
                {formatCurrency(activeInspectedCell.avgTicket)}
              </span>
            </div>
            <div className="flex items-center gap-2 pl-2 border-l border-zinc-200 text-[11px] font-semibold text-zinc-600">
              <span>Cash: {activeInspectedCell.cashCount}</span>
              <span>Card: {activeInspectedCell.cardCount}</span>
              <span>Online: {activeInspectedCell.onlineCount}</span>
              <span>Trade: {activeInspectedCell.tradedOutCount}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
