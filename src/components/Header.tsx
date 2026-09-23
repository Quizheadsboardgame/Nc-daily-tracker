import React from 'react';
import { Calendar, Download, Database, PlusCircle, Users, Cloud, ArrowLeftRight, FileSpreadsheet, Building2 } from 'lucide-react';
import { getLocalDateKey } from '../db/cloudDatabase';

export type AppTab = 'ledger' | 'trades' | 'vendor-check' | 'manage-vendors';

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
    <header className="bg-zinc-950 text-white border-b border-zinc-850 sticky top-0 z-30 shadow-md" id="app-header">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3.5">
          {/* Brand & Database Status */}
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700/80 text-white flex items-center justify-center shadow-inner shrink-0 ring-1 ring-white/10">
              <Database className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                  Daily Sales Tracker
                </h1>
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 shadow-xs"
                  title="Synchronized in real-time across all devices via Cloud Firestore"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <Cloud className="w-3 h-3 text-emerald-400" />
                  <span>Cloud Synced</span>
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-medium mt-0.5">
                Multi-vendor sales ledger (cash/card), cards trade-ins (cash/credit) & vendor portal
              </p>
            </div>
          </div>

          {/* Center / Navigation Bar */}
          {onTabChange && (
            <nav className="flex items-center p-1 bg-zinc-900/90 rounded-xl border border-zinc-800 text-xs font-bold overflow-x-auto shadow-inner">
              <button
                type="button"
                id="nav-tab-ledger"
                onClick={() => onTabChange('ledger')}
                className={`px-3.5 py-2 rounded-lg flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'ledger'
                    ? 'bg-white text-zinc-950 shadow-sm font-black'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                }`}
              >
                <FileSpreadsheet className={`w-4 h-4 ${activeTab === 'ledger' ? 'text-zinc-950' : 'text-zinc-400'}`} />
                <span>Sales Ledger</span>
              </button>

              <button
                type="button"
                id="nav-tab-trades"
                onClick={() => onTabChange('trades')}
                className={`px-3.5 py-2 rounded-lg flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'trades'
                    ? 'bg-white text-zinc-950 shadow-sm font-black'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                }`}
              >
                <ArrowLeftRight className={`w-4 h-4 ${activeTab === 'trades' ? 'text-amber-600' : 'text-amber-400'}`} />
                <span>Trade In</span>
              </button>

              <button
                type="button"
                id="nav-tab-vendor-check"
                onClick={() => onTabChange('vendor-check')}
                className={`px-3.5 py-2 rounded-lg flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'vendor-check'
                    ? 'bg-white text-zinc-950 shadow-sm font-black'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                }`}
              >
                <Building2 className={`w-4 h-4 ${activeTab === 'vendor-check' ? 'text-amber-600' : 'text-amber-400'}`} />
                <span>Vendor Portal</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wide ${
                  activeTab === 'vendor-check'
                    ? 'bg-amber-100 text-amber-900'
                    : 'bg-amber-950/60 text-amber-300 border border-amber-800/60'
                }`}>
                  Weekly (Sun–Sat)
                </span>
              </button>

              <button
                type="button"
                id="nav-tab-manage-vendors"
                onClick={() => onTabChange('manage-vendors')}
                className={`px-3.5 py-2 rounded-lg flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'manage-vendors'
                    ? 'bg-white text-zinc-950 shadow-sm font-black'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                }`}
              >
                <Users className={`w-4 h-4 ${activeTab === 'manage-vendors' ? 'text-emerald-700' : 'text-emerald-400'}`} />
                <span>Manage Vendors</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-extrabold ${
                  activeTab === 'manage-vendors'
                    ? 'bg-emerald-100 text-emerald-900'
                    : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
                }`}>
                  Colors
                </span>
              </button>
            </nav>
          )}

          {/* Date Selector & Day Navigation */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center bg-zinc-900 rounded-xl p-1 border border-zinc-800 shadow-inner">
              <button
                type="button"
                id="btn-select-today"
                onClick={() => onDateChange(todayKey)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  isToday
                    ? 'bg-white text-zinc-950 shadow-xs font-black'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                Today
              </button>

              <div className="flex items-center gap-1.5 px-2.5 border-l border-zinc-800 ml-1">
                <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                <input
                  type="date"
                  id="date-picker-input"
                  value={currentDateKey}
                  onChange={(e) => {
                    if (e.target.value) onDateChange(e.target.value);
                  }}
                  className="text-xs font-bold text-white bg-transparent border-none focus:outline-none cursor-pointer [color-scheme:dark]"
                />
              </div>
            </div>

            {/* Quick Actions */}
            <button
              type="button"
              id="btn-export-csv"
              onClick={onExportCsv}
              disabled={totalSalesCount === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-zinc-200 bg-zinc-900 border border-zinc-750 rounded-xl hover:bg-zinc-800 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-xs"
              title="Download day sales as CSV"
            >
              <Download className="w-3.5 h-3.5 text-zinc-400" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            <button
              type="button"
              id="btn-header-new-sale"
              onClick={onOpenNewSale}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-black text-zinc-950 bg-emerald-400 hover:bg-emerald-300 active:scale-98 rounded-xl shadow-md shadow-emerald-950/40 transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-zinc-950" />
              <span>Record Sale</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
