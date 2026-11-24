import React, { useState, useEffect } from 'react';
import { X, Tag, Banknote, CreditCard, ArrowLeftRight, Save, Calendar } from 'lucide-react';
import { SaleRecord, PaymentMethod } from '../types';
import { VendorDropdown } from './VendorDropdown';
import { isConnorVendor, isValidFourDigitItemNumber } from '../db/cloudDatabase';

interface EditSaleModalProps {
  sale: SaleRecord | null;
  isOpen: boolean;
  vendors?: string[];
  onClose: () => void;
  onSave: (id: string, updates: Partial<SaleRecord>) => void;
}

export const EditSaleModal: React.FC<EditSaleModalProps> = ({
  sale,
  isOpen,
  vendors = [],
  onClose,
  onSave,
}) => {
  const [vendorName, setVendorName] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [isMiscellaneous, setIsMiscellaneous] = useState(false);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [dateKey, setDateKey] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (sale) {
      setVendorName(sale.salesmanName);
      const isMisc = Boolean(sale.isMiscellaneous) || sale.itemDescription?.trim().toLowerCase() === 'miscellaneous';
      setIsMiscellaneous(isMisc);
      setItemDescription(isMisc && !sale.itemDescription?.trim() ? 'Miscellaneous' : sale.itemDescription);
      setAmount(sale.amount.toString());
      setPaymentMethod(
        sale.paymentMethod === 'cash'
          ? 'cash'
          : sale.paymentMethod === 'traded_out'
          ? 'traded_out'
          : sale.paymentMethod === 'online'
          ? 'online'
          : 'card'
      );
      setDateKey(sale.dateKey || '');
      setNotes(sale.notes || '');
      setError('');
    }
  }, [sale]);

  if (!isOpen || !sale) return null;

  const isConnorSelected = isConnorVendor(vendorName);
  const isConnorCodeValid = isValidFourDigitItemNumber(itemDescription);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorName.trim() || !amount) {
      setError('Please select a vendor and fill in the amount.');
      return;
    }

    if (isConnorSelected) {
      if (isMiscellaneous || !isValidFourDigitItemNumber(itemDescription)) {
        setError('For Connor, Miscellaneous cannot be used — enter a 4-digit number (e.g. 1234).');
        return;
      }
    } else if (!isMiscellaneous && !itemDescription.trim()) {
      setError('Please select a vendor and fill in item description (or tick Miscellaneous) and amount.');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Amount must be greater than £0.');
      return;
    }

    const finalItemDescription = !isConnorSelected && isMiscellaneous ? 'Miscellaneous' : itemDescription.trim();

    onSave(sale.id, {
      salesmanName: vendorName.trim(),
      itemDescription: finalItemDescription,
      isMiscellaneous: !isConnorSelected && isMiscellaneous,
      amount: numAmount,
      paymentMethod,
      dateKey: dateKey.trim() || sale.dateKey,
      notes: notes.trim() || undefined,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-zinc-200 animate-fade-in relative">
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-zinc-900">Edit Sales Record</h3>
            <p className="text-xs text-zinc-500">Update till transaction (Cash, Card, or Trade Out)</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold text-rose-800">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">Vendor's Name</label>
            <VendorDropdown
              id="edit-select-vendor"
              value={vendorName}
              onChange={(val) => {
                setVendorName(val);
                if (isConnorVendor(val)) {
                  setIsMiscellaneous(false);
                  if (!isValidFourDigitItemNumber(itemDescription)) {
                    setItemDescription('');
                  }
                }
                setError('');
              }}
              vendors={vendors}
              placeholder="-- Select Vendor --"
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700">
                <span>{isConnorSelected ? '4-Digit Item Number' : 'Item Sold'}</span>
                {isConnorSelected && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300">
                    4 digits required
                  </span>
                )}
              </label>
              <label
                className={`flex items-center gap-1.5 text-xs select-none px-2 py-0.5 rounded border ${
                  isConnorSelected
                    ? 'bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed line-through opacity-70'
                    : 'text-zinc-600 cursor-pointer bg-zinc-100 border-zinc-200'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isConnorSelected ? false : isMiscellaneous}
                  disabled={isConnorSelected}
                  onChange={(e) => {
                    if (isConnorSelected) return;
                    const checked = e.target.checked;
                    setIsMiscellaneous(checked);
                    if (checked) setItemDescription('Miscellaneous');
                    else if (itemDescription === 'Miscellaneous') setItemDescription('');
                  }}
                  className="rounded text-zinc-900 focus:ring-zinc-900 cursor-pointer disabled:cursor-not-allowed"
                />
                <span className="font-semibold text-[11px]">Miscellaneous</span>
              </label>
            </div>

            <div className="relative">
              <Tag className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                inputMode={isConnorSelected ? 'numeric' : undefined}
                maxLength={isConnorSelected ? 4 : undefined}
                pattern={isConnorSelected ? '[0-9]{4}' : undefined}
                id="edit-input-item"
                value={itemDescription}
                disabled={!isConnorSelected && isMiscellaneous}
                onChange={(e) => {
                  const nextVal = isConnorSelected
                    ? e.target.value.replace(/\D/g, '').slice(0, 4)
                    : e.target.value;
                  setItemDescription(nextVal);
                  setError('');
                }}
                placeholder={
                  isConnorSelected
                    ? 'Enter 4-digit number (e.g. 1234)'
                    : isMiscellaneous
                    ? 'Miscellaneous'
                    : 'Description of item'
                }
                className={`w-full pl-9 ${isConnorSelected ? 'pr-16 font-mono font-bold tracking-widest' : 'pr-3'} py-2 text-sm rounded-lg border ${
                  !isConnorSelected && isMiscellaneous
                    ? 'bg-zinc-100 text-zinc-500 border-zinc-200 cursor-not-allowed'
                    : 'border-zinc-300 bg-white text-zinc-900 focus:border-zinc-900'
                }`}
                required={isConnorSelected || !isMiscellaneous}
              />
              {isConnorSelected && (
                <span
                  className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-extrabold px-1.5 py-0.5 rounded tabular-nums ${
                    isConnorCodeValid
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}
                >
                  {itemDescription.trim().length}/4{isConnorCodeValid ? ' ✓' : ''}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-5">
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Gross Price (£)</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-sm font-bold text-zinc-400">£</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  id="edit-input-amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 text-sm font-bold rounded-lg border border-zinc-300 focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
                  required
                />
              </div>
            </div>

            <div className="sm:col-span-7">
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Method / Settlement</label>
              <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                <button
                  type="button"
                  id="edit-btn-payment-cash"
                  onClick={() => setPaymentMethod('cash')}
                  className={`py-2 px-1.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    paymentMethod === 'cash'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                      : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-300'
                  }`}
                >
                  <Banknote className="w-3.5 h-3.5 shrink-0" />
                  <span>Cash</span>
                </button>
                <button
                  type="button"
                  id="edit-btn-payment-card"
                  onClick={() => setPaymentMethod('card')}
                  className={`py-2 px-1.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    paymentMethod === 'card'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-300'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5 shrink-0" />
                  <span>Card</span>
                </button>
                <button
                  type="button"
                  id="edit-btn-payment-traded-out"
                  onClick={() => setPaymentMethod('traded_out')}
                  className={`py-2 px-1.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    paymentMethod === 'traded_out'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                      : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                  }`}
                  title="Item traded out from vendor's inventory"
                >
                  <ArrowLeftRight className={`w-3.5 h-3.5 shrink-0 ${paymentMethod === 'traded_out' ? 'text-amber-200' : 'text-amber-700'}`} />
                  <span>Trade Out</span>
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Transaction Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400 pointer-events-none" />
                <input
                  type="date"
                  id="edit-input-date"
                  value={dateKey}
                  onChange={(e) => setDateKey(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs font-semibold rounded-lg border border-zinc-300 focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 text-zinc-800"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Notes / Memo</label>
              <input
                type="text"
                id="edit-input-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes..."
                className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-100 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto min-h-[40px] px-4 py-2 text-xs font-semibold rounded-lg border border-zinc-300 text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="btn-save-edit-sale"
              className="w-full sm:w-auto min-h-[42px] px-4 py-2 text-xs font-bold rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
