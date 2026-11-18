import React from 'react';
import { Smartphone, Pin, PinOff, Check } from 'lucide-react';
import { cloudDb } from '../db/cloudDatabase';

interface DeviceVendorBarProps {
  theme?: 'light' | 'dark';
  selectedVendor: string;
  rememberedVendor: string;
  onPinVendor: (vendorName: string) => void;
  onClearPinnedVendor: () => void;
  onSelectVendor: (vendorName: string) => void;
  compact?: boolean;
}

export const DeviceVendorBar: React.FC<DeviceVendorBarProps> = ({
  theme = 'light',
  selectedVendor,
  rememberedVendor,
  onPinVendor,
  onClearPinnedVendor,
  onSelectVendor,
  compact = false,
}) => {
  const isDark = theme === 'dark';
  const cleanSelected = selectedVendor.trim();
  const isCurrentPinned =
    Boolean(rememberedVendor) &&
    Boolean(cleanSelected) &&
    rememberedVendor.toLowerCase() === cleanSelected.toLowerCase();

  // Nothing selected and nothing pinned yet -> subtle helpful bar
  if (!rememberedVendor && !cleanSelected) {
    return (
      <div
        className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl border text-[11px] font-medium ${
          isDark
            ? 'bg-zinc-900/70 border-zinc-800 text-zinc-400'
            : 'bg-zinc-50 border-zinc-200/80 text-zinc-500'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Smartphone className="w-3.5 h-3.5 shrink-0 opacity-75" />
          <span className="truncate">
            {compact ? 'Select a vendor to pin to this device' : 'Choose a vendor to remember them on this device'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl border text-[11px] transition-colors ${
        isCurrentPinned
          ? isDark
            ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
            : 'bg-emerald-50/90 border-emerald-200 text-emerald-900'
          : isDark
          ? 'bg-zinc-900/90 border-zinc-700/80 text-zinc-200'
          : 'bg-zinc-50 border-zinc-200 text-zinc-700'
      }`}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <Smartphone
          className={`w-3.5 h-3.5 shrink-0 ${
            isCurrentPinned ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : isDark ? 'text-zinc-400' : 'text-zinc-500'
          }`}
        />
        {rememberedVendor ? (
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-semibold truncate">This device:</span>
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: cloudDb.getVendorColor(rememberedVendor) }}
            />
            <span className="font-black truncate">{rememberedVendor}</span>
          </div>
        ) : (
          <span className="font-semibold truncate">
            Remember <strong className="font-black">{cleanSelected}</strong> on this device?
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {rememberedVendor && !isCurrentPinned && (
          <button
            type="button"
            onClick={() => onSelectVendor(rememberedVendor)}
            className={`min-h-[28px] px-2 py-1 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap ${
              isDark
                ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-600'
                : 'bg-white hover:bg-zinc-100 text-zinc-800 border border-zinc-300'
            }`}
          >
            <Check className="w-3 h-3 text-emerald-500 shrink-0" />
            <span>Use {rememberedVendor}</span>
          </button>
        )}

        {cleanSelected && !isCurrentPinned && (
          <button
            type="button"
            onClick={() => onPinVendor(cleanSelected)}
            className={`min-h-[28px] px-2.5 py-1 rounded-lg font-extrabold flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap ${
              isDark
                ? 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950'
                : 'bg-zinc-900 hover:bg-zinc-800 text-white'
            }`}
          >
            <Pin className="w-3 h-3 shrink-0" />
            <span>{rememberedVendor ? `Switch to ${cleanSelected}` : `Pin ${cleanSelected}`}</span>
          </button>
        )}

        {rememberedVendor && (
          <button
            type="button"
            onClick={onClearPinnedVendor}
            title="Stop remembering vendor on this device"
            className={`min-h-[28px] px-2 py-1 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap ${
              isDark
                ? 'text-zinc-400 hover:text-rose-300 hover:bg-rose-950/60'
                : 'text-zinc-500 hover:text-rose-700 hover:bg-rose-50'
            }`}
          >
            <PinOff className="w-3 h-3 shrink-0" />
            <span>Unpin</span>
          </button>
        )}
      </div>
    </div>
  );
};
