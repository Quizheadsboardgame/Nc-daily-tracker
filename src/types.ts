export type PaymentMethod = 'cash' | 'card' | 'traded_out' | 'online';

export type TradeType = 'cash' | 'credit'; // Cards traded in for cash OR for credit (vendors credit)

export interface SplitPaymentBreakdown {
  cash?: number;
  card?: number;
  online?: number;
  traded_out?: number;
}

export interface BasketItemInput {
  id: string;
  salesmanName: string;
  itemDescription: string;
  isMiscellaneous?: boolean;
  amount: number;
  notes?: string;
  onlineCardId?: string;
  onlineBarcode?: string;
}

export interface SaleRecord {
  id: string;
  salesmanName: string; // Vendor name (item/stock owner)
  operatorName?: string; // Counter operator who rang up the transaction on this device
  itemDescription: string;
  isMiscellaneous?: boolean;
  amount: number; // Final net sale price / valuation collected in GBP (£)
  originalAmount?: number; // Pre-discount subtotal/price in GBP (£) if discounted
  discountAmount?: number; // Total discount applied in GBP (£)
  discountLabel?: string; // e.g. "10% Off", "-£2.00", "Bundle: 3 for £10"
  paymentMethod: PaymentMethod; // cash, card, traded_out, or online
  notes?: string;
  timestamp: number; // Unix timestamp in milliseconds
  dateKey: string; // YYYY-MM-DD format
  isOnlineSale?: boolean;
  onlineCardId?: string;
  onlineBarcode?: string;
  // Multi-item basket & split payment grouping metadata
  checkoutGroupId?: string;
  checkoutTotalAmount?: number;
  splitSummary?: string;
  basketItemCount?: number;
  checkoutVendorSummary?: string;
  checkoutItemSummary?: string;
  // Store credit redemption metadata
  storeCreditCustomerId?: string;
  storeCreditCustomerName?: string;
  storeCreditAmount?: number;
  // Hold / layaway linkage
  relatedHoldId?: string;
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
  operatorName?: string; // Counter operator who rang up the trade on this device
  itemDescription: string; // Cards / Item traded in description
  tradeValue: number; // Valuation in GBP (£)
  tradeType: TradeType; // 'cash' (cash payout) or 'credit' (vendor credit)
  customerName?: string; // Optional customer name (great for credit tracking)
  storeCreditCustomerId?: string; // Linked StoreCreditCustomer ID if credit added to balance
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

export interface VendorLeaderboardEntry {
  rank: number;
  vendorName: string;
  color: string;
  totalRevenue: number;
  salesCount: number;
  averageTicket: number;
  cashRevenue: number;
  cashCount: number;
  cardRevenue: number;
  cardCount: number;
  onlineRevenue: number;
  onlineCount: number;
  tradedOutRevenue: number;
  tradedOutCount: number;
  percentageOfTotal: number;
  topSaleAmount?: number;
  topSaleDescription?: string;
}

export interface VendorLeaderboardSummary {
  periodType: 'weekly' | 'monthly' | 'all-time';
  periodLabel: string;
  startDateKey?: string;
  endDateKey?: string;
  totalRevenue: number;
  totalSalesCount: number;
  averageTicket: number;
  activeVendorsCount: number;
  leader?: VendorLeaderboardEntry;
  entries: VendorLeaderboardEntry[];
}

export interface DailySalesTrendPoint {
  dateKey: string;
  shortDate: string;
  fullDate: string;
  totalRevenue: number;
  salesCount: number;
}

export interface CashReconciliationRecord {
  dateKey: string; // YYYY-MM-DD
  openingFloat: number; // Opening till float in GBP (£)
  actualCashCounted: number | null; // Manager physical count at end of day
  denominationCounts?: Record<string, number>; // Optional UK notes/coins count map
  notes?: string;
  updatedAt: number; // Epoch ms
}

export interface CashReconciliationSummary {
  dateKey: string;
  openingFloat: number;
  cashSalesIn: number;
  cashTradesOut: number;
  expectedCashInTill: number; // openingFloat + cashSalesIn - cashTradesOut
  actualCashCounted: number | null;
  variance: number | null; // actualCashCounted - expectedCashInTill
  status: 'pending' | 'balanced' | 'over' | 'short';
  denominationCounts?: Record<string, number>;
  notes?: string;
  updatedAt?: number;
}

export type StoreCreditTransactionType = 'issue' | 'redeem' | 'adjust';

export interface StoreCreditCustomer {
  id: string;
  name: string;
  normalizedName: string;
  phone?: string;
  balance: number;
  totalIssued: number;
  totalRedeemed: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface StoreCreditTransaction {
  id: string;
  customerId: string;
  customerName: string;
  type: StoreCreditTransactionType;
  amount: number;
  delta: number;
  balanceAfter: number;
  vendorName?: string;
  description: string;
  relatedTradeId?: string;
  relatedCheckoutGroupId?: string;
  relatedSaleId?: string;
  dateKey: string;
  timestamp: number;
}

export interface StoreCreditOverview {
  totalOutstandingBalance: number;
  activeCustomersCount: number;
  totalCustomersCount: number;
  totalLifetimeIssued: number;
  totalLifetimeRedeemed: number;
}

export type HoldStatus = 'active' | 'completed' | 'cancelled' | 'expired';

export interface HoldPayment {
  id: string;
  amount: number;
  paymentMethod: PaymentMethod;
  operatorName?: string;
  saleId?: string;
  notes?: string;
  timestamp: number;
  dateKey: string;
}

export interface HoldRecord {
  id: string;
  customerName: string;
  customerPhone?: string;
  vendorName: string;
  operatorName?: string;
  itemDescription: string;
  totalPrice: number;
  depositPaid: number;
  remainingBalance: number;
  status: HoldStatus;
  dueDateKey?: string;
  notes?: string;
  payments: HoldPayment[];
  createdAt: number;
  dateKey: string;
  updatedAt: number;
  completedAt?: number;
}

export interface HoldsOverview {
  activeCount: number;
  completedCount: number;
  overdueCount: number;
  totalActiveValue: number;
  totalDepositsCollected: number;
  totalRemainingDue: number;
}

export type HeatmapMetric = 'revenue' | 'count' | 'avgTicket';

export interface HeatmapCell {
  dayIndex: number; // 0 = Mon ... 6 = Sun
  dayLabel: string;
  hour: number; // 0..23
  salesCount: number;
  totalRevenue: number;
  avgTicket: number;
  cashCount: number;
  cardCount: number;
  onlineCount: number;
  tradedOutCount: number;
  topPaymentMethod: PaymentMethod | null;
}

export interface HeatmapData {
  hours: number[];
  dayLabels: string[];
  cells: HeatmapCell[][]; // [dayIndex][hourIndex]
  totalSalesCount: number;
  totalRevenue: number;
  busiestDay: { label: string; revenue: number; count: number } | null;
  peakHour: { hour: number; label: string; revenue: number; count: number } | null;
  goldenSlot: HeatmapCell | null;
  quietestHour: { hour: number; label: string; revenue: number; count: number } | null;
  dayTotals: { label: string; revenue: number; count: number }[];
  hourTotals: { hour: number; label: string; revenue: number; count: number }[];
}

export type PresetColorKey = 'blue' | 'emerald' | 'violet' | 'amber' | 'rose' | 'cyan';

export interface CounterPreset {
  id: string;
  label: string;
  itemDescription: string;
  price: number;
  defaultVendor?: string;
  categoryColor: PresetColorKey;
  sortOrder?: number;
  updatedAt?: number;
}

export interface DayEventInfo {
  dateKey: string;
  isEvent: boolean;
  eventName: string;
  location?: string;
  tableCost?: number;
  notes?: string;
  updatedAt?: number;
}

export interface EventBucketStats {
  daysCount: number;
  totalRevenue: number;
  salesCount: number;
  avgDailyRevenue: number;
  averageTicket: number;
  totalTradesValue: number;
  totalTableCost: number;
  netAfterTableCost: number;
}

export interface EventDaySummaryItem {
  dateKey: string;
  eventName: string;
  location?: string;
  tableCost?: number;
  revenue: number;
  salesCount: number;
  tradesValue: number;
}

export interface EventVsShopComparison {
  eventStats: EventBucketStats;
  shopStats: EventBucketStats;
  recentEvents: EventDaySummaryItem[];
}

export type GiftCardStatus = 'active' | 'empty' | 'void';

export type GiftCardTransactionType = 'activate' | 'redeem' | 'topup' | 'adjust' | 'void';

export interface GiftCardRecord {
  id: string;
  barcode: string; // Printed barcode, QR code, or serial number on the physical gift card
  balance: number; // Current remaining value in GBP (£)
  initialValue: number; // Original loaded value in GBP (£)
  totalLoaded: number; // Cumulative GBP (£) loaded (activation + top-ups)
  totalRedeemed: number; // Cumulative GBP (£) spent/redeemed
  status: GiftCardStatus;
  recipientName?: string;
  notes?: string;
  soldPaymentMethod?: PaymentMethod;
  soldVendorName?: string;
  operatorName?: string;
  createdAt: number;
  dateKey: string;
  updatedAt: number;
  lastUsedAt?: number;
}

export interface GiftCardTransaction {
  id: string;
  giftCardId: string;
  barcode: string;
  type: GiftCardTransactionType;
  amount: number; // Absolute GBP (£) amount of this event
  delta: number; // Signed GBP (£) change to card balance
  balanceAfter: number; // Remaining balance immediately after
  paymentMethod?: PaymentMethod;
  vendorName?: string;
  operatorName?: string;
  description: string;
  relatedSaleId?: string;
  dateKey: string;
  timestamp: number;
}

export interface GiftCardsOverview {
  activeCardsCount: number;
  emptyCardsCount: number;
  voidCardsCount: number;
  totalCardsCount: number;
  totalOutstandingBalance: number;
  totalLifetimeLoaded: number;
  totalLifetimeRedeemed: number;
}


