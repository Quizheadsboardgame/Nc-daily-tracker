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
} from '../types';

export const DEFAULT_PRELOADED_VENDORS = ['Pete', 'Kieron', 'Newtons', 'Roy', 'Connor', 'Charlie'];
export const DEFAULT_PRELOADED_SALESMEN = DEFAULT_PRELOADED_VENDORS;

export const DEFAULT_VENDOR_COLORS: Record<string, string> = {
  Pete: '#2563eb', // Royal Blue
  Kieron: '#059669', // Emerald Green
  Newtons: '#7c3aed', // Purple Violet
  Roy: '#d97706', // Amber Gold
  Connor: '#dc2626', // Ruby Red
  Charlie: '#0891b2', // Teal Cyan
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
  private salesmenList: string[] = [...DEFAULT_PRELOADED_SALESMEN];
  private vendorColors: Map<string, string> = new Map(Object.entries(DEFAULT_VENDOR_COLORS));
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
      const storedSalesmen = localStorage.getItem(STORAGE_SALESMEN_KEY);
      if (storedSalesmen) {
        const parsed = JSON.parse(storedSalesmen);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.salesmenList = Array.from(new Set([...DEFAULT_PRELOADED_SALESMEN, ...parsed])).sort();
        }
      }

      const storedColors = localStorage.getItem(STORAGE_VENDOR_COLORS_KEY);
      if (storedColors) {
        const parsedColors = JSON.parse(storedColors);
        if (typeof parsedColors === 'object' && parsedColors !== null) {
          Object.entries(parsedColors).forEach(([vendor, color]) => {
            if (typeof color === 'string') {
              this.vendorColors.set(vendor, color);
            }
          });
        }
      }

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
    } catch (e) {
      console.warn('Could not read localStorage cache:', e);
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_SALESMEN_KEY, JSON.stringify(this.salesmenList));
      const colorsObj: Record<string, string> = {};
      this.vendorColors.forEach((color, name) => {
        colorsObj[name] = color;
      });
      localStorage.setItem(STORAGE_VENDOR_COLORS_KEY, JSON.stringify(colorsObj));
      localStorage.setItem(STORAGE_SALES_KEY, JSON.stringify(Array.from(this.salesCache.values())));
      localStorage.setItem(STORAGE_TRADES_KEY, JSON.stringify(Array.from(this.tradesCache.values())));
      localStorage.setItem(STORAGE_ONLINE_CARDS_KEY, JSON.stringify(Array.from(this.onlineCardsCache.values())));
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
      // 1. Real-time listener for Salesmen Roster & Colors across all devices
      const salesmenCol = collection(db, 'salesmen');
      onSnapshot(
        salesmenCol,
        (snapshot) => {
          this.isCloudConnected = true;
          this.lastSyncTimestamp = Date.now();
          if (snapshot.empty) {
            this.seedFirestoreSalesmen();
            return;
          }

          const remoteNames: string[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.name) {
              remoteNames.push(data.name);
              if (data.color) {
                this.vendorColors.set(data.name, data.color);
              }
            }
          });

          if (remoteNames.length > 0) {
            this.salesmenList = Array.from(new Set([...DEFAULT_PRELOADED_SALESMEN, ...remoteNames])).sort();
            this.notify();
          }
        },
        (error) => {
          console.warn('Salesmen Firestore listener error:', error);
        }
      );

      // 2. Real-time listener for Sales Records (Cash, Card, Traded Out, Online) across all devices
      const salesCol = collection(db, 'sales');
      onSnapshot(
        salesCol,
        (snapshot) => {
          this.isCloudConnected = true;
          this.lastSyncTimestamp = Date.now();
          const remoteSaleIds = new Set<string>();

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
              itemDescription: data.itemDescription || (data.isMiscellaneous ? 'Miscellaneous' : ''),
              isMiscellaneous: Boolean(data.isMiscellaneous) || data.itemDescription?.trim().toLowerCase() === 'miscellaneous',
              amount: Number(data.amount) || 0,
              paymentMethod,
              notes: data.notes || undefined,
              timestamp: data.timestamp || Date.now(),
              dateKey: data.dateKey || getLocalDateKey(new Date(data.timestamp || Date.now())),
              isOnlineSale: Boolean(data.isOnlineSale) || paymentMethod === 'online',
              onlineCardId: data.onlineCardId || undefined,
              onlineBarcode: data.onlineBarcode || undefined,
              tradeDetails: data.tradeDetails || undefined,
              tradeAcceptingVendor: data.tradeAcceptingVendor || undefined,
              tradeValue: data.tradeValue !== undefined && data.tradeValue !== null ? Number(data.tradeValue) : undefined,
              tradeItemDescription: data.tradeItemDescription || undefined,
            });
          });

          // Sync any local sales that haven't reached Firestore yet (e.g. offline fallback)
          this.salesCache.forEach((localSale, saleId) => {
            if (!remoteSaleIds.has(saleId)) {
              setDoc(doc(db, 'sales', saleId), {
                salesmanName: localSale.salesmanName,
                itemDescription: localSale.itemDescription,
                isMiscellaneous: localSale.isMiscellaneous || false,
                amount: localSale.amount,
                paymentMethod: localSale.paymentMethod,
                notes: localSale.notes || null,
                timestamp: localSale.timestamp,
                dateKey: localSale.dateKey,
                isOnlineSale: Boolean(localSale.isOnlineSale),
                onlineCardId: localSale.onlineCardId || null,
                onlineBarcode: localSale.onlineBarcode || null,
              }).catch((e) => console.warn('Could not sync local sale to Firestore:', e));
            }
          });

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
              itemDescription: data.itemDescription || '',
              tradeValue: Number(data.tradeValue) || 0,
              tradeType,
              dateKey: data.dateKey || getLocalDateKey(new Date(data.timestamp || Date.now())),
              timestamp: data.timestamp || Date.now(),
              customerName: data.customerName || undefined,
              notes: data.notes || undefined,
              isStandalone: data.isStandalone !== undefined ? Boolean(data.isStandalone) : true,
              soldItemDescription: data.soldItemDescription || undefined,
              saleAmount: data.saleAmount !== undefined && data.saleAmount !== null ? Number(data.saleAmount) : undefined,
              associatedSaleId: data.associatedSaleId || undefined,
            });
          });

          // Sync any local trades that haven't reached Firestore yet
          this.tradesCache.forEach((localTrade, tradeId) => {
            if (!remoteTradeIds.has(tradeId)) {
              setDoc(doc(db, 'trades', tradeId), {
                vendorName: localTrade.vendorName,
                itemDescription: localTrade.itemDescription,
                tradeValue: localTrade.tradeValue,
                tradeType: localTrade.tradeType,
                dateKey: localTrade.dateKey,
                timestamp: localTrade.timestamp,
                customerName: localTrade.customerName || null,
                notes: localTrade.notes || null,
                isStandalone: localTrade.isStandalone !== undefined ? Boolean(localTrade.isStandalone) : true,
                soldItemDescription: localTrade.soldItemDescription || null,
                saleAmount: localTrade.saleAmount !== undefined && localTrade.saleAmount !== null ? Number(localTrade.saleAmount) : null,
                associatedSaleId: localTrade.associatedSaleId || null,
              }).catch((e) => console.warn('Could not sync local trade to Firestore:', e));
            }
          });

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
            });
          });

          // Sync any local cards that haven't reached Firestore yet (e.g. created offline or before rules deployment)
          this.onlineCardsCache.forEach((localCard, cardId) => {
            if (!remoteCardIds.has(cardId)) {
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
              }).catch((e) => console.warn('Could not sync local card to Firestore:', e));
            }
          });

          this.saveToStorage();
          this.notify();
        },
        (error) => {
          console.warn('Online cards Firestore listener error:', error);
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
    const vendorSet = new Set<string>();

    // 1. Default preloaded vendors
    for (const v of DEFAULT_PRELOADED_SALESMEN) {
      if (v && v.trim()) vendorSet.add(v.trim());
    }

    // 2. Salesmen / Vendors roster from state
    for (const v of this.salesmenList) {
      if (v && v.trim()) vendorSet.add(v.trim());
    }

    // 3. Any vendor configured with an assigned color
    this.vendorColors.forEach((_, name) => {
      if (name && name.trim()) vendorSet.add(name.trim());
    });

    // 4. Any vendor that appears in any recorded sales
    this.salesCache.forEach((sale) => {
      if (sale.salesmanName && sale.salesmanName.trim()) {
        vendorSet.add(sale.salesmanName.trim());
      }
      if (sale.tradeAcceptingVendor && sale.tradeAcceptingVendor.trim()) {
        vendorSet.add(sale.tradeAcceptingVendor.trim());
      }
    });

    // 5. Any vendor that appears in cards trades
    this.tradesCache.forEach((trade) => {
      if (trade.vendorName && trade.vendorName.trim()) {
        vendorSet.add(trade.vendorName.trim());
      }
    });

    // 6. Any vendor that has online cards registered
    this.onlineCardsCache.forEach((card) => {
      if (card.vendorName && card.vendorName.trim()) {
        vendorSet.add(card.vendorName.trim());
      }
    });

    // Keep this.salesmenList up to date with discovered vendors
    const all = Array.from(vendorSet).filter(Boolean).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' })
    );

    if (all.length > this.salesmenList.length) {
      this.salesmenList = all;
    }

    return all;
  }

  public getKnownSalesmen(): string[] {
    return this.getKnownVendors();
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
    if (!clean) return false;

    const assignedColor = color || this.getVendorColor(clean);
    this.vendorColors.set(clean, assignedColor);

    if (!this.salesmenList.includes(clean)) {
      this.salesmenList.push(clean);
      this.salesmenList.sort();
      this.notify();
    }

    try {
      const docId = clean.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now().toString(36);
      await setDoc(doc(db, 'salesmen', docId), {
        name: clean,
        color: assignedColor,
        createdAt: Date.now(),
      });
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

    this.salesmenList = this.salesmenList.filter((n) => n !== clean);
    this.vendorColors.delete(clean);
    this.notify();

    try {
      const snap = await getDocs(collection(db, 'salesmen'));
      const deletes: Promise<void>[] = [];
      snap.forEach((docSnap) => {
        if (docSnap.data().name?.toLowerCase() === clean.toLowerCase()) {
          deletes.push(deleteDoc(docSnap.ref));
        }
      });
      await Promise.all(deletes);
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
    itemDescription: string;
    isMiscellaneous?: boolean;
    amount: number;
    paymentMethod: PaymentMethod; // cash, card, traded_out, or online
    notes?: string;
    dateKey?: string;
    timestamp?: number;
    isOnlineSale?: boolean;
    onlineCardId?: string;
    onlineBarcode?: string;
  }): Promise<SaleRecord> {
    const timestamp = input.timestamp || Date.now();
    const dateKey = input.dateKey || getLocalDateKey(new Date(timestamp));
    const id = 'sale_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    const isMiscellaneous = Boolean(input.isMiscellaneous) || input.itemDescription.trim().toLowerCase() === 'miscellaneous';
    const finalDescription = isMiscellaneous && !input.itemDescription.trim() ? 'Miscellaneous' : input.itemDescription.trim();

    const paymentMethod: PaymentMethod = input.paymentMethod === 'cash'
      ? 'cash'
      : input.paymentMethod === 'traded_out'
      ? 'traded_out'
      : input.paymentMethod === 'online'
      ? 'online'
      : 'card';

    const isOnlineSale = Boolean(input.isOnlineSale) || paymentMethod === 'online';

    const record: SaleRecord = {
      id,
      salesmanName: input.salesmanName.trim(),
      itemDescription: finalDescription,
      isMiscellaneous: isMiscellaneous ? true : undefined,
      amount: Math.round(Number(input.amount) * 100) / 100,
      paymentMethod,
      notes: input.notes?.trim() || undefined,
      timestamp,
      dateKey,
      isOnlineSale: isOnlineSale ? true : undefined,
      onlineCardId: input.onlineCardId || undefined,
      onlineBarcode: input.onlineBarcode || undefined,
    };

    // Store in cache & notify
    this.salesCache.set(id, record);

    if (!this.salesmenList.includes(record.salesmanName)) {
      this.salesmenList.push(record.salesmanName);
      this.salesmenList.sort();
    }

    this.notify();

    // Persist to Firestore
    try {
      await setDoc(doc(db, 'sales', id), {
        salesmanName: record.salesmanName,
        itemDescription: record.itemDescription,
        isMiscellaneous: record.isMiscellaneous || false,
        amount: record.amount,
        paymentMethod: record.paymentMethod,
        notes: record.notes || null,
        timestamp: record.timestamp,
        dateKey: record.dateKey,
        isOnlineSale: isOnlineSale,
        onlineCardId: input.onlineCardId || null,
        onlineBarcode: input.onlineBarcode || null,
      });
    } catch (e) {
      console.warn('Sale saved to memory/localStorage; Firestore sync pending:', e);
    }

    return record;
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
    this.salesCache.delete(id);
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
    itemDescription: string;
    tradeValue: number;
    tradeType: TradeType; // 'cash' or 'credit'
    customerName?: string;
    notes?: string;
    dateKey?: string;
    timestamp?: number;
  }): Promise<TradeRecord> {
    const timestamp = input.timestamp || Date.now();
    const dateKey = input.dateKey || getLocalDateKey(new Date(timestamp));
    const cleanVendor = input.vendorName.trim();
    const cleanItem = input.itemDescription.trim();
    const val = Math.round(Number(input.tradeValue) * 100) / 100;
    const tradeType: TradeType = input.tradeType === 'cash' ? 'cash' : 'credit';

    const id = `trade_${timestamp}_${Math.random().toString(36).slice(2, 7)}`;
    const record: TradeRecord = {
      id,
      vendorName: cleanVendor,
      itemDescription: cleanItem,
      tradeValue: isNaN(val) ? 0 : val,
      tradeType,
      customerName: input.customerName?.trim() || undefined,
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
        itemDescription: record.itemDescription,
        tradeValue: record.tradeValue,
        tradeType: record.tradeType,
        customerName: record.customerName || null,
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

      await updateDoc(doc(db, 'trades', id), firestoreUpdates);
    } catch (e) {
      console.warn('Trade updated locally; Firestore sync pending:', e);
    }
  }

  public async deleteTrade(id: string) {
    this.tradesCache.delete(id);
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

  public async sellOnlineCard(
    barcodeOrId: string,
    options?: {
      targetDateKey?: string;
      customPrice?: number;
      notes?: string;
    }
  ): Promise<{ card: OnlineCard; sale: SaleRecord }> {
    const card = this.getOnlineCardByBarcode(barcodeOrId);
    if (!card) {
      throw new Error(`No card found with barcode or ID: "${barcodeOrId}"`);
    }

    if (card.status === 'sold') {
      throw new Error(`This card (${card.cardName} - ${card.barcode}) was already sold on ${card.soldDateKey || 'a previous date'}!`);
    }

    const soldPrice = options?.customPrice !== undefined ? Math.round(Number(options.customPrice) * 100) / 100 : card.price;
    const soldDateKey = options?.targetDateKey || getLocalDateKey();
    const soldAt = Date.now();

    // 1. Record the sale in the Sales Ledger as an Online Sale
    const sale = await this.insertSale({
      salesmanName: card.vendorName,
      itemDescription: `${card.cardName} (Online #${card.barcode})`,
      amount: soldPrice,
      paymentMethod: 'online',
      notes: options?.notes ? `Online Sale [${card.barcode}]: ${options.notes}` : `Online Sale [${card.barcode}]`,
      dateKey: soldDateKey,
      timestamp: soldAt,
    });

    // Also update sale record with online metadata
    await this.updateSale(sale.id, {
      isOnlineSale: true,
      onlineCardId: card.id,
      onlineBarcode: card.barcode,
    });

    // 2. Mark online card as sold
    const updatedCard: OnlineCard = {
      ...card,
      status: 'sold',
      soldAt,
      soldDateKey,
      saleId: sale.id,
    };

    this.onlineCardsCache.set(card.id, updatedCard);
    this.notify();

    try {
      await updateDoc(doc(db, 'online_cards', card.id), {
        status: 'sold',
        soldAt,
        soldDateKey,
        saleId: sale.id,
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
    };

    this.onlineCardsCache.set(cardId, updatedCard);
    this.notify();

    try {
      await updateDoc(doc(db, 'online_cards', cardId), {
        status: 'available',
        soldAt: null,
        soldDateKey: null,
        saleId: null,
      });
    } catch (e) {
      console.warn('Returned card to stock locally; Firestore sync pending:', e);
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
          itemDescription: data.itemDescription || (data.isMiscellaneous ? 'Miscellaneous' : ''),
          isMiscellaneous: Boolean(data.isMiscellaneous),
          amount: Number(data.amount) || 0,
          paymentMethod,
          notes: data.notes || undefined,
          timestamp: data.timestamp || Date.now(),
          dateKey: data.dateKey || getLocalDateKey(new Date(data.timestamp || Date.now())),
          isOnlineSale: Boolean(data.isOnlineSale) || paymentMethod === 'online',
          onlineCardId: data.onlineCardId || undefined,
          onlineBarcode: data.onlineBarcode || undefined,
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
          itemDescription: data.itemDescription || '',
          tradeValue: Number(data.tradeValue) || 0,
          tradeType,
          dateKey: data.dateKey || getLocalDateKey(new Date(data.timestamp || Date.now())),
          timestamp: data.timestamp || Date.now(),
          customerName: data.customerName || undefined,
          notes: data.notes || undefined,
          isStandalone: data.isStandalone !== undefined ? Boolean(data.isStandalone) : true,
          soldItemDescription: data.soldItemDescription || undefined,
          saleAmount: data.saleAmount !== undefined && data.saleAmount !== null ? Number(data.saleAmount) : undefined,
          associatedSaleId: data.associatedSaleId || undefined,
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
      'Item Sold',
      'Gross Amount (£) [Before Commission]',
      'Payment Method',
      'Notes',
    ];

    const rows = list.map((sale) => [
      sale.id,
      sale.dateKey,
      new Date(sale.timestamp).toLocaleTimeString(),
      `"${sale.salesmanName.replace(/"/g, '""')}"`,
      `"${sale.itemDescription.replace(/"/g, '""')}"`,
      sale.amount.toFixed(2),
      sale.paymentMethod === 'traded_out' ? 'TRADE OUT' : sale.paymentMethod === 'online' ? 'ONLINE SALE' : sale.paymentMethod.toUpperCase(),
      `"${(sale.notes || '').replace(/"/g, '""')}"`,
    ]);

    return [
      `# DISCLAIMER: All gross sales amounts and trade values are before commission reductions`,
      headers.join(','),
      ...rows.map((r) => r.join(',')),
    ].join('\n');
  }

  public exportDayToCsv(dateKey: string): string {
    const sales = this.getSalesForDay(dateKey);
    const headers = [
      'Sale ID',
      'Date',
      'Time',
      'Vendor',
      'Item Sold',
      'Gross Amount (£) [Before Commission]',
      'Payment Method',
      'Notes',
    ];
    const rows = sales.map((sale) => [
      sale.id,
      sale.dateKey,
      new Date(sale.timestamp).toLocaleTimeString(),
      `"${sale.salesmanName.replace(/"/g, '""')}"`,
      `"${sale.itemDescription.replace(/"/g, '""')}"`,
      sale.amount.toFixed(2),
      sale.paymentMethod === 'traded_out' ? 'TRADE OUT' : sale.paymentMethod === 'online' ? 'ONLINE SALE' : sale.paymentMethod.toUpperCase(),
      `"${(sale.notes || '').replace(/"/g, '""')}"`,
    ]);

    return [
      `# DISCLAIMER: All figures are gross totals before commission reductions`,
      headers.join(','),
      ...rows.map((r) => r.join(',')),
    ].join('\n');
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

