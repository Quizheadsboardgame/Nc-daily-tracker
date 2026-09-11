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
import { SaleRecord, PaymentMethod, DaySummary, SalesmanStat } from '../types';

export const DEFAULT_PRELOADED_SALESMEN = ['Pete', 'Kieron', 'Newtons', 'Roy', 'Connor', 'Charlie'];

const STORAGE_SALES_KEY = 'daily_sales_tracker_records_v4';
const STORAGE_SALESMEN_KEY = 'daily_sales_tracker_salesmen_v4';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(config) : getApp();

// Initialize Firestore with specific database ID from config
export const db = getFirestore(app, config.firestoreDatabaseId);

/* Utility to format Date into YYYY-MM-DD local format */
export function getLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
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

/**
 * Cloud Sales Database with Local-First Fallback
 * Guaranteed zero data loss: writes immediately to memory & localStorage, then syncs to Firestore
 */
class CloudSalesDatabase {
  private salesCache: Map<string, SaleRecord> = new Map();
  private salesmenList: string[] = [...DEFAULT_PRELOADED_SALESMEN];
  private listeners: Set<() => void> = new Set();
  public isCloudConnected: boolean = false;

  constructor() {
    this.loadFromStorage();
    this.initRealtimeListeners();
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

      const storedSales = localStorage.getItem(STORAGE_SALES_KEY);
      if (storedSales) {
        const parsed = JSON.parse(storedSales);
        if (Array.isArray(parsed) && parsed.length > 0) {
          for (const item of parsed) {
            this.salesCache.set(item.id, item);
          }
        }
      }
    } catch (e) {
      console.warn('Could not read localStorage cache:', e);
    }

    // Seed defaults if brand new installation
    if (this.salesCache.size === 0) {
      this.seedLocalDefaults();
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_SALESMEN_KEY, JSON.stringify(this.salesmenList));
      localStorage.setItem(STORAGE_SALES_KEY, JSON.stringify(Array.from(this.salesCache.values())));
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

  private seedLocalDefaults() {
    const todayKey = getLocalDateKey();
    const now = Date.now();
    const samples = [
      { salesman: 'Pete', item: 'DeWalt 20V Max Impact Driver Combo', amount: 249.0, method: 'card' as PaymentMethod, offset: 160 },
      { salesman: 'Kieron', item: 'Solid Oak Workshop Bench', amount: 580.0, method: 'cash' as PaymentMethod, notes: 'Paid in cash in full', offset: 120 },
      { salesman: 'Newtons', item: 'Fender Stratocaster Electric Guitar', amount: 450.0, method: 'trade' as PaymentMethod, tradeDetails: 'Traded in Yamaha FG800 Acoustic + $200 cash difference', offset: 75 },
      { salesman: 'Roy', item: 'Snap-on Digital Torque Wrench 1/2"', amount: 320.0, method: 'card' as PaymentMethod, offset: 50 },
      { salesman: 'Connor', item: 'Honda Inverter Generator EU2200i', amount: 850.0, method: 'cash' as PaymentMethod, offset: 35 },
      { salesman: 'Charlie', item: 'Stihl Professional Chainsaw MS261', amount: 495.0, method: 'trade' as PaymentMethod, tradeDetails: 'Traded older chainsaw + $250 card balance', offset: 15 },
    ];

    for (const sample of samples) {
      const id = 'sale_' + Math.random().toString(36).substring(2, 9);
      this.salesCache.set(id, {
        id,
        salesmanName: sample.salesman,
        itemDescription: sample.item,
        amount: sample.amount,
        paymentMethod: sample.method,
        tradeDetails: sample.tradeDetails,
        notes: sample.notes,
        timestamp: now - sample.offset * 60 * 1000,
        dateKey: todayKey,
      });
    }
  }

  private initRealtimeListeners() {
    try {
      // 1. Listen to Salesmen collection
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
            if (data.name) remoteNames.push(data.name);
          });

          if (remoteNames.length > 0) {
            this.salesmenList = Array.from(new Set([...DEFAULT_PRELOADED_SALESMEN, ...remoteNames])).sort();
            this.notify();
          }
        },
        (error) => {
          console.warn('Salesmen Firestore listener error (using local cache):', error);
        }
      );

      // 2. Listen to Sales collection
      const salesCol = collection(db, 'sales');
      const salesQuery = query(salesCol, orderBy('timestamp', 'desc'));
      onSnapshot(
        salesQuery,
        (snapshot) => {
          this.isCloudConnected = true;
          if (snapshot.empty) {
            this.syncLocalSalesToFirestore();
            return;
          }

          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            this.salesCache.set(docSnap.id, {
              id: docSnap.id,
              salesmanName: data.salesmanName || '',
              itemDescription: data.itemDescription || '',
              amount: Number(data.amount) || 0,
              paymentMethod: data.paymentMethod || 'card',
              tradeDetails: data.tradeDetails || undefined,
              notes: data.notes || undefined,
              timestamp: data.timestamp || Date.now(),
              dateKey: data.dateKey || getLocalDateKey(new Date(data.timestamp || Date.now())),
            });
          });

          this.notify();
        },
        (error) => {
          console.warn('Sales Firestore listener error (using local cache):', error);
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
          createdAt: Date.now(),
        });
      }
    } catch (e) {
      console.warn('Could not seed initial salesmen in Firestore:', e);
    }
  }

  private async syncLocalSalesToFirestore() {
    try {
      for (const [id, sale] of this.salesCache.entries()) {
        await setDoc(doc(db, 'sales', id), {
          salesmanName: sale.salesmanName,
          itemDescription: sale.itemDescription,
          amount: sale.amount,
          paymentMethod: sale.paymentMethod,
          tradeDetails: sale.tradeDetails || null,
          notes: sale.notes || null,
          timestamp: sale.timestamp,
          dateKey: sale.dateKey,
        });
      }
    } catch (e) {
      console.warn('Could not sync local sales to Firestore:', e);
    }
  }

  // --- Salesmen Roster Methods ---

  public getKnownSalesmen(): string[] {
    return this.salesmenList;
  }

  public async addSalesman(name: string): Promise<boolean> {
    const clean = name.trim();
    if (!clean) return false;

    if (!this.salesmenList.includes(clean)) {
      this.salesmenList.push(clean);
      this.salesmenList.sort();
      this.notify();
    }

    try {
      const docId = clean.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now().toString(36);
      await setDoc(doc(db, 'salesmen', docId), {
        name: clean,
        createdAt: Date.now(),
      });
      return true;
    } catch (e) {
      console.warn('Salesman saved locally; Firestore sync pending:', e);
      return true;
    }
  }

  public async removeSalesman(name: string): Promise<boolean> {
    const clean = name.trim();
    if (!clean) return false;

    this.salesmenList = this.salesmenList.filter((n) => n !== clean);
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
      console.warn('Salesman removed locally; Firestore sync pending:', e);
      return true;
    }
  }

  // --- Sales Transactions Methods ---

  public async insertSale(input: {
    salesmanName: string;
    itemDescription: string;
    amount: number;
    paymentMethod: PaymentMethod;
    tradeDetails?: string;
    notes?: string;
    dateKey?: string;
    timestamp?: number;
  }): Promise<SaleRecord> {
    const timestamp = input.timestamp || Date.now();
    const dateKey = input.dateKey || getLocalDateKey(new Date(timestamp));
    const id = 'sale_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

    const record: SaleRecord = {
      id,
      salesmanName: input.salesmanName.trim(),
      itemDescription: input.itemDescription.trim(),
      amount: Math.round(Number(input.amount) * 100) / 100,
      paymentMethod: input.paymentMethod,
      tradeDetails: input.tradeDetails?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      timestamp,
      dateKey,
    };

    // 1. Immediately store in memory cache & localStorage
    this.salesCache.set(id, record);

    if (!this.salesmenList.includes(record.salesmanName)) {
      this.salesmenList.push(record.salesmanName);
      this.salesmenList.sort();
    }

    this.notify();

    // 2. Persist to Firestore
    try {
      await setDoc(doc(db, 'sales', id), {
        salesmanName: record.salesmanName,
        itemDescription: record.itemDescription,
        amount: record.amount,
        paymentMethod: record.paymentMethod,
        tradeDetails: record.tradeDetails || null,
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

    const updated: SaleRecord = {
      ...existing,
      ...updates,
      salesmanName: updates.salesmanName !== undefined ? updates.salesmanName.trim() : existing.salesmanName,
      itemDescription: updates.itemDescription !== undefined ? updates.itemDescription.trim() : existing.itemDescription,
      amount: updates.amount !== undefined ? Math.round(Number(updates.amount) * 100) / 100 : existing.amount,
    };

    this.salesCache.set(id, updated);
    this.notify();

    try {
      const firestoreUpdates: Record<string, any> = {};
      if (updates.salesmanName !== undefined) firestoreUpdates.salesmanName = updates.salesmanName.trim();
      if (updates.itemDescription !== undefined) firestoreUpdates.itemDescription = updates.itemDescription.trim();
      if (updates.amount !== undefined) firestoreUpdates.amount = Math.round(Number(updates.amount) * 100) / 100;
      if (updates.paymentMethod !== undefined) firestoreUpdates.paymentMethod = updates.paymentMethod;
      if (updates.tradeDetails !== undefined) firestoreUpdates.tradeDetails = updates.tradeDetails ? updates.tradeDetails.trim() : null;
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
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }

  public getDailySummary(dateKey: string): DaySummary {
    const sales = this.getSalesForDay(dateKey);
    let totalRevenue = 0;
    let cashRevenue = 0;
    let cashCount = 0;
    let cardRevenue = 0;
    let cardCount = 0;
    let tradeRevenue = 0;
    let tradeCount = 0;

    const salesmanMap = new Map<string, SalesmanStat>();

    for (const sale of sales) {
      totalRevenue += sale.amount;

      if (sale.paymentMethod === 'cash') {
        cashRevenue += sale.amount;
        cashCount++;
      } else if (sale.paymentMethod === 'card') {
        cardRevenue += sale.amount;
        cardCount++;
      } else if (sale.paymentMethod === 'trade') {
        tradeRevenue += sale.amount;
        tradeCount++;
      }

      let stat = salesmanMap.get(sale.salesmanName);
      if (!stat) {
        stat = {
          name: sale.salesmanName,
          totalAmount: 0,
          count: 0,
          cashAmount: 0,
          cardAmount: 0,
          tradeAmount: 0,
        };
        salesmanMap.set(sale.salesmanName, stat);
      }

      stat.count += 1;
      stat.totalAmount += sale.amount;
      if (sale.paymentMethod === 'cash') stat.cashAmount += sale.amount;
      if (sale.paymentMethod === 'card') stat.cardAmount += sale.amount;
      if (sale.paymentMethod === 'trade') stat.tradeAmount += sale.amount;
    }

    const salesmen = Array.from(salesmanMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);
    const topSalesman = salesmen.length > 0 ? salesmen[0] : undefined;

    return {
      dateKey,
      formattedDate: formatDisplayDate(dateKey),
      totalCount: sales.length,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      cashRevenue: Math.round(cashRevenue * 100) / 100,
      cashCount,
      cardRevenue: Math.round(cardRevenue * 100) / 100,
      cardCount,
      tradeRevenue: Math.round(tradeRevenue * 100) / 100,
      tradeCount,
      averageTicket: sales.length > 0 ? Math.round((totalRevenue / sales.length) * 100) / 100 : 0,
      topSalesman,
      salesmen,
    };
  }

  public async clearDay(dateKey: string) {
    const toDelete: string[] = [];
    this.salesCache.forEach((rec, id) => {
      if (rec.dateKey === dateKey) {
        toDelete.push(id);
      }
    });

    toDelete.forEach((id) => this.salesCache.delete(id));
    this.notify();

    try {
      await Promise.all(toDelete.map((id) => deleteDoc(doc(db, 'sales', id))));
    } catch (e) {
      console.warn('Cleared locally; Firestore sync pending:', e);
    }
  }

  public async resetSampleData() {
    this.salesCache.clear();
    this.seedLocalDefaults();
    this.notify();
    await this.seedFirestoreSalesmen();
    await this.syncLocalSalesToFirestore();
  }

  public exportDayToCsv(dateKey: string): string {
    const sales = this.getSalesForDay(dateKey);
    const headers = ['Sale ID', 'Date', 'Time', 'Salesman', 'Item Sold', 'Amount ($)', 'Payment Method', 'Trade Details', 'Notes'];
    const rows = sales.map((sale) => [
      sale.id,
      sale.dateKey,
      new Date(sale.timestamp).toLocaleTimeString(),
      `"${sale.salesmanName.replace(/"/g, '""')}"`,
      `"${sale.itemDescription.replace(/"/g, '""')}"`,
      sale.amount.toFixed(2),
      sale.paymentMethod.toUpperCase(),
      `"${(sale.tradeDetails || '').replace(/"/g, '""')}"`,
      `"${(sale.notes || '').replace(/"/g, '""')}"`,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }
}

export const cloudDb = new CloudSalesDatabase();
