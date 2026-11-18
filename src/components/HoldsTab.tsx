import React, { useState, useEffect, useMemo } from 'react';
import {
  BookmarkCheck,
  PlusCircle,
  Search,
  User,
  Phone,
  Calendar,
  Banknote,
  CreditCard,
  ArrowLeftRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
  UserCheck,
  Tag,
} from 'lucide-react';
import { HoldRecord, HoldStatus, PaymentMethod } from '../types';
import { cloudDb, formatCurrency, getLocalDateKey, formatDisplayDate } from '../db/cloudDatabase';
import { VendorDropdown } from './VendorDropdown';

interface HoldsTabProps {
  knownVendors: string[];
  currentDateKey: string;
  onNavigateToLedger?: () => void;
}

export const HoldsTab: React.FC<HoldsTabProps> = ({
  knownVendors,
  currentDateKey,
  onNavigateToLedger,
}) => {
  const [, setSyncTick] = useState(0);
  useEffect(() => {
    return cloudDb.subscribe(() => setSyncTick((t) => t + 1));
  }, []);

  // Create Hold Form State
  const [isFormOpen, setIsFormOpen] = useState(true);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [totalPrice, setTotalPrice] = useState('');
  const [initialDeposit, setInitialDeposit] = useState('');
  const [depositMethod, setDepositMethod] = useState<PaymentMethod>('cash');
  const [dueDateKey, setDueDateKey] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'active' | 'completed' | 'closed' | 'all'>('active');
  const [vendorFilter, setVendorFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Active Payment Drawer State
  const [payingHoldId, setPayingHoldId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Expanded Payment History & Delete Confirm
  const [expandedHoldId, setExpandedHoldId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const todayKey = getLocalDateKey();
  const frequentVendors = cloudDb.getFrequentVendors(3);
  const overview = cloudDb.getHoldsOverview();
  const allHolds = cloudDb.getHolds({
    vendor: vendorFilter,
    query: searchQuery,
  });

  const filteredHolds = useMemo(() => {
    if (statusFilter === 'all') return allHolds;
    if (statusFilter === 'closed') {
      return allHolds.filter((h) => h.status === 'cancelled' || h.status === 'expired');
    }
    return allHolds.filter((h) => h.status === statusFilter);
  }, [allHolds, statusFilter]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleCreateHold = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const parsedTotal = parseFloat(totalPrice);
    const parsedDeposit = initialDeposit.trim() ? parseFloat(initialDeposit) : 0;

    if (!customerName.trim()) {
      setFormError('Please enter the customer name.');
      return;
    }
    if (!vendorName.trim()) {
      setFormError('Please select the vendor holding this item.');
      return;
    }
    if (!itemDescription.trim()) {
      setFormError('Please describe the held card or item.');
      return;
    }
    if (isNaN(parsedTotal) || parsedTotal <= 0) {
      setFormError('Please enter a valid total price greater than £0.00.');
      return;
    }
    if (isNaN(parsedDeposit) || parsedDeposit < 0) {
      setFormError('Initial deposit cannot be negative.');
      return;
    }
    if (parsedDeposit > parsedTotal) {
      setFormError('Initial deposit cannot exceed the total item price.');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await cloudDb.createHold({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        vendorName: vendorName.trim(),
        itemDescription: itemDescription.trim(),
        totalPrice: parsedTotal,
        initialDeposit: parsedDeposit,
        depositPaymentMethod: depositMethod,
        dueDateKey: dueDateKey || undefined,
        notes: notes.trim() || undefined,
        dateKey: currentDateKey,
      });

      showToast(
        created.remainingBalance <= 0
          ? `Hold for ${created.customerName} paid in full & logged!`
          : `Hold created for ${created.customerName} (${formatCurrency(created.remainingBalance)} remaining)`
      );

      setCustomerName('');
      setCustomerPhone('');
      setItemDescription('');
      setTotalPrice('');
      setInitialDeposit('');
      setDueDateKey('');
      setNotes('');
    } catch (err: any) {
      setFormError(err?.message || 'Could not create hold.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openPaymentDrawer = (hold: HoldRecord) => {
    if (payingHoldId === hold.id) {
      setPayingHoldId(null);
      return;
    }
    setPayingHoldId(hold.id);
    setPaymentAmount(hold.remainingBalance.toFixed(2));
    setPaymentMethod('cash');
    setPaymentNotes('');
    setPaymentError(null);
  };

  const handleSubmitHoldPayment = async (hold: HoldRecord, e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError(null);

    const val = parseFloat(paymentAmount);
    if (isNaN(val) || val <= 0) {
      setPaymentError('Enter a payment amount greater than £0.00.');
      return;
    }
    if (val > hold.remainingBalance + 0.004) {
      setPaymentError(`Payment cannot exceed remaining balance (${formatCurrency(hold.remainingBalance)}).`);
      return;
    }

    setIsProcessingPayment(true);
    try {
      const updated = await cloudDb.recordHoldPayment(hold.id, {
        amount: val,
        paymentMethod,
        notes: paymentNotes.trim() || undefined,
        dateKey: currentDateKey,
      });

      setPayingHoldId(null);
      setPaymentAmount('');
      setPaymentNotes('');

      showToast(
        updated.status === 'completed'
          ? `Paid in full & completed layaway for ${updated.customerName}!`
          : `Recorded ${formatCurrency(val)} towards ${updated.customerName}'s hold (${formatCurrency(updated.remainingBalance)} left).`
      );
    } catch (err: any) {
      setPaymentError(err?.message || 'Failed to record payment.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleStatusChange = async (hold: HoldRecord, status: HoldStatus) => {
    await cloudDb.updateHoldStatus(hold.id, status);
    showToast(`Marked "${hold.itemDescription}" as ${status}.`);
  };

  const handleDeleteHold = async (holdId: string) => {
    await cloudDb.deleteHold(holdId);
    setDeleteConfirmId(null);
    showToast('Hold removed.');
  };

  const renderStatusBadge = (hold: HoldRecord) => {
    const isOverdue = hold.status === 'active' && Boolean(hold.dueDateKey && hold.dueDateKey < todayKey);
    if (hold.status === 'completed') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
          <CheckCircle2 className="w-3 h-3 text-emerald-700" />
          Paid &amp; Picked Up
        </span>
      );
    }
    if (hold.status === 'cancelled') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-zinc-200 text-zinc-700 border border-zinc-300">
          Cancelled
        </span>
      );
    }
    if (hold.status === 'expired') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
          Expired
        </span>
      );
    }
    if (isOverdue) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-100 text-rose-900 border border-rose-300">
          <AlertTriangle className="w-3 h-3 text-rose-600" />
          Overdue Hold
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-sky-100 text-sky-900 border border-sky-300">
        <Clock className="w-3 h-3 text-sky-700" />
        Active Layaway
      </span>
    );
  };

  const renderPaymentMethodPill = (method: PaymentMethod) => {
    const label =
      method === 'cash' ? 'Cash' : method === 'card' ? 'Card' : method === 'traded_out' ? 'Trade Out' : 'Online';
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 text-zinc-800 border border-zinc-200">
        {label}
      </span>
    );
  };

  return (
    <div className="space-y-6" id="view-holds-tab">
      {/* Floating Toast */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 bg-zinc-950 text-white px-4 py-3 rounded-xl shadow-2xl border border-emerald-500/50 animate-fade-in text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Banner */}
      <div className="bg-white rounded-2xl border border-zinc-200/90 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-sky-50 text-sky-800 border border-sky-200 shrink-0">
            <BookmarkCheck className="w-5 h-5 text-sky-700" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-zinc-900 tracking-tight">
              Customer Holds &amp; Layaway Tracker
            </h2>
            <p className="text-xs text-zinc-500 font-medium">
              Reserve high-value singles or boxes, collect partial deposits, and log installment payments straight into daily sales.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsFormOpen((v) => !v)}
            className="min-h-[38px] px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{isFormOpen ? 'Hide New Hold Form' : 'New Hold / Layaway'}</span>
          </button>

          {onNavigateToLedger && (
            <button
              type="button"
              onClick={onNavigateToLedger}
              className="min-h-[38px] px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold cursor-pointer transition-colors"
            >
              Sales Ledger
            </button>
          )}
        </div>
      </div>

      {/* Overview KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" id="section-holds-kpis">
        <div className="bg-zinc-950 text-white rounded-2xl border border-zinc-800 p-4 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            Active Holds
          </span>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-2xl sm:text-3xl font-black tabular-nums">{overview.activeCount}</span>
            {overview.overdueCount > 0 && (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/50">
                {overview.overdueCount} overdue
              </span>
            )}
          </div>
          <span className="text-[11px] text-zinc-400 mt-1">{overview.completedCount} completed</span>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
            Total Active Hold Value
          </span>
          <span className="mt-2 text-2xl sm:text-3xl font-black text-zinc-950 tabular-nums">
            {formatCurrency(overview.totalActiveValue)}
          </span>
          <span className="text-[11px] text-zinc-500 mt-1">Reserved stock total</span>
        </div>

        <div className="bg-white rounded-2xl border border-emerald-200 p-4 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
            Deposits Collected
          </span>
          <span className="mt-2 text-2xl sm:text-3xl font-black text-emerald-700 tabular-nums">
            {formatCurrency(overview.totalDepositsCollected)}
          </span>
          <span className="text-[11px] text-zinc-500 mt-1">Paid on open layaways</span>
        </div>

        <div className="bg-white rounded-2xl border border-amber-200 p-4 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
            Remaining Due
          </span>
          <span className="mt-2 text-2xl sm:text-3xl font-black text-amber-700 tabular-nums">
            {formatCurrency(overview.totalRemainingDue)}
          </span>
          <span className="text-[11px] text-zinc-500 mt-1">To collect at pickup</span>
        </div>
      </div>

      {/* Create New Hold / Layaway Card */}
      {isFormOpen && (
        <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-xs" id="card-create-hold">
          <div className="h-1 bg-gradient-to-r from-sky-500 via-indigo-500 to-emerald-500 rounded-t-2xl" />
          <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/70">
            <div className="flex items-center gap-2">
              <BookmarkCheck className="w-4 h-4 text-sky-600" />
              <h3 className="text-sm font-bold text-zinc-900">Create New Hold / Layaway</h3>
            </div>
            <span className="text-[11px] text-zinc-500 font-medium">
              Deposits automatically log into today&apos;s Sales Ledger
            </span>
          </div>

          <form onSubmit={handleCreateHold} className="p-5 space-y-4">
            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-4 space-y-1.5">
                <label className="block text-xs font-bold text-zinc-800">
                  Customer Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400 pointer-events-none" />
                  <input
                    type="text"
                    id="input-hold-customer-name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Jordan, @poke_alex..."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-zinc-300 bg-white text-zinc-900 focus:outline-hidden focus:border-zinc-900"
                  />
                </div>
              </div>

              <div className="md:col-span-3 space-y-1.5">
                <label className="block text-xs font-bold text-zinc-800">
                  Phone / Social Handle
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-400 pointer-events-none" />
                  <input
                    type="text"
                    id="input-hold-customer-phone"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="07700 900123 or Discord"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-zinc-300 bg-white text-zinc-900 focus:outline-hidden focus:border-zinc-900"
                  />
                </div>
              </div>

              <div className="md:col-span-5 space-y-1.5">
                <label className="block text-xs font-bold text-zinc-800">
                  Vendor Holding Stock <span className="text-rose-500">*</span>
                </label>
                <VendorDropdown
                  id="select-hold-vendor"
                  value={vendorName}
                  onChange={setVendorName}
                  vendors={knownVendors}
                  placeholder="-- Choose Vendor --"
                />
                {frequentVendors.length > 0 && (
                  <div
                    className={`grid gap-1.5 w-full pt-1 ${
                      frequentVendors.length === 1
                        ? 'grid-cols-1'
                        : frequentVendors.length === 2
                        ? 'grid-cols-2'
                        : 'grid-cols-3'
                    }`}
                  >
                    {frequentVendors.map((v) => {
                      const active = vendorName.toLowerCase() === v.toLowerCase();
                      return (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setVendorName(v)}
                          className={`min-w-0 min-h-[32px] px-2 py-1 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                            active
                              ? 'bg-zinc-950 text-white border-zinc-950'
                              : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-800 border-zinc-200'
                          }`}
                        >
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: cloudDb.getVendorColor(v) }}
                          />
                          <span className="truncate">{v}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-5 space-y-1.5">
                <label className="block text-xs font-bold text-zinc-800">
                  Card / Item Held <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Tag className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400 pointer-events-none" />
                  <input
                    type="text"
                    id="input-hold-item"
                    value={itemDescription}
                    onChange={(e) => setItemDescription(e.target.value)}
                    placeholder="e.g. Umbreon VMAX Alt Art PSA 10, Prismatic ETB..."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-zinc-300 bg-white text-zinc-900 focus:outline-hidden focus:border-zinc-900"
                  />
                </div>
              </div>

              <div className="md:col-span-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-zinc-800">
                    Total Agreed Price (£) <span className="text-rose-500">*</span>
                  </label>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-black text-zinc-500">£</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    id="input-hold-total"
                    value={totalPrice}
                    onChange={(e) => setTotalPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 text-sm font-black tabular-nums rounded-xl border border-zinc-300 bg-white text-zinc-950 focus:outline-hidden focus:border-zinc-900"
                  />
                </div>
              </div>

              <div className="md:col-span-4 space-y-1.5">
                <div className="flex items-center justify-between gap-1">
                  <label className="block text-xs font-bold text-zinc-800">
                    Initial Deposit (£)
                  </label>
                  <div className="flex items-center gap-1">
                    {parseFloat(totalPrice) > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => setInitialDeposit((parseFloat(totalPrice) * 0.2).toFixed(2))}
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200 cursor-pointer"
                        >
                          20%
                        </button>
                        <button
                          type="button"
                          onClick={() => setInitialDeposit((parseFloat(totalPrice) * 0.5).toFixed(2))}
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200 cursor-pointer"
                        >
                          50%
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => setInitialDeposit('0')}
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200 cursor-pointer"
                    >
                      £0 Hold
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-black text-zinc-500">£</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    id="input-hold-deposit"
                    value={initialDeposit}
                    onChange={(e) => setInitialDeposit(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 text-sm font-black tabular-nums rounded-xl border border-zinc-300 bg-white text-zinc-950 focus:outline-hidden focus:border-zinc-900"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              <div className="md:col-span-4 space-y-1.5">
                <label className="block text-xs font-bold text-zinc-800">
                  Deposit Payment Method
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'cash', label: 'Cash', icon: Banknote },
                      { id: 'card', label: 'Card', icon: CreditCard },
                      { id: 'traded_out', label: 'Trade Out', icon: ArrowLeftRight },
                    ] as const
                  ).map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setDepositMethod(id)}
                      className={`min-h-[38px] px-2 py-1.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-all ${
                        depositMethod === id
                          ? 'bg-zinc-950 text-white border-zinc-950'
                          : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-200'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="md:col-span-3 space-y-1.5">
                <label className="block text-xs font-bold text-zinc-800">
                  Pickup Due Date (Optional)
                </label>
                <div className="relative">
                  <Calendar className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-400 pointer-events-none" />
                  <input
                    type="date"
                    id="input-hold-due-date"
                    value={dueDateKey}
                    onChange={(e) => setDueDateKey(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 min-h-[38px] text-xs rounded-xl border border-zinc-300 bg-white text-zinc-900 focus:outline-hidden focus:border-zinc-900"
                  />
                </div>
              </div>

              <div className="md:col-span-3 space-y-1.5">
                <label className="block text-xs font-bold text-zinc-800">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Condition, shelf location..."
                  className="w-full px-3 py-2 min-h-[38px] text-xs rounded-xl border border-zinc-300 bg-white text-zinc-900 focus:outline-hidden focus:border-zinc-900"
                />
              </div>

              <div className="md:col-span-2">
                <button
                  type="submit"
                  id="btn-create-hold-submit"
                  disabled={isSubmitting}
                  className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 disabled:opacity-50 text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                >
                  <BookmarkCheck className="w-4 h-4 text-sky-400" />
                  <span>{isSubmitting ? 'Saving...' : 'Save Hold'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Holds Directory & Filters */}
      <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-zinc-100 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 bg-zinc-100 p-1 rounded-xl border border-zinc-200">
              {(
                [
                  { id: 'active', label: `Active (${overview.activeCount})` },
                  { id: 'completed', label: `Completed (${overview.completedCount})` },
                  { id: 'closed', label: 'Cancelled / Expired' },
                  { id: 'all', label: 'All Holds' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                    statusFilter === tab.id
                      ? 'bg-white text-zinc-950 shadow-xs font-black'
                      : 'text-zinc-600 hover:text-zinc-950'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1 md:max-w-lg">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search customer, item, phone, or staff..."
                  className="w-full pl-9 pr-3 py-1.5 min-h-[36px] text-xs rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:outline-hidden focus:border-zinc-900"
                />
              </div>
              <div className="w-full sm:w-44 shrink-0">
                <VendorDropdown
                  value={vendorFilter}
                  onChange={setVendorFilter}
                  vendors={knownVendors}
                  includeAllOption={true}
                  allOptionLabel="All Vendors"
                  placeholder="All Vendors"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Holds Cards List */}
        {filteredHolds.length === 0 ? (
          <div className="py-12 px-4 text-center space-y-2">
            <BookmarkCheck className="w-10 h-10 text-zinc-300 mx-auto" />
            <h3 className="text-sm font-bold text-zinc-800">No holds match your filter</h3>
            <p className="text-xs text-zinc-500">
              Create a new layaway or hold above, or switch status filters to view past holds.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {filteredHolds.map((hold) => {
              const progressPct =
                hold.totalPrice > 0
                  ? Math.min(100, Math.round((hold.depositPaid / hold.totalPrice) * 100))
                  : 100;
              const vendorColor = cloudDb.getVendorColor(hold.vendorName);
              const isExpanded = expandedHoldId === hold.id;
              const isPaying = payingHoldId === hold.id;

              return (
                <div key={hold.id} className="p-4 sm:p-5 space-y-3 hover:bg-zinc-50/50 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-black text-zinc-950">{hold.customerName}</span>
                        {hold.customerPhone && (
                          <span className="text-[11px] font-semibold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-md border border-zinc-200">
                            {hold.customerPhone}
                          </span>
                        )}
                        {renderStatusBadge(hold)}
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-zinc-100 text-zinc-800 border border-zinc-200">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: vendorColor }}
                          />
                          {hold.vendorName}
                        </span>
                        {hold.operatorName && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <UserCheck className="w-3 h-3 text-emerald-600" />
                            Rang by {hold.operatorName}
                          </span>
                        )}
                      </div>

                      <div className="text-sm font-bold text-zinc-800">{hold.itemDescription}</div>

                      <div className="flex items-center gap-3 flex-wrap text-[11px] text-zinc-500">
                        <span>Opened: {formatDisplayDate(hold.dateKey)}</span>
                        {hold.dueDateKey && (
                          <span
                            className={`font-bold ${
                              hold.status === 'active' && hold.dueDateKey < todayKey
                                ? 'text-rose-600'
                                : 'text-zinc-700'
                            }`}
                          >
                            Due: {formatDisplayDate(hold.dueDateKey)}
                          </span>
                        )}
                        {hold.notes && <span className="italic text-zinc-500">Note: {hold.notes}</span>}
                      </div>
                    </div>

                    {/* Financial Figures & Action Buttons */}
                    <div className="flex flex-col sm:items-end gap-2 shrink-0">
                      <div className="flex items-center gap-3 text-xs tabular-nums">
                        <div className="text-left sm:text-right">
                          <span className="block text-[10px] uppercase font-bold text-zinc-400">Total</span>
                          <span className="font-bold text-zinc-700">{formatCurrency(hold.totalPrice)}</span>
                        </div>
                        <div className="text-left sm:text-right">
                          <span className="block text-[10px] uppercase font-bold text-emerald-600">Paid</span>
                          <span className="font-black text-emerald-700">{formatCurrency(hold.depositPaid)}</span>
                        </div>
                        <div className="text-left sm:text-right px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-200">
                          <span className="block text-[10px] uppercase font-bold text-amber-800">Remaining</span>
                          <span className="text-sm font-black text-amber-950">
                            {formatCurrency(hold.remainingBalance)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {hold.status === 'active' && (
                          <button
                            type="button"
                            onClick={() => openPaymentDrawer(hold)}
                            className="min-h-[34px] px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <Banknote className="w-3.5 h-3.5" />
                            <span>{isPaying ? 'Close Payment' : 'Take Payment / Pickup'}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setExpandedHoldId(isExpanded ? null : hold.id)}
                          className="min-h-[34px] px-2.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <span>Payments ({hold.payments.length})</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        {hold.status === 'active' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleStatusChange(hold, 'cancelled')}
                              className="min-h-[34px] px-2.5 py-1.5 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-zinc-600 text-xs font-semibold cursor-pointer"
                            >
                              Cancel Hold
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStatusChange(hold, 'expired')}
                              className="min-h-[34px] px-2.5 py-1.5 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-700 text-xs font-semibold cursor-pointer"
                            >
                              Expire
                            </button>
                          </>
                        )}

                        {(hold.status === 'cancelled' || hold.status === 'expired') && hold.remainingBalance > 0 && (
                          <button
                            type="button"
                            onClick={() => handleStatusChange(hold, 'active')}
                            className="min-h-[34px] px-2.5 py-1.5 rounded-xl border border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-bold cursor-pointer"
                          >
                            Reactivate
                          </button>
                        )}

                        {deleteConfirmId === hold.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDeleteHold(hold.id)}
                              className="min-h-[34px] px-2.5 py-1 rounded-xl bg-rose-600 text-white text-xs font-bold cursor-pointer"
                            >
                              Confirm Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(null)}
                              className="min-h-[34px] px-2 py-1 rounded-xl bg-zinc-200 text-zinc-700 text-xs font-semibold cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(hold.id)}
                            className="min-h-[34px] p-2 rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                            title="Delete hold record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Deposit Progress Bar */}
                  <div className="space-y-1">
                    <div className="w-full h-2 rounded-full bg-zinc-100 overflow-hidden border border-zinc-200/70">
                      <div
                        className={`h-full transition-all duration-300 ${
                          hold.status === 'completed'
                            ? 'bg-emerald-500'
                            : hold.status === 'cancelled' || hold.status === 'expired'
                            ? 'bg-zinc-400'
                            : 'bg-sky-500'
                        }`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-bold text-zinc-500">
                      <span>{progressPct}% Paid</span>
                      <span>
                        {hold.remainingBalance > 0
                          ? `${formatCurrency(hold.remainingBalance)} left to clear`
                          : 'Cleared'}
                      </span>
                    </div>
                  </div>

                  {/* Inline Take Payment / Final Pickup Form */}
                  {isPaying && hold.status === 'active' && (
                    <form
                      onSubmit={(e) => handleSubmitHoldPayment(hold, e)}
                      className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-3 animate-fade-in"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-black text-emerald-950">
                          Collect Layaway Payment for {hold.customerName}
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setPaymentAmount(hold.remainingBalance.toFixed(2))}
                            className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold cursor-pointer"
                          >
                            Full Balance ({formatCurrency(hold.remainingBalance)})
                          </button>
                          {[10, 20, 50].map(
                            (amt) =>
                              amt < hold.remainingBalance && (
                                <button
                                  key={amt}
                                  type="button"
                                  onClick={() => setPaymentAmount(amt.toFixed(2))}
                                  className="px-2 py-1 rounded-lg bg-white border border-emerald-300 text-emerald-900 text-[11px] font-bold cursor-pointer"
                                >
                                  £{amt}
                                </button>
                              )
                          )}
                        </div>
                      </div>

                      {paymentError && (
                        <div className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg">
                          {paymentError}
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                        <div className="sm:col-span-3 space-y-1">
                          <label className="block text-[11px] font-bold text-zinc-700">Amount (£)</label>
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-xs font-black text-zinc-500">£</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              max={hold.remainingBalance}
                              value={paymentAmount}
                              onChange={(e) => setPaymentAmount(e.target.value)}
                              className="w-full pl-7 pr-2.5 py-2 text-sm font-black tabular-nums rounded-xl border border-emerald-300 bg-white text-zinc-950"
                            />
                          </div>
                        </div>

                        <div className="sm:col-span-4 space-y-1">
                          <label className="block text-[11px] font-bold text-zinc-700">Method</label>
                          <div className="grid grid-cols-3 gap-1">
                            {(
                              [
                                { id: 'cash', label: 'Cash' },
                                { id: 'card', label: 'Card' },
                                { id: 'traded_out', label: 'Trade Out' },
                              ] as const
                            ).map(({ id, label }) => (
                              <button
                                key={id}
                                type="button"
                                onClick={() => setPaymentMethod(id)}
                                className={`min-h-[36px] px-2 py-1 rounded-xl border text-xs font-bold cursor-pointer ${
                                  paymentMethod === id
                                    ? 'bg-emerald-700 text-white border-emerald-700'
                                    : 'bg-white text-zinc-700 border-emerald-200'
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="sm:col-span-3 space-y-1">
                          <label className="block text-[11px] font-bold text-zinc-700">Note (Optional)</label>
                          <input
                            type="text"
                            value={paymentNotes}
                            onChange={(e) => setPaymentNotes(e.target.value)}
                            placeholder="Installment / pickup..."
                            className="w-full px-3 py-2 min-h-[36px] text-xs rounded-xl border border-emerald-300 bg-white text-zinc-900"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <button
                            type="submit"
                            disabled={isProcessingPayment}
                            className="w-full min-h-[38px] px-3 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 disabled:opacity-50 text-white text-xs font-black cursor-pointer"
                          >
                            {isProcessingPayment ? 'Saving...' : 'Confirm Pay'}
                          </button>
                        </div>
                      </div>
                    </form>
                  )}

                  {/* Expandable Payment Timeline */}
                  {isExpanded && (
                    <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2 animate-fade-in">
                      <div className="text-[11px] font-black uppercase tracking-wider text-zinc-500">
                        Payment &amp; Deposit Timeline
                      </div>
                      {hold.payments.length === 0 ? (
                        <p className="text-xs text-zinc-500 italic">No payments collected yet (£0.00 hold only).</p>
                      ) : (
                        <div className="divide-y divide-zinc-200/80 bg-white rounded-lg border border-zinc-200">
                          {hold.payments.map((p) => (
                            <div
                              key={p.id}
                              className="px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs"
                            >
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-black text-emerald-700 tabular-nums">
                                  {formatCurrency(p.amount)}
                                </span>
                                {renderPaymentMethodPill(p.paymentMethod)}
                                {p.operatorName && (
                                  <span className="text-[11px] text-zinc-600 font-medium">
                                    by <strong>{p.operatorName}</strong>
                                  </span>
                                )}
                                {p.notes && <span className="text-[11px] text-zinc-500">• {p.notes}</span>}
                              </div>
                              <span className="text-[11px] text-zinc-400">
                                {p.dateKey}{' '}
                                {new Date(p.timestamp).toLocaleTimeString('en-GB', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
