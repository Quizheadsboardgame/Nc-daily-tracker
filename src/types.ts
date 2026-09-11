export type PaymentMethod = 'cash' | 'card' | 'trade';

export interface SaleRecord {
  id: string;
  salesmanName: string;
  itemDescription: string;
  isMiscellaneous?: boolean;
  amount: number;
  paymentMethod: PaymentMethod;
  tradeDetails?: string;
  tradeAcceptingVendor?: string;
  tradeValue?: number;
  tradeItemDescription?: string;
  notes?: string;
  timestamp: number; // Unix timestamp in milliseconds
  dateKey: string; // YYYY-MM-DD format for fast daily indexing
}

export interface VendorStat {
  name: string;
  totalAmount: number;
  count: number;
  cashAmount: number;
  cardAmount: number;
  tradeAmount: number;
  tradeTakenInAmount?: number;
  tradeTakenInCount?: number;
  color?: string;
}

export interface VendorProfile {
  name: string;
  color: string;
  createdAt?: number;
}

// Backward compatibility alias
export type SalesmanStat = VendorStat;

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
  topVendor?: VendorStat;
  topSalesman?: VendorStat;
  vendors: VendorStat[];
  salesmen: VendorStat[];
}

export interface FilterOptions {
  searchQuery: string;
  paymentMethod: 'all' | PaymentMethod;
  vendor: string; // 'all' or specific name
  salesman?: string;
  sortBy: 'newest' | 'oldest' | 'amount-high' | 'amount-low';
}
