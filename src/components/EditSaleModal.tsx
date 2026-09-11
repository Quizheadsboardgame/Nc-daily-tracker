import React, { useState, useEffect } from 'react';
import { X, User, Tag, Banknote, CreditCard, ArrowLeftRight, Save } from 'lucide-react';
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

  // Trade-in specific state
  const [tradeAcceptingVendor, setTradeAcceptingVendor] = useState('');
  const [tradeValue, setTradeValue] = useState('');
  const [tradeItemDescription, setTradeItemDescription] = useState('');

  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (sale) {
      setVendorName(sale.salesmanName);
      const isMisc = Boolean(sale.isMiscellaneous) || sale.itemDescription?.trim().toLowerCase() === 'miscellaneous';
      setIsMiscellaneous(isMisc);
      setItemDescription(isMisc && !sale.itemDescription?.trim() ? 'Miscellaneous' : sale.itemDescription);
      setAmount(sale.amount.toString());
      setPaymentMethod(sale.paymentMethod);
      setTradeAcceptingVendor(sale.tradeAcceptingVendor || '');
      setTradeValue(sale.tradeValue !== undefined ? sale.tradeValue.toString() : '');
      setTradeItemDescription(sale.tradeItemDescription || '');
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

    let numTradeValue: number | undefined = undefined;
    let compiledTradeDetails: string | undefined = undefined;

    if (paymentMethod === 'trade') {
      if (!tradeAcceptingVendor.trim()) {
        setError('Please select the vendor accepting the trade.');
        return;
      }
      numTradeValue = parseFloat(tradeValue);
      if (!tradeValue || isNaN(numTradeValue) || numTradeValue < 0) {
        setError('Please enter a valid trade-in value (£).');
        return;
      }

      const parts = [
        `Accepted by: ${tradeAcceptingVendor.trim()}`,
        `Value: £${numTradeValue.toFixed(2)}`,
      ];
      if (tradeItemDescription.trim()) {
        parts.push(`Item: ${tradeItemDescription.trim()}`);
      }
      compiledTradeDetails = parts.join(' • ');
    }

    const finalItemDescription = isMiscellaneous ? 'Miscellaneous' : itemDescription.trim();

    onSave(sale.id, {
      salesmanName: vendorName.trim(),
      itemDescription: finalItemDescription,
      isMiscellaneous,
      amount: numAmount,
      paymentMethod,
      tradeDetails: compiledTradeDetails,
      tradeAcceptingVendor: paymentMethod === 'trade' ? tradeAcceptingVendor.trim() : undefined,
      tradeValue: paymentMethod === 'trade' ? numTradeValue : undefined,
      tradeItemDescription: paymentMethod === 'trade' && tradeItemDescription.trim() ? tradeItemDescription.trim() : undefined,
      notes: notes.trim() || undefined,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-zinc-200 overflow-hidden animate-fade-in">
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-zinc-900">Edit Sale Record</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
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
                {vendorName && !vendors.includes(vendorName) && (
                  <option value={vendorName}>{vendorName}</option>
                )}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
                <label htmlFor="edit-input-item" className="block text-xs font-semibold text-zinc-700">
                  What We Sold {!isMiscellaneous && <span className="text-rose-500">*</span>}
                </label>
                <label
                  htmlFor="edit-checkbox-misc"
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold cursor-pointer select-none transition-all ${
                    isMiscellaneous
                      ? 'bg-amber-100 border border-amber-300 text-amber-950'
                      : 'bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 text-zinc-700'
                  }`}
                  title="Tick instead of typing an item description"
                >
                  <input
                    type="checkbox"
                    id="edit-checkbox-misc"
                    checked={isMiscellaneous}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIsMiscellaneous(checked);
                      if (checked) {
                        setItemDescription('Miscellaneous');
                      } else if (itemDescription === 'Miscellaneous') {
                        setItemDescription('');
                      }
                    }}
                    className="w-3.5 h-3.5 rounded border-zinc-300 text-amber-600 focus:ring-amber-500 cursor-pointer accent-amber-600"
                  />
                  <span>Miscellaneous</span>
                </label>
              </div>
              <div className="relative">
                <Tag className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
                <input
                  id="edit-input-item"
                  type="text"
                  value={isMiscellaneous ? 'Miscellaneous' : itemDescription}
                  disabled={isMiscellaneous}
                  onChange={(e) => setItemDescription(e.target.value)}
                  className={`w-full pl-9 pr-3 py-2 text-sm rounded-lg border transition-all ${
                    isMiscellaneous
                      ? 'bg-amber-50/70 border-amber-300 text-amber-950 font-semibold cursor-not-allowed italic'
                      : 'border-zinc-300 focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 bg-white'
                  }`}
                  required={!isMiscellaneous}
                />
              </div>
              {isMiscellaneous && (
                <p className="text-[11px] text-amber-800 font-medium mt-1">
                  Miscellaneous ticked — recorded as general sale
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Amount (£)</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-sm font-bold text-zinc-500">£</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm font-semibold rounded-lg border border-zinc-300 focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
                  required
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Payment Method</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                  paymentMethod === 'cash'
                    ? 'bg-emerald-50 border-emerald-600 text-emerald-900 ring-2 ring-emerald-500/20'
                    : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                <Banknote className="w-3.5 h-3.5" /> Cash
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                  paymentMethod === 'card'
                    ? 'bg-blue-50 border-blue-600 text-blue-900 ring-2 ring-blue-500/20'
                    : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" /> Card
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('trade')}
                className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                  paymentMethod === 'trade'
                    ? 'bg-amber-50 border-amber-600 text-amber-900 ring-2 ring-amber-500/20'
                    : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                <ArrowLeftRight className="w-3.5 h-3.5" /> Trade
              </button>
            </div>
          </div>

          {paymentMethod === 'trade' && (
            <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-amber-900">
                  <ArrowLeftRight className="w-3.5 h-3.5 text-amber-700" />
                  <span className="text-xs font-bold uppercase tracking-wider">Trade-in Details</span>
                </div>
                {vendorName && (
                  <button
                    type="button"
                    onClick={() => setTradeAcceptingVendor(vendorName)}
                    className="text-[11px] font-medium text-amber-800 hover:text-amber-950 underline cursor-pointer"
                  >
                    Same as vendor ({vendorName})
                  </button>
                )}
              </div>

              <div>
                <label htmlFor="edit-select-trade-vendor" className="block text-xs font-semibold text-amber-950 mb-1">
                  Vendor Accepting the Trade <span className="text-rose-500">*</span>
                </label>
                <select
                  id="edit-select-trade-vendor"
                  value={tradeAcceptingVendor}
                  onChange={(e) => setTradeAcceptingVendor(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-amber-300 bg-white focus:ring-2 focus:ring-amber-500/20 text-zinc-900 cursor-pointer"
                  required
                >
                  <option value="">-- Select Vendor Accepting Trade --</option>
                  {vendors.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                  {tradeAcceptingVendor && !vendors.includes(tradeAcceptingVendor) && (
                    <option value={tradeAcceptingVendor}>{tradeAcceptingVendor}</option>
                  )}
                </select>
              </div>

              <div>
                <label htmlFor="edit-input-trade-value" className="block text-xs font-semibold text-amber-950 mb-1">
                  Trade-in Value (£) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-bold text-amber-700">£</span>
                  <input
                    type="number"
                    id="edit-input-trade-value"
                    step="0.01"
                    min="0"
                    value={tradeValue}
                    onChange={(e) => setTradeValue(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-xs font-semibold rounded-lg border border-amber-300 bg-white focus:ring-2 focus:ring-amber-500/20 text-zinc-900"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="edit-input-trade-item" className="block text-xs font-semibold text-amber-950 mb-1">
                  Item Traded In <span className="text-zinc-400 font-normal">(Optional description)</span>
                </label>
                <input
                  type="text"
                  id="edit-input-trade-item"
                  value={tradeItemDescription}
                  onChange={(e) => setTradeItemDescription(e.target.value)}
                  placeholder="e.g. 2018 Yamaha Acoustic Guitar"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-amber-300/80 bg-white focus:ring-2 focus:ring-amber-500/20 text-zinc-900"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">Notes / Remarks</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" /> Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
