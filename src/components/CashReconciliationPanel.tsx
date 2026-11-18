import React, { useState, useEffect, useMemo } from 'react';
import {
  Vault,
  Banknote,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Calculator,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Save,
  History,
} from 'lucide-react';
import { CashReconciliationSummary } from '../types';
import { cloudDb, formatCurrency, formatDisplayDate } from '../db/cloudDatabase';

interface CashReconciliationPanelProps {
  currentDateKey: string;
}

const UK_DENOMINATIONS = [
  { key: '5000', label: '£50 Note', value: 50 },
  { key: '2000', label: '£20 Note', value: 20 },
  { key: '1000', label: '£10 Note', value: 10 },
  { key: '500', label: '£5 Note', value: 5 },
  { key: '200', label: '£2 Coin', value: 2 },
  { key: '100', label: '£1 Coin', value: 1 },
  { key: '50', label: '50p', value: 0.5 },
  { key: '20', label: '20p', value: 0.2 },
  { key: '10', label: '10p', value: 0.1 },
  { key: '5', label: '5p', value: 0.05 },
  { key: '2', label: '2p', value: 0.02 },
  { key: '1', label: '1p', value: 0.01 },
];

export const CashReconciliationPanel: React.FC<CashReconciliationPanelProps> = ({
  currentDateKey,
}) => {
  const [summary, setSummary] = useState<CashReconciliationSummary>(() =>
    cloudDb.getCashReconciliationSummary(currentDateKey)
  );
  const [previousFloat, setPreviousFloat] = useState<number | null>(() =>
    cloudDb.getPreviousDayOpeningFloat(currentDateKey)
  );

  const [openingFloatInput, setOpeningFloatInput] = useState<string>(() =>
    summary.openingFloat > 0 ? summary.openingFloat.toFixed(2) : ''
  );
  const [actualCountedInput, setActualCountedInput] = useState<string>(() =>
    summary.actualCashCounted !== null ? summary.actualCashCounted.toFixed(2) : ''
  );
  const [notesInput, setNotesInput] = useState<string>(() => summary.notes || '');
  const [denominations, setDenominations] = useState<Record<string, number>>(
    () => summary.denominationCounts || {}
  );
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [showDenominationCounter, setShowDenominationCounter] = useState<boolean>(false);
  const [savedNotice, setSavedNotice] = useState<boolean>(false);

  useEffect(() => {
    const syncState = () => {
      const next = cloudDb.getCashReconciliationSummary(currentDateKey);
      setSummary(next);
      setPreviousFloat(cloudDb.getPreviousDayOpeningFloat(currentDateKey));
      setOpeningFloatInput(next.openingFloat > 0 ? next.openingFloat.toFixed(2) : '');
      setActualCountedInput(
        next.actualCashCounted !== null ? next.actualCashCounted.toFixed(2) : ''
      );
      setNotesInput(next.notes || '');
      setDenominations(next.denominationCounts || {});
    };

    syncState();
    const unsub = cloudDb.subscribe(syncState);
    return unsub;
  }, [currentDateKey]);

  const parsedFloat = Math.max(0, Math.round((parseFloat(openingFloatInput) || 0) * 100) / 100);
  const liveExpectedCash = useMemo(() => {
    return Math.round((parsedFloat + summary.cashSalesIn - summary.cashTradesOut) * 100) / 100;
  }, [parsedFloat, summary.cashSalesIn, summary.cashTradesOut]);

  const parsedActualCounted =
    actualCountedInput.trim() === ''
      ? null
      : Math.max(0, Math.round((parseFloat(actualCountedInput) || 0) * 100) / 100);

  const liveVariance =
    parsedActualCounted !== null
      ? Math.round((parsedActualCounted - liveExpectedCash) * 100) / 100
      : null;

  const liveStatus: CashReconciliationSummary['status'] = useMemo(() => {
    if (liveVariance === null) return 'pending';
    if (Math.abs(liveVariance) < 0.005) return 'balanced';
    return liveVariance > 0 ? 'over' : 'short';
  }, [liveVariance]);

  const countedDenominationsTotal = useMemo(() => {
    let total = 0;
    for (const d of UK_DENOMINATIONS) {
      const qty = Math.max(0, Number(denominations[d.key]) || 0);
      total += qty * d.value;
    }
    return Math.round(total * 100) / 100;
  }, [denominations]);

  const triggerSavedBadge = () => {
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  const handleSaveReconciliation = async (e?: React.FormEvent) => {
    e?.preventDefault();
    await cloudDb.saveCashReconciliation(currentDateKey, {
      openingFloat: parsedFloat,
      actualCashCounted: parsedActualCounted,
      denominationCounts: denominations,
      notes: notesInput,
    });
    triggerSavedBadge();
  };

  const handleApplyPresetFloat = async (preset: number) => {
    setOpeningFloatInput(preset.toFixed(2));
    await cloudDb.saveCashReconciliation(currentDateKey, {
      openingFloat: preset,
    });
    triggerSavedBadge();
  };

  const handleApplyCountedTotal = async () => {
    setActualCountedInput(countedDenominationsTotal.toFixed(2));
    await cloudDb.saveCashReconciliation(currentDateKey, {
      openingFloat: parsedFloat,
      actualCashCounted: countedDenominationsTotal,
      denominationCounts: denominations,
      notes: notesInput,
    });
    triggerSavedBadge();
  };

  const handleClearActualCount = async () => {
    setActualCountedInput('');
    setDenominations({});
    await cloudDb.saveCashReconciliation(currentDateKey, {
      openingFloat: parsedFloat,
      actualCashCounted: null,
      denominationCounts: {},
      notes: notesInput,
    });
  };

  const renderStatusPill = () => {
    if (liveStatus === 'balanced') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>Till Balanced (£0.00)</span>
        </span>
      );
    }
    if (liveStatus === 'over' && liveVariance !== null) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-900 border border-blue-300 tabular-nums">
          <ArrowUpRight className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span>Over +{formatCurrency(liveVariance)}</span>
        </span>
      );
    }
    if (liveStatus === 'short' && liveVariance !== null) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-300 tabular-nums">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
          <span>Short {formatCurrency(liveVariance)}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-zinc-100 text-zinc-700 border border-zinc-300">
        <Scale className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
        <span>Awaiting EOD Count</span>
      </span>
    );
  };

  return (
    <section
      id="section-cash-drawer-reconciliation"
      className="bg-white rounded-2xl border border-zinc-200/90 shadow-xs overflow-hidden"
    >
      {/* Header Bar */}
      <div className="px-4 sm:px-5 py-3.5 bg-zinc-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
            <Vault className="w-4.5 h-4.5 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-black tracking-tight text-white">
                End-of-Day Cash Drawer Reconciliation
              </h3>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                {formatDisplayDate(currentDateKey)}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Expected Till = Opening Float + Cash Sales − Cash Trade-In Payouts
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {renderStatusPill()}
          <button
            type="button"
            id="btn-toggle-cash-reconciliation"
            onClick={() => setIsExpanded((v) => !v)}
            className="min-h-[36px] px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-bold text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>{isExpanded ? 'Collapse' : 'Open Drawer Check'}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Live Till Formula Strip (Always visible even when collapsed) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x divide-zinc-200 border-b border-zinc-200 bg-zinc-50/60">
        <div className="p-3 sm:p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Opening Float
          </span>
          <div className="text-lg sm:text-xl font-black text-zinc-900 tabular-nums mt-0.5">
            {formatCurrency(parsedFloat)}
          </div>
          <span className="text-[10px] text-zinc-400 font-medium">Starting cash in till</span>
        </div>

        <div className="p-3 sm:p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3" /> Cash Sales In
          </span>
          <div className="text-lg sm:text-xl font-black text-emerald-700 tabular-nums mt-0.5">
            +{formatCurrency(summary.cashSalesIn)}
          </div>
          <span className="text-[10px] text-zinc-500 font-medium">Incl. cash split legs</span>
        </div>

        <div className="p-3 sm:p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1">
            <ArrowDownRight className="w-3 h-3" /> Cash Trade Payouts
          </span>
          <div className="text-lg sm:text-xl font-black text-rose-700 tabular-nums mt-0.5">
            −{formatCurrency(summary.cashTradesOut)}
          </div>
          <span className="text-[10px] text-zinc-500 font-medium">Paid out on Trade Ins</span>
        </div>

        <div className="p-3 sm:p-4 bg-zinc-900 text-white">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1">
            <Banknote className="w-3 h-3" /> Expected in Till
          </span>
          <div className="text-lg sm:text-xl font-black text-white tabular-nums mt-0.5">
            {formatCurrency(liveExpectedCash)}
          </div>
          <span className="text-[10px] text-zinc-400 font-medium">Should be in drawer</span>
        </div>

        <div className="col-span-2 lg:col-span-1 p-3 sm:p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Actual / Variance
          </span>
          <div className="flex items-baseline justify-between gap-2 mt-0.5">
            <span className="text-lg sm:text-xl font-black text-zinc-950 tabular-nums">
              {parsedActualCounted !== null ? formatCurrency(parsedActualCounted) : '—'}
            </span>
            {liveVariance !== null && (
              <span
                className={`text-xs font-black tabular-nums ${
                  liveStatus === 'balanced'
                    ? 'text-emerald-600'
                    : liveStatus === 'over'
                    ? 'text-blue-600'
                    : 'text-rose-600'
                }`}
              >
                {liveVariance > 0 ? `+${formatCurrency(liveVariance)}` : formatCurrency(liveVariance)}
              </span>
            )}
          </div>
          <span className="text-[10px] text-zinc-400 font-medium">
            {summary.updatedAt
              ? `Saved ${new Date(summary.updatedAt).toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}`
              : 'Enter physical count below'}
          </span>
        </div>
      </div>

      {/* Expanded Reconciliation Controls */}
      {isExpanded && (
        <form onSubmit={handleSaveReconciliation} className="p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Opening Float Input + Quick Presets */}
            <div className="lg:col-span-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="input-opening-float" className="text-xs font-bold text-zinc-800">
                  Opening Till Float (£)
                </label>
                {previousFloat !== null && previousFloat > 0 && (
                  <button
                    type="button"
                    onClick={() => handleApplyPresetFloat(previousFloat)}
                    className="text-[10px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded-md flex items-center gap-1 cursor-pointer"
                  >
                    <History className="w-3 h-3" />
                    <span>Use Last (£{previousFloat.toFixed(0)})</span>
                  </button>
                )}
              </div>

              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-sm font-black text-zinc-500 pointer-events-none">
                  £
                </span>
                <input
                  id="input-opening-float"
                  type="number"
                  step="0.01"
                  min="0"
                  value={openingFloatInput}
                  onChange={(e) => setOpeningFloatInput(e.target.value)}
                  placeholder="0.00"
                  className="w-full min-h-[42px] pl-8 pr-3 py-2 text-sm font-black tabular-nums rounded-xl border border-zinc-300 focus:outline-hidden focus:border-zinc-900 text-zinc-950"
                />
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {[50, 100, 150, 200].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleApplyPresetFloat(preset)}
                    className={`min-h-[32px] text-[11px] font-bold rounded-lg border transition-colors cursor-pointer ${
                      Math.abs(parsedFloat - preset) < 0.01
                        ? 'bg-zinc-900 text-white border-zinc-900'
                        : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border-zinc-200'
                    }`}
                  >
                    £{preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Actual Cash Counted Input + Denomination Drawer Toggle */}
            <div className="lg:col-span-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="input-actual-cash-counted" className="text-xs font-bold text-zinc-800">
                  Actual Cash Counted (£)
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    id="btn-toggle-denom-counter"
                    onClick={() => setShowDenominationCounter((v) => !v)}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 cursor-pointer transition-colors ${
                      showDenominationCounter
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    <Calculator className="w-3 h-3" />
                    <span>Notes/Coins</span>
                  </button>
                  {actualCountedInput !== '' && (
                    <button
                      type="button"
                      onClick={handleClearActualCount}
                      className="text-[10px] font-bold text-zinc-500 hover:text-rose-600 p-0.5 cursor-pointer"
                      title="Clear counted cash"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-sm font-black text-zinc-500 pointer-events-none">
                  £
                </span>
                <input
                  id="input-actual-cash-counted"
                  type="number"
                  step="0.01"
                  min="0"
                  value={actualCountedInput}
                  onChange={(e) => setActualCountedInput(e.target.value)}
                  placeholder="Enter end-of-day cash count..."
                  className="w-full min-h-[42px] pl-8 pr-3 py-2 text-sm font-black tabular-nums rounded-xl border border-zinc-300 focus:outline-hidden focus:border-emerald-600 text-zinc-950"
                />
              </div>

              <p className="text-[11px] text-zinc-500">
                Count notes &amp; coins in drawer at close (Expected:{' '}
                <strong className="text-zinc-900 tabular-nums">{formatCurrency(liveExpectedCash)}</strong>)
              </p>
            </div>

            {/* Notes & Save Action */}
            <div className="lg:col-span-4 space-y-2 flex flex-col justify-between">
              <div className="space-y-1.5">
                <label htmlFor="input-reconciliation-notes" className="block text-xs font-bold text-zinc-800">
                  Till Variance / Close Notes
                </label>
                <input
                  id="input-reconciliation-notes"
                  type="text"
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  placeholder="e.g. Left £100 float, £340 banked..."
                  className="w-full min-h-[42px] px-3 py-2 text-xs rounded-xl border border-zinc-300 focus:outline-hidden focus:border-zinc-900 text-zinc-900"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  id="btn-save-cash-reconciliation"
                  className="flex-1 min-h-[40px] px-4 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Save Till Reconciliation</span>
                </button>

                {savedNotice && (
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-2 rounded-xl flex items-center gap-1 shrink-0 animate-fade-in">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Synced</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Collapsible UK Notes & Coins Counter */}
          {showDenominationCounter && (
            <div
              id="panel-uk-denomination-counter"
              className="rounded-2xl bg-zinc-50 border border-zinc-200 p-3.5 sm:p-4 space-y-3 animate-fade-in"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span className="text-xs font-black text-zinc-900 uppercase tracking-wider">
                    UK Notes &amp; Coins Counter
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-zinc-700">
                    Counted Sum:{' '}
                    <strong className="text-sm font-black text-emerald-700 tabular-nums">
                      {formatCurrency(countedDenominationsTotal)}
                    </strong>
                  </span>
                  <button
                    type="button"
                    id="btn-apply-denomination-total"
                    onClick={handleApplyCountedTotal}
                    className="min-h-[34px] px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black cursor-pointer transition-colors"
                  >
                    Use {formatCurrency(countedDenominationsTotal)}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {UK_DENOMINATIONS.map((denom) => {
                  const qty = denominations[denom.key] || 0;
                  const lineTotal = Math.round(qty * denom.value * 100) / 100;
                  return (
                    <div
                      key={denom.key}
                      className="bg-white rounded-xl border border-zinc-200 p-2 space-y-1"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-black text-zinc-800">{denom.label}</span>
                        {qty > 0 && (
                          <span className="font-bold text-emerald-700 tabular-nums">
                            {formatCurrency(lineTotal)}
                          </span>
                        )}
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={qty === 0 ? '' : qty}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                          setDenominations((prev) => ({ ...prev, [denom.key]: val }));
                        }}
                        placeholder="0"
                        className="w-full px-2 py-1 text-xs font-bold tabular-nums rounded-lg border border-zinc-300 focus:outline-hidden focus:border-emerald-600 text-zinc-950"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </form>
      )}
    </section>
  );
};
