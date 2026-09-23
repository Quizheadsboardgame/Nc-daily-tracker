import React, { useState, useEffect, useCallback } from 'react';
import { Header, AppTab } from './components/Header';
import { NewSaleForm } from './components/NewSaleForm';
import { DailyStats } from './components/DailyStats';
import { VendorBreakdown } from './components/SalesmanBreakdown';
import { SalesList } from './components/SalesList';
import { VendorDayCheck } from './components/VendorDayCheck';
import { ManageVendorsTab } from './components/ManageVendorsTab';
import { TradesTab } from './components/TradesTab';
import { EditSaleModal } from './components/EditSaleModal';
import { ManageVendorsModal } from './components/ManageSalesmenModal';
import { cloudDb, getLocalDateKey, formatDisplayDate } from './db/cloudDatabase';
import { SaleRecord, PaymentMethod, DaySummary } from './types';
import { Cloud, Users, ArrowLeftRight, FileSpreadsheet, PlusCircle, Building2 } from 'lucide-react';

export default function App() {
  const [currentDateKey, setCurrentDateKey] = useState<string>(getLocalDateKey());
  const [activeTab, setActiveTab] = useState<AppTab>('ledger');
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [summary, setSummary] = useState<DaySummary>(() => cloudDb.getDailySummary(getLocalDateKey()));
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [knownVendors, setKnownVendors] = useState<string[]>(() => cloudDb.getKnownVendors());

  // Filter states
  const [selectedPaymentFilter, setSelectedPaymentFilter] = useState<'all' | 'cash' | 'card'>('all');
  const [selectedVendor, setSelectedVendor] = useState<string>('all');

  // Modal states
  const [editingSale, setEditingSale] = useState<SaleRecord | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isManageVendorsOpen, setIsManageVendorsOpen] = useState(false);

  // Sync state with cloud database
  const refreshFromDb = useCallback(() => {
    const daySales = cloudDb.getSalesForDay(currentDateKey);
    const daySummary = cloudDb.getDailySummary(currentDateKey);
    const dates = cloudDb.getAvailableDateKeys();
    const vendors = cloudDb.getKnownVendors();

    setSales(daySales);
    setSummary(daySummary);
    setAvailableDates(dates);
    setKnownVendors(vendors);
  }, [currentDateKey]);

  useEffect(() => {
    refreshFromDb();
    // Subscribe to cloudDb real-time changes
    const unsubscribe = cloudDb.subscribe(() => {
      refreshFromDb();
    });
    return unsubscribe;
  }, [refreshFromDb]);

  // Actions
  const handleRecordSale = (newSale: {
    salesmanName: string;
    itemDescription: string;
    isMiscellaneous?: boolean;
    amount: number;
    paymentMethod: PaymentMethod;
    tradeDetails?: string;
    tradeAcceptingVendor?: string;
    tradeValue?: number;
    tradeItemDescription?: string;
    notes?: string;
  }) => {
    cloudDb.insertSale({
      ...newSale,
      dateKey: currentDateKey,
    });
    refreshFromDb();
  };

  const handleAddVendor = (name: string, color?: string) => {
    cloudDb.addVendor(name, color);
    refreshFromDb();
  };

  const handleRemoveVendor = (name: string) => {
    cloudDb.removeVendor(name);
    refreshFromDb();
  };

  const handleUpdateVendorColor = (name: string, color: string) => {
    cloudDb.updateVendorColor(name, color);
    refreshFromDb();
  };

  const handleEditSale = (sale: SaleRecord) => {
    setEditingSale(sale);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = (id: string, updates: Partial<SaleRecord>) => {
    cloudDb.updateSale(id, updates);
    refreshFromDb();
  };

  const handleDeleteSale = (id: string) => {
    cloudDb.deleteSale(id);
    refreshFromDb();
  };

  const handleExportCsv = () => {
    const csvContent = cloudDb.exportDayToCsv(currentDateKey);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `sales-record-${currentDateKey}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const scrollToNewSale = () => {
    setActiveTab('ledger');
    setTimeout(() => {
      const formEl = document.getElementById('card-new-sale-form');
      if (formEl) {
        formEl.scrollIntoView({ behavior: 'smooth' });
        const inputEl = document.getElementById('select-vendor-name') || document.getElementById('input-item-sold');
        inputEl?.focus();
      }
    }, 100);
  };

  return (
    <div className="min-h-screen bg-zinc-100/70 text-zinc-900 flex flex-col font-sans selection:bg-zinc-800 selection:text-white">
      {/* App Header & Navigation */}
      <Header
        currentDateKey={currentDateKey}
        onDateChange={setCurrentDateKey}
        availableDates={availableDates}
        totalSalesCount={sales.length}
        onExportCsv={handleExportCsv}
        onOpenNewSale={scrollToNewSale}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenManageVendors={() => setActiveTab('manage-vendors')}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Navigation Tabs Bar for easy switching */}
        <div className="flex items-center justify-between border-b border-zinc-250 pb-3.5 gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 bg-zinc-200/90 p-1.5 rounded-2xl border border-zinc-300/80 shadow-2xs">
            <button
              type="button"
              id="tab-btn-ledger"
              onClick={() => setActiveTab('ledger')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'ledger'
                  ? 'bg-zinc-950 text-white shadow-sm font-black'
                  : 'text-zinc-700 hover:text-zinc-950 hover:bg-white/60'
              }`}
            >
              <FileSpreadsheet className={`w-4 h-4 ${activeTab === 'ledger' ? 'text-emerald-400' : 'text-zinc-500'}`} />
              <span>Sales Ledger</span>
            </button>

            <button
              type="button"
              id="tab-btn-trades"
              onClick={() => setActiveTab('trades')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'trades'
                  ? 'bg-zinc-950 text-white shadow-sm font-black'
                  : 'text-zinc-700 hover:text-zinc-950 hover:bg-white/60'
              }`}
            >
              <ArrowLeftRight className={`w-4 h-4 ${activeTab === 'trades' ? 'text-amber-400' : 'text-amber-600'}`} />
              <span>Trades</span>
              {cloudDb.getTradesForDay(currentDateKey).length > 0 && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                  activeTab === 'trades'
                    ? 'bg-amber-400 text-zinc-950'
                    : 'bg-amber-100 text-amber-900 border border-amber-300'
                }`}>
                  {cloudDb.getTradesForDay(currentDateKey).length}
                </span>
              )}
            </button>

            <button
              type="button"
              id="tab-btn-vendor-check"
              onClick={() => setActiveTab('vendor-check')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'vendor-check'
                  ? 'bg-zinc-950 text-white shadow-sm font-black'
                  : 'text-zinc-700 hover:text-zinc-950 hover:bg-white/60'
              }`}
            >
              <Building2 className={`w-4 h-4 ${activeTab === 'vendor-check' ? 'text-amber-400' : 'text-amber-600'}`} />
              <span>Vendor Portal</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                activeTab === 'vendor-check'
                  ? 'bg-amber-400 text-zinc-950'
                  : 'bg-amber-100 text-amber-900 border border-amber-300'
              }`}>
                Weekly (Sun–Sat)
              </span>
            </button>

            <button
              type="button"
              id="tab-btn-manage-vendors"
              onClick={() => setActiveTab('manage-vendors')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'manage-vendors'
                  ? 'bg-zinc-950 text-white shadow-sm font-black'
                  : 'text-zinc-700 hover:text-zinc-950 hover:bg-white/60'
              }`}
            >
              <Users className={`w-4 h-4 ${activeTab === 'manage-vendors' ? 'text-emerald-400' : 'text-emerald-700'}`} />
              <span>Manage Vendors</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                activeTab === 'manage-vendors'
                  ? 'bg-emerald-400 text-zinc-950'
                  : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
              }`}>
                Colors
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <Cloud className="w-3.5 h-3.5 text-emerald-600" />
              Live Cloud Sync Active
            </span>
          </div>
        </div>

        {/* TAB 1: Main Sales Ledger View */}
        {activeTab === 'ledger' && (
          <div className="space-y-6 animate-fade-in" id="tab-content-ledger">
            {/* Day Headline & Filter Warning */}
            <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-3">
              <div>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-950">
                  Sales Ledger for {formatDisplayDate(currentDateKey)}
                </h2>
                <p className="text-xs font-medium text-zinc-500 mt-1">
                  Live gross sales, payment breakdown, and vendor performance summary
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  id="btn-switch-to-vendor-check"
                  onClick={() => setActiveTab('vendor-check')}
                  className="text-xs font-bold text-amber-950 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-3.5 py-2 rounded-xl flex items-center gap-2 shadow-2xs transition-colors cursor-pointer"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 text-amber-700" />
                  <span>Vendor Weekly (Sun–Sat) & Daily</span>
                </button>

                {(selectedPaymentFilter !== 'all' || selectedVendor !== 'all') && (
                  <div className="text-xs font-semibold text-zinc-700 bg-white border border-zinc-300 px-3 py-1.5 rounded-xl shadow-2xs flex items-center gap-2">
                    <span className="text-zinc-400 uppercase text-[10px] tracking-wider font-bold">Filtered:</span>
                    {selectedPaymentFilter !== 'all' && (
                      <span className="font-extrabold uppercase text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded-md border border-zinc-200">
                        {selectedPaymentFilter}
                      </span>
                    )}
                    {selectedVendor !== 'all' && (
                      <span className="font-extrabold text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded-md border border-zinc-200">
                        {selectedVendor}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPaymentFilter('all');
                        setSelectedVendor('all');
                      }}
                      className="ml-1 text-zinc-900 hover:text-rose-600 font-bold underline cursor-pointer"
                    >
                      Reset
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* USER REQUIREMENT: Record New Sale box placed at the TOP of the page */}
            <div id="section-new-sale-box-top">
              <NewSaleForm
                currentDateKey={currentDateKey}
                knownVendors={knownVendors}
                onSubmitSale={handleRecordSale}
                onAddVendor={handleAddVendor}
                onOpenManageVendors={() => setActiveTab('manage-vendors')}
                onNavigateToTrades={() => setActiveTab('trades')}
              />
            </div>

            {/* Daily KPI & Payment Breakdown Cards */}
            <DailyStats
              summary={summary}
              selectedPaymentFilter={selectedPaymentFilter}
              onSelectPaymentFilter={setSelectedPaymentFilter}
            />

            {/* Vendor Performance Leaderboard with Assigned Colors & Trade Taken In */}
            <VendorBreakdown
              vendors={summary.vendors}
              selectedVendor={selectedVendor}
              onSelectVendor={setSelectedVendor}
              totalDayRevenue={summary.totalRevenue}
            />

            {/* Sales Ledger Table / List */}
            <div id="section-sales-ledger-list">
              <SalesList
                sales={sales}
                allVendors={knownVendors}
                selectedPaymentFilter={selectedPaymentFilter}
                onSelectPaymentFilter={setSelectedPaymentFilter}
                selectedVendor={selectedVendor}
                onSelectVendor={setSelectedVendor}
                onEditSale={handleEditSale}
                onDeleteSale={handleDeleteSale}
              />
            </div>
          </div>
        )}

        {/* TAB 2: Dedicated Trades Tab (Independent trade entries & valuations) */}
        {activeTab === 'trades' && (
          <div className="animate-fade-in" id="tab-content-trades">
            <TradesTab
              currentDateKey={currentDateKey}
              onDateChange={setCurrentDateKey}
              knownVendors={knownVendors}
              onSwitchToLedger={() => setActiveTab('ledger')}
            />
          </div>
        )}

        {/* TAB 3: Vendor Daily Check Tab (Sales & How much Trade taken in) */}
        {activeTab === 'vendor-check' && (
          <div className="animate-fade-in" id="tab-content-vendor-check">
            <VendorDayCheck
              currentDateKey={currentDateKey}
              allVendors={knownVendors}
              sales={sales}
              summary={summary}
            />
          </div>
        )}

        {/* TAB 3: Manage Vendors Tab (Assign a colour to each vendor) */}
        {activeTab === 'manage-vendors' && (
          <div className="animate-fade-in" id="tab-content-manage-vendors">
            <ManageVendorsTab
              vendors={knownVendors}
              onAddVendor={handleAddVendor}
              onRemoveVendor={handleRemoveVendor}
              onUpdateVendorColor={handleUpdateVendorColor}
            />
          </div>
        )}
      </main>

      {/* Edit Sale Modal */}
      <EditSaleModal
        sale={editingSale}
        isOpen={isEditModalOpen}
        vendors={knownVendors}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingSale(null);
        }}
        onSave={handleSaveEdit}
      />

      {/* Manage Vendors Modal (Accessible from any quick-button) */}
      <ManageVendorsModal
        isOpen={isManageVendorsOpen}
        onClose={() => setIsManageVendorsOpen(false)}
        vendors={knownVendors}
        onAddVendor={handleAddVendor}
        onRemoveVendor={handleRemoveVendor}
      />

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white py-4 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-zinc-500">
          <div className="flex items-center gap-1.5">
            <Cloud className="w-3.5 h-3.5 text-emerald-600" />
            <span>Daily Sales Tracker • Active Record Date: <strong className="text-zinc-700">{currentDateKey}</strong></span>
          </div>
          <div className="flex items-center gap-3">
            <span>Channels: Cash & Card Sales • Cards Trade-In (Cash / Credit)</span>
            <span>•</span>
            <span className="text-emerald-700 font-medium">Cloud Database Connected (Multi-device)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

