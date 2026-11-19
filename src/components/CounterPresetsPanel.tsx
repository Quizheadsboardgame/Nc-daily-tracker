import React, { useState, useEffect } from 'react';
import { CounterPreset, PresetColorKey } from '../types';
import { cloudDb, formatCurrency } from '../db/cloudDatabase';
import { Zap, Plus, Pencil, Trash2, RotateCcw, ShoppingCart, X, Check } from 'lucide-react';

interface CounterPresetsPanelProps {
  theme?: 'light' | 'dark';
  knownVendors: string[];
  allowCustomize?: boolean;
  onApplyPreset: (preset: CounterPreset) => void;
  onQuickAddBasket?: (preset: CounterPreset) => void;
}

const COLOR_STYLES: Record<
  PresetColorKey,
  { light: string; dark: string; swatch: string; label: string }
> = {
  blue: {
    light: 'bg-blue-50/80 hover:bg-blue-100 border-blue-200 text-blue-950',
    dark: 'bg-blue-950/60 hover:bg-blue-900/70 border-blue-500/45 text-blue-100',
    swatch: 'bg-blue-500',
    label: 'Blue',
  },
  emerald: {
    light: 'bg-emerald-50/80 hover:bg-emerald-100 border-emerald-200 text-emerald-950',
    dark: 'bg-emerald-950/60 hover:bg-emerald-900/70 border-emerald-500/45 text-emerald-100',
    swatch: 'bg-emerald-500',
    label: 'Emerald',
  },
  violet: {
    light: 'bg-violet-50/80 hover:bg-violet-100 border-violet-200 text-violet-950',
    dark: 'bg-violet-950/60 hover:bg-violet-900/70 border-violet-500/45 text-violet-100',
    swatch: 'bg-violet-500',
    label: 'Violet',
  },
  amber: {
    light: 'bg-amber-50/80 hover:bg-amber-100 border-amber-200 text-amber-950',
    dark: 'bg-amber-950/60 hover:bg-amber-900/70 border-amber-500/45 text-amber-100',
    swatch: 'bg-amber-500',
    label: 'Amber',
  },
  rose: {
    light: 'bg-rose-50/80 hover:bg-rose-100 border-rose-200 text-rose-950',
    dark: 'bg-rose-950/60 hover:bg-rose-900/70 border-rose-500/45 text-rose-100',
    swatch: 'bg-rose-500',
    label: 'Rose',
  },
  cyan: {
    light: 'bg-cyan-50/80 hover:bg-cyan-100 border-cyan-200 text-cyan-950',
    dark: 'bg-cyan-950/60 hover:bg-cyan-900/70 border-cyan-500/45 text-cyan-100',
    swatch: 'bg-cyan-500',
    label: 'Cyan',
  },
};

export const CounterPresetsPanel: React.FC<CounterPresetsPanelProps> = ({
  theme = 'light',
  knownVendors,
  allowCustomize = false,
  onApplyPreset,
  onQuickAddBasket,
}) => {
  const isDark = theme === 'dark';
  const [presets, setPresets] = useState<CounterPreset[]>(() => cloudDb.getCounterPresets());
  const [isCustomizing, setIsCustomizing] = useState(false);

  // Editor form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [price, setPrice] = useState('');
  const [defaultVendor, setDefaultVendor] = useState('');
  const [categoryColor, setCategoryColor] = useState<PresetColorKey>('blue');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    setPresets(cloudDb.getCounterPresets());
    return cloudDb.subscribe(() => {
      setPresets(cloudDb.getCounterPresets());
    });
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setLabel('');
    setItemDescription('');
    setPrice('');
    setDefaultVendor('');
    setCategoryColor('blue');
    setFormError('');
  };

  const handleEditClick = (preset: CounterPreset) => {
    setEditingId(preset.id);
    setLabel(preset.label);
    setItemDescription(preset.itemDescription);
    setPrice(preset.price.toFixed(2));
    setDefaultVendor(preset.defaultVendor || '');
    setCategoryColor(preset.categoryColor);
    setFormError('');
  };

  const handleSavePreset = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanLabel = label.trim();
    const numPrice = parseFloat(price);
    if (!cleanLabel) {
      setFormError('Enter a button label (e.g. Booster Pack).');
      return;
    }
    if (isNaN(numPrice) || numPrice <= 0) {
      setFormError('Enter a valid price greater than £0.00.');
      return;
    }

    await cloudDb.saveCounterPreset({
      id: editingId || undefined,
      label: cleanLabel,
      itemDescription: itemDescription.trim() || cleanLabel,
      price: numPrice,
      defaultVendor: defaultVendor.trim() || undefined,
      categoryColor,
    });
    resetForm();
  };

  if (presets.length === 0 && !allowCustomize) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
            isDark ? 'text-zinc-400' : 'text-zinc-500'
          }`}
        >
          <Zap className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-amber-400' : 'text-amber-500'}`} />
          <span>1-Tap Counter Presets</span>
        </span>

        {allowCustomize && (
          <button
            type="button"
            id="btn-customize-counter-presets"
            onClick={() => {
              setIsCustomizing((prev) => !prev);
              resetForm();
            }}
            className="text-[11px] font-bold text-zinc-600 hover:text-zinc-950 bg-zinc-100 hover:bg-zinc-200 px-2.5 py-1 rounded-lg border border-zinc-200 flex items-center gap-1 transition-colors cursor-pointer"
          >
            {isCustomizing ? (
              <>
                <X className="w-3 h-3" />
                <span>Done</span>
              </>
            ) : (
              <>
                <Pencil className="w-3 h-3" />
                <span>Customize ({presets.length})</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Preset Tap Buttons Grid */}
      {presets.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {presets.map((preset) => {
            const palette = COLOR_STYLES[preset.categoryColor] || COLOR_STYLES.blue;
            return (
              <div
                key={preset.id}
                className={`rounded-xl border transition-all flex items-stretch overflow-hidden ${
                  isDark ? palette.dark : palette.light
                }`}
              >
                <button
                  type="button"
                  onClick={() => onApplyPreset(preset)}
                  className="flex-1 min-w-0 min-h-[48px] px-2.5 py-2 text-left flex flex-col justify-between gap-0.5 cursor-pointer"
                  title={`Fill "${preset.itemDescription}" (£${preset.price.toFixed(2)})${
                    preset.defaultVendor ? ` for ${preset.defaultVendor}` : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-xs font-black truncate">{preset.label}</span>
                    <span className="text-xs font-black tabular-nums shrink-0">
                      {formatCurrency(preset.price)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-semibold opacity-80 truncate">
                      {preset.defaultVendor ? `Auto: ${preset.defaultVendor}` : 'Uses active vendor'}
                    </span>
                  </div>
                </button>

                {onQuickAddBasket && !isCustomizing && (
                  <button
                    type="button"
                    onClick={() => onQuickAddBasket(preset)}
                    title={`Add ${preset.label} directly to basket`}
                    aria-label={`Quick add ${preset.label} to basket`}
                    className={`px-2 border-l flex items-center justify-center cursor-pointer transition-colors shrink-0 ${
                      isDark
                        ? 'border-white/15 hover:bg-white/10 text-white'
                        : 'border-black/10 hover:bg-black/5 text-zinc-700'
                    }`}
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                  </button>
                )}

                {isCustomizing && allowCustomize && (
                  <div className="flex items-center border-l border-black/10 bg-white/70 px-1 gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleEditClick(preset)}
                      className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200/70 cursor-pointer"
                      aria-label={`Edit ${preset.label}`}
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => cloudDb.deleteCounterPreset(preset.id)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-700 hover:bg-rose-100 cursor-pointer"
                      aria-label={`Delete ${preset.label}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-xs text-zinc-500 bg-zinc-50 border border-dashed border-zinc-300 rounded-xl p-3 flex items-center justify-between gap-2">
          <span>No counter presets saved yet.</span>
          <button
            type="button"
            onClick={() => cloudDb.resetDefaultCounterPresets()}
            className="text-xs font-bold text-blue-700 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restore Starters</span>
          </button>
        </div>
      )}

      {/* Inline Customizer Editor (only in NewSaleForm unlocked mode) */}
      {isCustomizing && allowCustomize && (
        <form
          onSubmit={handleSavePreset}
          className="rounded-xl bg-zinc-50 border border-zinc-200 p-3 space-y-2.5 animate-fade-in"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-black text-zinc-900">
              {editingId ? 'Edit Counter Preset' : 'Add Counter Preset'}
            </span>
            <button
              type="button"
              onClick={() => cloudDb.resetDefaultCounterPresets()}
              className="text-[11px] font-bold text-zinc-500 hover:text-zinc-900 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Restore Starter 4</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <div className="sm:col-span-3">
              <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">Button Label *</label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Booster Pack"
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-300 bg-white text-zinc-900 font-semibold"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">Sale Description</label>
              <input
                type="text"
                value={itemDescription}
                onChange={(e) => setItemDescription(e.target.value)}
                placeholder="Defaults to label"
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-300 bg-white text-zinc-900"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">Price (£) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="4.50"
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-300 bg-white text-zinc-900 font-black tabular-nums"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">Auto Vendor</label>
              <select
                value={defaultVendor}
                onChange={(e) => setDefaultVendor(e.target.value)}
                className="w-full px-2 py-1.5 text-xs rounded-lg border border-zinc-300 bg-white text-zinc-900 font-semibold"
              >
                <option value="">Any active</option>
                {knownVendors.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2 flex items-end gap-1.5">
              <button
                type="submit"
                className="flex-1 min-h-[34px] px-3 py-1.5 bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-black rounded-lg flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
              >
                {editingId ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{editingId ? 'Save' : 'Add'}</span>
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="min-h-[34px] px-2 py-1.5 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 text-xs font-bold rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase text-zinc-500">Color:</span>
            {(Object.keys(COLOR_STYLES) as PresetColorKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setCategoryColor(key)}
                className={`px-2 py-0.5 rounded-md border text-[11px] font-bold flex items-center gap-1.5 cursor-pointer ${
                  categoryColor === key
                    ? 'bg-zinc-900 text-white border-zinc-900'
                    : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${COLOR_STYLES[key].swatch}`} />
                <span>{COLOR_STYLES[key].label}</span>
              </button>
            ))}
          </div>

          {formError && <p className="text-[11px] font-bold text-rose-600">{formError}</p>}
        </form>
      )}
    </div>
  );
};
