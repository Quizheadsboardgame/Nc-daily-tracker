import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { NewSaleForm } from './components/NewSaleForm';
import { DailyStats } from './components/DailyStats';
import { SalesmanBreakdown } from './components/SalesmanBreakdown';
import { SalesList } from './components/SalesList';
import { EditSaleModal } from './components/EditSaleModal';
import { ManageSalesmenModal } from './components/ManageSalesmenModal';
import { cloudDb, getLocalDateKey, formatDisplayDate } from './db/cloudDatabase';
import { SaleRecord, PaymentMethod, DaySummary } from './types';
import { Cloud, Users } from 'lucide-react';

export default function App() {
  const [currentDateKey, setCurrentDateKey] = useState<string>(getLocalDateKey());
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [summary, setSummary] = useState<DaySummary>(() => cloudDb.getDailySummary(getLocalDateKey()));
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [knownSalesmen, setKnownSalesmen] = useState<string[]>(() => cloudDb.getKnownSalesmen());

  // Filter states
  const [selectedPaymentFilter, setSelectedPaymentFilter] = useState<'all' | 'cash' | 'card' | 'trade'>('all');
  const [selectedSalesman, setSelectedSalesman] = useState<string>('all');

  // Modal states
  const [editingSale, setEditingSale] = useState<SaleRecord | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isManageSalesmenOpen, setIsManageSalesmenOpen] = useState(false);

  // Sync state with cloud database
  const refreshFromDb = useCallback(() => {
    const daySales = cloudDb.getSalesForDay(currentDateKey);
    const daySummary = cloudDb.getDailySummary(currentDateKey);
    const dates = cloudDb.getAvailableDateKeys();
    const salesmen = cloudDb.getKnownSalesmen();

    setSales(daySales);
    setSummary(daySummary);
    setAvailableDates(dates);
    setKnownSalesmen(salesmen);
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
    amount: number;
    paymentMethod: PaymentMethod;
    tradeDetails?: string;
    notes?: string;
  }) => {
    cloudDb.insertSale({
      ...newSale,
      dateKey: currentDateKey,
    });
  };

  const handleAddSalesman = (name: string) => {
    cloudDb.addSalesman(name);
  };

  const handleRemoveSalesman = (name: string) => {
    cloudDb.removeSalesman(name);
  };

  const handleEditSale = (sale: SaleRecord) => {
    setEditingSale(sale);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = (id: string, updates: Partial<SaleRecord>) => {
    cloudDb.updateSale(id, updates);
  };

  const handleDeleteSale = (id: string) => {
    cloudDb.deleteSale(id);
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
    const formEl = document.getElementById('card-new-sale-form');
    if (formEl) {
      formEl.scrollIntoView({ behavior: 'smooth' });
      const inputEl = document.getElementById('input-salesman-name');
      inputEl?.focus();
    }
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
        onOpenManageSalesmen={() => setIsManageSalesmenOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Day Headline & Filter Warning */}
        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-zinc-900">
                Sales Ledger for {formatDisplayDate(currentDateKey)}
              </h2>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Cloud className="w-3 h-3 text-emerald-600" />
                Live Cloud Sync
              </span>
            </div>
            <p className="text-xs text-zinc-500">
              Changes sync in real-time across all your devices and browser sessions
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              id="btn-manage-team-pill"
              onClick={() => setIsManageSalesmenOpen(true)}
              className="text-xs font-semibold text-zinc-700 bg-white hover:bg-zinc-50 border border-zinc-300 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            >
              <Users className="w-3.5 h-3.5 text-zinc-500" />
              <span>Team: {knownSalesmen.length} salesmen</span>
            </button>

            {(selectedPaymentFilter !== 'all' || selectedSalesman !== 'all') && (
              <div className="text-xs text-zinc-600 bg-zinc-200/80 px-2.5 py-1 rounded-md flex items-center gap-1.5">
                <span>Filtered:</span>
                {selectedPaymentFilter !== 'all' && (
                  <span className="font-bold uppercase text-zinc-900">{selectedPaymentFilter}</span>
                )}
                {selectedSalesman !== 'all' && (
                  <span className="font-bold text-zinc-900">{selectedSalesman}</span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPaymentFilter('all');
                    setSelectedSalesman('all');
                  }}
                  className="ml-1 text-zinc-700 hover:text-zinc-900 underline cursor-pointer"
                >
                  Reset
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Daily KPI & Payment Breakdown Cards */}
        <DailyStats
          summary={summary}
          selectedPaymentFilter={selectedPaymentFilter}
          onSelectPaymentFilter={setSelectedPaymentFilter}
        />

        {/* 2-Column Responsive Layout: New Sale Form (Left) & Ledger Records (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Form to Track Sale */}
          <div className="lg:col-span-5 space-y-6">
            <NewSaleForm
              currentDateKey={currentDateKey}
              knownSalesmen={knownSalesmen}
              onSubmitSale={handleRecordSale}
              onAddSalesman={handleAddSalesman}
              onOpenManageSalesmen={() => setIsManageSalesmenOpen(true)}
            />

            {/* Salesman Performance Leaderboard */}
            <SalesmanBreakdown
              salesmen={summary.salesmen}
              selectedSalesman={selectedSalesman}
              onSelectSalesman={setSelectedSalesman}
              totalDayRevenue={summary.totalRevenue}
            />
          </div>

          {/* Right Column: Live Cloud Ledger */}
          <div className="lg:col-span-7 space-y-6">
            <SalesList
              sales={sales}
              allSalesmen={knownSalesmen}
              selectedPaymentFilter={selectedPaymentFilter}
              onSelectPaymentFilter={setSelectedPaymentFilter}
              selectedSalesman={selectedSalesman}
              onSelectSalesman={setSelectedSalesman}
              onEditSale={handleEditSale}
              onDeleteSale={handleDeleteSale}
            />
          </div>
        </div>
      </main>

      {/* Edit Sale Modal */}
      <EditSaleModal
        sale={editingSale}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingSale(null);
        }}
        onSave={handleSaveEdit}
      />

      {/* Manage Salesmen Modal (Add/Remove Salesmen) */}
      <ManageSalesmenModal
        isOpen={isManageSalesmenOpen}
        onClose={() => setIsManageSalesmenOpen(false)}
        salesmen={knownSalesmen}
        onAddSalesman={handleAddSalesman}
        onRemoveSalesman={handleRemoveSalesman}
      />

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white py-4 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-zinc-500">
          <div className="flex items-center gap-1.5">
            <Cloud className="w-3.5 h-3.5 text-emerald-600" />
            <span>Daily Sales Tracker • Active Record Date: <strong className="text-zinc-700">{currentDateKey}</strong></span>
          </div>
          <div className="flex items-center gap-3">
            <span>Payment channels: Cash • Card • Trade</span>
            <span>•</span>
            <span className="text-emerald-700 font-medium">Cloud Database Connected (Multi-device)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
