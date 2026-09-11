import React, { useState, useEffect } from 'react';
import { X, User, Tag, DollarSign, Banknote, CreditCard, ArrowLeftRight, Save } from 'lucide-react';
import { SaleRecord, PaymentMethod } from '../types';

interface EditSaleModalProps {
  sale: SaleRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, updates: Partial<SaleRecord>) => void;
}

export const EditSaleModal: React.FC<EditSaleModalProps> = ({
  sale,
  isOpen,
  onClose,
  onSave,
}) => {
  const [salesmanName, setSalesmanName] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [tradeDetails, setTradeDetails] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (sale) {
      setSalesmanName(sale.salesmanName);
      setItemDescription(sale.itemDescription);
      setAmount(sale.amount.toString());
      setPaymentMethod(sale.paymentMethod);
      setTradeDetails(sale.tradeDetails || '');
      setNotes(sale.notes || '');
      setError('');
    }
  }, [sale]);

  if (!isOpen || !sale) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!salesmanName.trim() || !itemDescription.trim() || !amount) {
      setError('Please fill in salesman, item description, and amount.');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Amount must be greater than $0.');
      return;
    }

    if (paymentMethod === 'trade' && !tradeDetails.trim()) {
      setError('Please enter trade-in details.');
      return;
    }

    onSave(sale.id, {
      salesmanName: salesmanName.trim(),
      itemDescription: itemDescription.trim(),
      amount: numAmount,
      paymentMethod,
      tradeDetails: paymentMethod === 'trade' ? tradeDetails.trim() : undefined,
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
            <label className="block text-xs font-semibold text-zinc-700 mb-1">Salesman's Name</label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                value={salesmanName}
                onChange={(e) => setSalesmanName(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-zinc-300 focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">What We Sold</label>
              <div className="relative">
                <Tag className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-zinc-300 focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Amount ($)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm font-semibold rounded-lg border border-zinc-300 focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
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
            <div>
              <label className="block text-xs font-semibold text-amber-900 mb-1">Trade Details</label>
              <input
                type="text"
                value={tradeDetails}
                onChange={(e) => setTradeDetails(e.target.value)}
                placeholder="What was traded in?"
                className="w-full px-3 py-2 text-xs rounded-lg border border-amber-300 focus:ring-2 focus:ring-amber-500/20"
                required
              />
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
