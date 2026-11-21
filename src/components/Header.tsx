import React, { useState, useRef, useEffect } from 'react';
import { Calendar, Download, Database, PlusCircle, Users, Cloud, ArrowLeftRight, FileSpreadsheet, Building2, ShoppingBag, RefreshCw, Lock, Volume2, VolumeX, Search, Trophy, Vault, Ticket, ChevronDown, Check, BookmarkCheck, Flame, UserCheck } from 'lucide-react';
import { getLocalDateKey, cloudDb } from '../db/cloudDatabase';
import { useTotalSalesAuth, useCashDrawerAuth } from '../utils/auth';
import { PasscodeModal } from './PasscodeModal';
import { useCheckoutSound, useAudioUnlockStatus, testMarioSound, testFanfareSound } from '../utils/sound';

export type AppTab = 'ledger' | 'trades' | 'holds' | 'cash-drawer' | 'store-credit' | 'search' | 'leaderboard' | 'heatmap' | 'online-cards' | 'vendor-check' | 'manage-vendors';

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
  operatorName?: string;
  onOpenOperatorModal?: () => void;
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
  operatorName,
  onOpenOperatorModal,
}) => {
  const { isUnlocked, lock } = useTotalSalesAuth();
  const { isUnlocked: isCashDrawerUnlocked } = useCashDrawerAuth();
  const { soundEnabled, toggle: toggleSound } = useCheckoutSound();
  const { isUnlocked: isAudioActive, unlock: unlockAudio } = useAudioUnlockStatus();
  const [isPasscodeModalOpen, setIsPasscodeModalOpen] = useState(false);

  // Dropdown state for tabs
  const [isTabMenuOpen, setIsTabMenuOpen] = useState(false);
  const tabMenuRef = useRef<HTMLDivElement>(null);

  // Reactive badge counts from cloudDb
  const [, setSyncTick] = useState(0);
  useEffect(() => {
    return cloudDb.subscribe(() => setSyncTick((t) => t + 1));
  }, []);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (tabMenuRef.current && !tabMenuRef.current.contains(e.target as Node)) {
        setIsTabMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsTabMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const todayKey = getLocalDateKey();
  const isToday = currentDateKey === todayKey;
  const [isHeaderSyncing, setIsHeaderSyncing] = useState(false);
  const [syncLabel, setSyncLabel] = useState<string | null>(null);

  const handleHeaderSync = async () => {
    if (isHeaderSyncing) return;
    setIsHeaderSyncing(true);
    try {
      const res = await cloudDb.syncNow();
      setSyncLabel(`Synced (${res.onlineCards} cards)!`);
      setTimeout(() => setSyncLabel(null), 3000);
    } catch {
      setSyncLabel('Sync failed');
      setTimeout(() => setSyncLabel(null), 3000);
    } finally {
      setIsHeaderSyncing(false);
    }
  };

  const dayTradesCount = cloudDb.getTradesForDay(currentDateKey).length;
  const activeHoldsCount = cloudDb.getHoldsOverview().activeCount;
  const activeCreditCustomers = cloudDb.getStoreCreditOverview().activeCustomersCount;
  const availableOnlineCards = cloudDb.getOnlineCardsSummary().availableCount;

  const tabItems: {
    id: AppTab;
    label: string;
    icon: React.ReactNode;
    badge?: string | number;
    badgeClass?: string;
    locked?: boolean;
  }[] = [
    {
      id: 'ledger',
      label: 'Sales Ledger',
      icon: <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />,
    },
    {
      id: 'trades',
      label: 'Trade In',
      icon: <ArrowLeftRight className="w-4 h-4 text-amber-400 shrink-0" />,
      badge: dayTradesCount > 0 ? dayTradesCount : undefined,
      badgeClass: 'bg-amber-400/20 text-amber-300 border border-amber-500/40',
    },
    {
      id: 'holds',
      label: 'Holds & Layaway',
      icon: <BookmarkCheck className="w-4 h-4 text-sky-400 shrink-0" />,
      badge: activeHoldsCount > 0 ? activeHoldsCount : undefined,
      badgeClass: 'bg-sky-400/20 text-sky-300 border border-sky-500/40',
    },
    {
      id: 'cash-drawer',
      label: 'Cash Drawer',
      icon: <Vault className="w-4 h-4 text-emerald-400 shrink-0" />,
      locked: !isCashDrawerUnlocked,
    },
    {
      id: 'store-credit',
      label: 'Store Credit',
      icon: <Ticket className="w-4 h-4 text-purple-400 shrink-0" />,
      badge: activeCreditCustomers > 0 ? activeCreditCustomers : undefined,
      badgeClass: 'bg-purple-400/20 text-purple-300 border border-purple-500/40',
    },
    {
      id: 'search',
      label: 'Search Sales',
      icon: <Search className="w-4 h-4 text-sky-400 shrink-0" />,
    },
    {
      id: 'leaderboard',
      label: 'Leaderboard',
      icon: <Trophy className="w-4 h-4 text-amber-400 shrink-0" />,
    },
    {
      id: 'heatmap',
      label: 'Peak Hours',
      icon: <Flame className="w-4 h-4 text-orange-400 shrink-0" />,
      badge: 'Owner',
      badgeClass: 'bg-orange-400/20 text-orange-300 border border-orange-500/40',
    },
    {
      id: 'online-cards',
      label: 'Online Cards',
      icon: <ShoppingBag className="w-4 h-4 text-violet-400 shrink-0" />,
      badge: availableOnlineCards > 0 ? `${availableOnlineCards} live` : undefined,
      badgeClass: 'bg-violet-400/20 text-violet-300 border border-violet-500/40',
    },
    {
      id: 'vendor-check',
      label: 'Vendor Portal',
      icon: <Building2 className="w-4 h-4 text-amber-400 shrink-0" />,
      badge: 'Weekly',
      badgeClass: 'bg-amber-400/15 text-amber-300 border border-amber-500/30',
    },
    {
      id: 'manage-vendors',
      label: 'Manage Vendors',
      icon: <Users className="w-4 h-4 text-emerald-400 shrink-0" />,
      badge: 'Colors',
      badgeClass: 'bg-emerald-400/15 text-emerald-300 border border-emerald-500/30',
    },
  ];

  const currentTabItem = tabItems.find((t) => t.id === activeTab) || tabItems[0];

  return (
    <header className="bg-zinc-950 text-white border-b border-zinc-850 lg:sticky lg:top-0 z-30 shadow-md" id="app-header">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Brand & Database Status */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700/80 text-white flex items-center justify-center shadow-inner shrink-0 ring-1 ring-white/10">
              <Database className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between sm:justify-start gap-2 flex-wrap">
                <h1 className="text-base sm:text-xl font-extrabold text-white tracking-tight truncate">
                  Daily Sales Tracker
                </h1>
                <button
                  type="button"
                  id="btn-header-cloud-sync"
                  onClick={handleHeaderSync}
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-bold bg-emerald-950/80 hover:bg-emerald-900/90 text-emerald-300 border border-emerald-500/40 shadow-xs cursor-pointer transition-all whitespace-nowrap shrink-0"
                  title="Synchronized in real-time across all devices via Cloud Firestore. Click to force instant sync."
                >
                  <span className={`w-2 h-2 rounded-full ${isHeaderSyncing ? 'bg-amber-400 animate-spin' : 'bg-emerald-400 animate-pulse'}`} />
                  {isHeaderSyncing ? (
                    <RefreshCw className="w-3 h-3 text-emerald-400 animate-spin" />
                  ) : (
                    <Cloud className="w-3 h-3 text-emerald-400" />
                  )}
                  <span>{syncLabel || (isHeaderSyncing ? 'Syncing...' : 'Cloud Synced')}</span>
                </button>
              </div>
              <p className="hidden sm:block text-xs text-zinc-400 font-medium mt-0.5 truncate">
                Multi-vendor sales ledger, trade-ins, store credit &amp; vendor portal
              </p>
            </div>
          </div>

          {/* Center: Responsive Tabs Dropdown Menu (Mobile & Desktop) */}
          {onTabChange && (
            <div className="relative w-full lg:w-auto" ref={tabMenuRef}>
              <button
                type="button"
                id="btn-tabs-dropdown"
                aria-haspopup="listbox"
                aria-expanded={isTabMenuOpen}
                onClick={() => setIsTabMenuOpen((prev) => !prev)}
                className="w-full lg:w-64 min-h-[42px] px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800/90 border border-zinc-700 hover:border-zinc-500 text-xs font-bold text-white flex items-center justify-between gap-2.5 shadow-inner transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {currentTabItem.icon}
                  <span className="truncate font-extrabold text-sm lg:text-xs">{currentTabItem.label}</span>
                  {currentTabItem.locked && (
                    <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                  )}
                  {currentTabItem.badge !== undefined && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-md font-extrabold shrink-0 ${
                        currentTabItem.badgeClass || 'bg-zinc-800 text-zinc-200'
                      }`}
                    >
                      {currentTabItem.badge}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0 text-zinc-400">
                  <span className="text-[10px] font-semibold uppercase tracking-wider hidden sm:inline">Menu</span>
                  <ChevronDown
                    className={`w-4 h-4 text-zinc-300 transition-transform duration-150 ${
                      isTabMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </div>
              </button>

              {isTabMenuOpen && (
                <div
                  id="menu-tabs-dropdown"
                  role="listbox"
                  aria-label="Select section"
                  className="absolute left-0 right-0 lg:right-auto lg:w-72 top-full mt-2 z-50 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl p-1.5 space-y-0.5 max-h-[75vh] overflow-y-auto animate-scale-up"
                >
                  {tabItems.map((tab) => {
                    const isSelected = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        id={`nav-tab-${tab.id}`}
                        onClick={() => {
                          onTabChange(tab.id);
                          setIsTabMenuOpen(false);
                        }}
                        className={`w-full min-h-[40px] px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                          isSelected
                            ? 'bg-white text-zinc-950 font-black shadow-xs'
                            : 'text-zinc-200 hover:text-white hover:bg-zinc-800/80'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={isSelected ? 'brightness-90' : ''}>{tab.icon}</span>
                          <span className="truncate">{tab.label}</span>
                          {tab.locked && (
                            <Lock
                              className={`w-3 h-3 shrink-0 ${
                                isSelected ? 'text-amber-600' : 'text-amber-400'
                              }`}
                            />
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {tab.badge !== undefined && (
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded-md font-extrabold ${
                                isSelected
                                  ? 'bg-zinc-900 text-white'
                                  : tab.badgeClass || 'bg-zinc-800 text-zinc-300'
                              }`}
                            >
                              {tab.badge}
                            </span>
                          )}
                          {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Date Selector & Quick Actions */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap lg:flex-nowrap items-stretch sm:items-center gap-2 w-full lg:w-auto">
            <div className="flex items-center justify-between sm:justify-start bg-zinc-900 rounded-xl p-1 border border-zinc-800 shadow-inner w-full sm:w-auto min-w-0">
              <button
                type="button"
                id="btn-select-today"
                onClick={() => onDateChange(todayKey)}
                className={`px-3 min-h-[36px] text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  isToday
                    ? 'bg-white text-zinc-950 shadow-xs font-black'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                Today
              </button>

              <div className="flex items-center gap-1.5 px-2.5 border-l border-zinc-800 ml-1 min-w-0">
                <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <input
                  type="date"
                  id="date-picker-input"
                  value={currentDateKey}
                  onChange={(e) => {
                    if (e.target.value) onDateChange(e.target.value);
                  }}
                  className="text-xs font-bold text-white bg-transparent border-none focus:outline-none cursor-pointer [color-scheme:dark] min-w-0"
                />
              </div>
            </div>

            {/* Quick Actions Grid on Mobile / Inline Flex on Desktop */}
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto">
              {/* Audio Unlock Warning / Prompt if device browser blocked audio */}
              {!isAudioActive && soundEnabled && (
                <button
                  type="button"
                  id="btn-activate-audio-header"
                  onClick={unlockAudio}
                  className="col-span-2 sm:col-span-1 inline-flex items-center justify-center gap-1.5 px-3 min-h-[40px] text-xs font-black rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/50 hover:bg-amber-500/30 transition animate-pulse cursor-pointer shadow-xs whitespace-nowrap"
                  title="Browser requires 1 tap to allow sound on this device. Click to activate!"
                >
                  <Volume2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Tap to Enable Sound</span>
                </button>
              )}

              {/* Sound On / Off Toggle */}
              <button
                type="button"
                id="btn-header-sound-toggle"
                onClick={toggleSound}
                className={`inline-flex items-center justify-center gap-1.5 px-3 min-h-[40px] text-xs font-bold rounded-xl border transition-all cursor-pointer shadow-xs whitespace-nowrap ${
                  soundEnabled
                    ? 'bg-zinc-900 border-emerald-500/50 text-emerald-300 hover:bg-zinc-800'
                    : 'bg-zinc-900 border-zinc-750 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                }`}
                title={soundEnabled ? 'Checkout sound is ON (click to mute)' : 'Checkout sound is OFF (click to turn on)'}
                aria-label="Toggle checkout chime sound"
              >
                {soundEnabled ? (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Sound: ON</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span>Sound: OFF</span>
                  </>
                )}
              </button>

              {/* Test Sound Buttons */}
              {soundEnabled && isAudioActive && (
                <>
                  <button
                    type="button"
                    id="btn-test-sound-header"
                    onClick={testMarioSound}
                    className="inline-flex items-center justify-center gap-1 px-2.5 min-h-[40px] text-xs font-bold rounded-xl border border-zinc-800 bg-zinc-900/90 text-zinc-300 hover:text-white hover:bg-zinc-800 transition cursor-pointer whitespace-nowrap"
                    title="Test Mario Coin sound effect on this device"
                  >
                    <span>Test 🪙</span>
                  </button>
                  <button
                    type="button"
                    id="btn-test-fanfare-header"
                    onClick={testFanfareSound}
                    className="inline-flex items-center justify-center gap-1 px-2.5 min-h-[40px] text-xs font-bold rounded-xl border border-amber-500/40 bg-amber-950/50 text-amber-300 hover:text-amber-200 hover:bg-amber-900/60 transition cursor-pointer whitespace-nowrap"
                    title="Test escalating £100+ / £250+ / £500+ Fanfare, Fireworks & Sound"
                  >
                    <span>Test 🎉</span>
                  </button>
                </>
              )}

              {onOpenOperatorModal && (
                <button
                  type="button"
                  id="btn-header-operator-switch"
                  onClick={onOpenOperatorModal}
                  className="inline-flex items-center justify-center gap-1.5 px-3 min-h-[40px] text-xs font-bold text-sky-200 bg-zinc-900 border border-sky-500/40 hover:border-sky-400 rounded-xl hover:bg-zinc-800 transition-all cursor-pointer shadow-xs whitespace-nowrap"
                  title="Switch counter operator on this device (who rang up the sale)"
                >
                  <UserCheck className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span>Till: {operatorName || 'Set User'}</span>
                </button>
              )}

              {isUnlocked && (
                <button
                  type="button"
                  id="btn-header-lock-sales"
                  onClick={lock}
                  className="inline-flex items-center justify-center gap-1.5 px-3 min-h-[40px] text-xs font-bold text-amber-300 bg-zinc-900 border border-zinc-750 hover:border-amber-500/60 rounded-xl hover:bg-zinc-800 transition-all cursor-pointer shadow-xs whitespace-nowrap"
                  title="Lock screen and return to clerk register terminal"
                >
                  <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="sm:hidden">Lock</span>
                  <span className="hidden sm:inline">Lock Screen</span>
                </button>
              )}

              <button
                type="button"
                id="btn-export-csv"
                onClick={onExportCsv}
                disabled={totalSalesCount === 0}
                className="inline-flex items-center justify-center gap-1.5 px-3 min-h-[40px] text-xs font-bold text-zinc-200 bg-zinc-900 border border-zinc-750 rounded-xl hover:bg-zinc-800 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-xs whitespace-nowrap"
                title="Download day sales as CSV"
              >
                <Download className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span className="sm:hidden">CSV</span>
                <span className="hidden sm:inline">Export CSV</span>
              </button>

              <button
                type="button"
                id="btn-header-new-sale"
                onClick={onOpenNewSale}
                className="col-span-2 sm:col-span-1 inline-flex items-center justify-center gap-2 px-4 min-h-[42px] text-xs font-black text-zinc-950 bg-emerald-400 hover:bg-emerald-300 active:scale-98 rounded-xl shadow-md shadow-emerald-950/40 transition-all cursor-pointer whitespace-nowrap"
              >
                <PlusCircle className="w-4 h-4 text-zinc-950 shrink-0" />
                <span>Record Sale</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Header Passcode Modal */}
      <PasscodeModal
        isOpen={isPasscodeModalOpen}
        onClose={() => setIsPasscodeModalOpen(false)}
      />
    </header>
  );
};
