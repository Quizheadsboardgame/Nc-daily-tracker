import React, { useState, useEffect, useMemo } from 'react';
import {
  Ticket,
  UserPlus,
  Search,
  Plus,
  Minus,
  History,
  Phone,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  SlidersHorizontal,
  X,
  Users,
  Wallet,
} from 'lucide-react';
import { StoreCreditCustomer, StoreCreditTransaction, StoreCreditOverview } from '../types';
import { cloudDb, formatCurrency, formatDisplayDate } from '../db/cloudDatabase';

interface StoreCreditTabProps {
  knownVendors: string[];
  onNavigateToLedger?: () => void;
  onNavigateToTrades?: () => void;
}

export const StoreCreditTab: React.FC<StoreCreditTabProps> = ({
  knownVendors,
  onNavigateToLedger,
  onNavigateToTrades,
}) => {
  const [customers, setCustomers] = useState<StoreCreditCustomer[]>(() =>
    cloudDb.getStoreCreditCustomers()
  );
  const [transactions, setTransactions] = useState<StoreCreditTransaction[]>(() =>
    cloudDb.getStoreCreditTransactions()
  );
  const [overview, setOverview] = useState<StoreCreditOverview>(() =>
    cloudDb.getStoreCreditOverview()
  );

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [balanceFilter, setBalanceFilter] = useState<'active' | 'all'>('active');

  // New customer / credit form
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newReason, setNewReason] = useState('');
  const [newVendor, setNewVendor] = useState('');
  const [formError, setFormError] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // Adjust modal state
  const [adjustingCustomer, setAdjustingCustomer] = useState<StoreCreditCustomer | null>(null);
  const [adjustDirection, setAdjustDirection] = useState<'add' | 'deduct'>('add');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustDescription, setAdjustDescription] = useState('');
  const [adjustError, setAdjustError] = useState('');

  // History modal / drawer state
  const [historyCustomer, setHistoryCustomer] = useState<StoreCreditCustomer | null>(null);

  // Delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      setCustomers(cloudDb.getStoreCreditCustomers());
      setTransactions(cloudDb.getStoreCreditTransactions());
      setOverview(cloudDb.getStoreCreditOverview());
    };
    sync();
    return cloudDb.subscribe(sync);
  }, []);

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return customers.filter((c) => {
      if (balanceFilter === 'active' && c.balance < 0.005) return false;
      if (q) {
        const matchName = c.name.toLowerCase().includes(q);
        const matchPhone = c.phone?.toLowerCase().includes(q);
        const matchNotes = c.notes?.toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchNotes) return false;
      }
      return true;
    });
  }, [customers, searchQuery, balanceFilter]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleCreateOrIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanName = newName.trim();
    if (!cleanName) {
      setFormError('Please enter the customer name.');
      return;
    }

    const parsedAmt = parseFloat(newAmount);
    if (newAmount.trim() !== '' && (isNaN(parsedAmt) || parsedAmt < 0)) {
      setFormError('Credit amount must be £0.00 or higher.');
      return;
    }

    try {
      if (!newAmount.trim() || parsedAmt === 0) {
        const cust = await cloudDb.upsertStoreCreditCustomer({
          name: cleanName,
          phone: newPhone.trim() || undefined,
          notes: newReason.trim() || undefined,
        });
        showToast(`Customer profile saved for ${cust.name}`);
      } else {
        const res = await cloudDb.adjustStoreCreditBalance({
          customerName: cleanName,
          phone: newPhone.trim() || undefined,
          type: 'issue',
          delta: parsedAmt,
          vendorName: newVendor || undefined,
          description: newReason.trim() || 'Manual Store Credit Issued',
        });
        showToast(
          `Added ${formatCurrency(parsedAmt)} credit to ${res.customer.name} (New balance: ${formatCurrency(res.customer.balance)})`
        );
      }

      setNewName('');
      setNewPhone('');
      setNewAmount('');
      setNewReason('');
    } catch (err: any) {
      setFormError(err?.message || 'Could not update store credit.');
    }
  };

  const openAdjustModal = (customer: StoreCreditCustomer, direction: 'add' | 'deduct') => {
    setAdjustingCustomer(customer);
    setAdjustDirection(direction);
    setAdjustAmount('');
    setAdjustDescription('');
    setAdjustError('');
  };

  const handleSubmitAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingCustomer) return;

    const val = parseFloat(adjustAmount);
    if (isNaN(val) || val <= 0) {
      setAdjustError('Enter an amount greater than £0.00.');
      return;
    }

    const delta = adjustDirection === 'add' ? val : -val;
    try {
      const res = await cloudDb.adjustStoreCreditBalance({
        customerId: adjustingCustomer.id,
        type: adjustDirection === 'add' ? 'issue' : 'adjust',
        delta,
        description:
          adjustDescription.trim() ||
          (adjustDirection === 'add' ? 'Manual Credit Top-Up' : 'Manual Credit Deduction'),
      });
      showToast(
        `${res.customer.name} updated: ${formatCurrency(res.customer.balance)} remaining`
      );
      setAdjustingCustomer(null);
    } catch (err: any) {
      setAdjustError(err?.message || 'Failed to adjust balance.');
    }
  };

  const selectedHistoryTxs = useMemo(() => {
    if (!historyCustomer) return [];
    return transactions.filter((tx) => tx.customerId === historyCustomer.id);
  }, [transactions, historyCustomer]);

  return (
    <div id="tab-content-store-credit" className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="bg-white rounded-2xl border border-zinc-200/90 p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-100 text-purple-800 border border-purple-200 shrink-0">
            <Ticket className="w-5 h-5 text-purple-700" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-zinc-900 tracking-tight">
              Customer Store Credit Balances
            </h2>
            <p className="text-xs text-zinc-500 font-medium">
              Automatically credited from <strong>Vendor&apos;s Credit</strong> trade-ins and redeemable at checkout across all devices
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {toastMessage && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold animate-fade-in">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>{toastMessage}</span>
            </div>
          )}
          {onNavigateToTrades && (
            <button
              type="button"
              onClick={onNavigateToTrades}
              className="min-h-[38px] px-3 py-1.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold cursor-pointer transition-colors"
            >
              Trade-In Ledger
            </button>
          )}
          {onNavigateToLedger && (
            <button
              type="button"
              onClick={onNavigateToLedger}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold cursor-pointer transition-colors"
            >
              Sales Ledger
            </button>
          )}
        </div>
      </div>

      {/* Overview KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        <div className="bg-zinc-950 text-white rounded-2xl border border-zinc-800 p-4 sm:p-5 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-300">
              Active Credit Balance
            </span>
            <Wallet className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black tabular-nums mt-2.5">
            {formatCurrency(overview.totalOutstandingBalance)}
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">Total unspent customer credit</p>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-300 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-600">
              Customers w/ Credit
            </span>
            <Users className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-zinc-950 tabular-nums mt-2.5">
            {overview.activeCustomersCount}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">
            Out of {overview.totalCustomersCount} saved profiles
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-300 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
              Lifetime Issued
            </span>
            <ArrowUpRight className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-700 tabular-nums mt-2.5">
            {formatCurrency(overview.totalLifetimeIssued)}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">Trades &amp; manual credits</p>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-300 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-800">
              Lifetime Redeemed
            </span>
            <ArrowDownRight className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-blue-700 tabular-nums mt-2.5">
            {formatCurrency(overview.totalLifetimeRedeemed)}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">Spent at register checkout</p>
        </div>
      </div>

      {/* Add Customer / Issue Store Credit Form */}
      <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-xs overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-purple-600 via-indigo-500 to-emerald-500" />
        <div className="px-4 sm:px-5 py-3.5 border-b border-zinc-100 bg-zinc-50/70 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0">
            <UserPlus className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-900">
              Add Customer / Issue Store Credit
            </h3>
            <p className="text-[11px] text-zinc-500">
              Create a customer account or top up an existing customer&apos;s balance
            </p>
          </div>
        </div>

        <form onSubmit={handleCreateOrIssue} className="p-4 sm:p-5 space-y-3.5">
          {formError && (
            <div className="flex items-center gap-2 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-3 space-y-1">
              <label htmlFor="input-sc-customer-name" className="block text-xs font-bold text-zinc-800">
                Customer Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="input-sc-customer-name"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Alex Smith"
                className="w-full min-h-[40px] px-3 py-2 text-xs font-bold rounded-xl border border-zinc-300 focus:outline-hidden focus:border-purple-600 text-zinc-950"
              />
            </div>

            <div className="lg:col-span-2 space-y-1">
              <label htmlFor="input-sc-customer-phone" className="block text-xs font-bold text-zinc-800">
                Phone / Handle
              </label>
              <input
                id="input-sc-customer-phone"
                type="text"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="07... or @handle"
                className="w-full min-h-[40px] px-3 py-2 text-xs rounded-xl border border-zinc-300 focus:outline-hidden focus:border-purple-600 text-zinc-900"
              />
            </div>

            <div className="lg:col-span-2 space-y-1">
              <label htmlFor="input-sc-issue-amount" className="block text-xs font-bold text-zinc-800">
                Credit Amount (£)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-black text-zinc-500">£</span>
                <input
                  id="input-sc-issue-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full min-h-[40px] pl-7 pr-2.5 py-2 text-xs font-black tabular-nums rounded-xl border border-zinc-300 focus:outline-hidden focus:border-purple-600 text-zinc-950"
                />
              </div>
            </div>

            <div className="lg:col-span-2 space-y-1">
              <label htmlFor="select-sc-vendor" className="block text-xs font-bold text-zinc-800">
                Vendor (Optional)
              </label>
              <select
                id="select-sc-vendor"
                value={newVendor}
                onChange={(e) => setNewVendor(e.target.value)}
                className="w-full min-h-[40px] px-2.5 py-2 text-xs rounded-xl border border-zinc-300 bg-white focus:outline-hidden focus:border-purple-600 text-zinc-900"
              >
                <option value="">Store / Any</option>
                {knownVendors.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-3 space-y-1 flex flex-col justify-between">
              <label htmlFor="input-sc-reason" className="block text-xs font-bold text-zinc-800">
                Reason / Notes
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="input-sc-reason"
                  type="text"
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  placeholder="e.g. Trade-in, tournament prize..."
                  className="flex-1 min-w-0 min-h-[40px] px-3 py-2 text-xs rounded-xl border border-zinc-300 focus:outline-hidden focus:border-purple-600 text-zinc-900"
                />
                <button
                  type="submit"
                  id="btn-submit-sc-customer"
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Save</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Customer Balances List */}
      <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-xs overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black text-zinc-900">
              Customer Credit Accounts ({filteredCustomers.length})
            </h3>
            <div className="flex items-center bg-zinc-100 p-0.5 rounded-lg border border-zinc-200 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setBalanceFilter('active')}
                className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                  balanceFilter === 'active'
                    ? 'bg-zinc-900 text-white'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Active Balance
              </button>
              <button
                type="button"
                onClick={() => setBalanceFilter('all')}
                className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                  balanceFilter === 'all'
                    ? 'bg-zinc-900 text-white'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                All ({customers.length})
              </button>
            </div>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400 pointer-events-none" />
            <input
              id="input-search-store-credit"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search customer name or phone..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-zinc-300 focus:outline-hidden focus:border-purple-600 text-zinc-900"
            />
          </div>
        </div>

        {filteredCustomers.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <Ticket className="w-8 h-8 text-zinc-300 mx-auto" />
            <p className="text-sm font-bold text-zinc-700">No store credit accounts found</p>
            <p className="text-xs text-zinc-500 max-w-md mx-auto">
              Log a <strong>Vendor&apos;s Credit</strong> trade-in with a Customer Name, or add a customer above to start tracking store credit balances.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-200">
            {filteredCustomers.map((cust) => (
              <div
                key={cust.id}
                className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-zinc-50/70 transition-colors"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-black text-zinc-950">{cust.name}</span>
                    {cust.phone && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-md border border-zinc-200">
                        <Phone className="w-3 h-3 text-zinc-400" />
                        {cust.phone}
                      </span>
                    )}
                    <span className="text-[11px] text-zinc-400">
                      Updated {formatDisplayDate(new Date(cust.updatedAt).toISOString().slice(0, 10))}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-zinc-500 flex-wrap">
                    <span>
                      Issued:{' '}
                      <strong className="text-emerald-700 tabular-nums">
                        {formatCurrency(cust.totalIssued)}
                      </strong>
                    </span>
                    <span>•</span>
                    <span>
                      Redeemed:{' '}
                      <strong className="text-blue-700 tabular-nums">
                        {formatCurrency(cust.totalRedeemed)}
                      </strong>
                    </span>
                    {cust.notes && (
                      <>
                        <span>•</span>
                        <span className="italic truncate max-w-xs">{cust.notes}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2.5 flex-wrap">
                  <div className="px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200 text-right">
                    <span className="block text-[9px] font-bold uppercase tracking-wider text-purple-600">
                      Balance
                    </span>
                    <span className="text-base font-black text-purple-900 tabular-nums">
                      {formatCurrency(cust.balance)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openAdjustModal(cust, 'add')}
                      className="min-h-[34px] px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      title="Add store credit"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openAdjustModal(cust, 'deduct')}
                      disabled={cust.balance <= 0}
                      className="min-h-[34px] px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 disabled:opacity-40 text-amber-900 border border-amber-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      title="Deduct store credit"
                    >
                      <Minus className="w-3.5 h-3.5" />
                      <span>Use</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setHistoryCustomer(cust)}
                      className="min-h-[34px] px-2.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      title="View transaction history"
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>Log</span>
                    </button>

                    {deletingId === cust.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={async () => {
                            await cloudDb.deleteStoreCreditCustomer(cust.id);
                            setDeletingId(null);
                          }}
                          className="min-h-[34px] px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-black cursor-pointer"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingId(null)}
                          className="min-h-[34px] px-2 py-1 rounded-lg bg-zinc-200 text-zinc-700 text-[11px] font-bold cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeletingId(cust.id)}
                        className="min-h-[34px] p-2 rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                        title="Delete customer profile"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity Log */}
      {transactions.length > 0 && (
        <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-xs overflow-hidden">
          <div className="px-4 sm:px-5 py-3 border-b border-zinc-200 bg-zinc-50/70 flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-purple-600" />
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-700">
              Recent Store Credit Activity
            </h3>
          </div>
          <div className="divide-y divide-zinc-100 max-h-80 overflow-y-auto">
            {transactions.slice(0, 25).map((tx) => (
              <div
                key={tx.id}
                className="px-4 sm:px-5 py-2.5 flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-zinc-900">{tx.customerName}</span>
                    <span
                      className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${
                        tx.delta > 0
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}
                    >
                      {tx.type === 'issue' ? 'Issued' : tx.type === 'redeem' ? 'Redeemed' : 'Adjusted'}
                    </span>
                    {tx.vendorName && (
                      <span className="text-[11px] font-semibold text-zinc-500">
                        • {tx.vendorName}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500 truncate">{tx.description}</p>
                </div>

                <div className="text-right shrink-0">
                  <span
                    className={`block font-black tabular-nums ${
                      tx.delta > 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {tx.delta > 0 ? `+${formatCurrency(tx.delta)}` : formatCurrency(tx.delta)}
                  </span>
                  <span className="text-[10px] text-zinc-400 tabular-nums">
                    Bal: {formatCurrency(tx.balanceAfter)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Adjust Balance Modal */}
      {adjustingCustomer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAdjustingCustomer(null);
          }}
        >
          <div className="bg-white rounded-3xl border border-zinc-200 shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="bg-zinc-950 text-white px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black">
                  {adjustDirection === 'add' ? 'Add Store Credit' : 'Deduct Store Credit'}
                </h3>
                <p className="text-xs text-zinc-400">
                  {adjustingCustomer.name} • Current: {formatCurrency(adjustingCustomer.balance)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAdjustingCustomer(null)}
                className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitAdjust} className="p-5 space-y-3.5">
              {adjustError && (
                <div className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-xl">
                  {adjustError}
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-xs font-bold text-zinc-800">Amount (£)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  placeholder="0.00"
                  autoFocus
                  className="w-full px-3 py-2.5 text-base font-black tabular-nums rounded-xl border border-zinc-300 focus:outline-hidden focus:border-purple-600"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-zinc-800">Reason / Note</label>
                <input
                  type="text"
                  value={adjustDescription}
                  onChange={(e) => setAdjustDescription(e.target.value)}
                  placeholder={
                    adjustDirection === 'add'
                      ? 'e.g. Trade-in bonus, top up...'
                      : 'e.g. Manual checkout deduction...'
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 focus:outline-hidden focus:border-purple-600"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setAdjustingCustomer(null)}
                  className="flex-1 py-2.5 rounded-xl border border-zinc-300 text-zinc-700 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`flex-1 py-2.5 rounded-xl text-white text-xs font-black cursor-pointer ${
                    adjustDirection === 'add'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  {adjustDirection === 'add' ? 'Add Credit' : 'Deduct Credit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Transaction History Modal */}
      {historyCustomer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setHistoryCustomer(null);
          }}
        >
          <div className="bg-white rounded-3xl border border-zinc-200 shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="bg-zinc-950 text-white px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black">{historyCustomer.name} — Credit History</h3>
                <p className="text-xs text-purple-300 font-bold">
                  Available Balance: {formatCurrency(historyCustomer.balance)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryCustomer(null)}
                className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto divide-y divide-zinc-100">
              {selectedHistoryTxs.length === 0 ? (
                <div className="p-6 text-center text-xs text-zinc-500">
                  No transactions recorded yet for {historyCustomer.name}.
                </div>
              ) : (
                selectedHistoryTxs.map((tx) => (
                  <div key={tx.id} className="px-5 py-3 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <div className="font-bold text-zinc-900">{tx.description}</div>
                      <div className="text-[11px] text-zinc-500">
                        {formatDisplayDate(tx.dateKey)} •{' '}
                        {new Date(tx.timestamp).toLocaleTimeString('en-GB', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {tx.vendorName ? ` • ${tx.vendorName}` : ''}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div
                        className={`font-black tabular-nums ${
                          tx.delta > 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {tx.delta > 0 ? `+${formatCurrency(tx.delta)}` : formatCurrency(tx.delta)}
                      </div>
                      <div className="text-[10px] text-zinc-400 tabular-nums">
                        Bal: {formatCurrency(tx.balanceAfter)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
