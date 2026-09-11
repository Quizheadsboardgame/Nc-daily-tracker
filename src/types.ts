export type PaymentMethod = 'cash' | 'card' | 'trade';

export interface SaleRecord {
  id: string;
  salesmanName: string;
  itemDescription: string;
  amount: number;
  paymentMethod: PaymentMethod;
  tradeDetails?: string;
  notes?: string;
  timestamp: number; // Unix timestamp in milliseconds
  dateKey: string; // YYYY-MM-DD format for fast daily indexing
}

export interface SalesmanStat {
  name: string;
  totalAmount: number;
  count: number;
  cashAmount: number;
  cardAmount: number;
  tradeAmount: number;
}

export interface DaySummary {
  dateKey: string;
  formattedDate: string;
  totalCount: number;
  totalRevenue: number;
  cashRevenue: number;
  cashCount: number;
  cardRevenue: number;
  cardCount: number;
  tradeRevenue: number;
  tradeCount: number;
  averageTicket: number;
  topSalesman?: SalesmanStat;
  salesmen: SalesmanStat[];
}

export interface FilterOptions {
  searchQuery: string;
  paymentMethod: 'all' | PaymentMethod;
  salesman: string; // 'all' or specific name
  sortBy: 'newest' | 'oldest' | 'amount-high' | 'amount-low';
}
