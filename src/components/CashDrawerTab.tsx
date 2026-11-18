import React, { useState, useRef, useEffect } from 'react';
import {
  Vault,
  Lock,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  Delete,
  ShieldCheck,
  ArrowLeft,
} from 'lucide-react';
import { useCashDrawerAuth } from '../utils/auth';
import { CashReconciliationPanel } from './CashReconciliationPanel';
import { formatDisplayDate } from '../db/cloudDatabase';

interface CashDrawerTabProps {
  currentDateKey: string;
  onNavigateToLedger?: () => void;
}

export const CashDrawerTab: React.FC<CashDrawerTabProps> = ({
  currentDateKey,
  onNavigateToLedger,
}) => {
  const { isUnlocked, unlock, lock } = useCashDrawerAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [justUnlocked, setJustUnlocked] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isUnlocked) {
      setPin('');
      setError('');
      setJustUnlocked(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isUnlocked]);

  const handleSubmit = (codeToVerify?: string) => {
    const code = codeToVerify !== undefined ? codeToVerify : pin;
    if (!code) {
      setError('Please enter the Cash Drawer passcode.');
      return;
    }

    const ok = unlock(code);
    if (ok) {
      setJustUnlocked(true);
      setError('');
    } else {
      setError('Incorrect passcode. Please try again.');
      setPin('');
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (digit: string) => {
    if (pin.length < 6) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError('');
      if (nextPin.length === 4) {
        handleSubmit(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setError('');
  };

  const handleClear = () => {
    setPin('');
    setError('');
  };

  if (!isUnlocked) {
    return (
      <div
        id="cash-drawer-locked-view"
        className="max-w-md mx-auto py-4 sm:py-8 px-1 animate-fade-in"
      >
        <div className="bg-white rounded-3xl border border-zinc-200 shadow-lg overflow-hidden">
          {/* Dark Header */}
          <div className="bg-zinc-950 text-white p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-emerald-500/40 mx-auto flex items-center justify-center shadow-inner mb-3.5">
              {justUnlocked ? (
                <CheckCircle2 className="w-7 h-7 text-emerald-400 animate-bounce" />
              ) : (
                <Lock className="w-7 h-7 text-emerald-400" />
              )}
            </div>
            <h2 className="text-xl font-black tracking-tight text-white">
              Cash Drawer Locked
            </h2>
            <p className="text-xs text-zinc-400 mt-1.5 max-w-xs mx-auto leading-relaxed">
              Enter your passcode to view and reconcile End-of-Day Cash Drawer totals for{' '}
              <span className="text-zinc-200 font-bold">{formatDisplayDate(currentDateKey)}</span>.
            </p>
          </div>

          {/* PIN Keypad Form */}
          <div className="p-5 sm:p-6 space-y-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
              className="space-y-4"
            >
              {/* 4-dot PIN indicator */}
              <div className="flex justify-center items-center gap-3 py-1">
                {[0, 1, 2, 3].map((idx) => {
                  const filled = pin.length > idx;
                  return (
                    <div
                      key={idx}
                      className={`w-11 h-12 rounded-xl border-2 flex items-center justify-center text-xl font-black transition-all ${
                        filled
                          ? 'border-emerald-500 bg-emerald-50 text-zinc-900 ring-2 ring-emerald-500/20'
                          : 'border-zinc-300 bg-zinc-50 text-zinc-400'
                      }`}
                    >
                      {filled ? '•' : ''}
                    </div>
                  );
                })}
              </div>

              <input
                ref={inputRef}
                id="input-cash-drawer-passcode"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={pin}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  setPin(val);
                  setError('');
                  if (val.length === 4) {
                    handleSubmit(val);
                  }
                }}
                placeholder="Enter passcode..."
                className="w-full text-center tracking-widest text-lg font-bold py-2.5 rounded-xl border border-zinc-300 bg-zinc-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-zinc-900"
                autoComplete="off"
              />

              {error && (
                <div
                  id="cash-drawer-passcode-error"
                  className="flex items-center justify-center gap-1.5 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 py-2 px-3 rounded-xl animate-fade-in"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Touch Keypad */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => handleKeyPress(digit)}
                    className="py-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 active:bg-zinc-300 text-zinc-900 font-black text-lg transition-colors cursor-pointer"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleClear}
                  className="py-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 active:bg-zinc-300 text-zinc-600 font-bold text-xs transition-colors cursor-pointer"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => handleKeyPress('0')}
                  className="py-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 active:bg-zinc-300 text-zinc-900 font-black text-lg transition-colors cursor-pointer"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handleBackspace}
                  className="py-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 active:bg-zinc-300 text-zinc-600 font-bold flex items-center justify-center transition-colors cursor-pointer"
                  title="Backspace"
                >
                  <Delete className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center gap-2 pt-1">
                {onNavigateToLedger && (
                  <button
                    type="button"
                    onClick={onNavigateToLedger}
                    className="flex-1 py-2.5 rounded-xl border border-zinc-300 text-zinc-700 hover:bg-zinc-100 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Ledger</span>
                  </button>
                )}
                <button
                  type="submit"
                  id="btn-unlock-cash-drawer"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>Unlock Drawer</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="tab-content-cash-drawer" className="space-y-5 animate-fade-in">
      {/* Tab Header & Lock Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-950 flex items-center gap-2.5">
              <Vault className="w-7 h-7 text-emerald-600 shrink-0" />
              <span>Cash Drawer Reconciliation</span>
            </h2>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Unlocked</span>
            </span>
          </div>
          <p className="text-xs font-medium text-zinc-500 mt-1">
            Count the physical till drawer, track opening float &amp; variance for{' '}
            <strong className="text-zinc-800">{formatDisplayDate(currentDateKey)}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {onNavigateToLedger && (
            <button
              type="button"
              onClick={onNavigateToLedger}
              className="min-h-[38px] px-3.5 py-2 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Sales Ledger</span>
            </button>
          )}
          <button
            type="button"
            id="btn-lock-cash-drawer"
            onClick={lock}
            className="min-h-[38px] px-3.5 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-amber-300 border border-zinc-800 text-xs font-black flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>Lock Cash Drawer</span>
          </button>
        </div>
      </div>

      <CashReconciliationPanel currentDateKey={currentDateKey} />
    </div>
  );
};
