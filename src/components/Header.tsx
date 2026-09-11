import React from 'react';
import { Calendar, Download, Database, PlusCircle, Users, Cloud, ArrowLeftRight, FileSpreadsheet } from 'lucide-react';
import { getLocalDateKey } from '../db/cloudDatabase';

export type AppTab = 'ledger' | 'vendor-check' | 'manage-vendors';

interface HeaderProps {
  currentDateKey: string;
  onDateChange: (dateKey: string) => void;
  availableDates: string[];
  totalSalesCount: number;
  onExportCsv: () => void;
  onOpenNewSale: () => void;
  activeTab?: AppTab;
  onTabChange?: (tab: AppTab) => void;
  onOpenManageVendors?: () => void;
  onOpenManageSalesmen?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentDateKey,
  onDateChange,
  availableDates: _availableDates,
  totalSalesCount,
  onExportCsv,
  onOpenNewSale,
  activeTab = 'ledger',
  onTabChange,
  onOpenManageVendors,
  onOpenManageSalesmen,
}) => {
  const handleOpenVendors = () => {
    if (onTabChange) {
      onTabChange('manage-vendors');
    } else if (onOpenManageVendors) {
      onOpenManageVendors();
    } else if (onOpenManageSalesmen) {
      onOpenManageSalesmen();
    }
  };
  const todayKey = getLocalDateKey();
  const isToday = currentDateKey === todayKey;

  return (
    <header className="bg-white border-b border-zinc-200 sticky top-0 z-30 shadow-xs" id="app-header">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Brand & Database Status */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-zinc-900 text-white flex items-center justify-center shadow-xs shrink-0">
              <Database className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-zinc-900 tracking-tight">Daily Sales Tracker</h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200" title="Synchronized in real-time across all devices via Cloud Firestore">
                  <Cloud className="w-3 h-3 mr-1 text-emerald-600" />
                  Cloud Synced
                </span>
              </div>
              <p className="text-xs text-zinc-500">Live vendor sales, assigned colors & trade-in tracking</p>
            </div>
          </div>

          {/* Center / Navigation Bar */}
          {onTabChange && (
            <div className="flex items-center p-1 bg-zinc-100 rounded-xl border border-zinc-200 text-xs font-semibold overflow-x-auto">
              <button
                type="button"
                id="nav-tab-ledger"
                onClick={() => onTabChange('ledger')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'ledger'
                    ? 'bg-white text-zinc-900 shadow-xs font-bold'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-zinc-500" />
                <span>Sales Ledger</span>
              </button>

              <button
                type="button"
                id="nav-tab-vendor-check"
                onClick={() => onTabChange('vendor-check')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'vendor-check'
                    ? 'bg-white text-zinc-900 shadow-xs font-bold'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                <ArrowLeftRight className="w-3.5 h-3.5 text-amber-600" />
                <span>Vendor Portal</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold">
                  Weekly & Daily (Sun–Sat)
                </span>
              </button>

              <button
                type="button"
                id="nav-tab-manage-vendors"
                onClick={() => onTabChange('manage-vendors')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'manage-vendors'
                    ? 'bg-white text-zinc-900 shadow-xs font-bold'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-zinc-500" />
                <span>Manage Vendors</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold">
                  Colors
                </span>
              </button>
            </div>
          )}

          {/* Date Selector & Day Navigation */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-zinc-100 rounded-lg p-1 border border-zinc-200">
              <button
                type="button"
                id="btn-select-today"
                onClick={() => onDateChange(todayKey)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  isToday ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Today
              </button>

              <div className="flex items-center gap-1 px-2 border-l border-zinc-300 ml-1">
                <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                <input
                  type="date"
                  id="date-picker-input"
                  value={currentDateKey}
                  onChange={(e) => {
                    if (e.target.value) onDateChange(e.target.value);
                  }}
                  className="text-xs font-medium text-zinc-800 bg-transparent border-none focus:outline-none cursor-pointer"
                />
              </div>
            </div>

            {/* Quick Actions */}
            <button
              type="button"
              id="btn-export-csv"
              onClick={onExportCsv}
              disabled={totalSalesCount === 0}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-zinc-700 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Download day sales as CSV"
            >
              <Download className="w-3.5 h-3.5 text-zinc-500" />
              <span className="hidden sm:inline">CSV</span>
            </button>

            <button
              type="button"
              id="btn-header-new-sale"
              onClick={onOpenNewSale}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 shadow-xs transition-colors cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Record Sale</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
