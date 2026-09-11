import React, { useState } from 'react';
import { X, UserMinus, UserPlus, Check, Trash2, ShieldCheck, Users } from 'lucide-react';

interface ManageSalesmenModalProps {
  isOpen: boolean;
  onClose: () => void;
  salesmen: string[];
  onAddSalesman: (name: string) => void;
  onRemoveSalesman: (name: string) => void;
}

export const ManageSalesmenModal: React.FC<ManageSalesmenModalProps> = ({
  isOpen,
  onClose,
  salesmen,
  onAddSalesman,
  onRemoveSalesman,
}) => {
  const [newSalesmanName, setNewSalesmanName] = useState('');
  const [error, setError] = useState('');
  const [salesmanToDelete, setSalesmanToDelete] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newSalesmanName.trim();
    if (!clean) {
      setError('Salesman name cannot be empty');
      return;
    }
    if (salesmen.some((s) => s.toLowerCase() === clean.toLowerCase())) {
      setError('This salesman is already in the roster');
      return;
    }

    onAddSalesman(clean);
    setNewSalesmanName('');
    setError('');
  };

  const handleConfirmDelete = (name: string) => {
    onRemoveSalesman(name);
    setSalesmanToDelete(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-zinc-200 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-zinc-900 text-white">
              <Users className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900">Manage Salesmen Roster</h3>
              <p className="text-xs text-zinc-500">Synced across all devices via Cloud Firestore</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4.5">
          {/* Add Form */}
          <form onSubmit={handleAdd} className="space-y-2">
            <label htmlFor="input-modal-add-salesman" className="block text-xs font-bold uppercase tracking-wider text-zinc-600">
              Add New Salesman
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                id="input-modal-add-salesman"
                value={newSalesmanName}
                onChange={(e) => {
                  setNewSalesmanName(e.target.value);
                  if (error) setError('');
                }}
                placeholder="e.g. Liam, Jessica, Bradley..."
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-zinc-300 focus:outline-hidden focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 text-zinc-900"
              />
              <button
                type="submit"
                id="btn-modal-add-salesman"
                className="px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg flex items-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0"
              >
                <UserPlus className="w-4 h-4" />
                <span>Add</span>
              </button>
            </div>
            {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
          </form>

          {/* Current Roster */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-600">
                Active Sales Team ({salesmen.length})
              </span>
              <span className="text-[11px] text-zinc-400">Synced cloud database</span>
            </div>

            <div className="border border-zinc-200 rounded-xl divide-y divide-zinc-100 max-h-64 overflow-y-auto bg-zinc-50/50">
              {salesmen.length === 0 ? (
                <div className="p-4 text-center text-xs text-zinc-500">
                  No salesmen registered yet.
                </div>
              ) : (
                salesmen.map((salesman) => {
                  const isDeleting = salesmanToDelete === salesman;

                  return (
                    <div
                      key={salesman}
                      className="px-3.5 py-2.5 flex items-center justify-between hover:bg-white transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-zinc-200 flex items-center justify-center text-zinc-800 text-xs font-bold">
                          {salesman.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-semibold text-zinc-900">{salesman}</span>
                      </div>

                      {isDeleting ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-semibold text-rose-600 mr-1">Remove?</span>
                          <button
                            type="button"
                            onClick={() => handleConfirmDelete(salesman)}
                            className="px-2 py-1 text-[11px] font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-md transition-colors cursor-pointer"
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={() => setSalesmanToDelete(null)}
                            className="px-2 py-1 text-[11px] font-medium text-zinc-600 bg-zinc-200 hover:bg-zinc-300 rounded-md transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSalesmanToDelete(salesman)}
                          className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title={`Remove ${salesman}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-[11px] text-emerald-800">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Changes save to your Cloud database immediately. Any device opening this page will see the exact same salesmen.
            </span>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-zinc-100 bg-zinc-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-zinc-800 bg-white border border-zinc-200 hover:bg-zinc-100 rounded-lg shadow-xs cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
