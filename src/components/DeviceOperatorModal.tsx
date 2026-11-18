import React, { useState } from 'react';
import { UserCheck, Plus, X, CheckCircle2, MonitorSmartphone } from 'lucide-react';
import { cloudDb } from '../db/cloudDatabase';

interface DeviceOperatorModalProps {
  isOpen: boolean;
  knownVendors: string[];
  currentOperator: string;
  requireSelection?: boolean;
  theme?: 'dark' | 'light';
  onSelect: (vendorName: string) => void;
  onClose?: () => void;
}

export const DeviceOperatorModal: React.FC<DeviceOperatorModalProps> = ({
  isOpen,
  knownVendors,
  currentOperator,
  requireSelection = false,
  theme = 'dark',
  onSelect,
  onClose,
}) => {
  const [newVendorName, setNewVendorName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  if (!isOpen) return null;

  const isDark = theme === 'dark';

  const handleChoose = (vendor: string) => {
    const clean = vendor.trim();
    if (!clean) return;
    onSelect(clean);
    onClose?.();
  };

  const handleCreateAndSelect = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newVendorName.trim();
    if (!clean) return;
    await cloudDb.addVendor(clean);
    setNewVendorName('');
    setIsAdding(false);
    handleChoose(clean);
  };

  return (
    <div
      id="modal-device-operator"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
    >
      <div
        className={`w-full max-w-md rounded-3xl shadow-2xl border overflow-hidden ${
          isDark
            ? 'bg-zinc-900 border-zinc-700 text-white'
            : 'bg-white border-zinc-200 text-zinc-900'
        }`}
      >
        <div
          className={`px-5 py-4 border-b flex items-start justify-between gap-3 ${
            isDark ? 'border-zinc-800 bg-zinc-950/60' : 'border-zinc-100 bg-zinc-50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isDark
                  ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-300'
                  : 'bg-emerald-100 border border-emerald-300 text-emerald-800'
              }`}
            >
              <MonitorSmartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight">
                Who is using this device?
              </h3>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                {requireSelection
                  ? 'Select your vendor profile once for this device. Sales & trades will be tagged automatically.'
                  : 'Switch which counter operator is logged in on this device.'}
              </p>
            </div>
          </div>

          {!requireSelection && onClose && (
            <button
              type="button"
              onClick={onClose}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isDark
                  ? 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                  : 'text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100'
              }`}
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-2.5">
            {knownVendors.map((vendor) => {
              const color = cloudDb.getVendorColor(vendor);
              const isSelected = currentOperator.toLowerCase() === vendor.toLowerCase();
              return (
                <button
                  key={vendor}
                  type="button"
                  id={`btn-device-operator-${vendor.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                  onClick={() => handleChoose(vendor)}
                  className={`min-h-[48px] px-3.5 py-2.5 rounded-2xl border-2 text-left flex items-center justify-between gap-2 transition-all cursor-pointer ${
                    isSelected
                      ? isDark
                        ? 'bg-emerald-400 text-zinc-950 border-emerald-200 font-black shadow-lg shadow-emerald-500/25'
                        : 'bg-zinc-950 text-white border-zinc-950 font-black shadow-md'
                      : isDark
                      ? 'bg-zinc-950 border-zinc-700 hover:border-emerald-400/70 hover:bg-zinc-800 text-white font-bold'
                      : 'bg-zinc-50 border-zinc-200 hover:border-zinc-900 hover:bg-zinc-100 text-zinc-900 font-bold'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 ring-1 ring-white/40"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-xs sm:text-sm truncate">{vendor}</span>
                  </div>
                  {isSelected && (
                    <CheckCircle2
                      className={`w-4 h-4 shrink-0 ${
                        isDark ? 'text-zinc-950' : 'text-emerald-400'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {!isAdding ? (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className={`w-full min-h-[40px] px-3 py-2 rounded-xl border border-dashed text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                isDark
                  ? 'border-zinc-700 text-zinc-300 hover:border-emerald-400 hover:text-emerald-300 hover:bg-zinc-800/60'
                  : 'border-zinc-300 text-zinc-600 hover:border-zinc-900 hover:text-zinc-900 hover:bg-zinc-50'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>I&apos;m a different vendor (Add New)</span>
            </button>
          ) : (
            <form onSubmit={handleCreateAndSelect} className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={newVendorName}
                onChange={(e) => setNewVendorName(e.target.value)}
                placeholder="Enter your vendor name..."
                autoFocus
                className={`flex-1 min-w-0 px-3 py-2 text-xs font-bold rounded-xl border focus:outline-hidden ${
                  isDark
                    ? 'bg-zinc-950 border-zinc-700 text-white focus:border-emerald-400'
                    : 'bg-white border-zinc-300 text-zinc-900 focus:border-zinc-900'
                }`}
              />
              <button
                type="submit"
                disabled={!newVendorName.trim()}
                className="min-h-[38px] px-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-zinc-950 text-xs font-black cursor-pointer whitespace-nowrap"
              >
                Save & Select
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setNewVendorName('');
                }}
                className={`min-h-[38px] px-2.5 text-xs font-semibold cursor-pointer ${
                  isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                Cancel
              </button>
            </form>
          )}

          <div
            className={`px-3 py-2.5 rounded-xl text-[11px] flex items-center gap-2 ${
              isDark
                ? 'bg-zinc-950/80 border border-zinc-800 text-zinc-400'
                : 'bg-zinc-50 border border-zinc-200 text-zinc-600'
            }`}
          >
            <UserCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>
              Remembered permanently on this device — you can switch anytime from the top bar.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
