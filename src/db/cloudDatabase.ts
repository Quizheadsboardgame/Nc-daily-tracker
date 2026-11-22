import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';
import config from '../../firebase-applet-config.json';
import {
  SaleRecord,
  PaymentMethod,
  DaySummary,
  SalesmanStat,
  TradeRecord,
  TradeType,
  TradeDaySummary,
  TradeVendorStat,
  OnlineCard,
  OnlineCardsSummary,
  VendorLeaderboardEntry,
  VendorLeaderboardSummary,
  DailySalesTrendPoint,
  SplitPaymentBreakdown,
  BasketItemInput,
  CashReconciliationRecord,
  CashReconciliationSummary,
  StoreCreditCustomer,
  StoreCreditTransaction,
  StoreCreditTransactionType,
  StoreCreditOverview,
  HoldRecord,
  HoldPayment,
  HoldStatus,
  HoldsOverview,
  HeatmapData,
  HeatmapCell,
  CounterPreset,
  PresetColorKey,
  DayEventInfo,
  EventVsShopComparison,
  EventDaySummaryItem,
  GiftCardRecord,
  GiftCardStatus,
  GiftCardTransaction,
  GiftCardTransactionType,
  GiftCardsOverview,
} from '../types';
import {
  playCheckoutSound,
  isSaleSoundRecentlyPlayed,
  markSaleSoundPlayed,
  emitSaleFlash,
  isSaleRecentlyFlashed,
  getCelebrationTier,
} from '../utils/sound';
import { getDeviceOperator } from '../utils/deviceOperator';

export const DEFAULT_PRELOADED_VENDORS = ['Pete', 'Kieron', 'Newtons', 'Roy', 'Connor', 'Charlie'];
export const DEFAULT_PRELOADED_SALESMEN = DEFAULT_PRELOADED_VENDORS;

export const DEFAULT_VENDOR_COLORS: Record<string, string> = {
  Pete: '#2563eb', // Royal Blue
  Kieron: '#059669', // Emerald Green
  Newtons: '#7c3aed', // Purple Violet
  Roy: '#d97706', // Amber Gold
  Connor: '#dc2626', // Ruby Red
  Charlie: '#0891b2', // Teal Cyan
  Issac: '#4f46e5', // Indigo
  Isaac: '#4f46e5', // Indigo
  Ollie: '#0d9488', // Teal
};

export const PRESET_VENDOR_PALETTE = [
  { name: 'Blue', hex: '#2563eb' },
  { name: 'Emerald', hex: '#059669' },
  { name: 'Violet', hex: '#7c3aed' },
  { name: 'Amber', hex: '#d97706' },
  { name: 'Rose', hex: '#e11d48' },
  { name: 'Cyan', hex: '#0891b2' },
  { name: 'Indigo', hex: '#4f46e5' },
  { name: 'Pink', hex: '#db2777' },
  { name: 'Lime', hex: '#65a30d' },
  { name: 'Orange', hex: '#ea580c' },
  { name: 'Slate', hex: '#475569' },
  { name: 'Teal', hex: '#0d9488' },
];

const STORAGE_SALES_KEY = 'daily_sales_tracker_real_sales_v6';
const STORAGE_TRADES_KEY = 'daily_sales_tracker_real_trades_v6';
const STORAGE_SALESMEN_KEY = 'daily_sales_tracker_real_salesmen_v6';
const STORAGE_VENDOR_COLORS_KEY = 'daily_sales_tracker_vendor_colors_v6';
const STORAGE_ONLINE_CARDS_KEY = 'daily_sales_tracker_real_online_cards_v6';
const STORAGE_REMOVED_VENDORS_KEY = 'daily_sales_tracker_removed_vendors_v6';
const STORAGE_CASH_RECON_KEY = 'daily_sales_tracker_cash_reconciliation_v6';
const STORAGE_STORE_CREDIT_CUSTOMERS_KEY = 'daily_sales_tracker_store_credit_customers_v6';
const STORAGE_STORE_CREDIT_TX_KEY = 'daily_sales_tracker_store_credit_tx_v6';
const STORAGE_HOLDS_KEY = 'daily_sales_tracker_holds_v6';
const STORAGE_DAY_EVENTS_KEY = 'daily_sales_tracker_day_events_v6';
const STORAGE_COUNTER_PRESETS_KEY = 'daily_sales_tracker_counter_presets_v6';
const STORAGE_GIFT_CARDS_KEY = 'daily_sales_tracker_gift_cards_v6';
const STORAGE_GIFT_CARD_TX_KEY = 'daily_sales_tracker_gift_card_tx_v6';

const DEFAULT_COUNTER_PRESETS: CounterPreset[] = [
  { id: 'preset_booster', label: 'Booster Pack', itemDescription: 'Booster Pack', price: 4.5, categoryColor: 'blue', sortOrder: 1 },
  { id: 'preset_sleeves', label: 'Sleeves / Toploaders', itemDescription: 'Card Sleeves & Toploaders', price: 3.0, categoryColor: 'emerald', sortOrder: 2 },
  { id: 'preset_binder', label: 'Binder Singles', itemDescription: 'Binder Singles', price: 5.0, categoryColor: 'violet', sortOrder: 3 },
  { id: 'preset_etb', label: 'ETB / Sealed Box', itemDescription: 'Elite Trainer Box', price: 49.99, categoryColor: 'amber', sortOrder: 4 },
];

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(config) : getApp();

// Connect to Firestore instance with database ID from config
export const db = getFirestore(app, config.firestoreDatabaseId);

/* Utility to format Date into YYYY-MM-DD local format */
export function getLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function isConnorVendor(vendorName?: string | null): boolean {
  return (vendorName || '').trim().toLowerCase() === 'connor';
}

export function isValidFourDigitItemNumber(value?: string | null): boolean {
  return /^\d{4}$/.test((value || '').trim());
}

export function formatDisplayDate(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export interface WeekDayItem {
  dateKey: string;
  dayName: string; // "Sun", "Mon", "Tue", ...
  fullDayName: string; // "Sunday", "Monday", ...
  formattedDate: string; // "6 Sep"
  isToday: boolean;
}

export interface WeekRangeInfo {
  weekNumber: number;
  year: number;
  startDateKey: string; // Sunday YYYY-MM-DD
  endDateKey: string; // Saturday YYYY-MM-DD
  startDisplay: string;
  endDisplay: string;
  label: string;
  shortLabel: string;
  days: WeekDayItem[];
}

/**
 * Calculates Sunday-to-Saturday business week of the year.
 * Weeks run Sunday (day 0) through Saturday (day 6).
 */
export function getWeekRangeInfo(dateOrKey: Date | string = new Date()): WeekRangeInfo {
  let d: Date;
  if (typeof dateOrKey === 'string') {
    const [y, m, day] = dateOrKey.split('-').map(Number);
    d = new Date(y, m - 1, day);
  } else {
    d = new Date(dateOrKey.getFullYear(), dateOrKey.getMonth(), dateOrKey.getDate());
  }

  const dayOfWeek = d.getDay(); // 0 is Sunday, 6 is Saturday
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - dayOfWeek);
  sunday.setHours(0, 0, 0, 0);

  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  saturday.setHours(23, 59, 59, 999);

  // Year of this week determined by midweek (Wednesday)
  const midweek = new Date(sunday);
  midweek.setDate(sunday.getDate() + 3);
  const year = midweek.getFullYear();

  // First Sunday of the year containing Jan 1st
  const jan1 = new Date(year, 0, 1);
  const jan1DayOfWeek = jan1.getDay();
  const firstSundayOfYear = new Date(jan1);
  firstSundayOfYear.setDate(jan1.getDate() - jan1DayOfWeek);
  firstSundayOfYear.setHours(0, 0, 0, 0);

  const diffMs = sunday.getTime() - firstSundayOfYear.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  let weekNumber = Math.floor(diffDays / 7) + 1;
  if (weekNumber < 1) weekNumber = 1;

  const startDateKey = getLocalDateKey(sunday);
  const endDateKey = getLocalDateKey(saturday);
  const todayKey = getLocalDateKey();

  const dayNamesShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayNamesFull = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const days: WeekDayItem[] = [];
  for (let i = 0; i < 7; i++) {
    const itemDate = new Date(sunday);
    itemDate.setDate(sunday.getDate() + i);
    const itemKey = getLocalDateKey(itemDate);
    days.push({
      dateKey: itemKey,
      dayName: dayNamesShort[i],
      fullDayName: dayNamesFull[i],
      formattedDate: itemDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      isToday: itemKey === todayKey,
    });
  }

  const startDisplay = sunday.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const endDisplay = saturday.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  return {
    weekNumber,
    year,
    startDateKey,
    endDateKey,
    startDisplay,
    endDisplay,
    label: `Week ${weekNumber} • ${startDisplay} – ${endDisplay}`,
    shortLabel: `Week ${weekNumber} (${sunday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${saturday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })})`,
    days,
  };
}

export function shiftWeek(startDateKey: string, weekDelta: number): WeekRangeInfo {
  const [y, m, d] = startDateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + weekDelta * 7);
  return getWeekRangeInfo(date);
}

/**
 * Cloud Sales & Trades Database
 * Independent Sales Ledger (Cash & Card) and Trade Ledger (Cards traded for Cash or Vendor Credit).
 * Combined reporting in the Vendor Portal.
 */
class CloudSalesDatabase {
  private salesCache: Map<string, SaleRecord> = new Map();
  private tradesCache: Map<string, TradeRecord> = new Map();
  private onlineCardsCache: Map<string, OnlineCard> = new Map();
  private cashReconciliationsCache: Map<string, CashReconciliationRecord> = new Map();
  private storeCreditCustomersCache: Map<string, StoreCreditCustomer> = new Map();
  private storeCreditTxCache: Map<string, StoreCreditTransaction> = new Map();
  private holdsCache: Map<string, HoldRecord> = new Map();
  private dayEventsCache: Map<string, DayEventInfo> = new Map();
  private counterPresetsCache: Map<string, CounterPreset> = new Map();
  private giftCardsCache: Map<string, GiftCardRecord> = new Map();
  private giftCardTxCache: Map<string, GiftCardTransaction> = new Map();
  private salesmenList: string[] = [...DEFAULT_PRELOADED_SALESMEN];
  private vendorColors: Map<string, string> = new Map(Object.entries(DEFAULT_VENDOR_COLORS));
  private removedVendors: Set<string> = new Set(['kerion']);
  private hasEnsuredPreloadedConnor: boolean = false;
  private listeners: Set<() => void> = new Set();
  public isCloudConnected: boolean = false;
  public lastSyncTimestamp: number = Date.now();

  constructor() {
    this.cleanLegacyStorage();
    this.loadFromStorage();
    this.initRealtimeListeners();
  }

  private cleanLegacyStorage() {
    try {
      localStorage.removeItem('daily_sales_tracker_records_v4');
      localStorage.removeItem('daily_sales_tracker_records_v3');
      localStorage.removeItem('daily_sales_tracker_records');
      localStorage.removeItem('sales_tracker_local_salesmen');
    } catch (e) {
      // ignore
    }
  }

  private loadFromStorage() {
    try {
      const storedRemoved = localStorage.getItem(STORAGE_REMOVED_VENDORS_KEY);
      if (storedRemoved) {
        try {
          const parsed = JSON.parse(storedRemoved);
          if (Array.isArray(parsed)) {
            parsed.forEach((n) => {
              if (typeof n === 'string' && n.trim()) {
                this.removedVendors.add(n.trim().toLowerCase());
              }
            });
          }
        } catch (e) {
          // ignore
        }
      }
      this.removedVendors.add('kerion');

      const storedSalesmen = localStorage.getItem(STORAGE_SALESMEN_KEY);
      if (storedSalesmen) {
        const parsed = JSON.parse(storedSalesmen);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.salesmenList = parsed
            .filter((n: string) => typeof n === 'string' && n.trim() && !this.removedVendors.has(n.trim().toLowerCase()))
            .sort();
        }
      }
      this.salesmenList = this.salesmenList.filter((n) => !this.removedVendors.has(n.trim().toLowerCase()));
      if (
        !this.removedVendors.has('connor') &&
        !this.salesmenList.some((n) => n.trim().toLowerCase() === 'connor')
      ) {
        this.salesmenList.push('Connor');
        this.salesmenList.sort();
      }

      const storedColors = localStorage.getItem(STORAGE_VENDOR_COLORS_KEY);
      if (storedColors) {
        const parsedColors = JSON.parse(storedColors);
        if (typeof parsedColors === 'object' && parsedColors !== null) {
          Object.entries(parsedColors).forEach(([vendor, color]) => {
            if (typeof color === 'string' && !this.removedVendors.has(vendor.toLowerCase())) {
              this.vendorColors.set(vendor, color);
            }
          });
        }
      }
      this.vendorColors.delete('Kerion');

      const storedSales = localStorage.getItem(STORAGE_SALES_KEY);
      if (storedSales) {
        const parsed = JSON.parse(storedSales);
        if (Array.isArray(parsed) && parsed.length > 0) {
          for (const item of parsed) {
            const raw = (item.paymentMethod || '').toString().toLowerCase().trim();
            const paymentMethod: PaymentMethod =
              raw === 'cash'
                ? 'cash'
                : raw === 'traded_out' || raw === 'trade_out' || raw === 'trade out' || raw === 'trade' || raw === 'traded'
                ? 'traded_out'
                : raw === 'online'
                ? 'online'
                : 'card';
            this.salesCache.set(item.id, {
              ...item,
              paymentMethod,
            });
          }
        }
      }

      const storedTrades = localStorage.getItem(STORAGE_TRADES_KEY);
      if (storedTrades) {
        const parsedTrades = JSON.parse(storedTrades);
        if (Array.isArray(parsedTrades) && parsedTrades.length > 0) {
          for (const item of parsedTrades) {
            this.tradesCache.set(item.id, item);
          }
        }
      }

      const storedOnline = localStorage.getItem(STORAGE_ONLINE_CARDS_KEY);
      if (storedOnline) {
        const parsedOnline = JSON.parse(storedOnline);
        if (Array.isArray(parsedOnline) && parsedOnline.length > 0) {
          for (const item of parsedOnline) {
            this.onlineCardsCache.set(item.id, item);
          }
        }
      }

      const storedCashRecon = localStorage.getItem(STORAGE_CASH_RECON_KEY);
      if (storedCashRecon) {
        const parsedRecon = JSON.parse(storedCashRecon);
        if (Array.isArray(parsedRecon)) {
          for (const item of parsedRecon) {
            if (item && item.dateKey) {
              this.cashReconciliationsCache.set(item.dateKey, item);
            }
          }
        }
      }

      const storedCreditCustomers = localStorage.getItem(STORAGE_STORE_CREDIT_CUSTOMERS_KEY);
      if (storedCreditCustomers) {
        const parsedCust = JSON.parse(storedCreditCustomers);
        if (Array.isArray(parsedCust)) {
          for (const item of parsedCust) {
            if (item && item.id) {
              this.storeCreditCustomersCache.set(item.id, item);
            }
          }
        }
      }

      const storedCreditTx = localStorage.getItem(STORAGE_STORE_CREDIT_TX_KEY);
      if (storedCreditTx) {
        const parsedTx = JSON.parse(storedCreditTx);
        if (Array.isArray(parsedTx)) {
          for (const item of parsedTx) {
            if (item && item.id) {
              this.storeCreditTxCache.set(item.id, item);
            }
          }
        }
      }

      const storedHolds = localStorage.getItem(STORAGE_HOLDS_KEY);
      if (storedHolds) {
        const parsedHolds = JSON.parse(storedHolds);
        if (Array.isArray(parsedHolds)) {
          for (const item of parsedHolds) {
            if (item && item.id) {
              this.holdsCache.set(item.id, item);
            }
          }
        }
      }

      const storedDayEvents = localStorage.getItem(STORAGE_DAY_EVENTS_KEY);
      if (storedDayEvents) {
        const parsedEvents = JSON.parse(storedDayEvents);
        if (Array.isArray(parsedEvents)) {
          for (const ev of parsedEvents) {
            if (ev && ev.dateKey && ev.eventName) {
              this.dayEventsCache.set(ev.dateKey, ev);
            }
          }
        }
      }

      const storedPresets = localStorage.getItem(STORAGE_COUNTER_PRESETS_KEY);
      if (storedPresets) {
        const parsedPresets = JSON.parse(storedPresets);
        if (Array.isArray(parsedPresets)) {
          for (const preset of parsedPresets) {
            if (preset && preset.id) {
              this.counterPresetsCache.set(preset.id, preset);
            }
          }
        }
      } else {
        DEFAULT_COUNTER_PRESETS.forEach((p) => this.counterPresetsCache.set(p.id, { ...p }));
      }

      const storedGiftCards = localStorage.getItem(STORAGE_GIFT_CARDS_KEY);
      if (storedGiftCards) {
        const parsedGiftCards = JSON.parse(storedGiftCards);
        if (Array.isArray(parsedGiftCards)) {
          for (const gc of parsedGiftCards) {
            if (gc && gc.id) {
              this.giftCardsCache.set(gc.id, gc);
            }
          }
        }
      }

      const storedGiftCardTx = localStorage.getItem(STORAGE_GIFT_CARD_TX_KEY);
      if (storedGiftCardTx) {
        const parsedGiftCardTx = JSON.parse(storedGiftCardTx);
        if (Array.isArray(parsedGiftCardTx)) {
          for (const tx of parsedGiftCardTx) {
            if (tx && tx.id) {
              this.giftCardTxCache.set(tx.id, tx);
            }
          }
        }
      }
    } catch (e) {
      console.warn('Could not read localStorage cache:', e);
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_SALESMEN_KEY, JSON.stringify(this.salesmenList));
      localStorage.setItem(STORAGE_REMOVED_VENDORS_KEY, JSON.stringify(Array.from(this.removedVendors)));
      const colorsObj: Record<string, string> = {};
      this.vendorColors.forEach((color, name) => {
        colorsObj[name] = color;
      });
      localStorage.setItem(STORAGE_VENDOR_COLORS_KEY, JSON.stringify(colorsObj));
      localStorage.setItem(STORAGE_SALES_KEY, JSON.stringify(Array.from(this.salesCache.values())));
      localStorage.setItem(STORAGE_TRADES_KEY, JSON.stringify(Array.from(this.tradesCache.values())));
      localStorage.setItem(STORAGE_ONLINE_CARDS_KEY, JSON.stringify(Array.from(this.onlineCardsCache.values())));
      localStorage.setItem(STORAGE_CASH_RECON_KEY, JSON.stringify(Array.from(this.cashReconciliationsCache.values())));
      localStorage.setItem(
        STORAGE_STORE_CREDIT_CUSTOMERS_KEY,
        JSON.stringify(Array.from(this.storeCreditCustomersCache.values()))
      );
      localStorage.setItem(
        STORAGE_STORE_CREDIT_TX_KEY,
        JSON.stringify(Array.from(this.storeCreditTxCache.values()))
      );
      localStorage.setItem(
        STORAGE_HOLDS_KEY,
        JSON.stringify(Array.from(this.holdsCache.values()))
      );
      localStorage.setItem(
        STORAGE_DAY_EVENTS_KEY,
        JSON.stringify(Array.from(this.dayEventsCache.values()))
      );
      localStorage.setItem(
        STORAGE_COUNTER_PRESETS_KEY,
        JSON.stringify(Array.from(this.counterPresetsCache.values()))
      );
      localStorage.setItem(
        STORAGE_GIFT_CARDS_KEY,
        JSON.stringify(Array.from(this.giftCardsCache.values()))
      );
      localStorage.setItem(
        STORAGE_GIFT_CARD_TX_KEY,
        JSON.stringify(Array.from(this.giftCardTxCache.values()))
      );
    } catch (e) {
      console.warn('Could not persist to localStorage:', e);
    }
  }

  private notify() {
    this.saveToStorage();
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (e) {
        console.error('Listener notify error:', e);
      }
    });
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private initRealtimeListeners() {
    try {
      // 0. Real-time listener for Removed/Deleted Vendors across all devices
      const removedVendorsCol = collection(db, 'removed_vendors');
      onSnapshot(
        removedVendorsCol,
        (snapshot) => {
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const name = data.name || docSnap.id;
            if (name && typeof name === 'string') {
              this.removedVendors.add(name.trim().toLowerCase());
            }
          });
          const beforeCount = this.salesmenList.length;
          this.salesmenList = this.salesmenList.filter((n) => !this.removedVendors.has(n.trim().toLowerCase()));
          if (this.salesmenList.length !== beforeCount) {
            this.notify();
          }
        },
        (error) => {
          console.warn('Removed vendors listener error:', error);
        }
      );

      // 1. Real-time listener for Salesmen Roster & Colors across all devices
      const salesmenCol = collection(db, 'salesmen');
      onSnapshot(
        salesmenCol,
        (snapshot) => {
          this.isCloudConnected = true;
          this.lastSyncTimestamp = Date.now();
          if (snapshot.empty) {
            if (this.removedVendors.size <= 1) {
              this.seedFirestoreSalesmen();
            }
            return;
          }

          const remoteNames: string[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.name) {
              const cleanName = data.name.trim();
              if (cleanName.toLowerCase() === 'kerion') {
                deleteDoc(docSnap.ref).catch(() => {});
                return;
              }
              if (this.removedVendors.has(cleanName.toLowerCase())) {
                return;
              }
              remoteNames.push(cleanName);
              if (data.color) {
                this.vendorColors.set(cleanName, data.color);
              }
            }
          });

          // Ensure preloaded vendor Connor exists in Firestore roster if not explicitly removed
          if (
            !this.removedVendors.has('connor') &&
            !remoteNames.some((n) => n.trim().toLowerCase() === 'connor')
          ) {
            remoteNames.push('Connor');
            if (!this.vendorColors.has('Connor')) {
              this.vendorColors.set('Connor', DEFAULT_VENDOR_COLORS.Connor || '#dc2626');
            }
            if (!this.hasEnsuredPreloadedConnor) {
              this.hasEnsuredPreloadedConnor = true;
              setDoc(
                doc(db, 'salesmen', 'connor'),
                {
                  name: 'Connor',
                  color: this.vendorColors.get('Connor') || DEFAULT_VENDOR_COLORS.Connor || '#dc2626',
                  createdAt: Date.now(),
                },
                { merge: true }
              ).catch((e) => console.warn('Could not seed Connor into Firestore salesmen:', e));
            }
          }

          // Use remote documents from Firestore as authoritative active roster
          this.salesmenList = Array.from(new Set(remoteNames))
            .filter((n) => !this.removedVendors.has(n.toLowerCase()))
            .sort();
          this.notify();
        },
        (error) => {
          console.warn('Salesmen Firestore listener error:', error);
        }
      );

      // 2. Real-time listener for Sales Records (Cash, Card, Traded Out, Online) across all devices
      const salesCol = collection(db, 'sales');
      let isInitialSalesSnapshot = true;
      onSnapshot(
        salesCol,
        (snapshot) => {
          this.isCloudConnected = true;
          this.lastSyncTimestamp = Date.now();
          const remoteSaleIds = new Set<string>();

          // Trigger Mario Coin sound (or fanfare if > £100) and 3-second flash banner on all connected devices when any new sale or basket checkout is made
          if (!isInitialSalesSnapshot) {
            const addedGroups = new Map<string, { docId: string; data: Record<string, any> }[]>();
            snapshot.docChanges().forEach((change) => {
              if (change.type === 'added') {
                const data = change.doc.data();
                const groupKey = data.checkoutGroupId ? String(data.checkoutGroupId) : change.doc.id;
                const existingGroup = addedGroups.get(groupKey) || [];
                existingGroup.push({ docId: change.doc.id, data });
                addedGroups.set(groupKey, existingGroup);
              }
            });

            addedGroups.forEach((groupItems, groupKey) => {
              const first = groupItems[0].data;
              const summedGroupAmount = groupItems.reduce((acc, g) => acc + (Number(g.data.amount) || 0), 0);
              const totalAmount =
                first.checkoutTotalAmount !== undefined && first.checkoutTotalAmount !== null
                  ? Number(first.checkoutTotalAmount)
                  : Math.round(summedGroupAmount * 100) / 100;

              const rawMethod = (first.paymentMethod || '').toString().toLowerCase().trim();
              const paymentMethod: PaymentMethod =
                rawMethod === 'cash'
                  ? 'cash'
                  : rawMethod === 'traded_out' ||
                    rawMethod === 'trade_out' ||
                    rawMethod === 'trade out' ||
                    rawMethod === 'trade' ||
                    rawMethod === 'traded'
                  ? 'traded_out'
                  : rawMethod === 'online'
                  ? 'online'
                  : 'card';

              const uniqueVendors = Array.from(
                new Set(
                  groupItems
                    .map((g) => (g.data.salesmanName || '').toString().trim())
                    .filter(Boolean)
                )
              );
              const primaryVendor = uniqueVendors[0] || 'Store';
              const vendorName =
                first.checkoutVendorSummary ||
                (uniqueVendors.length > 2
                  ? `${uniqueVendors[0]}, ${uniqueVendors[1]} +${uniqueVendors.length - 2}`
                  : uniqueVendors.join(' & ') || 'Store');

              const itemDescription =
                first.checkoutItemSummary ||
                first.itemDescription ||
                (first.isMiscellaneous ? 'Miscellaneous' : '');
              const splitSummary = first.splitSummary ? String(first.splitSummary) : undefined;
              const basketItemCount =
                first.basketItemCount !== undefined && first.basketItemCount !== null
                  ? Number(first.basketItemCount)
                  : groupItems.length;

              // Play sound immediately on this device if not already played locally
              if (!isSaleSoundRecentlyPlayed(groupKey)) {
                playCheckoutSound(false, groupKey, totalAmount);
              }

              // Flash who the sale is for and how it was paid for 3 seconds (or escalating fanfare if > £100)
              if (!isSaleRecentlyFlashed(groupKey)) {
                const eventDateKey = first.dateKey || getLocalDateKey(new Date(Number(first.timestamp) || Date.now()));
                const isTopSaleOfDay = this.isNewTopSaleForDay(eventDateKey, totalAmount, groupKey);
                emitSaleFlash({
                  id: groupKey,
                  vendorName,
                  vendorColor: this.getVendorColor(primaryVendor),
                  paymentMethod,
                  itemDescription,
                  amount: totalAmount,
                  isOver100: totalAmount > 100,
                  celebrationTier: getCelebrationTier(totalAmount),
                  isTopSaleOfDay,
                  isSplit: Boolean(splitSummary),
                  splitSummary,
                  basketItemCount,
                });
              }
            });
          }
          isInitialSalesSnapshot = false;

          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            remoteSaleIds.add(docSnap.id);
            const rawMethod = (data.paymentMethod || '').toString().toLowerCase().trim();
            const paymentMethod: PaymentMethod =
              rawMethod === 'cash'
                ? 'cash'
                : rawMethod === 'traded_out' ||
                  rawMethod === 'trade_out' ||
                  rawMethod === 'trade out' ||
                  rawMethod === 'trade' ||
                  rawMethod === 'traded'
                ? 'traded_out'
                : rawMethod === 'online'
                ? 'online'
                : 'card';

            this.salesCache.set(docSnap.id, {
              id: docSnap.id,
              salesmanName: data.salesmanName || '',
              operatorName: data.operatorName || undefined,
              itemDescription: data.itemDescription || (data.isMiscellaneous ? 'Miscellaneous' : ''),
              isMiscellaneous: Boolean(data.isMiscellaneous) || data.itemDescription?.trim().toLowerCase() === 'miscellaneous',
              amount: Number(data.amount) || 0,
              originalAmount: data.originalAmount !== undefined && data.originalAmount !== null ? Number(data.originalAmount) : undefined,
              discountAmount: data.discountAmount !== undefined && data.discountAmount !== null ? Number(data.discountAmount) : undefined,
              discountLabel: data.discountLabel || undefined,
              paymentMethod,
              notes: data.notes || undefined,
              timestamp: data.timestamp || Date.now(),
              dateKey: data.dateKey || getLocalDateKey(new Date(data.timestamp || Date.now())),
              isOnlineSale: Boolean(data.isOnlineSale) || paymentMethod === 'online',
              onlineCardId: data.onlineCardId || undefined,
              onlineBarcode: data.onlineBarcode || undefined,
              checkoutGroupId: data.checkoutGroupId || undefined,
              checkoutTotalAmount: data.checkoutTotalAmount !== undefined && data.checkoutTotalAmount !== null ? Number(data.checkoutTotalAmount) : undefined,
              splitSummary: data.splitSummary || undefined,
              basketItemCount: data.basketItemCount !== undefined && data.basketItemCount !== null ? Number(data.basketItemCount) : undefined,
              checkoutVendorSummary: data.checkoutVendorSummary || undefined,
              checkoutItemSummary: data.checkoutItemSummary || undefined,
              storeCreditCustomerId: data.storeCreditCustomerId || undefined,
              storeCreditCustomerName: data.storeCreditCustomerName || undefined,
              storeCreditAmount: data.storeCreditAmount !== undefined && data.storeCreditAmount !== null ? Number(data.storeCreditAmount) : undefined,
              relatedHoldId: data.relatedHoldId || undefined,
              tradeDetails: data.tradeDetails || undefined,
              tradeAcceptingVendor: data.tradeAcceptingVendor || undefined,
              tradeValue: data.tradeValue !== undefined && data.tradeValue !== null ? Number(data.tradeValue) : undefined,
              tradeItemDescription: data.tradeItemDescription || undefined,
            });
          });

          // Reconcile local cache with remote Firestore state:
          // Remove any sale from local cache that was deleted on another device!
          for (const localId of Array.from(this.salesCache.keys())) {
            if (!remoteSaleIds.has(localId)) {
              this.salesCache.delete(localId);
            }
          }

          this.notify();
        },
        (error) => {
          console.warn('Sales Firestore listener error:', error);
        }
      );

      // 3. Real-time listener for Trades collection (Cards traded for Cash or Vendor Credit)
      const tradesCol = collection(db, 'trades');
      onSnapshot(
        tradesCol,
        (snapshot) => {
          this.isCloudConnected = true;
          this.lastSyncTimestamp = Date.now();
          const remoteTradeIds = new Set<string>();

          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            remoteTradeIds.add(docSnap.id);
            const rawType = data.tradeType?.toLowerCase();
            const tradeType: TradeType = rawType === 'cash' ? 'cash' : 'credit';

            this.tradesCache.set(docSnap.id, {
              id: docSnap.id,
              vendorName: data.vendorName || '',
              operatorName: data.operatorName || undefined,
              itemDescription: data.itemDescription || '',
              tradeValue: Number(data.tradeValue) || 0,
              tradeType,
              dateKey: data.dateKey || getLocalDateKey(new Date(data.timestamp || Date.now())),
              timestamp: data.timestamp || Date.now(),
              customerName: data.customerName || undefined,
              storeCreditCustomerId: data.storeCreditCustomerId || undefined,
              notes: data.notes || undefined,
              isStandalone: data.isStandalone !== undefined ? Boolean(data.isStandalone) : true,
              soldItemDescription: data.soldItemDescription || undefined,
              saleAmount: data.saleAmount !== undefined && data.saleAmount !== null ? Number(data.saleAmount) : undefined,
              associatedSaleId: data.associatedSaleId || undefined,
            });
          });

          // Reconcile local cache with remote Firestore state:
          // Remove any trade that was deleted on another device!
          for (const localId of Array.from(this.tradesCache.keys())) {
            if (!remoteTradeIds.has(localId)) {
              this.tradesCache.delete(localId);
            }
          }

          this.notify();
        },
        (error) => {
          console.warn('Trades Firestore listener error:', error);
        }
      );

      // 4. Real-time listener for Online Cards & Barcodes collection across all devices
      const onlineCardsCol = collection(db, 'online_cards');
      onSnapshot(
        onlineCardsCol,
        (snapshot) => {
          this.isCloudConnected = true;
          this.lastSyncTimestamp = Date.now();
          const remoteCardIds = new Set<string>();

          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            remoteCardIds.add(docSnap.id);
            this.onlineCardsCache.set(docSnap.id, {
              id: docSnap.id,
              barcode: data.barcode || docSnap.id,
              vendorName: data.vendorName || '',
              cardName: data.cardName || '',
              price: Number(data.price) || 0,
              status: data.status === 'sold' ? 'sold' : 'available',
              notes: data.notes || undefined,
              timestamp: data.timestamp || Date.now(),
              dateKey: data.dateKey || getLocalDateKey(new Date(data.timestamp || Date.now())),
              soldAt: data.soldAt || undefined,
              soldDateKey: data.soldDateKey || undefined,
              saleId: data.saleId || undefined,
              soldPaymentMethod: data.soldPaymentMethod || undefined,
            });
          });

          // Reconcile local cache with remote Firestore state:
          // Remove any card that was deleted on another device!
          for (const localId of Array.from(this.onlineCardsCache.keys())) {
            if (!remoteCardIds.has(localId)) {
              this.onlineCardsCache.delete(localId);
            }
          }

          this.saveToStorage();
          this.notify();
        },
        (error) => {
          console.warn('Online cards Firestore listener error:', error);
        }
      );

      // 5. Real-time listener for End-of-Day Cash Drawer Reconciliations across all devices
      const cashReconCol = collection(db, 'cash_reconciliations');
      onSnapshot(
        cashReconCol,
        (snapshot) => {
          this.isCloudConnected = true;
          this.lastSyncTimestamp = Date.now();
          const remoteKeys = new Set<string>();

          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const dKey = data.dateKey || docSnap.id;
            remoteKeys.add(dKey);
            this.cashReconciliationsCache.set(dKey, {
              dateKey: dKey,
              openingFloat: Number(data.openingFloat) || 0,
              actualCashCounted:
                data.actualCashCounted !== undefined && data.actualCashCounted !== null
                  ? Number(data.actualCashCounted)
                  : null,
              denominationCounts: data.denominationCounts || undefined,
              notes: data.notes || undefined,
              updatedAt: data.updatedAt || Date.now(),
            });
          });

          for (const localKey of Array.from(this.cashReconciliationsCache.keys())) {
            if (!remoteKeys.has(localKey)) {
              this.cashReconciliationsCache.delete(localKey);
            }
          }

          this.notify();
        },
        (error) => {
          console.warn('Cash reconciliations Firestore listener error:', error);
        }
      );

      // 6. Real-time listener for Customer Store Credit Accounts
      const storeCreditCustCol = collection(db, 'store_credit_customers');
      onSnapshot(
        storeCreditCustCol,
        (snapshot) => {
          this.isCloudConnected = true;
          this.lastSyncTimestamp = Date.now();
          const remoteIds = new Set<string>();

          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            remoteIds.add(docSnap.id);
            this.storeCreditCustomersCache.set(docSnap.id, {
              id: docSnap.id,
              name: data.name || 'Customer',
              normalizedName: (data.normalizedName || data.name || '').toString().trim().toLowerCase(),
              phone: data.phone || undefined,
              balance: Math.round((Number(data.balance) || 0) * 100) / 100,
              totalIssued: Math.round((Number(data.totalIssued) || 0) * 100) / 100,
              totalRedeemed: Math.round((Number(data.totalRedeemed) || 0) * 100) / 100,
              notes: data.notes || undefined,
              createdAt: data.createdAt || Date.now(),
              updatedAt: data.updatedAt || Date.now(),
            });
          });

          for (const localId of Array.from(this.storeCreditCustomersCache.keys())) {
            if (!remoteIds.has(localId)) {
              this.storeCreditCustomersCache.delete(localId);
            }
          }

          this.notify();
        },
        (error) => {
          console.warn('Store credit customers Firestore listener error:', error);
        }
      );

      // 7. Real-time listener for Customer Store Credit Transactions
      const storeCreditTxCol = collection(db, 'store_credit_transactions');
      onSnapshot(
        storeCreditTxCol,
        (snapshot) => {
          this.isCloudConnected = true;
          this.lastSyncTimestamp = Date.now();
          const remoteTxIds = new Set<string>();

          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            remoteTxIds.add(docSnap.id);
            this.storeCreditTxCache.set(docSnap.id, {
              id: docSnap.id,
              customerId: data.customerId || '',
              customerName: data.customerName || 'Customer',
              type: data.type === 'redeem' ? 'redeem' : data.type === 'adjust' ? 'adjust' : 'issue',
              amount: Math.round((Number(data.amount) || 0) * 100) / 100,
              delta: Math.round((Number(data.delta) || 0) * 100) / 100,
              balanceAfter: Math.round((Number(data.balanceAfter) || 0) * 100) / 100,
              vendorName: data.vendorName || undefined,
              description: data.description || '',
              relatedTradeId: data.relatedTradeId || undefined,
              relatedCheckoutGroupId: data.relatedCheckoutGroupId || undefined,
              relatedSaleId: data.relatedSaleId || undefined,
              dateKey: data.dateKey || getLocalDateKey(new Date(data.timestamp || Date.now())),
              timestamp: data.timestamp || Date.now(),
            });
          });

          for (const localId of Array.from(this.storeCreditTxCache.keys())) {
            if (!remoteTxIds.has(localId)) {
              this.storeCreditTxCache.delete(localId);
            }
          }

          this.notify();
        },
        (error) => {
          console.warn('Store credit transactions Firestore listener error:', error);
        }
      );

      // 8. Real-time listener for Customer Holds & Layaways
      const holdsCol = collection(db, 'holds');
      onSnapshot(
        holdsCol,
        (snapshot) => {
          this.isCloudConnected = true;
          this.lastSyncTimestamp = Date.now();
          const remoteHoldIds = new Set<string>();

          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            remoteHoldIds.add(docSnap.id);
            const rawStatus = (data.status || 'active').toString().toLowerCase();
            const status: HoldStatus =
              rawStatus === 'completed'
                ? 'completed'
                : rawStatus === 'cancelled'
                ? 'cancelled'
                : rawStatus === 'expired'
                ? 'expired'
                : 'active';

            const payments: HoldPayment[] = Array.isArray(data.payments)
              ? data.payments.map((p: any) => ({
                  id: p.id || `hp_${Date.now()}`,
                  amount: Math.round((Number(p.amount) || 0) * 100) / 100,
                  paymentMethod: p.paymentMethod || 'cash',
                  operatorName: p.operatorName || undefined,
                  saleId: p.saleId || undefined,
                  notes: p.notes || undefined,
                  timestamp: p.timestamp || Date.now(),
                  dateKey: p.dateKey || getLocalDateKey(new Date(p.timestamp || Date.now())),
                }))
              : [];

            this.holdsCache.set(docSnap.id, {
              id: docSnap.id,
              customerName: data.customerName || 'Customer',
              customerPhone: data.customerPhone || undefined,
              vendorName: data.vendorName || '',
              operatorName: data.operatorName || undefined,
              itemDescription: data.itemDescription || '',
              totalPrice: Math.round((Number(data.totalPrice) || 0) * 100) / 100,
              depositPaid: Math.round((Number(data.depositPaid) || 0) * 100) / 100,
              remainingBalance: Math.round((Number(data.remainingBalance) || 0) * 100) / 100,
              status,
              dueDateKey: data.dueDateKey || undefined,
              notes: data.notes || undefined,
              payments,
              createdAt: data.createdAt || Date.now(),
              dateKey: data.dateKey || getLocalDateKey(new Date(data.createdAt || Date.now())),
              updatedAt: data.updatedAt || data.createdAt || Date.now(),
              completedAt: data.completedAt || undefined,
            });
          });

          for (const localId of Array.from(this.holdsCache.keys())) {
            if (!remoteHoldIds.has(localId)) {
              this.holdsCache.delete(localId);
            }
          }

          this.notify();
        },
        (error) => {
          console.warn('Holds Firestore listener error:', error);
        }
      );

      // 9. Real-time listener for Physical Gift Cards
      const giftCardsCol = collection(db, 'gift_cards');
      onSnapshot(
        giftCardsCol,
        (snapshot) => {
          this.isCloudConnected = true;
          this.lastSyncTimestamp = Date.now();
          const remoteIds = new Set<string>();
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            remoteIds.add(docSnap.id);
            const rawStatus = (data.status || 'active').toString().toLowerCase();
            const status: GiftCardStatus =
              rawStatus === 'void' ? 'void' : rawStatus === 'empty' ? 'empty' : 'active';
            this.giftCardsCache.set(docSnap.id, {
              id: docSnap.id,
              barcode: String(data.barcode || docSnap.id),
              balance: Math.round((Number(data.balance) || 0) * 100) / 100,
              initialValue: Math.round((Number(data.initialValue) || 0) * 100) / 100,
              totalLoaded: Math.round((Number(data.totalLoaded) || 0) * 100) / 100,
              totalRedeemed: Math.round((Number(data.totalRedeemed) || 0) * 100) / 100,
              status,
              recipientName: data.recipientName || undefined,
              notes: data.notes || undefined,
              soldPaymentMethod: data.soldPaymentMethod || undefined,
              soldVendorName: data.soldVendorName || undefined,
              operatorName: data.operatorName || undefined,
              createdAt: Number(data.createdAt) || Date.now(),
              dateKey: data.dateKey || getLocalDateKey(new Date(Number(data.createdAt) || Date.now())),
              updatedAt: Number(data.updatedAt) || Number(data.createdAt) || Date.now(),
              lastUsedAt: data.lastUsedAt ? Number(data.lastUsedAt) : undefined,
            });
          });
          for (const localId of Array.from(this.giftCardsCache.keys())) {
            if (!remoteIds.has(localId)) {
              this.giftCardsCache.delete(localId);
            }
          }
          this.notify();
        },
        (error) => {
          console.warn('Gift cards Firestore listener error:', error);
        }
      );

      // 10. Real-time listener for Gift Card Transactions
      const giftCardTxCol = collection(db, 'gift_card_transactions');
      onSnapshot(
        giftCardTxCol,
        (snapshot) => {
          this.isCloudConnected = true;
          this.lastSyncTimestamp = Date.now();
          const remoteTxIds = new Set<string>();
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            remoteTxIds.add(docSnap.id);
            const rawType = (data.type || 'adjust').toString().toLowerCase();
            const type: GiftCardTransactionType =
              rawType === 'activate' ||
              rawType === 'redeem' ||
              rawType === 'topup' ||
              rawType === 'void'
                ? rawType
                : 'adjust';
            this.giftCardTxCache.set(docSnap.id, {
              id: docSnap.id,
              giftCardId: String(data.giftCardId || ''),
              barcode: String(data.barcode || ''),
              type,
              amount: Math.round((Number(data.amount) || 0) * 100) / 100,
              delta: Math.round((Number(data.delta) || 0) * 100) / 100,
              balanceAfter: Math.round((Number(data.balanceAfter) || 0) * 100) / 100,
              paymentMethod: data.paymentMethod || undefined,
              vendorName: data.vendorName || undefined,
              operatorName: data.operatorName || undefined,
              description: data.description || '',
              relatedSaleId: data.relatedSaleId || undefined,
              dateKey: data.dateKey || getLocalDateKey(new Date(Number(data.timestamp) || Date.now())),
              timestamp: Number(data.timestamp) || Date.now(),
            });
          });
          for (const localId of Array.from(this.giftCardTxCache.keys())) {
            if (!remoteTxIds.has(localId)) {
              this.giftCardTxCache.delete(localId);
            }
          }
          this.notify();
        },
        (error) => {
          console.warn('Gift card transactions Firestore listener error:', error);
        }
      );
    } catch (e) {
      console.warn('Could not initialize Firestore listeners:', e);
    }
  }

  private async seedFirestoreSalesmen() {
    try {
      for (const name of DEFAULT_PRELOADED_SALESMEN) {
        const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
        await setDoc(doc(db, 'salesmen', id), {
          name,
          color: DEFAULT_VENDOR_COLORS[name] || '#2563eb',
          createdAt: Date.now(),
        }, { merge: true });
      }
    } catch (e) {
      console.warn('Could not seed initial salesmen in Firestore:', e);
    }
  }

  // --- Vendors Roster & Color Methods ---

  public getKnownVendors(): string[] {
    const list = this.salesmenList.filter(
      (v) => v && v.trim() && !this.removedVendors.has(v.trim().toLowerCase()) && v.trim().toLowerCase() !== 'kerion'
    );
    return Array.from(new Set(list)).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' })
    );
  }

  public getKnownSalesmen(): string[] {
    return this.getKnownVendors();
  }

  public getFrequentVendors(limit = 5): string[] {
    const known = this.getKnownVendors();
    if (known.length === 0) return [];

    const canonicalByLower = new Map<string, string>();
    const scores = new Map<string, number>();

    for (const name of known) {
      const lower = name.toLowerCase();
      canonicalByLower.set(lower, name);
      scores.set(name, 0);
    }

    // Weight sales and trades so the busiest counter vendors bubble to the front
    const now = Date.now();
    const recentWindowMs = 14 * 24 * 60 * 60 * 1000;

    this.salesCache.forEach((sale) => {
      const canonical = canonicalByLower.get((sale.salesmanName || '').trim().toLowerCase());
      if (!canonical) return;
      const weight = now - sale.timestamp <= recentWindowMs ? 2 : 1;
      scores.set(canonical, (scores.get(canonical) || 0) + weight);
    });

    this.tradesCache.forEach((trade) => {
      const canonical = canonicalByLower.get((trade.vendorName || '').trim().toLowerCase());
      if (!canonical) return;
      const weight = now - trade.timestamp <= recentWindowMs ? 2 : 1;
      scores.set(canonical, (scores.get(canonical) || 0) + weight);
    });

    return [...known]
      .sort((a, b) => {
        const diff = (scores.get(b) || 0) - (scores.get(a) || 0);
        if (diff !== 0) return diff;
        return a.localeCompare(b, undefined, { sensitivity: 'base' });
      })
      .slice(0, Math.max(1, limit));
  }

  public getVendorColor(name: string): string {
    if (!name) return '#64748b';
    const clean = name.trim();
    if (this.vendorColors.has(clean)) {
      return this.vendorColors.get(clean)!;
    }
    // Also check case-insensitive match
    for (const [key, col] of this.vendorColors.entries()) {
      if (key.toLowerCase() === clean.toLowerCase()) {
        return col;
      }
    }
    let hash = 0;
    for (let i = 0; i < clean.length; i++) {
      hash = clean.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % PRESET_VENDOR_PALETTE.length;
    const fallbackColor = PRESET_VENDOR_PALETTE[index].hex;
    this.vendorColors.set(clean, fallbackColor);
    return fallbackColor;
  }

  public getVendorProfiles(): { name: string; color: string }[] {
    const all = this.getKnownVendors();
    return all.map((name) => ({
      name,
      color: this.getVendorColor(name),
    }));
  }

  public async updateVendorColor(name: string, color: string): Promise<boolean> {
    const clean = name.trim();
    if (!clean) return false;

    this.vendorColors.set(clean, color);
    this.notify();

    try {
      const snap = await getDocs(collection(db, 'salesmen'));
      const updates: Promise<void>[] = [];
      let found = false;
      snap.forEach((docSnap) => {
        if (docSnap.data().name?.toLowerCase() === clean.toLowerCase()) {
          found = true;
          updates.push(updateDoc(docSnap.ref, { color }));
        }
      });
      if (!found) {
        const docId = clean.toLowerCase().replace(/[^a-z0-9]/g, '_');
        updates.push(setDoc(doc(db, 'salesmen', docId), {
          name: clean,
          color,
          createdAt: Date.now(),
        }, { merge: true }));
      }
      await Promise.all(updates);
      return true;
    } catch (e) {
      console.warn('Vendor color updated locally; Firestore sync pending:', e);
      return true;
    }
  }

  public async addVendor(name: string, color?: string): Promise<boolean> {
    const clean = name.trim();
    if (!clean || clean.toLowerCase() === 'kerion') return false;

    // Remove from removedVendors set
    this.removedVendors.delete(clean.toLowerCase());

    const assignedColor = color || this.getVendorColor(clean);
    this.vendorColors.set(clean, assignedColor);

    if (!this.salesmenList.some((n) => n.toLowerCase() === clean.toLowerCase())) {
      this.salesmenList.push(clean);
      this.salesmenList.sort();
      this.notify();
    }

    try {
      const docId = clean.toLowerCase().replace(/[^a-z0-9]/g, '_');
      await Promise.all([
        setDoc(
          doc(db, 'salesmen', docId),
          {
            name: clean,
            color: assignedColor,
            createdAt: Date.now(),
          },
          { merge: true }
        ),
        deleteDoc(doc(db, 'removed_vendors', docId)).catch(() => {}),
      ]);
      return true;
    } catch (e) {
      console.warn('Vendor saved locally; Firestore sync pending:', e);
      return true;
    }
  }

  public async addSalesman(name: string, color?: string): Promise<boolean> {
    return this.addVendor(name, color);
  }

  public async removeVendor(name: string): Promise<boolean> {
    const clean = name.trim();
    if (!clean) return false;

    this.removedVendors.add(clean.toLowerCase());
    this.salesmenList = this.salesmenList.filter((n) => n.toLowerCase() !== clean.toLowerCase());
    this.vendorColors.delete(clean);
    this.notify();

    try {
      const docId = clean.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const ops: Promise<void>[] = [];

      // 1. Mark as removed in Firestore removed_vendors so all other devices update immediately
      ops.push(
        setDoc(doc(db, 'removed_vendors', docId), {
          name: clean,
          removedAt: Date.now(),
        })
      );

      // 2. Delete document(s) in salesmen collection
      const snap = await getDocs(collection(db, 'salesmen'));
      snap.forEach((docSnap) => {
        const val = docSnap.data().name?.trim().toLowerCase();
        if (val === clean.toLowerCase() || docSnap.id === docId) {
          ops.push(deleteDoc(docSnap.ref));
        }
      });

      await Promise.all(ops);
      return true;
    } catch (e) {
      console.warn('Vendor removed locally; Firestore sync pending:', e);
      return true;
    }
  }

  public async removeSalesman(name: string): Promise<boolean> {
    return this.removeVendor(name);
  }

  // --- Sales Ledger Transactions (Cash, Card, or Traded Out) ---

  public async insertSale(input: {
    salesmanName: string;
    operatorName?: string;
    itemDescription: string;
    isMiscellaneous?: boolean;
    amount: number;
    originalAmount?: number;
    discountAmount?: number;
    discountLabel?: string;
    paymentMethod: PaymentMethod; // cash, card, traded_out, or online
    notes?: string;
    dateKey?: string;
    timestamp?: number;
    isOnlineSale?: boolean;
    onlineCardId?: string;
    onlineBarcode?: string;
    relatedHoldId?: string;
    storeCredit?: {
      customerId: string;
      amount: number;
    };
  }): Promise<SaleRecord> {
    const timestamp = input.timestamp || Date.now();
    const dateKey = input.dateKey || getLocalDateKey(new Date(timestamp));
    const id = 'sale_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    const isMiscellaneous = Boolean(input.isMiscellaneous) || input.itemDescription.trim().toLowerCase() === 'miscellaneous';
    const finalDescription = isMiscellaneous && !input.itemDescription.trim() ? 'Miscellaneous' : input.itemDescription.trim();
    const resolvedOperator = (input.operatorName ?? getDeviceOperator()).trim() || undefined;

    const paymentMethod: PaymentMethod = input.paymentMethod === 'cash'
      ? 'cash'
      : input.paymentMethod === 'traded_out'
      ? 'traded_out'
      : input.paymentMethod === 'online'
      ? 'online'
      : 'card';

    const isOnlineSale = Boolean(input.isOnlineSale) || paymentMethod === 'online';

    // Strict duplicate prevention: Do not allow scanned cards to duplicate in sales
    if (input.onlineCardId || input.onlineBarcode) {
      const match = Array.from(this.salesCache.values()).find(
        (s) =>
          (input.onlineCardId && s.onlineCardId === input.onlineCardId) ||
          (input.onlineBarcode && s.onlineBarcode && s.onlineBarcode.toLowerCase() === input.onlineBarcode.trim().toLowerCase())
      );
      if (match) {
        throw new Error(
          `Duplicate sale prevented: Card [${input.onlineBarcode || input.onlineCardId}] is already recorded in the sales ledger!`
        );
      }
    }

    let creditCustomer: StoreCreditCustomer | undefined;
    let creditUsedAmount: number | undefined;
    if (input.storeCredit && input.storeCredit.amount > 0) {
      creditCustomer = this.storeCreditCustomersCache.get(input.storeCredit.customerId);
      if (!creditCustomer) {
        throw new Error('Selected customer store credit account was not found.');
      }
      const reqPence = Math.round(input.storeCredit.amount * 100);
      const balPence = Math.round(creditCustomer.balance * 100);
      if (reqPence > balPence) {
        throw new Error(
          `Insufficient store credit for ${creditCustomer.name} (Available: £${creditCustomer.balance.toFixed(2)}).`
        );
      }
      creditUsedAmount = reqPence / 100;
    }

    const discountAmount =
      input.discountAmount && input.discountAmount > 0
        ? Math.round(Number(input.discountAmount) * 100) / 100
        : undefined;
    const originalAmount =
      discountAmount && input.originalAmount
        ? Math.round(Number(input.originalAmount) * 100) / 100
        : undefined;
    const discountLabel = discountAmount ? input.discountLabel?.trim() || `Discount (-£${discountAmount.toFixed(2)})` : undefined;

    const discountTag = discountLabel ? `Discount: ${discountLabel}` : '';
    const creditNoteTag = creditCustomer && creditUsedAmount
      ? `Store Credit (${creditCustomer.name}: £${creditUsedAmount.toFixed(2)})`
      : '';
    const combinedNotes = [discountTag, creditNoteTag, input.notes?.trim() || ''].filter(Boolean).join(' • ') || undefined;

    const record: SaleRecord = {
      id,
      salesmanName: input.salesmanName.trim(),
      operatorName: resolvedOperator,
      itemDescription: finalDescription,
      isMiscellaneous: isMiscellaneous ? true : undefined,
      amount: Math.round(Number(input.amount) * 100) / 100,
      originalAmount,
      discountAmount,
      discountLabel,
      paymentMethod,
      notes: combinedNotes,
      timestamp,
      dateKey,
      isOnlineSale: isOnlineSale ? true : undefined,
      onlineCardId: input.onlineCardId || undefined,
      onlineBarcode: input.onlineBarcode || undefined,
      storeCreditCustomerId: creditCustomer?.id,
      storeCreditCustomerName: creditCustomer?.name,
      storeCreditAmount: creditUsedAmount,
      relatedHoldId: input.relatedHoldId || undefined,
      splitSummary: creditCustomer && creditUsedAmount
        ? `Store Credit (${creditCustomer.name} £${creditUsedAmount.toFixed(2)})`
        : undefined,
    };

    // Store in cache & notify
    this.salesCache.set(id, record);

    // Deduct store credit if used
    if (creditCustomer && creditUsedAmount && creditUsedAmount > 0) {
      await this.adjustStoreCreditBalance({
        customerId: creditCustomer.id,
        type: 'redeem',
        delta: -creditUsedAmount,
        vendorName: record.salesmanName,
        description: `Redeemed on sale: ${record.itemDescription}`,
        relatedSaleId: id,
        dateKey,
        timestamp,
      });
    }

    // Determine if this >£100 transaction sets a new top single sale of the day
    const isTopSaleOfDay = this.isNewTopSaleForDay(dateKey, record.amount, id);

    // Play Mario coin sound (or escalating fanfare if > £100) immediately on this device and mark ID to avoid double-firing
    playCheckoutSound(false, id, record.amount);

    // Flash who the sale is for and how it was paid for 3 seconds (or escalating celebration if > £100)
    emitSaleFlash({
      id,
      vendorName: record.salesmanName,
      vendorColor: this.getVendorColor(record.salesmanName),
      paymentMethod: record.paymentMethod,
      itemDescription: record.itemDescription,
      amount: record.amount,
      isOver100: record.amount > 100,
      celebrationTier: getCelebrationTier(record.amount),
      isTopSaleOfDay,
      isSplit: Boolean(record.splitSummary),
      splitSummary: record.splitSummary,
    });

    if (!this.salesmenList.includes(record.salesmanName)) {
      this.salesmenList.push(record.salesmanName);
      this.salesmenList.sort();
    }

    this.notify();

    // Persist to Firestore
    try {
      await setDoc(doc(db, 'sales', id), {
        salesmanName: record.salesmanName,
        operatorName: record.operatorName || null,
        itemDescription: record.itemDescription,
        isMiscellaneous: record.isMiscellaneous || false,
        amount: record.amount,
        originalAmount: record.originalAmount || null,
        discountAmount: record.discountAmount || null,
        discountLabel: record.discountLabel || null,
        paymentMethod: record.paymentMethod,
        notes: record.notes || null,
        timestamp: record.timestamp,
        dateKey: record.dateKey,
        isOnlineSale: isOnlineSale,
        onlineCardId: input.onlineCardId || null,
        onlineBarcode: input.onlineBarcode || null,
        relatedHoldId: record.relatedHoldId || null,
        splitSummary: record.splitSummary || null,
        storeCreditCustomerId: record.storeCreditCustomerId || null,
        storeCreditCustomerName: record.storeCreditCustomerName || null,
        storeCreditAmount: record.storeCreditAmount || null,
      });
    } catch (e) {
      console.warn('Sale saved to memory/localStorage; Firestore sync pending:', e);
    }

    return record;
  }

  /**
   * Records a Multi-Item Basket and/or Split-Payment Checkout as penny-accurate SaleRecord legs.
   * Plays ONE unified checkout sound (Fanfare if combined total > £100) and emits ONE 3s flash banner across devices.
   */
  public async insertBasketCheckout(input: {
    items: BasketItemInput[];
    payments: SplitPaymentBreakdown;
    operatorName?: string;
    dateKey?: string;
    timestamp?: number;
    notes?: string;
    discount?: {
      label: string;
      amount: number;
      originalSubtotal: number;
    };
    storeCredit?: {
      customerId: string;
      amount: number;
    };
  }): Promise<SaleRecord[]> {
    if (!input.items || input.items.length === 0) {
      throw new Error('Cannot checkout an empty basket.');
    }

    const timestamp = input.timestamp || Date.now();
    const dateKey = input.dateKey || getLocalDateKey(new Date(timestamp));
    const checkoutGroupId = 'chk_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    const resolvedOperator = (input.operatorName ?? getDeviceOperator()).trim() || undefined;

    // 1. Validate items & online card duplicates
    const seenCardIds = new Set<string>();
    const rawItemPence: number[] = [];
    for (const item of input.items) {
      const pence = Math.round(Number(item.amount) * 100);
      if (isNaN(pence) || pence <= 0) {
        throw new Error(`Invalid price for item "${item.itemDescription}".`);
      }
      if (!item.salesmanName || !item.salesmanName.trim()) {
        throw new Error(`Missing vendor for item "${item.itemDescription}".`);
      }
      if (item.onlineCardId || item.onlineBarcode) {
        if (item.onlineCardId && seenCardIds.has(item.onlineCardId)) {
          throw new Error(`Card [${item.onlineBarcode || item.onlineCardId}] is already in this basket.`);
        }
        if (item.onlineCardId) seenCardIds.add(item.onlineCardId);
        if (
          (item.onlineBarcode && this.isOnlineCardAlreadySold(item.onlineBarcode)) ||
          (item.onlineCardId && this.isOnlineCardAlreadySold(item.onlineCardId))
        ) {
          throw new Error(
            `Duplicate sale prevented: Card [${item.onlineBarcode || item.onlineCardId}] is already sold!`
          );
        }
      }
      rawItemPence.push(pence);
    }

    const rawTotalPence = rawItemPence.reduce((a, b) => a + b, 0);
    const requestedDiscountPence =
      input.discount && input.discount.amount > 0
        ? Math.min(rawTotalPence - 1, Math.round(Number(input.discount.amount) * 100))
        : 0;

    // Proportionally distribute discount across items in integer pence (largest remainder)
    const itemDiscountPence = Array(rawItemPence.length).fill(0);
    if (requestedDiscountPence > 0 && rawTotalPence > 0) {
      const fracs: { idx: number; frac: number }[] = [];
      let assigned = 0;
      for (let i = 0; i < rawItemPence.length; i++) {
        const exact = (rawItemPence[i] * requestedDiscountPence) / rawTotalPence;
        const floored = Math.min(rawItemPence[i] - 1, Math.floor(exact));
        itemDiscountPence[i] = Math.max(0, floored);
        assigned += itemDiscountPence[i];
        fracs.push({ idx: i, frac: exact - floored });
      }
      fracs.sort((a, b) => b.frac - a.frac);
      let rem = requestedDiscountPence - assigned;
      let cursor = 0;
      while (rem > 0 && cursor < fracs.length * 3) {
        const targetIdx = fracs[cursor % fracs.length].idx;
        if (rawItemPence[targetIdx] - itemDiscountPence[targetIdx] > 1) {
          itemDiscountPence[targetIdx] += 1;
          rem -= 1;
        }
        cursor++;
      }
    }

    const itemPence = rawItemPence.map((p, i) => p - itemDiscountPence[i]);
    const totalPence = itemPence.reduce((a, b) => a + b, 0);
    const totalCheckoutAmount = Math.round(totalPence) / 100;
    const totalDiscountAppliedPence = itemDiscountPence.reduce((a, b) => a + b, 0);
    const discountLabel =
      totalDiscountAppliedPence > 0
        ? input.discount?.label?.trim() || `Discount (-£${(totalDiscountAppliedPence / 100).toFixed(2)})`
        : undefined;

    // 2. Validate payment breakdown in integer pence
    const orderedMethods: PaymentMethod[] = ['cash', 'card', 'online', 'traded_out'];
    const payPenceMap: Record<PaymentMethod, number> = {
      cash: Math.max(0, Math.round((Number(input.payments.cash) || 0) * 100)),
      card: Math.max(0, Math.round((Number(input.payments.card) || 0) * 100)),
      online: Math.max(0, Math.round((Number(input.payments.online) || 0) * 100)),
      traded_out: Math.max(0, Math.round((Number(input.payments.traded_out) || 0) * 100)),
    };

    const totalPayPence = orderedMethods.reduce((sum, m) => sum + payPenceMap[m], 0);
    if (totalPayPence !== totalPence) {
      throw new Error(
        `Split payment total (£${(totalPayPence / 100).toFixed(2)}) must match basket total (£${totalCheckoutAmount.toFixed(2)}).`
      );
    }

    const activeMethods = orderedMethods.filter((m) => payPenceMap[m] > 0);
    if (activeMethods.length === 0) {
      throw new Error('Select at least one payment method with an amount greater than £0.00.');
    }

    let creditCustomer: StoreCreditCustomer | undefined;
    let creditUsedAmount: number | undefined;
    if (input.storeCredit && input.storeCredit.amount > 0) {
      creditCustomer = this.storeCreditCustomersCache.get(input.storeCredit.customerId);
      if (!creditCustomer) {
        throw new Error('Selected customer store credit account was not found.');
      }
      const reqPence = Math.round(input.storeCredit.amount * 100);
      const balPence = Math.round(creditCustomer.balance * 100);
      if (reqPence > balPence) {
        throw new Error(
          `Insufficient store credit for ${creditCustomer.name} (Available: £${creditCustomer.balance.toFixed(2)}).`
        );
      }
      if (reqPence > payPenceMap.traded_out) {
        throw new Error(
          `Store credit amount (£${(reqPence / 100).toFixed(2)}) cannot exceed the Trade Out / Credit payment leg.`
        );
      }
      creditUsedAmount = reqPence / 100;
    }

    const isSplit = activeMethods.length > 1 || Boolean(creditCustomer && creditUsedAmount);
    const methodLabel = (m: PaymentMethod) =>
      m === 'cash'
        ? 'Cash'
        : m === 'card'
        ? 'Card'
        : m === 'online'
        ? 'Online'
        : creditCustomer && creditUsedAmount
        ? `Store Credit (${creditCustomer.name})`
        : 'Trade Out';

    const splitSummary =
      activeMethods.length > 1 || (creditCustomer && creditUsedAmount)
        ? activeMethods.map((m) => `${methodLabel(m)} £${(payPenceMap[m] / 100).toFixed(2)}`).join(' + ')
        : undefined;

    // 3. Allocate pence across (item, method) matrix with exact row & column sums
    const rows = input.items.length;
    const cols = activeMethods.length;
    const alloc: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));

    if (cols === 1) {
      for (let i = 0; i < rows; i++) {
        alloc[i][0] = itemPence[i];
      }
    } else if (rows === 1) {
      for (let c = 0; c < cols; c++) {
        alloc[0][c] = payPenceMap[activeMethods[c]];
      }
    } else {
      const frac: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));
      const rowSums = Array(rows).fill(0);
      const colSums = Array(cols).fill(0);

      for (let i = 0; i < rows; i++) {
        for (let c = 0; c < cols; c++) {
          const exact = (itemPence[i] * payPenceMap[activeMethods[c]]) / totalPence;
          const floored = Math.floor(exact);
          alloc[i][c] = floored;
          frac[i][c] = exact - floored;
          rowSums[i] += floored;
          colSums[c] += floored;
        }
      }

      const rowDeficit = itemPence.map((target, i) => target - rowSums[i]);
      const colDeficit = activeMethods.map((m, c) => payPenceMap[m] - colSums[c]);
      let remainingDeficit = rowDeficit.reduce((a, b) => a + b, 0);

      while (remainingDeficit > 0) {
        let bestI = -1;
        let bestC = -1;
        let bestFrac = -1;
        for (let i = 0; i < rows; i++) {
          if (rowDeficit[i] <= 0) continue;
          for (let c = 0; c < cols; c++) {
            if (colDeficit[c] <= 0) continue;
            if (frac[i][c] > bestFrac) {
              bestFrac = frac[i][c];
              bestI = i;
              bestC = c;
            }
          }
        }
        if (bestI === -1 || bestC === -1) break;
        alloc[bestI][bestC] += 1;
        rowDeficit[bestI] -= 1;
        colDeficit[bestC] -= 1;
        frac[bestI][bestC] = -1;
        remainingDeficit -= 1;
      }
    }

    // 4. Build unified flash metadata
    const uniqueVendors = Array.from(new Set(input.items.map((i) => i.salesmanName.trim()).filter(Boolean)));
    const primaryVendor = uniqueVendors[0] || 'Store';
    const checkoutVendorSummary =
      uniqueVendors.length > 2
        ? `${uniqueVendors[0]}, ${uniqueVendors[1]} +${uniqueVendors.length - 2}`
        : uniqueVendors.join(' & ');

    const firstItemLabel = input.items[0].isMiscellaneous
      ? 'Miscellaneous'
      : input.items[0].itemDescription.trim();
    const checkoutItemSummary =
      input.items.length === 1
        ? firstItemLabel
        : `${firstItemLabel} + ${input.items.length - 1} more`;

    // 5. Create SaleRecord legs & mark online cards sold
    const createdRecords: SaleRecord[] = [];
    const firestoreWrites: Promise<any>[] = [];
    const basketNotePrefix = input.items.length > 1 ? `Basket (${input.items.length} items)` : '';

    for (let i = 0; i < rows; i++) {
      const item = input.items[i];
      const vendor = item.salesmanName.trim();
      const isMisc = Boolean(item.isMiscellaneous) || item.itemDescription.trim().toLowerCase() === 'miscellaneous';
      const baseDesc = isMisc ? 'Miscellaneous' : item.itemDescription.trim();
      let cardLinkedToSale = false;

      if (!this.salesmenList.includes(vendor)) {
        this.salesmenList.push(vendor);
        this.salesmenList.sort();
      }

      // Compute leg discount split for this item
      const activeColsForItem = alloc[i]
        .map((p, cIdx) => ({ cIdx, p }))
        .filter((x) => x.p > 0);
      const itemDiscP = itemDiscountPence[i] || 0;
      const itemNetP = itemPence[i] || 1;
      let discAssigned = 0;

      for (let k = 0; k < activeColsForItem.length; k++) {
        const { cIdx: c, p: legPence } = activeColsForItem[k];
        const isLastLegOfItem = k === activeColsForItem.length - 1;
        const legDiscPence =
          itemDiscP > 0
            ? isLastLegOfItem
              ? itemDiscP - discAssigned
              : Math.round((legPence * itemDiscP) / itemNetP)
            : 0;
        discAssigned += legDiscPence;

        const method = activeMethods[c];
        const legAmount = Math.round(legPence) / 100;
        const legDiscountAmount = legDiscPence > 0 ? legDiscPence / 100 : undefined;
        const legOriginalAmount = legDiscPence > 0 ? (legPence + legDiscPence) / 100 : undefined;
        const id = 'sale_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

        const attachCreditInfo = Boolean(creditCustomer && creditUsedAmount && method === 'traded_out');
        const noteParts = [
          discountLabel ? `Discount: ${discountLabel}` : '',
          attachCreditInfo ? `Store Credit (${creditCustomer!.name})` : '',
          splitSummary ? `Split (${splitSummary})` : '',
          basketNotePrefix,
          item.notes?.trim() || '',
          input.notes?.trim() || '',
        ].filter(Boolean);
        const combinedNotes = noteParts.length > 0 ? noteParts.join(' • ') : undefined;

        const attachCard = Boolean(item.onlineCardId && !cardLinkedToSale);
        if (attachCard) cardLinkedToSale = true;

        const isOnlineSale = method === 'online' || Boolean(attachCard && item.onlineCardId);

        const record: SaleRecord = {
          id,
          salesmanName: vendor,
          operatorName: resolvedOperator,
          itemDescription: baseDesc,
          isMiscellaneous: isMisc ? true : undefined,
          amount: legAmount,
          originalAmount: legOriginalAmount,
          discountAmount: legDiscountAmount,
          discountLabel,
          paymentMethod: method,
          notes: combinedNotes,
          timestamp: timestamp + createdRecords.length,
          dateKey,
          isOnlineSale: isOnlineSale ? true : undefined,
          onlineCardId: attachCard ? item.onlineCardId : undefined,
          onlineBarcode: attachCard ? item.onlineBarcode : undefined,
          checkoutGroupId,
          checkoutTotalAmount: totalCheckoutAmount,
          splitSummary,
          basketItemCount: input.items.length,
          checkoutVendorSummary,
          checkoutItemSummary,
          storeCreditCustomerId: attachCreditInfo ? creditCustomer!.id : undefined,
          storeCreditCustomerName: attachCreditInfo ? creditCustomer!.name : undefined,
          storeCreditAmount: attachCreditInfo ? creditUsedAmount : undefined,
        };

        this.salesCache.set(id, record);
        createdRecords.push(record);

        firestoreWrites.push(
          setDoc(doc(db, 'sales', id), {
            salesmanName: record.salesmanName,
            operatorName: record.operatorName || null,
            itemDescription: record.itemDescription,
            isMiscellaneous: record.isMiscellaneous || false,
            amount: record.amount,
            originalAmount: record.originalAmount || null,
            discountAmount: record.discountAmount || null,
            discountLabel: record.discountLabel || null,
            paymentMethod: record.paymentMethod,
            notes: record.notes || null,
            timestamp: record.timestamp,
            dateKey: record.dateKey,
            isOnlineSale: Boolean(record.isOnlineSale),
            onlineCardId: record.onlineCardId || null,
            onlineBarcode: record.onlineBarcode || null,
            checkoutGroupId,
            checkoutTotalAmount: totalCheckoutAmount,
            splitSummary: splitSummary || null,
            basketItemCount: input.items.length,
            checkoutVendorSummary,
            checkoutItemSummary,
            storeCreditCustomerId: record.storeCreditCustomerId || null,
            storeCreditCustomerName: record.storeCreditCustomerName || null,
            storeCreditAmount: record.storeCreditAmount || null,
          })
        );

        // If this leg carries the scanned online card, mark card as sold
        if (attachCard && item.onlineCardId) {
          const card = this.onlineCardsCache.get(item.onlineCardId);
          if (card) {
            const updatedCard: OnlineCard = {
              ...card,
              status: 'sold',
              soldAt: timestamp,
              soldDateKey: dateKey,
              saleId: id,
              soldPaymentMethod: method,
            };
            this.onlineCardsCache.set(card.id, updatedCard);
            firestoreWrites.push(
              updateDoc(doc(db, 'online_cards', card.id), {
                status: 'sold',
                soldAt: timestamp,
                soldDateKey: dateKey,
                saleId: id,
                soldPaymentMethod: method,
              })
            );
          }
        }
      }
    }

    // Deduct store credit if used in this checkout
    if (creditCustomer && creditUsedAmount && creditUsedAmount > 0) {
      await this.adjustStoreCreditBalance({
        customerId: creditCustomer.id,
        type: 'redeem',
        delta: -creditUsedAmount,
        vendorName: checkoutVendorSummary,
        description: `Redeemed at checkout: ${checkoutItemSummary}`,
        relatedCheckoutGroupId: checkoutGroupId,
        dateKey,
        timestamp,
      });
    }

    // Determine if this >£100 checkout sets a new top single sale of the day
    const isTopSaleOfDay = this.isNewTopSaleForDay(dateKey, totalCheckoutAmount, checkoutGroupId);

    // Play sound ONCE for the combined checkout total (Escalating Fanfare if > £100!) & flash unified banner
    playCheckoutSound(false, checkoutGroupId, totalCheckoutAmount);
    emitSaleFlash({
      id: checkoutGroupId,
      vendorName: checkoutVendorSummary,
      vendorColor: this.getVendorColor(primaryVendor),
      paymentMethod: activeMethods[0],
      itemDescription: checkoutItemSummary,
      amount: totalCheckoutAmount,
      isOver100: totalCheckoutAmount > 100,
      celebrationTier: getCelebrationTier(totalCheckoutAmount),
      isTopSaleOfDay,
      isSplit,
      splitSummary,
      basketItemCount: input.items.length,
    });

    this.notify();

    try {
      await Promise.all(firestoreWrites);
    } catch (e) {
      console.warn('Checkout saved locally; Firestore sync pending:', e);
    }

    return createdRecords;
  }

  /**
   * Returns true if `amount` (> £100) beats the highest single transaction / checkout recorded so far on `dateKey`,
   * excluding the current sale ID or checkoutGroupId.
   */
  private isNewTopSaleForDay(dateKey: string, amount: number, excludeIdOrGroup?: string): boolean {
    if (!(amount > 100)) return false;

    const groupedTotals = new Map<string, number>();
    for (const sale of this.salesCache.values()) {
      if (sale.dateKey !== dateKey) continue;
      if (excludeIdOrGroup && (sale.id === excludeIdOrGroup || sale.checkoutGroupId === excludeIdOrGroup)) {
        continue;
      }
      const key = sale.checkoutGroupId || sale.id;
      groupedTotals.set(key, (groupedTotals.get(key) || 0) + (Number(sale.amount) || 0));
    }

    let previousMax = 0;
    for (const total of groupedTotals.values()) {
      if (total > previousMax) previousMax = total;
    }

    return amount > previousMax;
  }

  public async updateSale(id: string, updates: Partial<Omit<SaleRecord, 'id'>>) {
    const existing = this.salesCache.get(id);
    if (!existing) return;

    const isMisc = updates.isMiscellaneous !== undefined
      ? updates.isMiscellaneous
      : (updates.itemDescription !== undefined ? updates.itemDescription.trim().toLowerCase() === 'miscellaneous' : existing.isMiscellaneous);

    let updatedPaymentMethod = existing.paymentMethod;
    if (updates.paymentMethod !== undefined) {
      updatedPaymentMethod = updates.paymentMethod === 'cash'
        ? 'cash'
        : updates.paymentMethod === 'traded_out'
        ? 'traded_out'
        : updates.paymentMethod === 'online'
        ? 'online'
        : 'card';
    }

    const updated: SaleRecord = {
      ...existing,
      ...updates,
      salesmanName: updates.salesmanName !== undefined ? updates.salesmanName.trim() : existing.salesmanName,
      itemDescription: updates.itemDescription !== undefined ? updates.itemDescription.trim() : existing.itemDescription,
      isMiscellaneous: isMisc,
      amount: updates.amount !== undefined ? Math.round(Number(updates.amount) * 100) / 100 : existing.amount,
      paymentMethod: updatedPaymentMethod,
      notes: updates.notes !== undefined ? (updates.notes ? updates.notes.trim() : undefined) : existing.notes,
      isOnlineSale: updates.isOnlineSale !== undefined ? updates.isOnlineSale : existing.isOnlineSale,
      onlineCardId: updates.onlineCardId !== undefined ? updates.onlineCardId : existing.onlineCardId,
      onlineBarcode: updates.onlineBarcode !== undefined ? updates.onlineBarcode : existing.onlineBarcode,
    };

    this.salesCache.set(id, updated);
    this.notify();

    try {
      const firestoreUpdates: Record<string, any> = {};
      if (updates.salesmanName !== undefined) firestoreUpdates.salesmanName = updates.salesmanName.trim();
      if (updates.itemDescription !== undefined) firestoreUpdates.itemDescription = updates.itemDescription.trim();
      if (updates.isMiscellaneous !== undefined) firestoreUpdates.isMiscellaneous = updates.isMiscellaneous;
      if (updates.amount !== undefined) firestoreUpdates.amount = Math.round(Number(updates.amount) * 100) / 100;
      if (updates.paymentMethod !== undefined) firestoreUpdates.paymentMethod = updatedPaymentMethod;
      if (updates.notes !== undefined) firestoreUpdates.notes = updates.notes ? updates.notes.trim() : null;
      if (updates.dateKey !== undefined) firestoreUpdates.dateKey = updates.dateKey;
      if (updates.isOnlineSale !== undefined) firestoreUpdates.isOnlineSale = updates.isOnlineSale;
      if (updates.onlineCardId !== undefined) firestoreUpdates.onlineCardId = updates.onlineCardId;
      if (updates.onlineBarcode !== undefined) firestoreUpdates.onlineBarcode = updates.onlineBarcode;

      await updateDoc(doc(db, 'sales', id), firestoreUpdates);
    } catch (e) {
      console.warn('Updated locally; Firestore sync pending:', e);
    }
  }

  public async deleteSale(id: string) {
    const existing = this.salesCache.get(id);
    this.salesCache.delete(id);

    // If this sale was linked to an online inventory card, revert card back to available stock
    if (existing?.onlineCardId) {
      const card = this.onlineCardsCache.get(existing.onlineCardId);
      if (card && card.status === 'sold' && (card.saleId === id || !card.saleId)) {
        const revertedCard: OnlineCard = {
          ...card,
          status: 'available',
          soldAt: undefined,
          soldDateKey: undefined,
          saleId: undefined,
          soldPaymentMethod: undefined,
        };
        this.onlineCardsCache.set(card.id, revertedCard);
        updateDoc(doc(db, 'online_cards', card.id), {
          status: 'available',
          soldAt: null,
          soldDateKey: null,
          saleId: null,
          soldPaymentMethod: null,
        }).catch((e) => console.warn('Could not revert card status in Firestore:', e));
      }
    } else if (existing?.onlineBarcode) {
      const card = this.getOnlineCardByBarcode(existing.onlineBarcode);
      if (card && card.status === 'sold') {
        const revertedCard: OnlineCard = {
          ...card,
          status: 'available',
          soldAt: undefined,
          soldDateKey: undefined,
          saleId: undefined,
          soldPaymentMethod: undefined,
        };
        this.onlineCardsCache.set(card.id, revertedCard);
        updateDoc(doc(db, 'online_cards', card.id), {
          status: 'available',
          soldAt: null,
          soldDateKey: null,
          saleId: null,
          soldPaymentMethod: null,
        }).catch((e) => console.warn('Could not revert card status in Firestore:', e));
      }
    }

    // Reverse any linked Store Credit redemption transaction when sale is deleted
    if (existing?.storeCreditCustomerId) {
      const remainingGroupLegs = existing.checkoutGroupId
        ? Array.from(this.salesCache.values()).some((s) => s.checkoutGroupId === existing.checkoutGroupId)
        : false;
      if (!remainingGroupLegs) {
        await this.removeLinkedStoreCreditTransactions({
          relatedSaleId: id,
          relatedCheckoutGroupId: existing.checkoutGroupId,
        });
      }
    }

    this.notify();

    try {
      await deleteDoc(doc(db, 'sales', id));
    } catch (e) {
      console.warn('Deleted locally; Firestore sync pending:', e);
    }
  }

  // --- Dedicated Trades Ledger (Cards Traded in for Cash or Credit) ---

  public async insertTrade(input: {
    vendorName: string;
    operatorName?: string;
    itemDescription: string;
    tradeValue: number;
    tradeType: TradeType; // 'cash' or 'credit'
    customerName?: string;
    customerPhone?: string;
    addToStoreCredit?: boolean;
    notes?: string;
    dateKey?: string;
    timestamp?: number;
  }): Promise<TradeRecord> {
    const timestamp = input.timestamp || Date.now();
    const dateKey = input.dateKey || getLocalDateKey(new Date(timestamp));
    const cleanVendor = input.vendorName.trim();
    const resolvedOperator = (input.operatorName ?? getDeviceOperator()).trim() || undefined;
    const cleanItem = input.itemDescription.trim();
    const val = Math.round(Number(input.tradeValue) * 100) / 100;
    const tradeType: TradeType = input.tradeType === 'cash' ? 'cash' : 'credit';
    const cleanCustomer = input.customerName?.trim() || undefined;

    const id = `trade_${timestamp}_${Math.random().toString(36).slice(2, 7)}`;
    let linkedCustomerId: string | undefined;

    // Automatically issue customer store credit when a credit trade includes a customer name
    const shouldAddStoreCredit =
      tradeType === 'credit' &&
      Boolean(cleanCustomer) &&
      val > 0 &&
      input.addToStoreCredit !== false;

    if (shouldAddStoreCredit && cleanCustomer) {
      const res = await this.adjustStoreCreditBalance({
        customerName: cleanCustomer,
        phone: input.customerPhone?.trim() || undefined,
        type: 'issue',
        delta: val,
        vendorName: cleanVendor,
        description: `Trade-In Credit: ${cleanItem}`,
        relatedTradeId: id,
        dateKey,
        timestamp,
      });
      linkedCustomerId = res.customer.id;
    }

    const record: TradeRecord = {
      id,
      vendorName: cleanVendor,
      operatorName: resolvedOperator,
      itemDescription: cleanItem,
      tradeValue: isNaN(val) ? 0 : val,
      tradeType,
      customerName: cleanCustomer,
      storeCreditCustomerId: linkedCustomerId,
      notes: input.notes?.trim() || undefined,
      dateKey,
      timestamp,
      isStandalone: true,
    };

    this.tradesCache.set(id, record);

    if (cleanVendor && !this.salesmenList.includes(cleanVendor)) {
      this.salesmenList.push(cleanVendor);
      this.salesmenList.sort();
    }

    this.notify();

    try {
      await setDoc(doc(db, 'trades', id), {
        vendorName: record.vendorName,
        operatorName: record.operatorName || null,
        itemDescription: record.itemDescription,
        tradeValue: record.tradeValue,
        tradeType: record.tradeType,
        customerName: record.customerName || null,
        storeCreditCustomerId: record.storeCreditCustomerId || null,
        notes: record.notes || null,
        dateKey: record.dateKey,
        timestamp: record.timestamp,
      });
    } catch (e) {
      console.warn('Trade saved to memory/localStorage; Firestore sync pending:', e);
    }

    return record;
  }

  public async updateTrade(id: string, updates: Partial<Omit<TradeRecord, 'id'>>) {
    const existing = this.tradesCache.get(id);
    if (!existing) return;

    const updated: TradeRecord = {
      ...existing,
      ...updates,
      vendorName: updates.vendorName !== undefined ? updates.vendorName.trim() : existing.vendorName,
      itemDescription: updates.itemDescription !== undefined ? updates.itemDescription.trim() : existing.itemDescription,
      tradeValue: updates.tradeValue !== undefined ? Math.round(Number(updates.tradeValue) * 100) / 100 : existing.tradeValue,
      tradeType: updates.tradeType ? (updates.tradeType === 'cash' ? 'cash' : 'credit') : existing.tradeType,
      customerName: updates.customerName !== undefined ? (updates.customerName ? updates.customerName.trim() : undefined) : existing.customerName,
      notes: updates.notes !== undefined ? (updates.notes ? updates.notes.trim() : undefined) : existing.notes,
    };

    // Keep linked store credit in sync when a trade is edited
    const hadLinkedTx = Array.from(this.storeCreditTxCache.values()).some((tx) => tx.relatedTradeId === id);
    if (hadLinkedTx) {
      await this.removeLinkedStoreCreditTransactions({ relatedTradeId: id });
      updated.storeCreditCustomerId = undefined;
    }
    if (updated.tradeType === 'credit' && updated.customerName && updated.tradeValue > 0) {
      const res = await this.adjustStoreCreditBalance({
        customerName: updated.customerName,
        type: 'issue',
        delta: updated.tradeValue,
        vendorName: updated.vendorName,
        description: `Trade-In Credit: ${updated.itemDescription}`,
        relatedTradeId: id,
        dateKey: updated.dateKey,
        timestamp: updated.timestamp,
      });
      updated.storeCreditCustomerId = res.customer.id;
    }

    this.tradesCache.set(id, updated);
    this.notify();

    try {
      const firestoreUpdates: Record<string, any> = {};
      if (updates.vendorName !== undefined) firestoreUpdates.vendorName = updates.vendorName.trim();
      if (updates.itemDescription !== undefined) firestoreUpdates.itemDescription = updates.itemDescription.trim();
      if (updates.tradeValue !== undefined) firestoreUpdates.tradeValue = Math.round(Number(updates.tradeValue) * 100) / 100;
      if (updates.tradeType !== undefined) firestoreUpdates.tradeType = updates.tradeType;
      if (updates.customerName !== undefined) firestoreUpdates.customerName = updates.customerName ? updates.customerName.trim() : null;
      if (updates.notes !== undefined) firestoreUpdates.notes = updates.notes ? updates.notes.trim() : null;
      if (updates.dateKey !== undefined) firestoreUpdates.dateKey = updates.dateKey;
      firestoreUpdates.storeCreditCustomerId = updated.storeCreditCustomerId || null;

      await updateDoc(doc(db, 'trades', id), firestoreUpdates);
    } catch (e) {
      console.warn('Trade updated locally; Firestore sync pending:', e);
    }
  }

  public async deleteTrade(id: string) {
    this.tradesCache.delete(id);
    await this.removeLinkedStoreCreditTransactions({ relatedTradeId: id });
    this.notify();

    try {
      await deleteDoc(doc(db, 'trades', id));
    } catch (e) {
      console.warn('Trade deleted locally; Firestore sync pending:', e);
    }
  }

  public getTradesForDay(dateKey: string): TradeRecord[] {
    const list: TradeRecord[] = [];
    this.tradesCache.forEach((trade) => {
      if (trade.dateKey === dateKey) {
        list.push(trade);
      }
    });

    return list.sort((a, b) => b.timestamp - a.timestamp);
  }

  public getDailyTradeSummary(dateKey: string): TradeDaySummary {
    const trades = this.getTradesForDay(dateKey);
    let totalTradeValue = 0;
    let cashTradeValue = 0;
    let cashTradeCount = 0;
    let creditTradeValue = 0;
    let creditTradeCount = 0;

    const vendorMap = new Map<
      string,
      {
        totalVal: number;
        count: number;
        cashVal: number;
        cashCount: number;
        creditVal: number;
        creditCount: number;
      }
    >();

    for (const t of trades) {
      totalTradeValue += t.tradeValue;

      const isCash = t.tradeType === 'cash';
      if (isCash) {
        cashTradeValue += t.tradeValue;
        cashTradeCount++;
      } else {
        creditTradeValue += t.tradeValue;
        creditTradeCount++;
      }

      const existing = vendorMap.get(t.vendorName) || {
        totalVal: 0,
        count: 0,
        cashVal: 0,
        cashCount: 0,
        creditVal: 0,
        creditCount: 0,
      };

      existing.totalVal += t.tradeValue;
      existing.count += 1;
      if (isCash) {
        existing.cashVal += t.tradeValue;
        existing.cashCount += 1;
      } else {
        existing.creditVal += t.tradeValue;
        existing.creditCount += 1;
      }
      vendorMap.set(t.vendorName, existing);
    }

    const vendorStats: TradeVendorStat[] = Array.from(vendorMap.entries()).map(([vendorName, data]) => ({
      vendorName,
      color: this.getVendorColor(vendorName),
      totalTradeValue: Math.round(data.totalVal * 100) / 100,
      tradeCount: data.count,
      cashTradeValue: Math.round(data.cashVal * 100) / 100,
      cashTradeCount: data.cashCount,
      creditTradeValue: Math.round(data.creditVal * 100) / 100,
      creditTradeCount: data.creditCount,
    })).sort((a, b) => b.totalTradeValue - a.totalTradeValue);

    const totalCount = trades.length;
    const averageTradeValue = totalCount > 0 ? Math.round((totalTradeValue / totalCount) * 100) / 100 : 0;

    return {
      dateKey,
      totalTradeValue: Math.round(totalTradeValue * 100) / 100,
      totalCount,
      cashTradeValue: Math.round(cashTradeValue * 100) / 100,
      cashTradeCount,
      creditTradeValue: Math.round(creditTradeValue * 100) / 100,
      creditTradeCount,
      averageTradeValue,
      topVendor: vendorStats[0],
      vendorStats,
    };
  }

  public exportTradesToCsv(dateKey: string, vendorName?: string): string {
    const list = this.getTradesForDay(dateKey);
    const filterVendor = vendorName?.trim().toLowerCase();
    const filtered = filterVendor ? list.filter((t) => t.vendorName.toLowerCase() === filterVendor) : list;

    const headers = [
      'Trade ID',
      'Date',
      'Time',
      'Vendor Taking In Cards',
      'Rang By (Operator)',
      'Cards / Item Traded In',
      'Trade Valuation (£) [Before Commission]',
      'Traded In For',
      'Customer Name',
      'Notes',
    ];

    const rows = filtered.map((t) => {
      const time = new Date(t.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });

      const escape = (val: string | number | undefined | null) => {
        if (val === undefined || val === null) return '""';
        const s = String(val).replace(/"/g, '""');
        return `"${s}"`;
      };

      return [
        escape(t.id),
        escape(t.dateKey),
        escape(time),
        escape(t.vendorName),
        escape(t.operatorName || ''),
        escape(t.itemDescription),
        t.tradeValue.toFixed(2),
        escape(t.tradeType === 'cash' ? 'Cash Payout' : "Vendor's Credit"),
        escape(t.customerName || ''),
        escape(t.notes || ''),
      ].join(',');
    });

    return [
      `# DISCLAIMER: All figures are gross valuations before commission reductions`,
      headers.join(','),
      ...rows,
    ].join('\n');
  }

  // --- Sales Retrieval & Daily Summary ---

  public getSalesForDay(dateKey: string): SaleRecord[] {
    const list: SaleRecord[] = [];
    this.salesCache.forEach((rec) => {
      if (rec.dateKey === dateKey) {
        list.push(rec);
      }
    });
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }

  public getAllSales(): SaleRecord[] {
    return Array.from(this.salesCache.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  public exportSalesListToCsv(salesList: SaleRecord[]): string {
    const headers = [
      'Sale ID',
      'Date',
      'Time',
      'Vendor',
      'Rang By (Operator)',
      'Description',
      'Amount (£)',
      'Discount (£)',
      'Discount Label',
      'Payment Method',
      'Channel',
      'Barcode',
      'Notes',
    ];

    const rows = salesList.map((s) => {
      const time = new Date(s.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });

      const escape = (val: string | number | undefined | null) => {
        if (val === undefined || val === null) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      return [
        escape(s.id),
        escape(s.dateKey),
        escape(time),
        escape(s.salesmanName),
        escape(s.operatorName || ''),
        escape(s.itemDescription),
        s.amount.toFixed(2),
        s.discountAmount ? s.discountAmount.toFixed(2) : '0.00',
        escape(s.discountLabel || ''),
        escape(s.paymentMethod),
        escape(s.isOnlineSale || s.paymentMethod === 'online' ? 'Online' : 'In-Person'),
        escape(s.onlineBarcode || ''),
        escape(s.notes || ''),
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  public getVendorLeaderboard(options: {
    period: 'weekly' | 'monthly' | 'all-time';
    dateKey?: string;
  }): VendorLeaderboardSummary {
    const allSales = this.getAllSales();
    const period = options.period;
    let startDateKey: string | undefined = undefined;
    let endDateKey: string | undefined = undefined;
    let periodLabel = 'All-Time Sales History';

    if (period === 'weekly') {
      const weekInfo = getWeekRangeInfo(options.dateKey || getLocalDateKey());
      startDateKey = weekInfo.startDateKey;
      endDateKey = weekInfo.endDateKey;
      periodLabel = `Week ${weekInfo.weekNumber} (${weekInfo.startDisplay} – ${weekInfo.endDisplay})`;
    } else if (period === 'monthly') {
      const refKey = options.dateKey || getLocalDateKey();
      const [y, m] = refKey.split('-').map(Number);
      const startD = new Date(y, m - 1, 1);
      const endD = new Date(y, m, 0);
      startDateKey = getLocalDateKey(startD);
      endDateKey = getLocalDateKey(endD);
      periodLabel = startD.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    }

    const filteredSales = allSales.filter((s) => {
      if (startDateKey && s.dateKey < startDateKey) return false;
      if (endDateKey && s.dateKey > endDateKey) return false;
      return true;
    });

    let totalPeriodRevenue = 0;
    const vendorMap = new Map<string, {
      totalAmount: number;
      count: number;
      cashAmount: number;
      cashCount: number;
      cardAmount: number;
      cardCount: number;
      onlineAmount: number;
      onlineCount: number;
      tradedOutAmount: number;
      tradedOutCount: number;
      topSaleAmount: number;
      topSaleDescription: string;
    }>();

    // Initialize all known vendors
    const known = this.getKnownVendors();
    for (const v of known) {
      vendorMap.set(v.toLowerCase(), {
        totalAmount: 0,
        count: 0,
        cashAmount: 0,
        cashCount: 0,
        cardAmount: 0,
        cardCount: 0,
        onlineAmount: 0,
        onlineCount: 0,
        tradedOutAmount: 0,
        tradedOutCount: 0,
        topSaleAmount: 0,
        topSaleDescription: '',
      });
    }

    for (const s of filteredSales) {
      totalPeriodRevenue += s.amount;
      const key = s.salesmanName.trim().toLowerCase();
      let stat = vendorMap.get(key);
      if (!stat) {
        stat = {
          totalAmount: 0,
          count: 0,
          cashAmount: 0,
          cashCount: 0,
          cardAmount: 0,
          cardCount: 0,
          onlineAmount: 0,
          onlineCount: 0,
          tradedOutAmount: 0,
          tradedOutCount: 0,
          topSaleAmount: 0,
          topSaleDescription: '',
        };
        vendorMap.set(key, stat);
      }

      stat.totalAmount += s.amount;
      stat.count += 1;

      if (s.amount > stat.topSaleAmount) {
        stat.topSaleAmount = s.amount;
        stat.topSaleDescription = s.itemDescription;
      }

      if (s.paymentMethod === 'cash') {
        stat.cashAmount += s.amount;
        stat.cashCount += 1;
      } else if (s.paymentMethod === 'traded_out') {
        stat.tradedOutAmount += s.amount;
        stat.tradedOutCount += 1;
      } else if (s.paymentMethod === 'online' || s.isOnlineSale) {
        stat.onlineAmount += s.amount;
        stat.onlineCount += 1;
      } else {
        stat.cardAmount += s.amount;
        stat.cardCount += 1;
      }
    }

    // Convert map to leaderboard entries
    const entries: VendorLeaderboardEntry[] = [];
    vendorMap.forEach((stat, key) => {
      const matchingKnown = known.find((k) => k.toLowerCase() === key);
      const name = matchingKnown || (key.charAt(0).toUpperCase() + key.slice(1));
      const percentage = totalPeriodRevenue > 0 ? (stat.totalAmount / totalPeriodRevenue) * 100 : 0;
      const averageTicket = stat.count > 0 ? stat.totalAmount / stat.count : 0;

      entries.push({
        rank: 0,
        vendorName: name,
        color: this.getVendorColor(name),
        totalRevenue: Math.round(stat.totalAmount * 100) / 100,
        salesCount: stat.count,
        averageTicket: Math.round(averageTicket * 100) / 100,
        cashRevenue: Math.round(stat.cashAmount * 100) / 100,
        cashCount: stat.cashCount,
        cardRevenue: Math.round(stat.cardAmount * 100) / 100,
        cardCount: stat.cardCount,
        onlineRevenue: Math.round(stat.onlineAmount * 100) / 100,
        onlineCount: stat.onlineCount,
        tradedOutRevenue: Math.round(stat.tradedOutAmount * 100) / 100,
        tradedOutCount: stat.tradedOutCount,
        percentageOfTotal: Math.round(percentage * 10) / 10,
        topSaleAmount: stat.topSaleAmount > 0 ? Math.round(stat.topSaleAmount * 100) / 100 : undefined,
        topSaleDescription: stat.topSaleDescription || undefined,
      });
    });

    // Sort by revenue descending, then by sales count descending
    entries.sort((a, b) => {
      if (b.totalRevenue !== a.totalRevenue) return b.totalRevenue - a.totalRevenue;
      return b.salesCount - a.salesCount;
    });

    // Assign rank
    entries.forEach((e, idx) => {
      e.rank = idx + 1;
    });

    const activeVendorsCount = entries.filter((e) => e.salesCount > 0).length;
    const totalSalesCount = filteredSales.length;
    const averageTicket = totalSalesCount > 0 ? totalPeriodRevenue / totalSalesCount : 0;

    return {
      periodType: period,
      periodLabel,
      startDateKey,
      endDateKey,
      totalRevenue: Math.round(totalPeriodRevenue * 100) / 100,
      totalSalesCount,
      averageTicket: Math.round(averageTicket * 100) / 100,
      activeVendorsCount,
      leader: entries.length > 0 && entries[0].totalRevenue > 0 ? entries[0] : undefined,
      entries,
    };
  }

  public exportLeaderboardToCsv(leaderboard: VendorLeaderboardSummary): string {
    const headers = [
      'Rank',
      'Vendor',
      'Total Sales (£)',
      'Share of Store Sales (%)',
      'Number of Sales',
      'Average Sale (£)',
      'Cash Sales (£)',
      'Card Sales (£)',
      'Online Sales (£)',
      'Traded Out Sales (£)',
      'Top Sale Amount (£)',
      'Top Sale Description',
    ];

    const rows = leaderboard.entries.map((e) => {
      const escape = (val: string | number | undefined | null) => {
        if (val === undefined || val === null) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      return [
        e.rank,
        escape(e.vendorName),
        e.totalRevenue.toFixed(2),
        `${e.percentageOfTotal}%`,
        e.salesCount,
        e.averageTicket.toFixed(2),
        e.cashRevenue.toFixed(2),
        e.cardRevenue.toFixed(2),
        e.onlineRevenue.toFixed(2),
        e.tradedOutRevenue.toFixed(2),
        e.topSaleAmount ? e.topSaleAmount.toFixed(2) : '0.00',
        escape(e.topSaleDescription || 'N/A'),
      ].join(',');
    });

    const titleLine = `# Vendor Leaderboard: ${leaderboard.periodLabel} (Total: £${leaderboard.totalRevenue.toFixed(2)}, ${leaderboard.totalSalesCount} sales)`;

    return [titleLine, headers.join(','), ...rows].join('\n');
  }

  public getSalesTrendLastDays(days = 30, endDateKey?: string): DailySalesTrendPoint[] {
    const refKey = endDateKey || getLocalDateKey();
    const [endY, endM, endD] = refKey.split('-').map(Number);
    const endDate = new Date(endY, endM - 1, endD);

    const dailyTotals = new Map<string, { revenue: number; count: number }>();
    this.salesCache.forEach((sale) => {
      const existing = dailyTotals.get(sale.dateKey) || { revenue: 0, count: 0 };
      existing.revenue += sale.amount;
      existing.count += 1;
      dailyTotals.set(sale.dateKey, existing);
    });

    const points: DailySalesTrendPoint[] = [];
    for (let offset = days - 1; offset >= 0; offset--) {
      const d = new Date(endDate);
      d.setDate(endDate.getDate() - offset);
      const dateKey = getLocalDateKey(d);
      const totals = dailyTotals.get(dateKey);

      points.push({
        dateKey,
        shortDate: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        fullDate: d.toLocaleDateString('en-GB', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
        totalRevenue: totals ? Math.round(totals.revenue * 100) / 100 : 0,
        salesCount: totals ? totals.count : 0,
      });
    }

    return points;
  }

  public getAvailableDateKeys(): string[] {
    const today = getLocalDateKey();
    const set = new Set<string>();
    set.add(today);
    this.salesCache.forEach((rec) => {
      set.add(rec.dateKey);
    });
    this.tradesCache.forEach((rec) => {
      set.add(rec.dateKey);
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }

  public getDailySummary(dateKey: string): DaySummary {
    const sales = this.getSalesForDay(dateKey);
    let totalRevenue = 0;
    let cashRevenue = 0;
    let cashCount = 0;
    let cardRevenue = 0;
    let cardCount = 0;
    let onlineRevenue = 0;
    let onlineCount = 0;
    let tradedOutRevenue = 0;
    let tradedOutCount = 0;

    const salesmanMap = new Map<string, SalesmanStat>();

    for (const sale of sales) {
      totalRevenue += sale.amount;

      if (sale.paymentMethod === 'cash') {
        cashRevenue += sale.amount;
        cashCount++;
      } else if (sale.paymentMethod === 'traded_out') {
        tradedOutRevenue += sale.amount;
        tradedOutCount++;
      } else if (sale.paymentMethod === 'online' || sale.isOnlineSale) {
        onlineRevenue += sale.amount;
        onlineCount++;
      } else {
        cardRevenue += sale.amount;
        cardCount++;
      }

      let stat = salesmanMap.get(sale.salesmanName);
      if (!stat) {
        stat = {
          name: sale.salesmanName,
          totalAmount: 0,
          count: 0,
          cashAmount: 0,
          cashCount: 0,
          cardAmount: 0,
          cardCount: 0,
          onlineAmount: 0,
          onlineCount: 0,
          tradedOutAmount: 0,
          tradedOutCount: 0,
          color: this.getVendorColor(sale.salesmanName),
        };
        salesmanMap.set(sale.salesmanName, stat);
      }

      stat.count += 1;
      stat.totalAmount += sale.amount;
      if (sale.paymentMethod === 'cash') {
        stat.cashAmount += sale.amount;
        stat.cashCount = (stat.cashCount || 0) + 1;
      } else if (sale.paymentMethod === 'traded_out') {
        stat.tradedOutAmount = (stat.tradedOutAmount || 0) + sale.amount;
        stat.tradedOutCount = (stat.tradedOutCount || 0) + 1;
      } else if (sale.paymentMethod === 'online' || sale.isOnlineSale) {
        stat.onlineAmount = (stat.onlineAmount || 0) + sale.amount;
        stat.onlineCount = (stat.onlineCount || 0) + 1;
      } else {
        stat.cardAmount += sale.amount;
        stat.cardCount = (stat.cardCount || 0) + 1;
      }
    }

    const vendors = Array.from(salesmanMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);
    const topVendor = vendors.length > 0 ? vendors[0] : undefined;

    return {
      dateKey,
      formattedDate: formatDisplayDate(dateKey),
      totalCount: sales.length,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      cashRevenue: Math.round(cashRevenue * 100) / 100,
      cashCount,
      cardRevenue: Math.round(cardRevenue * 100) / 100,
      cardCount,
      onlineRevenue: Math.round(onlineRevenue * 100) / 100,
      onlineCount,
      tradedOutRevenue: Math.round(tradedOutRevenue * 100) / 100,
      tradedOutCount,
      averageTicket: sales.length > 0 ? Math.round((totalRevenue / sales.length) * 100) / 100 : 0,
      topVendor,
      topSalesman: topVendor,
      vendors,
      salesmen: vendors,
    };
  }

  // --- Vendor Portal: Independent Sales & Trade reporting combined ---

  public resolveVendorName(aliases: string[], fallback: string): string {
    const normalizedAliases = aliases.map((a) => a.trim().toLowerCase()).filter(Boolean);
    for (const alias of normalizedAliases) {
      const fromList = this.salesmenList.find((v) => v.trim().toLowerCase() === alias);
      if (fromList) return fromList;
    }
    for (const alias of normalizedAliases) {
      for (const sale of this.salesCache.values()) {
        if (sale.salesmanName.trim().toLowerCase() === alias) {
          return sale.salesmanName.trim();
        }
      }
      for (const trade of this.tradesCache.values()) {
        if (trade.vendorName.trim().toLowerCase() === alias) {
          return trade.vendorName.trim();
        }
      }
    }
    return fallback;
  }

  public getVendorDayDetails(dateKey: string, vendorName: string): VendorDayDetails {
    const allDaySales = this.getSalesForDay(dateKey);
    const cleanVendor = vendorName.trim();
    const vendorSales = allDaySales.filter(
      (s) => s.salesmanName.toLowerCase() === cleanVendor.toLowerCase()
    );

    let totalRevenue = 0;
    let cashRevenue = 0;
    let cashCount = 0;
    let cardRevenue = 0;
    let cardCount = 0;
    let onlineRevenue = 0;
    let onlineCount = 0;
    let tradedOutRevenue = 0;
    let tradedOutCount = 0;

    for (const s of vendorSales) {
      totalRevenue += s.amount;
      if (s.paymentMethod === 'cash') {
        cashRevenue += s.amount;
        cashCount++;
      } else if (s.paymentMethod === 'traded_out') {
        tradedOutRevenue += s.amount;
        tradedOutCount++;
      } else if (s.paymentMethod === 'online' || s.isOnlineSale) {
        onlineRevenue += s.amount;
        onlineCount++;
      } else {
        cardRevenue += s.amount;
        cardCount++;
      }
    }

    // Trades taken in by this vendor on dateKey
    const allTrades = this.getTradesForDay(dateKey);
    const tradesTakenIn = allTrades.filter(
      (t) => t.vendorName.toLowerCase() === cleanVendor.toLowerCase()
    );

    let totalTradeTakenInAmount = 0;
    let cashTradeValue = 0;
    let cashTradeCount = 0;
    let creditTradeValue = 0;
    let creditTradeCount = 0;

    for (const t of tradesTakenIn) {
      totalTradeTakenInAmount += t.tradeValue;
      if (t.tradeType === 'cash') {
        cashTradeValue += t.tradeValue;
        cashTradeCount++;
      } else {
        creditTradeValue += t.tradeValue;
        creditTradeCount++;
      }
    }

    return {
      vendorName: cleanVendor,
      color: this.getVendorColor(cleanVendor),
      dateKey,
      formattedDate: formatDisplayDate(dateKey),
      salesCount: vendorSales.length,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      cashRevenue: Math.round(cashRevenue * 100) / 100,
      cashCount,
      cardRevenue: Math.round(cardRevenue * 100) / 100,
      cardCount,
      onlineRevenue: Math.round(onlineRevenue * 100) / 100,
      onlineCount,
      tradedOutRevenue: Math.round(tradedOutRevenue * 100) / 100,
      tradedOutCount,
      averageTicket: vendorSales.length > 0 ? Math.round((totalRevenue / vendorSales.length) * 100) / 100 : 0,
      sales: vendorSales,
      tradesTakenIn,
      totalTradeTakenInAmount: Math.round(totalTradeTakenInAmount * 100) / 100,
      tradeTakenInCount: tradesTakenIn.length,
      cashTradeValue: Math.round(cashTradeValue * 100) / 100,
      cashTradeCount,
      creditTradeValue: Math.round(creditTradeValue * 100) / 100,
      creditTradeCount,
    };
  }

  public getVendorWeekDetails(startDateKey: string, endDateKey: string, vendorName: string): VendorWeekDetails {
    const cleanVendor = vendorName.trim().toLowerCase();
    const weekInfo = getWeekRangeInfo(startDateKey);

    const weekSales: SaleRecord[] = [];
    const weekTradesTakenIn: TradeRecord[] = [];

    this.salesCache.forEach((rec) => {
      if (rec.dateKey >= startDateKey && rec.dateKey <= endDateKey) {
        if (rec.salesmanName.toLowerCase() === cleanVendor) {
          weekSales.push(rec);
        }
      }
    });

    this.tradesCache.forEach((t) => {
      if (t.dateKey >= startDateKey && t.dateKey <= endDateKey) {
        if (t.vendorName.toLowerCase() === cleanVendor) {
          weekTradesTakenIn.push(t);
        }
      }
    });

    weekSales.sort((a, b) => b.timestamp - a.timestamp);
    weekTradesTakenIn.sort((a, b) => b.timestamp - a.timestamp);

    let totalRevenue = 0;
    let cashRevenue = 0;
    let cashCount = 0;
    let cardRevenue = 0;
    let cardCount = 0;
    let onlineRevenue = 0;
    let onlineCount = 0;
    let tradedOutRevenue = 0;
    let tradedOutCount = 0;

    for (const s of weekSales) {
      totalRevenue += s.amount;
      if (s.paymentMethod === 'cash') {
        cashRevenue += s.amount;
        cashCount++;
      } else if (s.paymentMethod === 'traded_out') {
        tradedOutRevenue += s.amount;
        tradedOutCount++;
      } else if (s.paymentMethod === 'online' || s.isOnlineSale) {
        onlineRevenue += s.amount;
        onlineCount++;
      } else {
        cardRevenue += s.amount;
        cardCount++;
      }
    }

    let totalTradeTakenInAmount = 0;
    let cashTradeValue = 0;
    let cashTradeCount = 0;
    let creditTradeValue = 0;
    let creditTradeCount = 0;

    for (const t of weekTradesTakenIn) {
      totalTradeTakenInAmount += t.tradeValue;
      if (t.tradeType === 'cash') {
        cashTradeValue += t.tradeValue;
        cashTradeCount++;
      } else {
        creditTradeValue += t.tradeValue;
        creditTradeCount++;
      }
    }

    // 7-day strip (Sun - Sat)
    const dayBreakdown: DayBreakdownItem[] = weekInfo.days.map((day) => {
      const daySales = weekSales.filter((s) => s.dateKey === day.dateKey);
      const dayTrades = weekTradesTakenIn.filter((t) => t.dateKey === day.dateKey);

      let dayTotal = 0;
      let dayCash = 0;
      let dayCard = 0;
      let dayOnline = 0;
      let dayOnlineCount = 0;
      let dayTradedOut = 0;
      let dayTradedOutCount = 0;

      for (const s of daySales) {
        dayTotal += s.amount;
        if (s.paymentMethod === 'cash') {
          dayCash += s.amount;
        } else if (s.paymentMethod === 'traded_out') {
          dayTradedOut += s.amount;
          dayTradedOutCount++;
        } else if (s.paymentMethod === 'online' || s.isOnlineSale) {
          dayOnline += s.amount;
          dayOnlineCount++;
        } else {
          dayCard += s.amount;
        }
      }

      let dayTradeVal = 0;
      let dayCashTradeVal = 0;
      let dayCreditTradeVal = 0;

      for (const t of dayTrades) {
        dayTradeVal += t.tradeValue;
        if (t.tradeType === 'cash') dayCashTradeVal += t.tradeValue;
        else dayCreditTradeVal += t.tradeValue;
      }

      return {
        dateKey: day.dateKey,
        dayName: day.dayName,
        fullDayName: day.fullDayName,
        formattedDate: day.formattedDate,
        isToday: day.isToday,
        salesCount: daySales.length,
        totalRevenue: Math.round(dayTotal * 100) / 100,
        cashRevenue: Math.round(dayCash * 100) / 100,
        cardRevenue: Math.round(dayCard * 100) / 100,
        onlineRevenue: Math.round(dayOnline * 100) / 100,
        onlineCount: dayOnlineCount,
        tradedOutRevenue: Math.round(dayTradedOut * 100) / 100,
        tradedOutCount: dayTradedOutCount,
        tradeTakenInAmount: Math.round(dayTradeVal * 100) / 100,
        tradeTakenInCount: dayTrades.length,
        cashTradeValue: Math.round(dayCashTradeVal * 100) / 100,
        creditTradeValue: Math.round(dayCreditTradeVal * 100) / 100,
      };
    });

    return {
      vendorName,
      color: this.getVendorColor(vendorName),
      weekInfo,
      salesCount: weekSales.length,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      cashRevenue: Math.round(cashRevenue * 100) / 100,
      cashCount,
      cardRevenue: Math.round(cardRevenue * 100) / 100,
      cardCount,
      onlineRevenue: Math.round(onlineRevenue * 100) / 100,
      onlineCount,
      tradedOutRevenue: Math.round(tradedOutRevenue * 100) / 100,
      tradedOutCount,
      averageTicket: weekSales.length > 0 ? Math.round((totalRevenue / weekSales.length) * 100) / 100 : 0,
      totalTradeTakenInAmount: Math.round(totalTradeTakenInAmount * 100) / 100,
      tradeTakenInCount: weekTradesTakenIn.length,
      cashTradeValue: Math.round(cashTradeValue * 100) / 100,
      cashTradeCount,
      creditTradeValue: Math.round(creditTradeValue * 100) / 100,
      creditTradeCount,
      dayBreakdown,
      sales: weekSales,
      tradesTakenIn: weekTradesTakenIn,
    };
  }

  // --- Online Cards Inventory & Barcode System ---

  public getOnlineCards(filter?: {
    status?: 'all' | 'available' | 'sold';
    vendor?: string;
    query?: string;
  }): OnlineCard[] {
    let list = Array.from(this.onlineCardsCache.values());

    if (filter) {
      if (filter.status && filter.status !== 'all') {
        list = list.filter((c) => c.status === filter.status);
      }
      if (filter.vendor && filter.vendor !== 'all') {
        const v = filter.vendor.trim().toLowerCase();
        list = list.filter((c) => c.vendorName.trim().toLowerCase() === v);
      }
      if (filter.query && filter.query.trim()) {
        const q = filter.query.trim().toLowerCase();
        list = list.filter(
          (c) =>
            c.cardName.toLowerCase().includes(q) ||
            c.barcode.toLowerCase().includes(q) ||
            c.vendorName.toLowerCase().includes(q) ||
            (c.notes && c.notes.toLowerCase().includes(q))
        );
      }
    }

    return list.sort((a, b) => b.timestamp - a.timestamp);
  }

  public getOnlineCardByBarcode(barcodeOrId: string): OnlineCard | undefined {
    const clean = barcodeOrId.trim().toUpperCase();
    if (!clean) return undefined;

    // Check direct ID or barcode
    for (const card of this.onlineCardsCache.values()) {
      if (card.barcode.toUpperCase() === clean || card.id.toUpperCase() === clean) {
        return card;
      }
      // Also match without "ONL-" if user only scanned numbers
      const numOnly = clean.replace(/[^0-9]/g, '');
      const cardNumOnly = card.barcode.replace(/[^0-9]/g, '');
      if (numOnly && cardNumOnly && numOnly === cardNumOnly) {
        return card;
      }
    }
    return undefined;
  }

  public getOnlineCardById(id: string): OnlineCard | undefined {
    return this.onlineCardsCache.get(id);
  }

  public getOnlineCardsSummary(): OnlineCardsSummary {
    let totalCards = 0;
    let availableCount = 0;
    let availableValue = 0;
    let soldCount = 0;
    let soldValue = 0;

    this.onlineCardsCache.forEach((card) => {
      totalCards++;
      if (card.status === 'sold') {
        soldCount++;
        soldValue += card.price;
      } else {
        availableCount++;
        availableValue += card.price;
      }
    });

    return {
      totalCards,
      availableCount,
      availableValue: Math.round(availableValue * 100) / 100,
      soldCount,
      soldValue: Math.round(soldValue * 100) / 100,
    };
  }

  public async addOnlineCard(input: {
    vendorName: string;
    cardName: string;
    price: number;
    notes?: string;
  }): Promise<OnlineCard> {
    const vendorName = input.vendorName.trim();
    const cardName = input.cardName.trim();
    const price = Math.round(Number(input.price) * 100) / 100;
    const notes = input.notes?.trim() || undefined;

    // Generate unique barcode e.g. ONL-123456
    let barcodeNumber = Math.floor(100000 + Math.random() * 900000).toString();
    while (Array.from(this.onlineCardsCache.values()).some((c) => c.barcode === `ONL-${barcodeNumber}`)) {
      barcodeNumber = Math.floor(100000 + Math.random() * 900000).toString();
    }
    const barcode = `ONL-${barcodeNumber}`;
    const id = `onl_card_${barcodeNumber}_${Date.now().toString(36)}`;
    const timestamp = Date.now();
    const dateKey = getLocalDateKey(new Date(timestamp));

    const card: OnlineCard = {
      id,
      barcode,
      vendorName,
      cardName,
      price,
      status: 'available',
      notes,
      timestamp,
      dateKey,
    };

    this.onlineCardsCache.set(id, card);

    // Register vendor if new
    if (!this.salesmenList.includes(vendorName)) {
      this.salesmenList.push(vendorName);
      this.salesmenList.sort();
    }

    this.notify();

    try {
      await setDoc(doc(db, 'online_cards', id), {
        id,
        barcode,
        vendorName,
        cardName,
        price,
        status: 'available',
        notes: notes || null,
        timestamp,
        dateKey,
        soldAt: null,
        soldDateKey: null,
        saleId: null,
      });
    } catch (e) {
      console.warn('Online card saved locally; Firestore sync pending:', e);
    }

    return card;
  }

  public async addOnlineCardsBatch(
    items: { vendorName: string; cardName: string; price: number; notes?: string }[]
  ): Promise<OnlineCard[]> {
    const added: OnlineCard[] = [];
    for (const item of items) {
      const card = await this.addOnlineCard(item);
      added.push(card);
    }
    return added;
  }

  public async updateOnlineCard(
    id: string,
    updates: Partial<Omit<OnlineCard, 'id' | 'barcode'>>
  ): Promise<void> {
    const existing = this.onlineCardsCache.get(id);
    if (!existing) return;

    const updated: OnlineCard = {
      ...existing,
      ...updates,
      vendorName: updates.vendorName ? updates.vendorName.trim() : existing.vendorName,
      cardName: updates.cardName ? updates.cardName.trim() : existing.cardName,
      price: updates.price !== undefined ? Math.round(Number(updates.price) * 100) / 100 : existing.price,
      notes: updates.notes !== undefined ? (updates.notes ? updates.notes.trim() : undefined) : existing.notes,
    };

    this.onlineCardsCache.set(id, updated);
    this.notify();

    try {
      const firestoreUpdates: Record<string, any> = {};
      if (updates.vendorName !== undefined) firestoreUpdates.vendorName = updates.vendorName.trim();
      if (updates.cardName !== undefined) firestoreUpdates.cardName = updates.cardName.trim();
      if (updates.price !== undefined) firestoreUpdates.price = Math.round(Number(updates.price) * 100) / 100;
      if (updates.notes !== undefined) firestoreUpdates.notes = updates.notes ? updates.notes.trim() : null;
      if (updates.status !== undefined) firestoreUpdates.status = updates.status;

      await updateDoc(doc(db, 'online_cards', id), firestoreUpdates);
    } catch (e) {
      console.warn('Updated online card locally; Firestore sync pending:', e);
    }
  }

  public async deleteOnlineCard(id: string): Promise<void> {
    this.onlineCardsCache.delete(id);
    this.notify();

    try {
      await deleteDoc(doc(db, 'online_cards', id));
    } catch (e) {
      console.warn('Deleted online card locally; Firestore sync pending:', e);
    }
  }

  public isOnlineCardAlreadySold(barcodeOrId: string): boolean {
    const clean = barcodeOrId.trim().toLowerCase();
    if (!clean) return false;
    const card = this.getOnlineCardByBarcode(clean);
    if (card && card.status === 'sold') return true;
    for (const s of this.salesCache.values()) {
      if (s.onlineBarcode && s.onlineBarcode.toLowerCase() === clean) return true;
      if (card && s.onlineCardId && s.onlineCardId === card.id) return true;
    }
    return false;
  }

  public async sellOnlineCard(
    barcodeOrId: string,
    options?: {
      targetDateKey?: string;
      customPrice?: number;
      originalAmount?: number;
      discountAmount?: number;
      discountLabel?: string;
      operatorName?: string;
      notes?: string;
      paymentMethod?: PaymentMethod;
    }
  ): Promise<{ card: OnlineCard; sale: SaleRecord }> {
    const card = this.getOnlineCardByBarcode(barcodeOrId);
    if (!card) {
      throw new Error(`No card found with barcode or ID: "${barcodeOrId}"`);
    }

    // 1. Strict duplicate check on card status
    if (card.status === 'sold') {
      throw new Error(
        `This card (${card.cardName} - ${card.barcode}) was already sold on ${card.soldDateKey || 'a previous date'}! Duplicate sales are prevented.`
      );
    }

    // 2. Strict duplicate check in sales ledger cache
    const existingSale = Array.from(this.salesCache.values()).find(
      (s) =>
        (s.onlineBarcode && s.onlineBarcode.toLowerCase() === card.barcode.toLowerCase()) ||
        (s.onlineCardId && s.onlineCardId === card.id)
    );
    if (existingSale) {
      // Ensure local state synchronizes card status to sold
      card.status = 'sold';
      card.saleId = existingSale.id;
      this.onlineCardsCache.set(card.id, card);
      this.notify();
      throw new Error(
        `Duplicate prevented: Card "${card.cardName}" (${card.barcode}) is already recorded in the sales ledger!`
      );
    }

    const soldPrice = options?.customPrice !== undefined ? Math.round(Number(options.customPrice) * 100) / 100 : card.price;
    const soldDateKey = options?.targetDateKey || getLocalDateKey();
    const soldAt = Date.now();
    const paymentMethod: PaymentMethod = options?.paymentMethod || 'online';
    const isOnlineSale = paymentMethod === 'online';

    // 1. Record the sale in the Sales Ledger with the selected settlement method (Online vs In-Person Cash / Card / Trade Out)
    const channelTag = isOnlineSale ? 'Online' : 'In-Person';
    const methodDisplay =
      paymentMethod === 'cash'
        ? 'Cash'
        : paymentMethod === 'card'
        ? 'Card'
        : paymentMethod === 'traded_out'
        ? 'Trade Out'
        : 'Online';

    const saleDescription = `${card.cardName} (${channelTag} #${card.barcode})`;

    const defaultNote = isOnlineSale
      ? `Online Sale [${card.barcode}]`
      : `In-Person Sale (${methodDisplay}) [${card.barcode}]`;

    const saleNotes = options?.notes ? `${defaultNote}: ${options.notes}` : defaultNote;

    const sale = await this.insertSale({
      salesmanName: card.vendorName,
      operatorName: options?.operatorName,
      itemDescription: saleDescription,
      amount: soldPrice,
      originalAmount: options?.originalAmount,
      discountAmount: options?.discountAmount,
      discountLabel: options?.discountLabel,
      paymentMethod,
      notes: saleNotes,
      dateKey: soldDateKey,
      timestamp: soldAt,
      isOnlineSale,
      onlineCardId: card.id,
      onlineBarcode: card.barcode,
    });

    // Also update sale record with online metadata
    await this.updateSale(sale.id, {
      isOnlineSale,
      onlineCardId: card.id,
      onlineBarcode: card.barcode,
    });

    // 2. Mark online card as sold with the chosen payment method
    const updatedCard: OnlineCard = {
      ...card,
      status: 'sold',
      soldAt,
      soldDateKey,
      saleId: sale.id,
      soldPaymentMethod: paymentMethod,
    };

    this.onlineCardsCache.set(card.id, updatedCard);
    this.notify();

    try {
      await updateDoc(doc(db, 'online_cards', card.id), {
        status: 'sold',
        soldAt,
        soldDateKey,
        saleId: sale.id,
        soldPaymentMethod: paymentMethod,
      });
    } catch (e) {
      console.warn('Marked card sold locally; Firestore sync pending:', e);
    }

    return { card: updatedCard, sale };
  }

  public async returnOnlineCardToStock(cardId: string): Promise<void> {
    const card = this.onlineCardsCache.get(cardId);
    if (!card) return;

    if (card.saleId) {
      await this.deleteSale(card.saleId);
    }

    const updatedCard: OnlineCard = {
      ...card,
      status: 'available',
      soldAt: undefined,
      soldDateKey: undefined,
      saleId: undefined,
      soldPaymentMethod: undefined,
    };

    this.onlineCardsCache.set(cardId, updatedCard);
    this.notify();

    try {
      await updateDoc(doc(db, 'online_cards', cardId), {
        status: 'available',
        soldAt: null,
        soldDateKey: null,
        saleId: null,
        soldPaymentMethod: null,
      });
    } catch (e) {
      console.warn('Returned card to stock locally; Firestore sync pending:', e);
    }
  }

  // --- End-of-Day Cash Drawer Reconciliation ---

  public getCashReconciliationRecord(dateKey: string): CashReconciliationRecord {
    const existing = this.cashReconciliationsCache.get(dateKey);
    if (existing) return existing;
    return {
      dateKey,
      openingFloat: 0,
      actualCashCounted: null,
      updatedAt: 0,
    };
  }

  public getPreviousDayOpeningFloat(dateKey: string): number | null {
    const sortedKeys = Array.from(this.cashReconciliationsCache.keys())
      .filter((k) => k < dateKey)
      .sort((a, b) => b.localeCompare(a));

    for (const key of sortedKeys) {
      const rec = this.cashReconciliationsCache.get(key);
      if (rec && rec.openingFloat > 0) {
        return rec.openingFloat;
      }
    }
    return null;
  }

  public getCashReconciliationSummary(dateKey: string): CashReconciliationSummary {
    const rec = this.getCashReconciliationRecord(dateKey);
    const daySummary = this.getDailySummary(dateKey);
    const tradeSummary = this.getDailyTradeSummary(dateKey);

    const openingFloat = Math.round((Number(rec.openingFloat) || 0) * 100) / 100;
    const cashSalesIn = Math.round((Number(daySummary.cashRevenue) || 0) * 100) / 100;
    const cashTradesOut = Math.round((Number(tradeSummary.cashTradeValue) || 0) * 100) / 100;
    const expectedCashInTill = Math.round((openingFloat + cashSalesIn - cashTradesOut) * 100) / 100;

    const actualCashCounted =
      rec.actualCashCounted !== undefined && rec.actualCashCounted !== null
        ? Math.round(Number(rec.actualCashCounted) * 100) / 100
        : null;

    const variance =
      actualCashCounted !== null
        ? Math.round((actualCashCounted - expectedCashInTill) * 100) / 100
        : null;

    let status: CashReconciliationSummary['status'] = 'pending';
    if (variance !== null) {
      if (Math.abs(variance) < 0.005) status = 'balanced';
      else if (variance > 0) status = 'over';
      else status = 'short';
    }

    return {
      dateKey,
      openingFloat,
      cashSalesIn,
      cashTradesOut,
      expectedCashInTill,
      actualCashCounted,
      variance,
      status,
      denominationCounts: rec.denominationCounts,
      notes: rec.notes,
      updatedAt: rec.updatedAt || undefined,
    };
  }

  public async saveCashReconciliation(
    dateKey: string,
    updates: {
      openingFloat?: number;
      actualCashCounted?: number | null;
      denominationCounts?: Record<string, number>;
      notes?: string;
    }
  ): Promise<CashReconciliationRecord> {
    const existing = this.getCashReconciliationRecord(dateKey);
    const now = Date.now();

    const openingFloat =
      updates.openingFloat !== undefined
        ? Math.max(0, Math.round((Number(updates.openingFloat) || 0) * 100) / 100)
        : existing.openingFloat;

    let actualCashCounted = existing.actualCashCounted;
    if (updates.actualCashCounted !== undefined) {
      actualCashCounted =
        updates.actualCashCounted === null
          ? null
          : Math.max(0, Math.round(Number(updates.actualCashCounted) * 100) / 100);
    }

    const denominationCounts =
      updates.denominationCounts !== undefined
        ? updates.denominationCounts
        : existing.denominationCounts;

    const notes =
      updates.notes !== undefined
        ? updates.notes.trim() || undefined
        : existing.notes;

    const record: CashReconciliationRecord = {
      dateKey,
      openingFloat,
      actualCashCounted,
      denominationCounts,
      notes,
      updatedAt: now,
    };

    this.cashReconciliationsCache.set(dateKey, record);
    this.notify();

    try {
      await setDoc(doc(db, 'cash_reconciliations', dateKey), {
        dateKey,
        openingFloat: record.openingFloat,
        actualCashCounted: record.actualCashCounted,
        denominationCounts: record.denominationCounts || null,
        notes: record.notes || null,
        updatedAt: record.updatedAt,
      });
    } catch (e) {
      console.warn('Cash reconciliation saved locally; Firestore sync pending:', e);
    }

    return record;
  }

  // --- Customer Store Credit Balances & Audit Transactions ---

  public getStoreCreditCustomers(): StoreCreditCustomer[] {
    return Array.from(this.storeCreditCustomersCache.values()).sort((a, b) => {
      if (Math.abs(b.balance - a.balance) >= 0.005) return b.balance - a.balance;
      return b.updatedAt - a.updatedAt;
    });
  }

  public getStoreCreditCustomer(id: string): StoreCreditCustomer | undefined {
    return this.storeCreditCustomersCache.get(id);
  }

  public findStoreCreditCustomerByExactName(name: string): StoreCreditCustomer | undefined {
    const clean = name.trim().toLowerCase();
    if (!clean) return undefined;
    for (const c of this.storeCreditCustomersCache.values()) {
      if (c.normalizedName === clean || c.name.trim().toLowerCase() === clean) {
        return c;
      }
    }
    return undefined;
  }

  public getStoreCreditTransactions(customerId?: string): StoreCreditTransaction[] {
    const list: StoreCreditTransaction[] = [];
    this.storeCreditTxCache.forEach((tx) => {
      if (!customerId || tx.customerId === customerId) {
        list.push(tx);
      }
    });
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }

  public getStoreCreditOverview(): StoreCreditOverview {
    let totalOutstandingPence = 0;
    let activeCustomersCount = 0;
    let totalIssuedPence = 0;
    let totalRedeemedPence = 0;

    this.storeCreditCustomersCache.forEach((c) => {
      const balP = Math.round((c.balance || 0) * 100);
      if (balP > 0) activeCustomersCount += 1;
      totalOutstandingPence += Math.max(0, balP);
      totalIssuedPence += Math.round((c.totalIssued || 0) * 100);
      totalRedeemedPence += Math.round((c.totalRedeemed || 0) * 100);
    });

    return {
      totalOutstandingBalance: totalOutstandingPence / 100,
      activeCustomersCount,
      totalCustomersCount: this.storeCreditCustomersCache.size,
      totalLifetimeIssued: totalIssuedPence / 100,
      totalLifetimeRedeemed: totalRedeemedPence / 100,
    };
  }

  public async upsertStoreCreditCustomer(input: {
    name: string;
    phone?: string;
    notes?: string;
  }): Promise<StoreCreditCustomer> {
    const cleanName = input.name.trim();
    if (!cleanName) {
      throw new Error('Customer name is required.');
    }

    const existing = this.findStoreCreditCustomerByExactName(cleanName);
    const now = Date.now();

    if (existing) {
      const updated: StoreCreditCustomer = {
        ...existing,
        phone: input.phone !== undefined ? input.phone.trim() || undefined : existing.phone,
        notes: input.notes !== undefined ? input.notes.trim() || undefined : existing.notes,
        updatedAt: now,
      };
      this.storeCreditCustomersCache.set(existing.id, updated);
      this.notify();

      try {
        await setDoc(
          doc(db, 'store_credit_customers', existing.id),
          {
            name: updated.name,
            normalizedName: updated.normalizedName,
            phone: updated.phone || null,
            balance: updated.balance,
            totalIssued: updated.totalIssued,
            totalRedeemed: updated.totalRedeemed,
            notes: updated.notes || null,
            createdAt: updated.createdAt,
            updatedAt: updated.updatedAt,
          },
          { merge: true }
        );
      } catch (e) {
        console.warn('Customer saved locally; Firestore sync pending:', e);
      }
      return updated;
    }

    const id = 'cust_' + Math.random().toString(36).substring(2, 9) + now.toString(36);
    const created: StoreCreditCustomer = {
      id,
      name: cleanName,
      normalizedName: cleanName.toLowerCase(),
      phone: input.phone?.trim() || undefined,
      balance: 0,
      totalIssued: 0,
      totalRedeemed: 0,
      notes: input.notes?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };

    this.storeCreditCustomersCache.set(id, created);
    this.notify();

    try {
      await setDoc(doc(db, 'store_credit_customers', id), {
        name: created.name,
        normalizedName: created.normalizedName,
        phone: created.phone || null,
        balance: created.balance,
        totalIssued: created.totalIssued,
        totalRedeemed: created.totalRedeemed,
        notes: created.notes || null,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      });
    } catch (e) {
      console.warn('Customer created locally; Firestore sync pending:', e);
    }

    return created;
  }

  public async adjustStoreCreditBalance(input: {
    customerId?: string;
    customerName?: string;
    phone?: string;
    notes?: string;
    type: StoreCreditTransactionType;
    delta: number; // positive adds credit, negative deducts credit
    description: string;
    vendorName?: string;
    relatedTradeId?: string;
    relatedSaleId?: string;
    relatedCheckoutGroupId?: string;
    dateKey?: string;
    timestamp?: number;
  }): Promise<{ customer: StoreCreditCustomer; transaction: StoreCreditTransaction }> {
    const timestamp = input.timestamp || Date.now();
    const dateKey = input.dateKey || getLocalDateKey(new Date(timestamp));

    let customer = input.customerId
      ? this.storeCreditCustomersCache.get(input.customerId)
      : undefined;
    if (!customer && input.customerName) {
      customer = await this.upsertStoreCreditCustomer({
        name: input.customerName,
        phone: input.phone,
        notes: input.notes,
      });
    }
    if (!customer) {
      throw new Error('Customer account not found.');
    }

    // Update phone/notes if provided
    if (
      (input.phone !== undefined && input.phone.trim() && input.phone.trim() !== customer.phone) ||
      (input.notes !== undefined && input.notes.trim() && input.notes.trim() !== customer.notes)
    ) {
      customer = {
        ...customer,
        phone: input.phone?.trim() || customer.phone,
        notes: input.notes?.trim() || customer.notes,
      };
    }

    const currentPence = Math.round((customer.balance || 0) * 100);
    const deltaPence = Math.round(Number(input.delta) * 100);
    if (isNaN(deltaPence) || deltaPence === 0) {
      throw new Error('Credit adjustment amount must not be £0.00.');
    }

    const nextBalancePence = currentPence + deltaPence;
    if (nextBalancePence < 0) {
      throw new Error(
        `Store credit balance for ${customer.name} cannot go below £0.00 (Available: £${(currentPence / 100).toFixed(2)}).`
      );
    }

    const nextBalance = nextBalancePence / 100;
    const issuedPence =
      Math.round((customer.totalIssued || 0) * 100) + (deltaPence > 0 ? deltaPence : 0);
    const redeemedPence =
      Math.round((customer.totalRedeemed || 0) * 100) + (deltaPence < 0 ? Math.abs(deltaPence) : 0);

    const updatedCustomer: StoreCreditCustomer = {
      ...customer,
      balance: nextBalance,
      totalIssued: issuedPence / 100,
      totalRedeemed: redeemedPence / 100,
      updatedAt: timestamp,
    };

    const txId = 'sctx_' + Math.random().toString(36).substring(2, 9) + timestamp.toString(36);
    const tx: StoreCreditTransaction = {
      id: txId,
      customerId: updatedCustomer.id,
      customerName: updatedCustomer.name,
      type: input.type,
      amount: Math.abs(deltaPence) / 100,
      delta: deltaPence / 100,
      balanceAfter: nextBalance,
      vendorName: input.vendorName?.trim() || undefined,
      description: input.description.trim() || 'Store Credit Update',
      relatedTradeId: input.relatedTradeId,
      relatedSaleId: input.relatedSaleId,
      relatedCheckoutGroupId: input.relatedCheckoutGroupId,
      dateKey,
      timestamp,
    };

    this.storeCreditCustomersCache.set(updatedCustomer.id, updatedCustomer);
    this.storeCreditTxCache.set(txId, tx);
    this.notify();

    try {
      await Promise.all([
        setDoc(
          doc(db, 'store_credit_customers', updatedCustomer.id),
          {
            name: updatedCustomer.name,
            normalizedName: updatedCustomer.normalizedName,
            phone: updatedCustomer.phone || null,
            balance: updatedCustomer.balance,
            totalIssued: updatedCustomer.totalIssued,
            totalRedeemed: updatedCustomer.totalRedeemed,
            notes: updatedCustomer.notes || null,
            createdAt: updatedCustomer.createdAt,
            updatedAt: updatedCustomer.updatedAt,
          },
          { merge: true }
        ),
        setDoc(doc(db, 'store_credit_transactions', txId), {
          customerId: tx.customerId,
          customerName: tx.customerName,
          type: tx.type,
          amount: tx.amount,
          delta: tx.delta,
          balanceAfter: tx.balanceAfter,
          vendorName: tx.vendorName || null,
          description: tx.description,
          relatedTradeId: tx.relatedTradeId || null,
          relatedSaleId: tx.relatedSaleId || null,
          relatedCheckoutGroupId: tx.relatedCheckoutGroupId || null,
          dateKey: tx.dateKey,
          timestamp: tx.timestamp,
        }),
      ]);
    } catch (e) {
      console.warn('Store credit updated locally; Firestore sync pending:', e);
    }

    return { customer: updatedCustomer, transaction: tx };
  }

  private async recalculateCustomerBalance(customerId: string) {
    const customer = this.storeCreditCustomersCache.get(customerId);
    if (!customer) return;

    const txs = this.getStoreCreditTransactions(customerId).sort((a, b) => a.timestamp - b.timestamp);
    let balancePence = 0;
    let issuedPence = 0;
    let redeemedPence = 0;

    for (const tx of txs) {
      const dPence = Math.round((tx.delta || 0) * 100);
      balancePence = Math.max(0, balancePence + dPence);
      if (dPence > 0) issuedPence += dPence;
      if (dPence < 0) redeemedPence += Math.abs(dPence);
    }

    const updated: StoreCreditCustomer = {
      ...customer,
      balance: balancePence / 100,
      totalIssued: issuedPence / 100,
      totalRedeemed: redeemedPence / 100,
      updatedAt: Date.now(),
    };
    this.storeCreditCustomersCache.set(customerId, updated);

    try {
      await setDoc(
        doc(db, 'store_credit_customers', customerId),
        {
          balance: updated.balance,
          totalIssued: updated.totalIssued,
          totalRedeemed: updated.totalRedeemed,
          updatedAt: updated.updatedAt,
        },
        { merge: true }
      );
    } catch (e) {
      console.warn('Could not sync recalculated customer balance:', e);
    }
  }

  private async removeLinkedStoreCreditTransactions(filter: {
    relatedTradeId?: string;
    relatedSaleId?: string;
    relatedCheckoutGroupId?: string;
  }) {
    const matchingTx: StoreCreditTransaction[] = [];
    this.storeCreditTxCache.forEach((tx) => {
      if (
        (filter.relatedTradeId && tx.relatedTradeId === filter.relatedTradeId) ||
        (filter.relatedSaleId && tx.relatedSaleId === filter.relatedSaleId) ||
        (filter.relatedCheckoutGroupId && tx.relatedCheckoutGroupId === filter.relatedCheckoutGroupId)
      ) {
        matchingTx.push(tx);
      }
    });

    if (matchingTx.length === 0) return;

    const affectedCustomerIds = new Set<string>();
    const deletes: Promise<any>[] = [];

    for (const tx of matchingTx) {
      this.storeCreditTxCache.delete(tx.id);
      affectedCustomerIds.add(tx.customerId);
      deletes.push(deleteDoc(doc(db, 'store_credit_transactions', tx.id)).catch(() => {}));
    }

    await Promise.all(deletes);
    for (const custId of affectedCustomerIds) {
      await this.recalculateCustomerBalance(custId);
    }
  }

  public async deleteStoreCreditCustomer(customerId: string) {
    this.storeCreditCustomersCache.delete(customerId);
    const txToDelete: string[] = [];
    this.storeCreditTxCache.forEach((tx, txId) => {
      if (tx.customerId === customerId) {
        txToDelete.push(txId);
      }
    });
    txToDelete.forEach((id) => this.storeCreditTxCache.delete(id));
    this.notify();

    try {
      await Promise.all([
        deleteDoc(doc(db, 'store_credit_customers', customerId)),
        ...txToDelete.map((id) => deleteDoc(doc(db, 'store_credit_transactions', id)).catch(() => {})),
      ]);
    } catch (e) {
      console.warn('Store credit customer deleted locally; Firestore sync pending:', e);
    }
  }

  // --- Customer Holds, Deposits & Layaway Tracker ---

  public getHolds(filter?: {
    status?: 'all' | HoldStatus;
    vendor?: string;
    query?: string;
  }): HoldRecord[] {
    let list = Array.from(this.holdsCache.values());

    if (filter) {
      if (filter.status && filter.status !== 'all') {
        list = list.filter((h) => h.status === filter.status);
      }
      if (filter.vendor && filter.vendor !== 'all') {
        const v = filter.vendor.trim().toLowerCase();
        list = list.filter((h) => h.vendorName.trim().toLowerCase() === v);
      }
      if (filter.query && filter.query.trim()) {
        const q = filter.query.trim().toLowerCase();
        list = list.filter(
          (h) =>
            h.customerName.toLowerCase().includes(q) ||
            h.itemDescription.toLowerCase().includes(q) ||
            h.vendorName.toLowerCase().includes(q) ||
            (h.customerPhone && h.customerPhone.toLowerCase().includes(q)) ||
            (h.operatorName && h.operatorName.toLowerCase().includes(q)) ||
            (h.notes && h.notes.toLowerCase().includes(q))
        );
      }
    }

    return list.sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (a.status !== 'active' && b.status === 'active') return 1;
      return b.updatedAt - a.updatedAt;
    });
  }

  public getHoldById(id: string): HoldRecord | undefined {
    return this.holdsCache.get(id);
  }

  public getHoldsOverview(): HoldsOverview {
    const todayKey = getLocalDateKey();
    let activeCount = 0;
    let completedCount = 0;
    let overdueCount = 0;
    let totalActivePence = 0;
    let totalDepositsPence = 0;
    let totalRemainingPence = 0;

    this.holdsCache.forEach((h) => {
      if (h.status === 'active') {
        activeCount++;
        totalActivePence += Math.round((h.totalPrice || 0) * 100);
        totalDepositsPence += Math.round((h.depositPaid || 0) * 100);
        totalRemainingPence += Math.max(0, Math.round((h.remainingBalance || 0) * 100));
        if (h.dueDateKey && h.dueDateKey < todayKey) {
          overdueCount++;
        }
      } else if (h.status === 'completed') {
        completedCount++;
      }
    });

    return {
      activeCount,
      completedCount,
      overdueCount,
      totalActiveValue: totalActivePence / 100,
      totalDepositsCollected: totalDepositsPence / 100,
      totalRemainingDue: totalRemainingPence / 100,
    };
  }

  public async createHold(input: {
    customerName: string;
    customerPhone?: string;
    vendorName: string;
    operatorName?: string;
    itemDescription: string;
    totalPrice: number;
    initialDeposit?: number;
    depositPaymentMethod?: PaymentMethod;
    dueDateKey?: string;
    notes?: string;
    dateKey?: string;
  }): Promise<HoldRecord> {
    const now = Date.now();
    const dateKey = input.dateKey || getLocalDateKey(new Date(now));
    const cleanCustomer = input.customerName.trim();
    const cleanVendor = input.vendorName.trim();
    const cleanItem = input.itemDescription.trim();
    const resolvedOperator = (input.operatorName ?? getDeviceOperator()).trim() || undefined;

    if (!cleanCustomer) throw new Error('Customer name is required for a hold.');
    if (!cleanVendor) throw new Error('Vendor is required for a hold.');
    if (!cleanItem) throw new Error('Item description is required for a hold.');

    const totalPence = Math.round(Number(input.totalPrice) * 100);
    if (isNaN(totalPence) || totalPence <= 0) {
      throw new Error('Total item price must be greater than £0.00.');
    }

    const depositPence = Math.max(
      0,
      Math.min(totalPence, Math.round((Number(input.initialDeposit) || 0) * 100))
    );
    const remainingPence = totalPence - depositPence;
    const id = 'hold_' + Math.random().toString(36).substring(2, 9) + now.toString(36);

    const payments: HoldPayment[] = [];
    let status: HoldStatus = remainingPence === 0 ? 'completed' : 'active';

    if (depositPence > 0) {
      const payMethod: PaymentMethod = input.depositPaymentMethod || 'cash';
      const depositAmount = depositPence / 100;
      const sale = await this.insertSale({
        salesmanName: cleanVendor,
        operatorName: resolvedOperator,
        itemDescription:
          remainingPence === 0
            ? `Layaway Paid in Full: ${cleanItem} (${cleanCustomer})`
            : `Layaway Deposit: ${cleanItem} (${cleanCustomer})`,
        amount: depositAmount,
        paymentMethod: payMethod,
        notes: input.notes?.trim() || undefined,
        dateKey,
        timestamp: now,
        relatedHoldId: id,
      });

      payments.push({
        id: 'hp_' + Math.random().toString(36).substring(2, 9),
        amount: depositAmount,
        paymentMethod: payMethod,
        operatorName: resolvedOperator,
        saleId: sale.id,
        notes: 'Initial Deposit',
        timestamp: now,
        dateKey,
      });
    }

    const record: HoldRecord = {
      id,
      customerName: cleanCustomer,
      customerPhone: input.customerPhone?.trim() || undefined,
      vendorName: cleanVendor,
      operatorName: resolvedOperator,
      itemDescription: cleanItem,
      totalPrice: totalPence / 100,
      depositPaid: depositPence / 100,
      remainingBalance: remainingPence / 100,
      status,
      dueDateKey: input.dueDateKey?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      payments,
      createdAt: now,
      dateKey,
      updatedAt: now,
      completedAt: status === 'completed' ? now : undefined,
    };

    this.holdsCache.set(id, record);
    this.notify();

    try {
      await setDoc(doc(db, 'holds', id), {
        customerName: record.customerName,
        customerPhone: record.customerPhone || null,
        vendorName: record.vendorName,
        operatorName: record.operatorName || null,
        itemDescription: record.itemDescription,
        totalPrice: record.totalPrice,
        depositPaid: record.depositPaid,
        remainingBalance: record.remainingBalance,
        status: record.status,
        dueDateKey: record.dueDateKey || null,
        notes: record.notes || null,
        payments: record.payments,
        createdAt: record.createdAt,
        dateKey: record.dateKey,
        updatedAt: record.updatedAt,
        completedAt: record.completedAt || null,
      });
    } catch (e) {
      console.warn('Hold saved locally; Firestore sync pending:', e);
    }

    return record;
  }

  public async recordHoldPayment(
    holdId: string,
    input: {
      amount: number;
      paymentMethod: PaymentMethod;
      operatorName?: string;
      notes?: string;
      dateKey?: string;
    }
  ): Promise<HoldRecord> {
    const existing = this.holdsCache.get(holdId);
    if (!existing) throw new Error('Hold record not found.');
    if (existing.status === 'cancelled' || existing.status === 'expired') {
      throw new Error(`Cannot add payment to a ${existing.status} hold.`);
    }

    const now = Date.now();
    const dateKey = input.dateKey || getLocalDateKey(new Date(now));
    const resolvedOperator = (input.operatorName ?? getDeviceOperator()).trim() || undefined;
    const remainingPence = Math.max(0, Math.round(existing.remainingBalance * 100));
    const payPence = Math.round(Number(input.amount) * 100);

    if (isNaN(payPence) || payPence <= 0) {
      throw new Error('Payment amount must be greater than £0.00.');
    }
    if (payPence > remainingPence) {
      throw new Error(
        `Payment (£${(payPence / 100).toFixed(2)}) exceeds remaining balance (£${(remainingPence / 100).toFixed(2)}).`
      );
    }

    const paidAmount = payPence / 100;
    const nextRemainingPence = remainingPence - payPence;
    const nextDepositPence = Math.round(existing.depositPaid * 100) + payPence;
    const isFinalPickup = nextRemainingPence === 0;

    const sale = await this.insertSale({
      salesmanName: existing.vendorName,
      operatorName: resolvedOperator,
      itemDescription: isFinalPickup
        ? `Layaway Final Pickup: ${existing.itemDescription} (${existing.customerName})`
        : `Layaway Payment: ${existing.itemDescription} (${existing.customerName})`,
      amount: paidAmount,
      paymentMethod: input.paymentMethod,
      notes: input.notes?.trim() || undefined,
      dateKey,
      timestamp: now,
      relatedHoldId: holdId,
    });

    const newPayment: HoldPayment = {
      id: 'hp_' + Math.random().toString(36).substring(2, 9) + now.toString(36),
      amount: paidAmount,
      paymentMethod: input.paymentMethod,
      operatorName: resolvedOperator,
      saleId: sale.id,
      notes: input.notes?.trim() || (isFinalPickup ? 'Final Balance & Pickup' : 'Installment Payment'),
      timestamp: now,
      dateKey,
    };

    const updated: HoldRecord = {
      ...existing,
      depositPaid: nextDepositPence / 100,
      remainingBalance: nextRemainingPence / 100,
      status: isFinalPickup ? 'completed' : 'active',
      payments: [...existing.payments, newPayment],
      updatedAt: now,
      completedAt: isFinalPickup ? now : existing.completedAt,
    };

    this.holdsCache.set(holdId, updated);
    this.notify();

    try {
      await updateDoc(doc(db, 'holds', holdId), {
        depositPaid: updated.depositPaid,
        remainingBalance: updated.remainingBalance,
        status: updated.status,
        payments: updated.payments,
        updatedAt: updated.updatedAt,
        completedAt: updated.completedAt || null,
      });
    } catch (e) {
      console.warn('Hold payment updated locally; Firestore sync pending:', e);
    }

    return updated;
  }

  public async updateHoldStatus(holdId: string, status: HoldStatus, notes?: string): Promise<void> {
    const existing = this.holdsCache.get(holdId);
    if (!existing) return;
    const now = Date.now();
    const updated: HoldRecord = {
      ...existing,
      status,
      notes: notes !== undefined ? notes.trim() || undefined : existing.notes,
      updatedAt: now,
      completedAt: status === 'completed' ? existing.completedAt || now : undefined,
    };
    this.holdsCache.set(holdId, updated);
    this.notify();

    try {
      await updateDoc(doc(db, 'holds', holdId), {
        status,
        notes: updated.notes || null,
        updatedAt: now,
        completedAt: updated.completedAt || null,
      });
    } catch (e) {
      console.warn('Hold status updated locally; Firestore sync pending:', e);
    }
  }

  public async deleteHold(holdId: string): Promise<void> {
    this.holdsCache.delete(holdId);
    this.notify();
    try {
      await deleteDoc(doc(db, 'holds', holdId));
    } catch (e) {
      console.warn('Hold deleted locally; Firestore sync pending:', e);
    }
  }

  // --- Busiest Hours & Days Heatmap Analytics ---

  public getBusiestHoursHeatmapData(options?: {
    rangeDays?: 30 | 90 | 'all';
    vendor?: string;
  }): HeatmapData {
    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const rangeDays = options?.rangeDays ?? 'all';
    const filterVendor = options?.vendor && options.vendor !== 'all' ? options.vendor.trim().toLowerCase() : null;

    let minDateKey: string | null = null;
    if (rangeDays !== 'all') {
      const d = new Date();
      d.setDate(d.getDate() - rangeDays + 1);
      minDateKey = getLocalDateKey(d);
    }

    const filteredSales = Array.from(this.salesCache.values()).filter((s) => {
      if (minDateKey && s.dateKey < minDateKey) return false;
      if (filterVendor && s.salesmanName.trim().toLowerCase() !== filterVendor) return false;
      return true;
    });

    // Determine visible trading hour span (default 9..20, expand dynamically if sales exist outside)
    let minHour = 9;
    let maxHour = 20;
    for (const s of filteredSales) {
      const h = new Date(s.timestamp).getHours();
      if (h < minHour) minHour = h;
      if (h > maxHour) maxHour = h;
    }
    const hours: number[] = [];
    for (let h = minHour; h <= maxHour; h++) hours.push(h);

    // Initialize 7xH matrix (dayIndex 0=Mon .. 6=Sun)
    const cells: HeatmapCell[][] = dayLabels.map((dayLabel, dayIndex) =>
      hours.map((hour) => ({
        dayIndex,
        dayLabel,
        hour,
        salesCount: 0,
        totalRevenue: 0,
        avgTicket: 0,
        cashCount: 0,
        cardCount: 0,
        onlineCount: 0,
        tradedOutCount: 0,
        topPaymentMethod: null,
      }))
    );

    const formatHour = (h: number) => `${String(h).padStart(2, '0')}:00`;
    const dayTotals = dayLabels.map((label) => ({ label, revenue: 0, count: 0 }));
    const hourTotals = hours.map((hour) => ({ hour, label: formatHour(hour), revenue: 0, count: 0 }));

    let totalRevenue = 0;
    let totalSalesCount = 0;

    for (const s of filteredSales) {
      const dt = new Date(s.timestamp);
      const jsDay = dt.getDay(); // 0=Sun..6=Sat
      const dayIndex = (jsDay + 6) % 7; // 0=Mon..6=Sun
      const hr = dt.getHours();
      const hourIndex = hr - minHour;
      if (hourIndex < 0 || hourIndex >= hours.length) continue;

      const cell = cells[dayIndex][hourIndex];
      cell.salesCount += 1;
      cell.totalRevenue += s.amount;

      if (s.paymentMethod === 'cash') cell.cashCount += 1;
      else if (s.paymentMethod === 'online' || s.isOnlineSale) cell.onlineCount += 1;
      else if (s.paymentMethod === 'traded_out') cell.tradedOutCount += 1;
      else cell.cardCount += 1;

      dayTotals[dayIndex].revenue += s.amount;
      dayTotals[dayIndex].count += 1;
      hourTotals[hourIndex].revenue += s.amount;
      hourTotals[hourIndex].count += 1;

      totalRevenue += s.amount;
      totalSalesCount += 1;
    }

    let goldenSlot: HeatmapCell | null = null;

    for (let d = 0; d < 7; d++) {
      dayTotals[d].revenue = Math.round(dayTotals[d].revenue * 100) / 100;
      for (let hIdx = 0; hIdx < hours.length; hIdx++) {
        const cell = cells[d][hIdx];
        cell.totalRevenue = Math.round(cell.totalRevenue * 100) / 100;
        cell.avgTicket = cell.salesCount > 0 ? Math.round((cell.totalRevenue / cell.salesCount) * 100) / 100 : 0;

        if (cell.salesCount > 0) {
          const methodCounts: { m: PaymentMethod; c: number }[] = [
            { m: 'card', c: cell.cardCount },
            { m: 'cash', c: cell.cashCount },
            { m: 'online', c: cell.onlineCount },
            { m: 'traded_out', c: cell.tradedOutCount },
          ];
          methodCounts.sort((a, b) => b.c - a.c);
          cell.topPaymentMethod = methodCounts[0].c > 0 ? methodCounts[0].m : null;

          if (!goldenSlot || cell.totalRevenue > goldenSlot.totalRevenue) {
            goldenSlot = cell;
          }
        }
      }
    }

    for (let hIdx = 0; hIdx < hours.length; hIdx++) {
      hourTotals[hIdx].revenue = Math.round(hourTotals[hIdx].revenue * 100) / 100;
    }

    const activeDays = dayTotals.filter((d) => d.count > 0);
    const busiestDay =
      activeDays.length > 0
        ? [...activeDays].sort((a, b) => b.revenue - a.revenue)[0]
        : null;

    const activeHours = hourTotals.filter((h) => h.count > 0);
    const peakHourRaw =
      activeHours.length > 0
        ? [...activeHours].sort((a, b) => b.revenue - a.revenue)[0]
        : null;
    const quietestHourRaw =
      activeHours.length > 0
        ? [...activeHours].sort((a, b) => a.revenue - b.revenue)[0]
        : null;

    return {
      hours,
      dayLabels,
      cells,
      totalSalesCount,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      busiestDay,
      peakHour: peakHourRaw
        ? { hour: peakHourRaw.hour, label: formatHour(peakHourRaw.hour), revenue: peakHourRaw.revenue, count: peakHourRaw.count }
        : null,
      goldenSlot,
      quietestHour: quietestHourRaw
        ? { hour: quietestHourRaw.hour, label: formatHour(quietestHourRaw.hour), revenue: quietestHourRaw.revenue, count: quietestHourRaw.count }
        : null,
      dayTotals,
      hourTotals,
    };
  }

  // --- Card Show / Day Events & Comparisons ---

  public getDayEventsMap(): Map<string, DayEventInfo> {
    return new Map(this.dayEventsCache);
  }

  public getDayEvent(dateKey: string): DayEventInfo | null {
    return this.dayEventsCache.get(dateKey) || null;
  }

  public async saveDayEvent(input: DayEventInfo): Promise<DayEventInfo> {
    const record: DayEventInfo = {
      dateKey: input.dateKey,
      isEvent: true,
      eventName: input.eventName.trim(),
      location: input.location?.trim() || undefined,
      tableCost: input.tableCost !== undefined && !isNaN(Number(input.tableCost)) ? Math.round(Number(input.tableCost) * 100) / 100 : undefined,
      notes: input.notes?.trim() || undefined,
      updatedAt: Date.now(),
    };

    this.dayEventsCache.set(record.dateKey, record);
    this.notify();

    try {
      await setDoc(doc(db, 'day_events', record.dateKey), {
        dateKey: record.dateKey,
        isEvent: true,
        eventName: record.eventName,
        location: record.location || null,
        tableCost: record.tableCost ?? null,
        notes: record.notes || null,
        updatedAt: record.updatedAt,
      });
    } catch (e) {
      console.warn('Day event saved locally; Firestore sync pending:', e);
    }

    return record;
  }

  public async clearDayEvent(dateKey: string): Promise<void> {
    this.dayEventsCache.delete(dateKey);
    this.notify();

    try {
      await deleteDoc(doc(db, 'day_events', dateKey));
    } catch (e) {
      console.warn('Day event cleared locally; Firestore sync pending:', e);
    }
  }

  public getEventVsShopComparison(startDateKey?: string, endDateKey?: string): EventVsShopComparison {
    const salesByDate = new Map<string, { revenue: number; count: number }>();
    const tradesByDate = new Map<string, number>();

    this.salesCache.forEach((sale) => {
      if (startDateKey && sale.dateKey < startDateKey) return;
      if (endDateKey && sale.dateKey > endDateKey) return;
      const prev = salesByDate.get(sale.dateKey) || { revenue: 0, count: 0 };
      prev.revenue += sale.amount;
      prev.count += 1;
      salesByDate.set(sale.dateKey, prev);
    });

    this.tradesCache.forEach((trade) => {
      if (startDateKey && trade.dateKey < startDateKey) return;
      if (endDateKey && trade.dateKey > endDateKey) return;
      tradesByDate.set(trade.dateKey, (tradesByDate.get(trade.dateKey) || 0) + trade.tradeValue);
    });

    const eventDateKeys = new Set<string>();
    this.dayEventsCache.forEach((ev, key) => {
      if (!ev.isEvent) return;
      if (startDateKey && key < startDateKey) return;
      if (endDateKey && key > endDateKey) return;
      eventDateKeys.add(key);
    });

    let eventRevenue = 0;
    let eventSalesCount = 0;
    let eventTradesValue = 0;
    let eventTableCost = 0;
    const recentEvents: EventDaySummaryItem[] = [];

    eventDateKeys.forEach((dateKey) => {
      const ev = this.dayEventsCache.get(dateKey)!;
      const daySales = salesByDate.get(dateKey) || { revenue: 0, count: 0 };
      const dayTrades = tradesByDate.get(dateKey) || 0;
      const cost = ev.tableCost || 0;

      eventRevenue += daySales.revenue;
      eventSalesCount += daySales.count;
      eventTradesValue += dayTrades;
      eventTableCost += cost;

      recentEvents.push({
        dateKey,
        eventName: ev.eventName,
        location: ev.location,
        tableCost: ev.tableCost,
        revenue: Math.round(daySales.revenue * 100) / 100,
        salesCount: daySales.count,
        tradesValue: Math.round(dayTrades * 100) / 100,
      });
    });

    recentEvents.sort((a, b) => b.dateKey.localeCompare(a.dateKey));

    const shopDateKeys = new Set<string>();
    salesByDate.forEach((_val, dateKey) => {
      if (!eventDateKeys.has(dateKey)) shopDateKeys.add(dateKey);
    });
    tradesByDate.forEach((_val, dateKey) => {
      if (!eventDateKeys.has(dateKey)) shopDateKeys.add(dateKey);
    });

    let shopRevenue = 0;
    let shopSalesCount = 0;
    let shopTradesValue = 0;

    shopDateKeys.forEach((dateKey) => {
      const daySales = salesByDate.get(dateKey) || { revenue: 0, count: 0 };
      const dayTrades = tradesByDate.get(dateKey) || 0;
      shopRevenue += daySales.revenue;
      shopSalesCount += daySales.count;
      shopTradesValue += dayTrades;
    });

    const eventDays = eventDateKeys.size;
    const shopDays = shopDateKeys.size;

    return {
      eventStats: {
        daysCount: eventDays,
        totalRevenue: Math.round(eventRevenue * 100) / 100,
        salesCount: eventSalesCount,
        avgDailyRevenue: eventDays > 0 ? Math.round((eventRevenue / eventDays) * 100) / 100 : 0,
        averageTicket: eventSalesCount > 0 ? Math.round((eventRevenue / eventSalesCount) * 100) / 100 : 0,
        totalTradesValue: Math.round(eventTradesValue * 100) / 100,
        totalTableCost: Math.round(eventTableCost * 100) / 100,
        netAfterTableCost: Math.round((eventRevenue - eventTableCost) * 100) / 100,
      },
      shopStats: {
        daysCount: shopDays,
        totalRevenue: Math.round(shopRevenue * 100) / 100,
        salesCount: shopSalesCount,
        avgDailyRevenue: shopDays > 0 ? Math.round((shopRevenue / shopDays) * 100) / 100 : 0,
        averageTicket: shopSalesCount > 0 ? Math.round((shopRevenue / shopSalesCount) * 100) / 100 : 0,
        totalTradesValue: Math.round(shopTradesValue * 100) / 100,
        totalTableCost: 0,
        netAfterTableCost: Math.round(shopRevenue * 100) / 100,
      },
      recentEvents,
    };
  }

  // --- Counter Quick Presets ---

  public getCounterPresets(): CounterPreset[] {
    return Array.from(this.counterPresetsCache.values()).sort(
      (a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999) || a.label.localeCompare(b.label)
    );
  }

  public async saveCounterPreset(input: {
    id?: string;
    label: string;
    itemDescription: string;
    price: number;
    defaultVendor?: string;
    categoryColor: PresetColorKey;
  }): Promise<CounterPreset> {
    const id = input.id || `preset_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const existing = this.counterPresetsCache.get(id);
    const preset: CounterPreset = {
      id,
      label: input.label.trim(),
      itemDescription: input.itemDescription.trim() || input.label.trim(),
      price: Math.round(Number(input.price) * 100) / 100,
      defaultVendor: input.defaultVendor?.trim() || undefined,
      categoryColor: input.categoryColor,
      sortOrder: existing?.sortOrder ?? this.counterPresetsCache.size + 1,
      updatedAt: Date.now(),
    };

    this.counterPresetsCache.set(id, preset);
    this.notify();

    try {
      await setDoc(doc(db, 'counter_presets', id), {
        id: preset.id,
        label: preset.label,
        itemDescription: preset.itemDescription,
        price: preset.price,
        defaultVendor: preset.defaultVendor || null,
        categoryColor: preset.categoryColor,
        sortOrder: preset.sortOrder,
        updatedAt: preset.updatedAt,
      });
    } catch (e) {
      console.warn('Counter preset saved locally; Firestore sync pending:', e);
    }

    return preset;
  }

  public async deleteCounterPreset(id: string): Promise<void> {
    this.counterPresetsCache.delete(id);
    this.notify();

    try {
      await deleteDoc(doc(db, 'counter_presets', id));
    } catch (e) {
      console.warn('Counter preset deleted locally; Firestore sync pending:', e);
    }
  }

  public async resetDefaultCounterPresets(): Promise<void> {
    this.counterPresetsCache.clear();
    for (const preset of DEFAULT_COUNTER_PRESETS) {
      this.counterPresetsCache.set(preset.id, { ...preset, updatedAt: Date.now() });
    }
    this.notify();

    try {
      await Promise.allSettled(
        DEFAULT_COUNTER_PRESETS.map((preset) =>
          setDoc(doc(db, 'counter_presets', preset.id), {
            ...preset,
            defaultVendor: preset.defaultVendor || null,
            updatedAt: Date.now(),
          })
        )
      );
    } catch (e) {
      console.warn('Default counter presets saved locally; Firestore sync pending:', e);
    }
  }

  public getSyncStatus(): {
    isConnected: boolean;
    lastSyncTimestamp: number;
    onlineCardsCount: number;
    salesCount: number;
    tradesCount: number;
    vendorsCount: number;
  } {
    return {
      isConnected: this.isCloudConnected,
      lastSyncTimestamp: this.lastSyncTimestamp,
      onlineCardsCount: this.onlineCardsCache.size,
      salesCount: this.salesCache.size,
      tradesCount: this.tradesCache.size,
      vendorsCount: this.getKnownVendors().length,
    };
  }

  /**
   * Forces an immediate bi-directional pull and push with Cloud Firestore across all devices.
   */
  public async syncNow(): Promise<{ onlineCards: number; sales: number; trades: number }> {
    try {
      // 1. Online cards & barcodes
      const onlineSnap = await getDocs(collection(db, 'online_cards'));
      const remoteCardIds = new Set<string>();
      onlineSnap.forEach((docSnap) => {
        remoteCardIds.add(docSnap.id);
        const data = docSnap.data();
        this.onlineCardsCache.set(docSnap.id, {
          id: docSnap.id,
          barcode: data.barcode || docSnap.id,
          vendorName: data.vendorName || '',
          cardName: data.cardName || '',
          price: Number(data.price) || 0,
          status: data.status === 'sold' ? 'sold' : 'available',
          notes: data.notes || undefined,
          timestamp: data.timestamp || Date.now(),
          dateKey: data.dateKey || getLocalDateKey(new Date(data.timestamp || Date.now())),
          soldAt: data.soldAt || undefined,
          soldDateKey: data.soldDateKey || undefined,
          saleId: data.saleId || undefined,
          soldPaymentMethod: data.soldPaymentMethod || undefined,
        });
      });

      // Push any local cards that are not yet in Firestore
      const cardPromises: Promise<any>[] = [];
      this.onlineCardsCache.forEach((localCard, cardId) => {
        if (!remoteCardIds.has(cardId)) {
          cardPromises.push(
            setDoc(doc(db, 'online_cards', cardId), {
              id: localCard.id,
              barcode: localCard.barcode,
              vendorName: localCard.vendorName,
              cardName: localCard.cardName,
              price: localCard.price,
              status: localCard.status,
              notes: localCard.notes || null,
              timestamp: localCard.timestamp,
              dateKey: localCard.dateKey,
              soldAt: localCard.soldAt || null,
              soldDateKey: localCard.soldDateKey || null,
              saleId: localCard.saleId || null,
              soldPaymentMethod: localCard.soldPaymentMethod || null,
            })
          );
        }
      });
      await Promise.allSettled(cardPromises);

      // 2. Sales records
      const salesSnap = await getDocs(collection(db, 'sales'));
      const remoteSaleIds = new Set<string>();
      salesSnap.forEach((docSnap) => {
        remoteSaleIds.add(docSnap.id);
        const data = docSnap.data();
        const rawMethod = (data.paymentMethod || '').toString().toLowerCase().trim();
        const paymentMethod: PaymentMethod =
          rawMethod === 'cash'
            ? 'cash'
            : rawMethod === 'traded_out' ||
              rawMethod === 'trade_out' ||
              rawMethod === 'trade out' ||
              rawMethod === 'trade' ||
              rawMethod === 'traded'
            ? 'traded_out'
            : rawMethod === 'online'
            ? 'online'
            : 'card';

        this.salesCache.set(docSnap.id, {
          id: docSnap.id,
          salesmanName: data.salesmanName || '',
          operatorName: data.operatorName || undefined,
          itemDescription: data.itemDescription || (data.isMiscellaneous ? 'Miscellaneous' : ''),
          isMiscellaneous: Boolean(data.isMiscellaneous),
          amount: Number(data.amount) || 0,
          originalAmount: data.originalAmount !== undefined && data.originalAmount !== null ? Number(data.originalAmount) : undefined,
          discountAmount: data.discountAmount !== undefined && data.discountAmount !== null ? Number(data.discountAmount) : undefined,
          discountLabel: data.discountLabel || undefined,
          paymentMethod,
          notes: data.notes || undefined,
          timestamp: data.timestamp || Date.now(),
          dateKey: data.dateKey || getLocalDateKey(new Date(data.timestamp || Date.now())),
          isOnlineSale: Boolean(data.isOnlineSale) || paymentMethod === 'online',
          onlineCardId: data.onlineCardId || undefined,
          onlineBarcode: data.onlineBarcode || undefined,
          checkoutGroupId: data.checkoutGroupId || undefined,
          checkoutTotalAmount: data.checkoutTotalAmount !== undefined && data.checkoutTotalAmount !== null ? Number(data.checkoutTotalAmount) : undefined,
          splitSummary: data.splitSummary || undefined,
          basketItemCount: data.basketItemCount !== undefined && data.basketItemCount !== null ? Number(data.basketItemCount) : undefined,
          checkoutVendorSummary: data.checkoutVendorSummary || undefined,
          checkoutItemSummary: data.checkoutItemSummary || undefined,
          storeCreditCustomerId: data.storeCreditCustomerId || undefined,
          storeCreditCustomerName: data.storeCreditCustomerName || undefined,
          storeCreditAmount: data.storeCreditAmount !== undefined && data.storeCreditAmount !== null ? Number(data.storeCreditAmount) : undefined,
          relatedHoldId: data.relatedHoldId || undefined,
          tradeDetails: data.tradeDetails || undefined,
          tradeAcceptingVendor: data.tradeAcceptingVendor || undefined,
          tradeValue: data.tradeValue !== undefined && data.tradeValue !== null ? Number(data.tradeValue) : undefined,
          tradeItemDescription: data.tradeItemDescription || undefined,
        });
      });

      // 3. Trades records
      const tradesSnap = await getDocs(collection(db, 'trades'));
      tradesSnap.forEach((docSnap) => {
        const data = docSnap.data();
        const rawType = data.tradeType?.toLowerCase();
        const tradeType: TradeType = rawType === 'cash' ? 'cash' : 'credit';

        this.tradesCache.set(docSnap.id, {
          id: docSnap.id,
          vendorName: data.vendorName || '',
          operatorName: data.operatorName || undefined,
          itemDescription: data.itemDescription || '',
          tradeValue: Number(data.tradeValue) || 0,
          tradeType,
          dateKey: data.dateKey || getLocalDateKey(new Date(data.timestamp || Date.now())),
          timestamp: data.timestamp || Date.now(),
          customerName: data.customerName || undefined,
          storeCreditCustomerId: data.storeCreditCustomerId || undefined,
          notes: data.notes || undefined,
          isStandalone: data.isStandalone !== undefined ? Boolean(data.isStandalone) : true,
          soldItemDescription: data.soldItemDescription || undefined,
          saleAmount: data.saleAmount !== undefined && data.saleAmount !== null ? Number(data.saleAmount) : undefined,
          associatedSaleId: data.associatedSaleId || undefined,
        });
      });

      // 4. Cash Drawer Reconciliations
      const cashReconSnap = await getDocs(collection(db, 'cash_reconciliations'));
      cashReconSnap.forEach((docSnap) => {
        const data = docSnap.data();
        const dKey = data.dateKey || docSnap.id;
        this.cashReconciliationsCache.set(dKey, {
          dateKey: dKey,
          openingFloat: Number(data.openingFloat) || 0,
          actualCashCounted:
            data.actualCashCounted !== undefined && data.actualCashCounted !== null
              ? Number(data.actualCashCounted)
              : null,
          denominationCounts: data.denominationCounts || undefined,
          notes: data.notes || undefined,
          updatedAt: data.updatedAt || Date.now(),
        });
      });

      // 5. Store Credit Customers
      const custSnap = await getDocs(collection(db, 'store_credit_customers'));
      custSnap.forEach((docSnap) => {
        const data = docSnap.data();
        this.storeCreditCustomersCache.set(docSnap.id, {
          id: docSnap.id,
          name: data.name || 'Customer',
          normalizedName: (data.normalizedName || data.name || '').toString().trim().toLowerCase(),
          phone: data.phone || undefined,
          balance: Math.round((Number(data.balance) || 0) * 100) / 100,
          totalIssued: Math.round((Number(data.totalIssued) || 0) * 100) / 100,
          totalRedeemed: Math.round((Number(data.totalRedeemed) || 0) * 100) / 100,
          notes: data.notes || undefined,
          createdAt: data.createdAt || Date.now(),
          updatedAt: data.updatedAt || Date.now(),
        });
      });

      // 6. Store Credit Transactions
      const txSnap = await getDocs(collection(db, 'store_credit_transactions'));
      txSnap.forEach((docSnap) => {
        const data = docSnap.data();
        this.storeCreditTxCache.set(docSnap.id, {
          id: docSnap.id,
          customerId: data.customerId || '',
          customerName: data.customerName || 'Customer',
          type: data.type === 'redeem' ? 'redeem' : data.type === 'adjust' ? 'adjust' : 'issue',
          amount: Math.round((Number(data.amount) || 0) * 100) / 100,
          delta: Math.round((Number(data.delta) || 0) * 100) / 100,
          balanceAfter: Math.round((Number(data.balanceAfter) || 0) * 100) / 100,
          vendorName: data.vendorName || undefined,
          description: data.description || '',
          relatedTradeId: data.relatedTradeId || undefined,
          relatedCheckoutGroupId: data.relatedCheckoutGroupId || undefined,
          relatedSaleId: data.relatedSaleId || undefined,
          dateKey: data.dateKey || getLocalDateKey(new Date(data.timestamp || Date.now())),
          timestamp: data.timestamp || Date.now(),
        });
      });

      // 7. Customer Holds & Layaways
      const holdsSnap = await getDocs(collection(db, 'holds'));
      holdsSnap.forEach((docSnap) => {
        const data = docSnap.data();
        const rawStatus = (data.status || 'active').toString().toLowerCase();
        const status: HoldStatus =
          rawStatus === 'completed'
            ? 'completed'
            : rawStatus === 'cancelled'
            ? 'cancelled'
            : rawStatus === 'expired'
            ? 'expired'
            : 'active';
        const payments: HoldPayment[] = Array.isArray(data.payments)
          ? data.payments.map((p: any) => ({
              id: p.id || `hp_${Date.now()}`,
              amount: Math.round((Number(p.amount) || 0) * 100) / 100,
              paymentMethod: p.paymentMethod || 'cash',
              operatorName: p.operatorName || undefined,
              saleId: p.saleId || undefined,
              notes: p.notes || undefined,
              timestamp: p.timestamp || Date.now(),
              dateKey: p.dateKey || getLocalDateKey(new Date(p.timestamp || Date.now())),
            }))
          : [];
        this.holdsCache.set(docSnap.id, {
          id: docSnap.id,
          customerName: data.customerName || 'Customer',
          customerPhone: data.customerPhone || undefined,
          vendorName: data.vendorName || '',
          operatorName: data.operatorName || undefined,
          itemDescription: data.itemDescription || '',
          totalPrice: Math.round((Number(data.totalPrice) || 0) * 100) / 100,
          depositPaid: Math.round((Number(data.depositPaid) || 0) * 100) / 100,
          remainingBalance: Math.round((Number(data.remainingBalance) || 0) * 100) / 100,
          status,
          dueDateKey: data.dueDateKey || undefined,
          notes: data.notes || undefined,
          payments,
          createdAt: data.createdAt || Date.now(),
          dateKey: data.dateKey || getLocalDateKey(new Date(data.createdAt || Date.now())),
          updatedAt: data.updatedAt || data.createdAt || Date.now(),
          completedAt: data.completedAt || undefined,
        });
      });

      this.isCloudConnected = true;
      this.lastSyncTimestamp = Date.now();
      this.saveToStorage();
      this.notify();

      return {
        onlineCards: this.onlineCardsCache.size,
        sales: this.salesCache.size,
        trades: this.tradesCache.size,
      };
    } catch (e) {
      console.error('Error during syncNow:', e);
      throw e;
    }
  }

  public exportWeekToCsv(startDateKey: string, endDateKey: string, vendorName?: string): string {
    const list: SaleRecord[] = [];
    const filterVendor = vendorName?.trim().toLowerCase();

    this.salesCache.forEach((rec) => {
      if (rec.dateKey >= startDateKey && rec.dateKey <= endDateKey) {
        if (!filterVendor || rec.salesmanName.toLowerCase() === filterVendor) {
          list.push(rec);
        }
      }
    });

    list.sort((a, b) => b.timestamp - a.timestamp);

    const headers = [
      'Sale ID',
      'Date',
      'Time',
      'Vendor',
      'Rang By (Operator)',
      'Item Sold',
      'Gross Amount (£) [Before Commission]',
      'Discount (£)',
      'Discount Label',
      'Payment Method',
      'Notes',
    ];

    const rows = list.map((sale) => [
      sale.id,
      sale.dateKey,
      new Date(sale.timestamp).toLocaleTimeString(),
      `"${sale.salesmanName.replace(/"/g, '""')}"`,
      `"${(sale.operatorName || '').replace(/"/g, '""')}"`,
      `"${sale.itemDescription.replace(/"/g, '""')}"`,
      sale.amount.toFixed(2),
      sale.discountAmount ? sale.discountAmount.toFixed(2) : '0.00',
      `"${(sale.discountLabel || '').replace(/"/g, '""')}"`,
      sale.paymentMethod === 'traded_out' ? 'TRADE OUT' : sale.paymentMethod === 'online' ? 'ONLINE SALE' : sale.paymentMethod.toUpperCase(),
      `"${(sale.notes || '').replace(/"/g, '""')}"`,
    ]);

    return [
      `# DISCLAIMER: All gross sales amounts and trade values are before commission reductions`,
      headers.join(','),
      ...rows.map((r) => r.join(',')),
    ].join('\n');
  }

  public exportDayToCsv(dateKey: string, vendorName?: string): string {
    const filterVendor = vendorName?.trim().toLowerCase();
    const sales = this.getSalesForDay(dateKey).filter(
      (s) => !filterVendor || s.salesmanName.toLowerCase() === filterVendor
    );
    const headers = [
      'Sale ID',
      'Date',
      'Time',
      'Vendor',
      'Rang By (Operator)',
      'Item Sold',
      'Gross Amount (£) [Before Commission]',
      'Discount (£)',
      'Discount Label',
      'Payment Method',
      'Notes',
    ];
    const rows = sales.map((sale) => [
      sale.id,
      sale.dateKey,
      new Date(sale.timestamp).toLocaleTimeString(),
      `"${sale.salesmanName.replace(/"/g, '""')}"`,
      `"${(sale.operatorName || '').replace(/"/g, '""')}"`,
      `"${sale.itemDescription.replace(/"/g, '""')}"`,
      sale.amount.toFixed(2),
      sale.discountAmount ? sale.discountAmount.toFixed(2) : '0.00',
      `"${(sale.discountLabel || '').replace(/"/g, '""')}"`,
      sale.paymentMethod === 'traded_out' ? 'TRADE OUT' : sale.paymentMethod === 'online' ? 'ONLINE SALE' : sale.paymentMethod.toUpperCase(),
      `"${(sale.notes || '').replace(/"/g, '""')}"`,
    ]);

    if (filterVendor) {
      return [
        `# DISCLAIMER: All figures are gross totals before commission reductions`,
        headers.join(','),
        ...rows.map((r) => r.join(',')),
      ].join('\n');
    }

    const recon = this.getCashReconciliationSummary(dateKey);
    const reconLines = [
      '',
      `# END-OF-DAY CASH DRAWER RECONCILIATION (${dateKey})`,
      `Opening Float (£),${recon.openingFloat.toFixed(2)}`,
      `Cash Sales In (£),${recon.cashSalesIn.toFixed(2)}`,
      `Cash Trade-In Payouts Out (£),-${recon.cashTradesOut.toFixed(2)}`,
      `Expected Cash in Till (£),${recon.expectedCashInTill.toFixed(2)}`,
      `Actual Cash Counted (£),${recon.actualCashCounted !== null ? recon.actualCashCounted.toFixed(2) : 'Not Counted'}`,
      `Variance (£),${recon.variance !== null ? recon.variance.toFixed(2) : 'N/A'}`,
      `Status,${recon.status.toUpperCase()}`,
    ];

    return [
      `# DISCLAIMER: All figures are gross totals before commission reductions`,
      headers.join(','),
      ...rows.map((r) => r.join(',')),
      ...reconLines,
    ].join('\n');
  }

  // ==================== GIFT CARDS ====================

  public getGiftCards(): GiftCardRecord[] {
    return Array.from(this.giftCardsCache.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  public getGiftCardByBarcode(barcode: string): GiftCardRecord | undefined {
    const clean = (barcode || '').trim().toLowerCase();
    if (!clean) return undefined;
    for (const card of this.giftCardsCache.values()) {
      if (card.barcode.trim().toLowerCase() === clean) {
        return card;
      }
    }
    return undefined;
  }

  public getGiftCardTransactions(giftCardId?: string): GiftCardTransaction[] {
    const all = Array.from(this.giftCardTxCache.values());
    const filtered = giftCardId ? all.filter((tx) => tx.giftCardId === giftCardId) : all;
    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }

  public getGiftCardsOverview(): GiftCardsOverview {
    let activeCardsCount = 0;
    let emptyCardsCount = 0;
    let voidCardsCount = 0;
    let totalOutstandingBalance = 0;
    let totalLifetimeLoaded = 0;
    let totalLifetimeRedeemed = 0;

    for (const card of this.giftCardsCache.values()) {
      if (card.status === 'void') {
        voidCardsCount += 1;
      } else if (card.status === 'empty' || card.balance <= 0.004) {
        emptyCardsCount += 1;
      } else {
        activeCardsCount += 1;
        totalOutstandingBalance += card.balance;
      }
      totalLifetimeLoaded += card.totalLoaded || 0;
      totalLifetimeRedeemed += card.totalRedeemed || 0;
    }

    return {
      activeCardsCount,
      emptyCardsCount,
      voidCardsCount,
      totalCardsCount: this.giftCardsCache.size,
      totalOutstandingBalance: Math.round(totalOutstandingBalance * 100) / 100,
      totalLifetimeLoaded: Math.round(totalLifetimeLoaded * 100) / 100,
      totalLifetimeRedeemed: Math.round(totalLifetimeRedeemed * 100) / 100,
    };
  }

  private async persistGiftCardAndTx(card: GiftCardRecord, tx?: GiftCardTransaction) {
    this.giftCardsCache.set(card.id, card);
    if (tx) {
      this.giftCardTxCache.set(tx.id, tx);
    }
    this.notify();

    try {
      await setDoc(doc(db, 'gift_cards', card.id), {
        barcode: card.barcode,
        balance: card.balance,
        initialValue: card.initialValue,
        totalLoaded: card.totalLoaded,
        totalRedeemed: card.totalRedeemed,
        status: card.status,
        recipientName: card.recipientName || null,
        notes: card.notes || null,
        soldPaymentMethod: card.soldPaymentMethod || null,
        soldVendorName: card.soldVendorName || null,
        operatorName: card.operatorName || null,
        createdAt: card.createdAt,
        dateKey: card.dateKey,
        updatedAt: card.updatedAt,
        lastUsedAt: card.lastUsedAt || null,
      });

      if (tx) {
        await setDoc(doc(db, 'gift_card_transactions', tx.id), {
          giftCardId: tx.giftCardId,
          barcode: tx.barcode,
          type: tx.type,
          amount: tx.amount,
          delta: tx.delta,
          balanceAfter: tx.balanceAfter,
          paymentMethod: tx.paymentMethod || null,
          vendorName: tx.vendorName || null,
          operatorName: tx.operatorName || null,
          description: tx.description,
          relatedSaleId: tx.relatedSaleId || null,
          dateKey: tx.dateKey,
          timestamp: tx.timestamp,
        });
      }
    } catch (e) {
      console.warn('Gift card saved locally; Firestore sync pending:', e);
    }
  }

  public async activateGiftCard(input: {
    barcode: string;
    initialValue: number;
    paymentMethod?: PaymentMethod;
    recipientName?: string;
    notes?: string;
    recordAsSale?: boolean;
    vendorName?: string;
    dateKey?: string;
  }): Promise<{ card: GiftCardRecord; transaction: GiftCardTransaction }> {
    const cleanBarcode = input.barcode.trim();
    if (!cleanBarcode) throw new Error('Barcode is required.');
    const existing = this.getGiftCardByBarcode(cleanBarcode);
    if (existing) {
      throw new Error(`Gift card #${cleanBarcode} is already registered.`);
    }

    const val = Math.round(Number(input.initialValue) * 100) / 100;
    if (isNaN(val) || val <= 0) throw new Error('Initial value must be greater than £0.00.');

    const now = Date.now();
    const dateKey = input.dateKey || getLocalDateKey(new Date(now));
    const operatorName = getDeviceOperator() || undefined;
    const cardId = `gc_${now}_${Math.random().toString(36).slice(2, 7)}`;

    let relatedSaleId: string | undefined;
    if (input.recordAsSale && input.vendorName?.trim()) {
      const saleRec = await this.insertSale({
        salesmanName: input.vendorName.trim(),
        itemDescription: `Gift Card #${cleanBarcode}${input.recipientName?.trim() ? ` (${input.recipientName.trim()})` : ''}`,
        amount: val,
        paymentMethod: input.paymentMethod || 'card',
        notes: input.notes?.trim() || 'Gift card activation',
        operatorName,
        dateKey,
      });
      relatedSaleId = saleRec.id;
    }

    const card: GiftCardRecord = {
      id: cardId,
      barcode: cleanBarcode,
      balance: val,
      initialValue: val,
      totalLoaded: val,
      totalRedeemed: 0,
      status: 'active',
      recipientName: input.recipientName?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      soldPaymentMethod: input.paymentMethod || 'card',
      soldVendorName: input.vendorName?.trim() || undefined,
      operatorName,
      createdAt: now,
      dateKey,
      updatedAt: now,
    };

    const tx: GiftCardTransaction = {
      id: `gctx_${now}_${Math.random().toString(36).slice(2, 7)}`,
      giftCardId: cardId,
      barcode: cleanBarcode,
      type: 'activate',
      amount: val,
      delta: val,
      balanceAfter: val,
      paymentMethod: input.paymentMethod || 'card',
      vendorName: input.vendorName?.trim() || undefined,
      operatorName,
      description: `Activated gift card #${cleanBarcode}${input.recipientName?.trim() ? ` for ${input.recipientName.trim()}` : ''}`,
      relatedSaleId,
      dateKey,
      timestamp: now,
    };

    await this.persistGiftCardAndTx(card, tx);
    return { card, transaction: tx };
  }

  public async redeemGiftCard(
    cardId: string,
    input: {
      amount: number;
      description?: string;
      vendorName?: string;
      recordVendorRedemptionSale?: boolean;
      dateKey?: string;
    }
  ): Promise<{ card: GiftCardRecord; transaction: GiftCardTransaction }> {
    const existing = this.giftCardsCache.get(cardId);
    if (!existing) throw new Error('Gift card not found.');
    if (existing.status === 'void') throw new Error('This gift card is voided and cannot be redeemed.');

    const val = Math.round(Number(input.amount) * 100) / 100;
    if (isNaN(val) || val <= 0) throw new Error('Redemption amount must be greater than £0.00.');
    if (val > existing.balance + 0.004) {
      throw new Error(`Insufficient balance (${formatCurrency(existing.balance)} remaining).`);
    }

    const now = Date.now();
    const dateKey = input.dateKey || getLocalDateKey(new Date(now));
    const operatorName = getDeviceOperator() || undefined;
    const newBalance = Math.max(0, Math.round((existing.balance - val) * 100) / 100);

    let relatedSaleId: string | undefined;
    if (input.recordVendorRedemptionSale && input.vendorName?.trim()) {
      const saleRec = await this.insertSale({
        salesmanName: input.vendorName.trim(),
        itemDescription: input.description?.trim()
          ? `${input.description.trim()} (Gift Card #${existing.barcode})`
          : `Gift Card Redemption (#${existing.barcode})`,
        amount: val,
        paymentMethod: 'traded_out',
        notes: `Paid by Gift Card #${existing.barcode}`,
        operatorName,
        dateKey,
      });
      relatedSaleId = saleRec.id;
    }

    const updated: GiftCardRecord = {
      ...existing,
      balance: newBalance,
      totalRedeemed: Math.round(((existing.totalRedeemed || 0) + val) * 100) / 100,
      status: newBalance <= 0.004 ? 'empty' : 'active',
      updatedAt: now,
      lastUsedAt: now,
    };

    const tx: GiftCardTransaction = {
      id: `gctx_${now}_${Math.random().toString(36).slice(2, 7)}`,
      giftCardId: existing.id,
      barcode: existing.barcode,
      type: 'redeem',
      amount: val,
      delta: -val,
      balanceAfter: newBalance,
      vendorName: input.vendorName?.trim() || undefined,
      operatorName,
      description: input.description?.trim() || `Redeemed ${formatCurrency(val)}`,
      relatedSaleId,
      dateKey,
      timestamp: now,
    };

    await this.persistGiftCardAndTx(updated, tx);
    return { card: updated, transaction: tx };
  }

  public async topUpGiftCard(
    cardId: string,
    input: {
      amount: number;
      paymentMethod?: PaymentMethod;
      description?: string;
      recordAsSale?: boolean;
      vendorName?: string;
      dateKey?: string;
    }
  ): Promise<{ card: GiftCardRecord; transaction: GiftCardTransaction }> {
    const existing = this.giftCardsCache.get(cardId);
    if (!existing) throw new Error('Gift card not found.');
    if (existing.status === 'void') throw new Error('Cannot top up a voided gift card.');

    const val = Math.round(Number(input.amount) * 100) / 100;
    if (isNaN(val) || val <= 0) throw new Error('Top-up amount must be greater than £0.00.');

    const now = Date.now();
    const dateKey = input.dateKey || getLocalDateKey(new Date(now));
    const operatorName = getDeviceOperator() || undefined;
    const newBalance = Math.round((existing.balance + val) * 100) / 100;

    let relatedSaleId: string | undefined;
    if (input.recordAsSale && input.vendorName?.trim()) {
      const saleRec = await this.insertSale({
        salesmanName: input.vendorName.trim(),
        itemDescription: `Gift Card Top-Up #${existing.barcode}`,
        amount: val,
        paymentMethod: input.paymentMethod || 'card',
        notes: input.description?.trim() || 'Gift card reload',
        operatorName,
        dateKey,
      });
      relatedSaleId = saleRec.id;
    }

    const updated: GiftCardRecord = {
      ...existing,
      balance: newBalance,
      totalLoaded: Math.round(((existing.totalLoaded || 0) + val) * 100) / 100,
      status: 'active',
      updatedAt: now,
      lastUsedAt: now,
    };

    const tx: GiftCardTransaction = {
      id: `gctx_${now}_${Math.random().toString(36).slice(2, 7)}`,
      giftCardId: existing.id,
      barcode: existing.barcode,
      type: 'topup',
      amount: val,
      delta: val,
      balanceAfter: newBalance,
      paymentMethod: input.paymentMethod || 'card',
      vendorName: input.vendorName?.trim() || undefined,
      operatorName,
      description: input.description?.trim() || `Reloaded +${formatCurrency(val)}`,
      relatedSaleId,
      dateKey,
      timestamp: now,
    };

    await this.persistGiftCardAndTx(updated, tx);
    return { card: updated, transaction: tx };
  }

  public async adjustGiftCardBalance(
    cardId: string,
    input: {
      newBalance: number;
      reason?: string;
      recipientName?: string;
      notes?: string;
      dateKey?: string;
    }
  ): Promise<{ card: GiftCardRecord; transaction: GiftCardTransaction }> {
    const existing = this.giftCardsCache.get(cardId);
    if (!existing) throw new Error('Gift card not found.');

    const target = Math.max(0, Math.round(Number(input.newBalance) * 100) / 100);
    const delta = Math.round((target - existing.balance) * 100) / 100;
    const now = Date.now();
    const dateKey = input.dateKey || getLocalDateKey(new Date(now));
    const operatorName = getDeviceOperator() || undefined;

    const updated: GiftCardRecord = {
      ...existing,
      balance: target,
      status: existing.status === 'void' ? 'void' : target <= 0.004 ? 'empty' : 'active',
      recipientName: input.recipientName !== undefined ? input.recipientName.trim() || undefined : existing.recipientName,
      notes: input.notes !== undefined ? input.notes.trim() || undefined : existing.notes,
      updatedAt: now,
    };

    const tx: GiftCardTransaction = {
      id: `gctx_${now}_${Math.random().toString(36).slice(2, 7)}`,
      giftCardId: existing.id,
      barcode: existing.barcode,
      type: 'adjust',
      amount: Math.abs(delta),
      delta,
      balanceAfter: target,
      operatorName,
      description: input.reason?.trim() || `Manual balance adjustment to ${formatCurrency(target)}`,
      dateKey,
      timestamp: now,
    };

    await this.persistGiftCardAndTx(updated, tx);
    return { card: updated, transaction: tx };
  }

  public async toggleVoidGiftCard(
    cardId: string,
    shouldVoid: boolean,
    reason?: string
  ): Promise<GiftCardRecord | undefined> {
    const existing = this.giftCardsCache.get(cardId);
    if (!existing) return undefined;

    const now = Date.now();
    const dateKey = getLocalDateKey(new Date(now));
    const operatorName = getDeviceOperator() || undefined;
    const nextStatus: GiftCardStatus = shouldVoid
      ? 'void'
      : existing.balance <= 0.004
      ? 'empty'
      : 'active';

    const updated: GiftCardRecord = {
      ...existing,
      status: nextStatus,
      updatedAt: now,
    };

    const tx: GiftCardTransaction = {
      id: `gctx_${now}_${Math.random().toString(36).slice(2, 7)}`,
      giftCardId: existing.id,
      barcode: existing.barcode,
      type: 'void',
      amount: 0,
      delta: 0,
      balanceAfter: existing.balance,
      operatorName,
      description: shouldVoid
        ? `Voided card${reason?.trim() ? `: ${reason.trim()}` : ''}`
        : `Reactivated card${reason?.trim() ? `: ${reason.trim()}` : ''}`,
      dateKey,
      timestamp: now,
    };

    await this.persistGiftCardAndTx(updated, tx);
    return updated;
  }

  public async deleteGiftCard(cardId: string): Promise<void> {
    this.giftCardsCache.delete(cardId);
    const txToDelete: string[] = [];
    for (const [txId, tx] of this.giftCardTxCache.entries()) {
      if (tx.giftCardId === cardId) {
        this.giftCardTxCache.delete(txId);
        txToDelete.push(txId);
      }
    }
    this.notify();

    try {
      await deleteDoc(doc(db, 'gift_cards', cardId));
      await Promise.all(txToDelete.map((txId) => deleteDoc(doc(db, 'gift_card_transactions', txId))));
    } catch (e) {
      console.warn('Gift card deleted locally; Firestore sync pending:', e);
    }
  }
}

export interface DayBreakdownItem {
  dateKey: string;
  dayName: string;
  fullDayName: string;
  formattedDate: string;
  isToday: boolean;
  salesCount: number;
  totalRevenue: number;
  cashRevenue: number;
  cardRevenue: number;
  onlineRevenue?: number;
  onlineCount?: number;
  tradedOutRevenue: number;
  tradedOutCount: number;
  tradeTakenInAmount: number;
  tradeTakenInCount: number;
  cashTradeValue: number;
  creditTradeValue: number;
}

export interface VendorDayDetails {
  vendorName: string;
  color: string;
  dateKey: string;
  formattedDate: string;
  salesCount: number;
  totalRevenue: number;
  cashRevenue: number;
  cashCount: number;
  cardRevenue: number;
  cardCount: number;
  onlineRevenue?: number;
  onlineCount?: number;
  tradedOutRevenue: number;
  tradedOutCount: number;
  averageTicket: number;
  sales: SaleRecord[];
  tradesTakenIn: TradeRecord[];
  totalTradeTakenInAmount: number;
  tradeTakenInCount: number;
  cashTradeValue: number;
  cashTradeCount: number;
  creditTradeValue: number;
  creditTradeCount: number;
}

export interface VendorWeekDetails {
  vendorName: string;
  color: string;
  weekInfo: WeekRangeInfo;
  salesCount: number;
  totalRevenue: number;
  cashRevenue: number;
  cashCount: number;
  cardRevenue: number;
  cardCount: number;
  onlineRevenue?: number;
  onlineCount?: number;
  tradedOutRevenue: number;
  tradedOutCount: number;
  averageTicket: number;
  totalTradeTakenInAmount: number;
  tradeTakenInCount: number;
  cashTradeValue: number;
  cashTradeCount: number;
  creditTradeValue: number;
  creditTradeCount: number;
  dayBreakdown: DayBreakdownItem[];
  sales: SaleRecord[];
  tradesTakenIn: TradeRecord[];
}

export const cloudDb = new CloudSalesDatabase();

