import React, { useState } from 'react';
import { Calculator, Percent, Sparkles } from 'lucide-react';

interface TradeRateCalculatorProps {
  theme?: 'light' | 'dark';
  onApplyValuation: (calculatedValue: string, noteHint?: string) => void;
}

const PRESET_RATES = [50, 60, 65, 70, 75, 80];

export const TradeRateCalculator: React.FC<TradeRateCalculatorProps> = ({
  theme = 'light',
  onApplyValuation,
}) => {
  const isDark = theme === 'dark';
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [marketValue, setMarketValue] = useState<string>('');
  const [selectedRate, setSelectedRate] = useState<number>(70);
  const [customRate, setCustomRate] = useState<string>('');
  const [includeNoteHint, setIncludeNoteHint] = useState<boolean>(false);

  const parsedMarket = parseFloat(marketValue);
  const activeRate = customRate.trim() !== '' ? parseFloat(customRate) : selectedRate;
  const isValid = !isNaN(parsedMarket) && parsedMarket > 0 && !isNaN(activeRate) && activeRate > 0 && activeRate <= 100;
  const calculatedOffer = isValid ? Math.round(parsedMarket * (activeRate / 100) * 100) / 100 : null;

  const applyRate = (rate: number, marketStr = marketValue) => {
    const m = parseFloat(marketStr);
    if (!isNaN(m) && m > 0 && rate > 0 && rate <= 100) {
      const offer = Math.round(m * (rate / 100) * 100) / 100;
      const hint = includeNoteHint ? `@ ${rate}% of £${m.toFixed(2)} market` : undefined;
      onApplyValuation(offer.toFixed(2), hint);
    }
  };

  return (
    <div
      className={`rounded-xl border transition-all ${
        isDark
          ? 'bg-zinc-900/90 border-amber-500/35 text-zinc-100'
          : 'bg-amber-50/70 border-amber-200 text-zinc-900'
      }`}
    >
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full min-h-[40px] px-3 py-2 flex items-center justify-between gap-2 text-xs font-bold cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Calculator className={`w-4 h-4 shrink-0 ${isDark ? 'text-amber-400' : 'text-amber-700'}`} />
          <span className="truncate font-extrabold">Buy-Rate % Calculator</span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
              isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-800 border border-amber-300'
            }`}
          >
            {isOpen ? 'Hide' : 'Comp % Helper'}
          </span>
        </div>

        {calculatedOffer !== null && (
          <span
            className={`text-xs font-black tabular-nums shrink-0 ${
              isDark ? 'text-emerald-400' : 'text-emerald-700'
            }`}
          >
            £{calculatedOffer.toFixed(2)} ({activeRate}%)
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className={`px-3 pb-3 pt-2 border-t space-y-2.5 animate-fade-in ${
            isDark ? 'border-zinc-800' : 'border-amber-200/70'
          }`}
        >
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
            {/* Market Value Input */}
            <div className="sm:col-span-5 space-y-1">
              <label
                className={`block text-[11px] font-bold uppercase tracking-wider ${
                  isDark ? 'text-zinc-400' : 'text-amber-900'
                }`}
              >
                Market / Comp Value (£)
              </label>
              <div className="relative">
                <span
                  className={`absolute left-2.5 top-2 text-xs font-black pointer-events-none ${
                    isDark ? 'text-zinc-400' : 'text-zinc-500'
                  }`}
                >
                  £
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={marketValue}
                  onChange={(e) => {
                    const nextVal = e.target.value;
                    setMarketValue(nextVal);
                    applyRate(activeRate, nextVal);
                  }}
                  placeholder="e.g. 50.00"
                  className={`w-full min-h-[38px] pl-6 pr-2.5 py-1.5 text-xs font-black tabular-nums rounded-lg border focus:outline-hidden ${
                    isDark
                      ? 'bg-zinc-950 border-zinc-700 text-white focus:border-amber-400'
                      : 'bg-white border-amber-300 text-zinc-950 focus:border-amber-600'
                  }`}
                />
              </div>
            </div>

            {/* Custom % Input */}
            <div className="sm:col-span-3 space-y-1">
              <label
                className={`block text-[11px] font-bold uppercase tracking-wider ${
                  isDark ? 'text-zinc-400' : 'text-amber-900'
                }`}
              >
                Custom %
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  min="1"
                  max="100"
                  value={customRate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustomRate(val);
                    const num = parseFloat(val);
                    if (!isNaN(num) && num > 0 && num <= 100) {
                      applyRate(num);
                    }
                  }}
                  placeholder={`${selectedRate}`}
                  className={`w-full min-h-[38px] pl-2.5 pr-6 py-1.5 text-xs font-black tabular-nums rounded-lg border focus:outline-hidden ${
                    isDark
                      ? 'bg-zinc-950 border-zinc-700 text-white focus:border-amber-400'
                      : 'bg-white border-amber-300 text-zinc-950 focus:border-amber-600'
                  }`}
                />
                <Percent
                  className={`w-3 h-3 absolute right-2.5 top-3 pointer-events-none ${
                    isDark ? 'text-zinc-400' : 'text-zinc-500'
                  }`}
                />
              </div>
            </div>

            {/* Apply Button / Preview */}
            <div className="sm:col-span-4">
              <button
                type="button"
                disabled={!isValid}
                onClick={() => isValid && applyRate(activeRate)}
                className={`w-full min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap ${
                  isDark
                    ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950'
                    : 'bg-amber-600 hover:bg-amber-700 text-white shadow-2xs'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {calculatedOffer !== null ? `Use £${calculatedOffer.toFixed(2)}` : 'Enter Market £'}
                </span>
              </button>
            </div>
          </div>

          {/* Preset % Buttons */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
            {PRESET_RATES.map((rate) => {
              const isSelected = customRate.trim() === '' && selectedRate === rate;
              const previewVal =
                !isNaN(parsedMarket) && parsedMarket > 0
                  ? Math.round(parsedMarket * (rate / 100) * 100) / 100
                  : null;
              return (
                <button
                  key={rate}
                  type="button"
                  onClick={() => {
                    setSelectedRate(rate);
                    setCustomRate('');
                    applyRate(rate);
                  }}
                  className={`min-h-[36px] px-2 py-1 rounded-lg border text-xs font-bold flex flex-col items-center justify-center leading-tight cursor-pointer transition-all tabular-nums ${
                    isSelected
                      ? isDark
                        ? 'bg-amber-500 text-zinc-950 border-amber-400 font-black shadow-xs'
                        : 'bg-amber-700 text-white border-amber-700 font-black shadow-xs'
                      : isDark
                      ? 'bg-zinc-950 hover:bg-zinc-800 text-zinc-200 border-zinc-700'
                      : 'bg-white hover:bg-amber-100 text-amber-950 border-amber-200'
                  }`}
                >
                  <span>{rate}%</span>
                  {previewVal !== null && (
                    <span className={`text-[10px] font-bold ${isSelected ? 'opacity-90' : isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                      £{previewVal.toFixed(2)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <label className="flex items-center gap-2 text-[11px] font-semibold cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeNoteHint}
              onChange={(e) => setIncludeNoteHint(e.target.checked)}
              className="rounded-xs w-3.5 h-3.5 cursor-pointer"
            />
            <span className={isDark ? 'text-zinc-300' : 'text-amber-950'}>
              Add rate &amp; market comp note automatically (e.g. &ldquo;@ {activeRate}% of £{isNaN(parsedMarket) ? '50.00' : parsedMarket.toFixed(2)}&rdquo;)
            </span>
          </label>
        </div>
      )}
    </div>
  );
};
