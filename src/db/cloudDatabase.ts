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
  private salesmenList: string[] = [...DEFAULT_PRELOADED_SALESMEN];
  private vendorColors: Map<string, string> = new Map(Object.entries(DEFAULT_VENDOR_COLORS));
  private listeners: Set<() => void> = new Set();
  public isCloudConnected: boolean = false;

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
            this.salesCache.set(item.id, item);
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

      // 2. Real-time listener for Sales Records (Cash & Card) across all devices
      const salesCol = collection(db, 'sales');
      const salesQuery = query(salesCol, orderBy('timestamp', 'desc'));
      onSnapshot(
        salesQuery,
        (snapshot) => {
          this.isCloudConnected = true;
          this.salesCache.clear();
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const rawMethod = data.paymentMethod?.toLowerCase();
            const paymentMethod: PaymentMethod = rawMethod === 'cash' ? 'cash' : 'card';

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
              tradeDetails: data.tradeDetails || undefined,
              tradeAcceptingVendor: data.tradeAcceptingVendor || undefined,
              tradeValue: data.tradeValue !== undefined && data.tradeValue !== null ? Number(data.tradeValue) : undefined,
              tradeItemDescription: data.tradeItemDescription || undefined,
            });
          });

          this.notify();
        },
        (error) => {
          console.warn('Sales Firestore listener error:', error);
        }
      );

      // 3. Real-time listener for Trades collection (Cards traded for Cash or Vendor Credit)
      const tradesCol = collection(db, 'trades');
      const tradesQuery = query(tradesCol, orderBy('timestamp', 'desc'));
      onSnapshot(
        tradesQuery,
        (snapshot) => {
          this.isCloudConnected = true;
          this.tradesCache.clear();
          snapshot.forEach((docSnap) => {
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

          this.notify();
        },
        (error) => {
          console.warn('Trades Firestore listener error:', error);
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
    return this.salesmenList;
  }

  public getKnownSalesmen(): string[] {
    return this.getKnownVendors();
  }

  public getVendorColor(name: string): string {
    if (!name) return '#64748b';
    if (this.vendorColors.has(name)) {
      return this.vendorColors.get(name)!;
    }
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % PRESET_VENDOR_PALETTE.length;
    const fallbackColor = PRESET_VENDOR_PALETTE[index].hex;
    this.vendorColors.set(name, fallbackColor);
    return fallbackColor;
  }

  public getVendorProfiles(): { name: string; color: string }[] {
    return this.salesmenList.map((name) => ({
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
    paymentMethod: PaymentMethod; // cash, card, or traded_out
    notes?: string;
    dateKey?: string;
    timestamp?: number;
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
      : 'card';

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
      let dayTradedOut = 0;
      let dayTradedOutCount = 0;

      for (const s of daySales) {
        dayTotal += s.amount;
        if (s.paymentMethod === 'cash') {
          dayCash += s.amount;
        } else if (s.paymentMethod === 'traded_out') {
          dayTradedOut += s.amount;
          dayTradedOutCount++;
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
      sale.paymentMethod.toUpperCase(),
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
      sale.paymentMethod.toUpperCase(),
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
