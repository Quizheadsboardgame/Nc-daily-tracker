import { SaleRecord, DaySummary, SalesmanStat, PaymentMethod } from '../types';

const STORAGE_KEY = 'daily_sales_tracker_memory_store_v1';

/**
 * Utility to format Date into YYYY-MM-DD local format
 */
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
 * In-Memory Sales Database with fast indexing and persistence fallback
 */
class MemoryDatabase {
  private records: Map<string, SaleRecord> = new Map();
  private dateIndex: Map<string, Set<string>> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.loadFromStorage();
  }

  private notify() {
    this.saveToStorage();
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (e) {
        console.error('Error notifying database listener', e);
      }
    });
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private saveToStorage() {
    try {
      const recordsArray = Array.from(this.records.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(recordsArray));
    } catch (e) {
      console.warn('Unable to persist memory database snapshot', e);
    }
  }

  private loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.records.clear();
          this.dateIndex.clear();
          for (const item of parsed) {
            this.indexRecord(item);
          }
          return;
        }
      }
    } catch (e) {
      console.warn('Failed to parse saved memory db, seeding default state', e);
    }

    // If empty, seed initial records for today so the user immediately sees a working record
    this.seedDefaultRecords();
  }

  private indexRecord(record: SaleRecord) {
    this.records.set(record.id, record);
    if (!this.dateIndex.has(record.dateKey)) {
      this.dateIndex.set(record.dateKey, new Set());
    }
    this.dateIndex.get(record.dateKey)!.add(record.id);
  }

  public seedDefaultRecords() {
    const todayKey = getLocalDateKey();
    const now = Date.now();

    const sampleSales: Array<{
      salesman: string;
      item: string;
      amount: number;
      method: PaymentMethod;
      tradeDetails?: string;
      notes?: string;
      minuteOffset: number;
    }> = [
      {
        salesman: 'Marcus Vance',
        item: 'Milwaukee Cordless Drill Set 18V',
        amount: 289.0,
        method: 'card',
        minuteOffset: 160,
      },
      {
        salesman: 'Elena Rostova',
        item: 'Oak Dining Table & 4 Chairs',
        amount: 650.0,
        method: 'cash',
        notes: 'Customer paid exact cash',
        minuteOffset: 120,
      },
      {
        salesman: 'David Chen',
        item: 'Fender Stratocaster Electric Guitar',
        amount: 475.0,
        method: 'trade',
        tradeDetails: 'Traded in Yamaha Acoustic FG800 + $200 cash difference',
        minuteOffset: 75,
      },
      {
        salesman: 'Marcus Vance',
        item: 'Snap-on Torque Wrench 1/2"',
        amount: 195.5,
        method: 'card',
        minuteOffset: 35,
      },
      {
        salesman: 'Sarah Miller',
        item: 'Apple iPad Air M2 128GB',
        amount: 520.0,
        method: 'cash',
        minuteOffset: 15,
      },
    ];

    for (const sample of sampleSales) {
      const id = 'sale_' + Math.random().toString(36).substring(2, 9);
      const record: SaleRecord = {
        id,
        salesmanName: sample.salesman,
        itemDescription: sample.item,
        amount: sample.amount,
        paymentMethod: sample.method,
        tradeDetails: sample.tradeDetails,
        notes: sample.notes,
        timestamp: now - sample.minuteOffset * 60 * 1000,
        dateKey: todayKey,
      };
      this.indexRecord(record);
    }
    this.notify();
  }

  public insertSale(input: {
    salesmanName: string;
    itemDescription: string;
    amount: number;
    paymentMethod: PaymentMethod;
    tradeDetails?: string;
    notes?: string;
    dateKey?: string;
    timestamp?: number;
  }): SaleRecord {
    const timestamp = input.timestamp || Date.now();
    const dateKey = input.dateKey || getLocalDateKey(new Date(timestamp));
    const id = 'sale_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);

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

    this.indexRecord(record);
    this.notify();
    return record;
  }

  public updateSale(id: string, updates: Partial<Omit<SaleRecord, 'id'>>): SaleRecord | null {
    const existing = this.records.get(id);
    if (!existing) return null;

    // Remove from old date index if date changed
    if (updates.dateKey && updates.dateKey !== existing.dateKey) {
      const oldSet = this.dateIndex.get(existing.dateKey);
      if (oldSet) oldSet.delete(id);

      if (!this.dateIndex.has(updates.dateKey)) {
        this.dateIndex.set(updates.dateKey, new Set());
      }
      this.dateIndex.get(updates.dateKey)!.add(id);
    }

    const updated: SaleRecord = {
      ...existing,
      ...updates,
      salesmanName: updates.salesmanName !== undefined ? updates.salesmanName.trim() : existing.salesmanName,
      itemDescription: updates.itemDescription !== undefined ? updates.itemDescription.trim() : existing.itemDescription,
      amount: updates.amount !== undefined ? Math.round(Number(updates.amount) * 100) / 100 : existing.amount,
      id: existing.id,
    };

    this.records.set(id, updated);
    this.notify();
    return updated;
  }

  public deleteSale(id: string): boolean {
    const record = this.records.get(id);
    if (!record) return false;

    const dateSet = this.dateIndex.get(record.dateKey);
    if (dateSet) {
      dateSet.delete(id);
      if (dateSet.size === 0) {
        this.dateIndex.delete(record.dateKey);
      }
    }

    this.records.delete(id);
    this.notify();
    return true;
  }

  public getSale(id: string): SaleRecord | undefined {
    return this.records.get(id);
  }

  public getSalesForDay(dateKey: string): SaleRecord[] {
    const ids = this.dateIndex.get(dateKey);
    if (!ids) return [];

    const list: SaleRecord[] = [];
    ids.forEach((id) => {
      const rec = this.records.get(id);
      if (rec) list.push(rec);
    });

    // Default newest first
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }

  public getAvailableDateKeys(): string[] {
    const today = getLocalDateKey();
    const set = new Set(this.dateIndex.keys());
    set.add(today);
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

  public getKnownSalesmen(): string[] {
    const set = new Set<string>();
    this.records.forEach((rec) => {
      if (rec.salesmanName) set.add(rec.salesmanName);
    });
    return Array.from(set).sort();
  }

  public clearDay(dateKey: string) {
    const ids = this.dateIndex.get(dateKey);
    if (!ids) return;

    ids.forEach((id) => {
      this.records.delete(id);
    });
    this.dateIndex.delete(dateKey);
    this.notify();
  }

  public resetAll() {
    this.records.clear();
    this.dateIndex.clear();
    this.notify();
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

export const memoryDb = new MemoryDatabase();
