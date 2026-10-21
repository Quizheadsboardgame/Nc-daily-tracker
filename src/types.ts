export type PaymentMethod = 'cash' | 'card' | 'traded_out' | 'online';

export type TradeType = 'cash' | 'credit'; // Cards traded in for cash OR for credit (vendors credit)

export interface SaleRecord {
  id: string;
  salesmanName: string; // Vendor name
  itemDescription: string;
  isMiscellaneous?: boolean;
  amount: number; // Gross sale price / valuation in GBP (£)
  paymentMethod: PaymentMethod; // cash, card, traded_out, or online
  notes?: string;
  timestamp: number; // Unix timestamp in milliseconds
  dateKey: string; // YYYY-MM-DD format
  isOnlineSale?: boolean;
  onlineCardId?: string;
  onlineBarcode?: string;
  // Backward compatibility fields if legacy records exist
  tradeDetails?: string;
  tradeAcceptingVendor?: string;
  tradeValue?: number;
  tradeItemDescription?: string;
}

export interface VendorStat {
  name: string;
  totalAmount: number; // Gross cash + card + online + traded out revenue
  count: number;
  cashAmount: number;
  cashCount?: number;
  cardAmount: number;
  cardCount?: number;
  onlineAmount?: number;
  onlineCount?: number;
  tradedOutAmount: number;
  tradedOutCount?: number;
  tradeAmount?: number; // legacy alias
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
  totalRevenue: number; // Gross cash + card + online + traded out revenue
  cashRevenue: number;
  cashCount: number;
  cardRevenue: number;
  cardCount: number;
  onlineRevenue: number;
  onlineCount: number;
  tradedOutRevenue: number;
  tradedOutCount: number;
  averageTicket: number;
  topVendor?: VendorStat;
  topSalesman?: VendorStat;
  vendors: VendorStat[];
  salesmen: VendorStat[];
}

export interface TradeRecord {
  id: string;
  vendorName: string; // Vendor who accepted / is holding the trade
  itemDescription: string; // Cards / Item traded in description
  tradeValue: number; // Valuation in GBP (£)
  tradeType: TradeType; // 'cash' (cash payout) or 'credit' (vendor credit)
  customerName?: string; // Optional customer name (great for credit tracking)
  notes?: string;
  dateKey: string; // YYYY-MM-DD
  timestamp: number; // Milliseconds epoch
  // Backward compatibility fields
  isStandalone?: boolean;
  soldItemDescription?: string;
  saleAmount?: number;
  associatedSaleId?: string;
}

export interface TradeVendorStat {
  vendorName: string;
  color: string;
  totalTradeValue: number; // Total value of cards traded in
  tradeCount: number;
  cashTradeValue: number; // Total valuation of cards traded in for cash
  cashTradeCount: number;
  creditTradeValue: number; // Total valuation of cards traded in for vendor credit
  creditTradeCount: number;
}

export interface TradeDaySummary {
  dateKey: string;
  totalTradeValue: number; // Total valuation of cards traded in
  totalCount: number;
  cashTradeValue: number; // Cards traded for cash (£)
  cashTradeCount: number;
  creditTradeValue: number; // Cards traded for vendor credit (£)
  creditTradeCount: number;
  averageTradeValue: number;
  topVendor?: TradeVendorStat;
  vendorStats: TradeVendorStat[];
}

export interface FilterOptions {
  searchQuery: string;
  paymentMethod: 'all' | PaymentMethod;
  vendor: string; // 'all' or specific name
  salesman?: string;
  sortBy: 'newest' | 'oldest' | 'amount-high' | 'amount-low';
}

export type OnlineCardStatus = 'available' | 'sold';

export interface OnlineCard {
  id: string; // e.g. "ONL-XXXXXX"
  barcode: string; // barcode string e.g. "ONL-784920"
  vendorName: string; // Vendor who owns the card
  cardName: string; // Title / Card name
  price: number; // Listed price in GBP (£)
  status: OnlineCardStatus; // 'available' or 'sold'
  notes?: string; // Optional condition, set, notes
  timestamp: number; // Created timestamp
  dateKey: string; // Date added (YYYY-MM-DD)
  soldAt?: number; // Sold timestamp
  soldDateKey?: string; // Date sold (YYYY-MM-DD)
  saleId?: string; // Linked sale record ID in daily sales ledger
  soldPaymentMethod?: PaymentMethod; // 'online' | 'cash' | 'card' | 'traded_out'
}

export interface OnlineCardsSummary {
  totalCards: number;
  availableCount: number;
  availableValue: number;
  soldCount: number;
  soldValue: number;
}

