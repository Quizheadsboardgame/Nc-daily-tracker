import React, { useState, useEffect } from 'react';
import { X, User, Tag, Banknote, CreditCard, Save } from 'lucide-react';
import { SaleRecord, PaymentMethod } from '../types';

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
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (sale) {
      setVendorName(sale.salesmanName);
      const isMisc = Boolean(sale.isMiscellaneous) || sale.itemDescription?.trim().toLowerCase() === 'miscellaneous';
      setIsMiscellaneous(isMisc);
      setItemDescription(isMisc && !sale.itemDescription?.trim() ? 'Miscellaneous' : sale.itemDescription);
      setAmount(sale.amount.toString());
      setPaymentMethod(sale.paymentMethod === 'cash' ? 'cash' : 'card');
      setNotes(sale.notes || '');
      setError('');
    }
  }, [sale]);

  if (!isOpen || !sale) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorName.trim() || (!isMiscellaneous && !itemDescription.trim()) || !amount) {
      setError('Please select a vendor and fill in item description (or tick Miscellaneous) and amount.');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Amount must be greater than £0.');
      return;
    }

    const finalItemDescription = isMiscellaneous ? 'Miscellaneous' : itemDescription.trim();

    onSave(sale.id, {
      salesmanName: vendorName.trim(),
      itemDescription: finalItemDescription,
      isMiscellaneous,
      amount: numAmount,
      paymentMethod,
      notes: notes.trim() || undefined,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-zinc-200 overflow-hidden animate-fade-in">
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-zinc-900">Edit Sales Record</h3>
            <p className="text-xs text-zinc-500">Update till gross transaction</p>
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
            <div className="relative">
              <User className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400 pointer-events-none" />
              <select
                id="edit-select-vendor"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-zinc-300 focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 bg-white cursor-pointer font-medium text-zinc-900"
                required
              >
                <option value="">-- Select Vendor --</option>
                {vendors.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-zinc-700">Item Sold</label>
              <label className="flex items-center gap-1.5 text-xs text-zinc-600 cursor-pointer select-none bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                <input
                  type="checkbox"
                  checked={isMiscellaneous}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsMiscellaneous(checked);
                    if (checked) setItemDescription('Miscellaneous');
                    else if (itemDescription === 'Miscellaneous') setItemDescription('');
                  }}
                  className="rounded text-zinc-900 focus:ring-zinc-900 cursor-pointer"
                />
                <span className="font-semibold text-[11px]">Miscellaneous</span>
              </label>
            </div>

            <div className="relative">
              <Tag className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                id="edit-input-item"
                value={itemDescription}
                disabled={isMiscellaneous}
                onChange={(e) => setItemDescription(e.target.value)}
                placeholder={isMiscellaneous ? 'Miscellaneous' : 'Description of item'}
                className={`w-full pl-9 pr-3 py-2 text-sm rounded-lg border ${
                  isMiscellaneous
                    ? 'bg-zinc-100 text-zinc-500 border-zinc-200 cursor-not-allowed'
                    : 'border-zinc-300 bg-white text-zinc-900 focus:border-zinc-900'
                }`}
                required={!isMiscellaneous}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
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

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Payment Method</label>
              <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                <button
                  type="button"
                  id="edit-btn-payment-cash"
                  onClick={() => setPaymentMethod('cash')}
                  className={`py-2 px-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    paymentMethod === 'cash'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-300'
                  }`}
                >
                  <Banknote className="w-3.5 h-3.5" />
                  <span>Cash</span>
                </button>
                <button
                  type="button"
                  id="edit-btn-payment-card"
                  onClick={() => setPaymentMethod('card')}
                  className={`py-2 px-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    paymentMethod === 'card'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-300'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Card</span>
                </button>
              </div>
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

          <div className="pt-3 border-t border-zinc-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-lg border border-zinc-300 text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="btn-save-edit-sale"
              className="px-4 py-2 text-xs font-bold rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white flex items-center gap-1.5 transition-colors cursor-pointer"
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
