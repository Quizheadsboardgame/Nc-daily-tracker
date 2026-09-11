import React from 'react';
import { Calendar, Download, Database, PlusCircle, Users, Cloud } from 'lucide-react';
import { getLocalDateKey } from '../db/cloudDatabase';

interface HeaderProps {
  currentDateKey: string;
  onDateChange: (dateKey: string) => void;
  availableDates: string[];
  totalSalesCount: number;
  onExportCsv: () => void;
  onOpenNewSale: () => void;
  onOpenManageSalesmen: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentDateKey,
  onDateChange,
  availableDates: _availableDates,
  totalSalesCount,
  onExportCsv,
  onOpenNewSale,
  onOpenManageSalesmen,
}) => {
  const todayKey = getLocalDateKey();
  const isToday = currentDateKey === todayKey;

  return (
    <header className="bg-white border-b border-zinc-200 sticky top-0 z-30 shadow-xs" id="app-header">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Brand & Database Status */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-zinc-900 text-white flex items-center justify-center shadow-xs">
              <Database className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Daily Sales Tracker</h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200" title="Synchronized in real-time across all devices via Cloud Firestore">
                  <Cloud className="w-3 h-3 mr-1 text-emerald-600" />
                  Cloud Synced
                </span>
              </div>
              <p className="text-xs text-zinc-500">Salesman, item, price & payment ledger • Live sync across all devices</p>
            </div>
          </div>

          {/* Date Selector & Day Navigation */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-zinc-100 rounded-lg p-1 border border-zinc-200">
              <button
                type="button"
                id="btn-select-today"
                onClick={() => onDateChange(todayKey)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
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

            {/* Manage Sales Team Button */}
            <button
              type="button"
              id="btn-header-manage-salesmen"
              onClick={onOpenManageSalesmen}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-700 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50 transition-colors shadow-2xs cursor-pointer"
              title="Add or remove salesmen from cloud roster"
            >
              <Users className="w-3.5 h-3.5 text-zinc-500" />
              <span>Manage Sales Team</span>
            </button>

            {/* Quick Actions */}
            <button
              type="button"
              id="btn-export-csv"
              onClick={onExportCsv}
              disabled={totalSalesCount === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Download day sales as CSV"
            >
              <Download className="w-3.5 h-3.5 text-zinc-500" />
              <span className="hidden sm:inline">Export</span> CSV
            </button>

            <button
              type="button"
              id="btn-header-new-sale"
              onClick={onOpenNewSale}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 shadow-xs transition-colors cursor-pointer"
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
