import React, { useState, useEffect, useRef } from 'react';
import { Lock, KeyRound, X, CheckCircle2, AlertCircle, Delete } from 'lucide-react';
import { useTotalSalesAuth } from '../utils/auth';

interface PasscodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  title?: string;
  subtitle?: string;
}

export const PasscodeModal: React.FC<PasscodeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  title = 'Manager Passcode',
  subtitle = 'Enter authorization code to unlock full access.',
}) => {
  const { unlock } = useTotalSalesAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError('');
      setIsSuccess(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (codeToVerify?: string) => {
    const code = codeToVerify !== undefined ? codeToVerify : pin;
    if (!code) {
      setError('Please enter your passcode.');
      return;
    }

    const success = unlock(code);
    if (success) {
      setIsSuccess(true);
      setError('');
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 400);
    } else {
      setError('Incorrect passcode. Please try again.');
      setPin('');
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (digit: string) => {
    if (pin.length < 6) {
      const newPin = pin + digit;
      setPin(newPin);
      setError('');
      if (newPin.length === 4) {
        handleSubmit(newPin);
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-3xl border border-zinc-200 shadow-2xl max-w-sm w-full overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="bg-zinc-950 text-white p-5 text-center relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Cancel"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-700/80 mx-auto flex items-center justify-center shadow-inner mb-3">
            {isSuccess ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-400 animate-bounce" />
            ) : (
              <Lock className="w-6 h-6 text-emerald-400" />
            )}
          </div>

          <h3 className="text-lg font-black tracking-tight text-white">
            {isSuccess ? 'Access Granted' : title}
          </h3>
          <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">
            {isSuccess
              ? 'Full application experience unlocked'
              : subtitle}
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Hidden or standard input for hardware keyboard */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            className="space-y-4"
          >
            <div className="flex justify-center items-center gap-3 py-2">
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

            <div className="relative">
              <input
                ref={inputRef}
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
                placeholder="Enter code..."
                className="w-full text-center tracking-widest text-lg font-bold py-2 rounded-xl border border-zinc-300 bg-zinc-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-zinc-900"
                autoComplete="off"
              />
            </div>

            {error && (
              <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 py-2 px-3 rounded-xl animate-fade-in">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* On-Screen Touch Keypad */}
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

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-zinc-300 text-zinc-700 hover:bg-zinc-100 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <KeyRound className="w-4 h-4" />
                <span>Authorize</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
