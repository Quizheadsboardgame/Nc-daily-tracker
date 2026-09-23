import React, { useState, useMemo } from 'react';
import {
  Boxes,
  PlusCircle,
  Search,
  Download,
  Filter,
  Trash2,
  Edit2,
  CheckCircle2,
  Tag,
  User,
  Sparkles,
  Layers,
  AlertCircle,
  Check,
  X,
  Plus,
  Coins,
  ShoppingBag,
  RotateCcw,
} from 'lucide-react';
import { StockItem, StockCategory, StockItemStatus } from '../types';
import { cloudDb, formatCurrency } from '../db/cloudDatabase';

interface StockTabProps {
  knownVendors: string[];
  onSellStockItem?: (item: StockItem) => void;
  onSwitchToLedger?: () => void;
}

export const StockTab: React.FC<StockTabProps> = ({
  knownVendors,
  onSellStockItem,
  onSwitchToLedger: _onSwitchToLedger,
}) => {
  // Form state for Preloading New Stock
  const [vendorName, setVendorName] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [category, setCategory] = useState<StockCategory>('card');
  const [price, setPrice] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('1');
  const [condition, setCondition] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [showSuccessToast, setShowSuccessToast] = useState<boolean>(false);
  const [lastAddedItem, setLastAddedItem] = useState<string>('');

  // Bulk / Fast Preload mode toggle
  const [isBulkMode, setIsBulkMode] = useState<boolean>(false);
  const [bulkText, setBulkText] = useState<string>('');
  const [bulkCategory, setBulkCategory] = useState<StockCategory>('card');
  const [bulkVendor, setBulkVendor] = useState<string>('');

  // Filters & Search
  const [filterVendor, setFilterVendor] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<'all' | StockCategory>('all');
  const [filterStatus, setFilterStatus] = useState<'in_stock' | 'sold' | 'all'>('in_stock');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'alpha' | 'price-desc' | 'price-asc' | 'newest'>('alpha');

  // Edit modal state
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editVendor, setEditVendor] = useState<string>('');
  const [editCategory, setEditCategory] = useState<StockCategory>('card');
  const [editPrice, setEditPrice] = useState<string>('');
  const [editQuantity, setEditQuantity] = useState<string>('1');
  const [editCondition, setEditCondition] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editStatus, setEditStatus] = useState<StockItemStatus>('in_stock');

  // Delete confirmation
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  // Summary and list from cloudDb
  const summary = useMemo(() => {
    return cloudDb.getStockSummary(filterVendor !== 'all' ? filterVendor : undefined);
  }, [filterVendor]);

  // List of all items matching options
  const stockList = useMemo(() => {
    return cloudDb.getStockItems({
      vendorName: filterVendor !== 'all' ? filterVendor : undefined,
      category: filterCategory !== 'all' ? filterCategory : undefined,
      status: filterStatus !== 'all' ? filterStatus : undefined,
      search: searchQuery,
      sortBy,
    });
  }, [filterVendor, filterCategory, filterStatus, searchQuery, sortBy]);

  const selectedVendorColor = vendorName.trim() ? cloudDb.getVendorColor(vendorName.trim()) : null;

  const handleQuickAddPrice = (val: number) => {
    const current = parseFloat(price) || 0;
    setPrice((current + val).toFixed(2));
    if (formErrors.price) {
      setFormErrors((prev) => ({ ...prev, price: '' }));
    }
  };

  const validateForm = (): boolean => {
    const errs: Record<string, string> = {};
    if (!vendorName.trim()) {
      errs.vendorName = 'Please select a vendor';
    }
    if (!title.trim()) {
      errs.title = 'Title / description is required';
    }
    const numPrice = parseFloat(price);
    if (!price || isNaN(numPrice) || numPrice < 0) {
      errs.price = 'Valid price is required (£0 or higher)';
    }
    const numQty = parseInt(quantity, 10);
    if (!quantity || isNaN(numQty) || numQty <= 0) {
      errs.quantity = 'Quantity must be 1 or more';
    }

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handlePreloadSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const numPrice = parseFloat(price);
    const numQty = parseInt(quantity, 10) || 1;

    await cloudDb.insertStockItem({
      vendorName: vendorName.trim(),
      title: title.trim(),
      category,
      price: numPrice,
      quantity: numQty,
      condition: condition.trim() || undefined,
      notes: notes.trim() || undefined,
      status: 'in_stock',
    });

    setLastAddedItem(`${title.trim()} (£${numPrice.toFixed(2)}) for ${vendorName.trim()}`);
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 3500);

    // Reset fields except vendor to allow fast multiple inputs for same vendor
    setTitle('');
    setPrice('');
    setQuantity('1');
    setCondition('');
    setNotes('');
    setFormErrors({});
  };

  const handleBulkPreload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkVendor.trim()) {
      alert('Please select a vendor for bulk preloading');
      return;
    }
    if (!bulkText.trim()) {
      alert('Please enter items (one per line, e.g. "Item Name, 45.00")');
      return;
    }

    const lines = bulkText.split('\n');
    let addedCount = 0;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      // Match format: "Title, Price" or "Title - Price" or just "Title"
      let itemTitle = line;
      let itemPrice = 0;
      let itemQty = 1;

      if (line.includes(',')) {
        const parts = line.split(',');
        itemTitle = parts[0].trim();
        const rawP = parts[1]?.replace(/[£$,]/g, '').trim();
        itemPrice = parseFloat(rawP) || 0;
        if (parts[2]) {
          itemQty = parseInt(parts[2].trim(), 10) || 1;
        }
      } else if (line.includes(' - ')) {
        const parts = line.split(' - ');
        itemTitle = parts[0].trim();
        const rawP = parts[1]?.replace(/[£$,]/g, '').trim();
        itemPrice = parseFloat(rawP) || 0;
      }

      if (itemTitle) {
        await cloudDb.insertStockItem({
          vendorName: bulkVendor.trim(),
          title: itemTitle,
          category: bulkCategory,
          price: itemPrice,
          quantity: itemQty,
          status: 'in_stock',
        });
        addedCount++;
      }
    }

    setLastAddedItem(`${addedCount} items preloaded for ${bulkVendor}`);
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 4000);
    setBulkText('');
    setIsBulkMode(false);
  };

  const handleOpenEdit = (item: StockItem) => {
    setEditingItem(item);
    setEditTitle(item.title);
    setEditVendor(item.vendorName);
    setEditCategory(item.category);
    setEditPrice(item.price.toString());
    setEditQuantity(item.quantity.toString());
    setEditCondition(item.condition || '');
    setEditNotes(item.notes || '');
    setEditStatus(item.status);
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    const numPrice = parseFloat(editPrice) || 0;
    const numQty = parseInt(editQuantity, 10) || 0;

    await cloudDb.updateStockItem(editingItem.id, {
      title: editTitle.trim(),
      vendorName: editVendor.trim(),
      category: editCategory,
      price: numPrice,
      quantity: numQty,
      condition: editCondition.trim() || undefined,
      notes: editNotes.trim() || undefined,
      status: editStatus,
    });

    setEditingItem(null);
  };

  const handleToggleSold = async (item: StockItem) => {
    if (item.status === 'in_stock') {
      await cloudDb.markStockItemSold(item.id);
    } else {
      await cloudDb.restoreStockItem(item.id);
    }
  };

  const handleDeleteItem = async (id: string) => {
    await cloudDb.deleteStockItem(id);
    setDeletingItemId(null);
  };

  const handleExportCsv = () => {
    const csvContent = cloudDb.exportStockToCsv(filterVendor !== 'all' ? filterVendor : undefined);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const vendorSuffix = filterVendor !== 'all' ? `_${filterVendor.toLowerCase()}` : '_all_vendors';
    link.setAttribute('download', `inventory_stock_report${vendorSuffix}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 pb-12" id="stock-tab-container">
      {/* Top Banner & Overview */}
      <div className="bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 rounded-2xl p-5 sm:p-6 text-white border border-zinc-800 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="p-2 rounded-xl bg-blue-600/30 border border-blue-500/40 text-blue-400">
                <Boxes className="w-5 h-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Vendor Stock & Cards Inventory
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-950 text-blue-300 border border-blue-800">
                Preload Mode
              </span>
            </div>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl">
              Vendors can preload trading cards and stock items. Available in-stock items display
              in an alphabetical drop-down on the New Sale form and automatically come off the list when sold.
            </p>
          </div>

          {/* Quick Actions in Header */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              id="btn-export-stock-csv"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl border border-zinc-700 transition-colors shadow-xs cursor-pointer"
              title="Download full inventory CSV spreadsheet"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              id="btn-toggle-bulk-preload"
              onClick={() => setIsBulkMode(!isBulkMode)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl border transition-colors shadow-xs cursor-pointer ${
                isBulkMode
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>{isBulkMode ? 'Single Item Mode' : 'Batch Preload'}</span>
            </button>
          </div>
        </div>

        {/* 4 Summary Stat Metric Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-zinc-800/80">
          <div className="bg-zinc-900/90 rounded-xl p-3.5 border border-zinc-800">
            <span className="text-[11px] uppercase tracking-wider text-zinc-400 font-bold block">In Stock Count</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl sm:text-2xl font-black text-white">{summary.inStockItems}</span>
              <span className="text-xs text-zinc-500 font-medium">available</span>
            </div>
          </div>

          <div className="bg-zinc-900/90 rounded-xl p-3.5 border border-zinc-800">
            <span className="text-[11px] uppercase tracking-wider text-emerald-400 font-bold block">In-Stock Valuation</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl sm:text-2xl font-black text-emerald-400">{formatCurrency(summary.inStockValuation)}</span>
            </div>
          </div>

          <div className="bg-zinc-900/90 rounded-xl p-3.5 border border-zinc-800">
            <span className="text-[11px] uppercase tracking-wider text-blue-400 font-bold block">Trading Cards</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl sm:text-2xl font-black text-blue-400">{summary.cardCount}</span>
              <span className="text-xs text-zinc-500 font-medium">cards in stock</span>
            </div>
          </div>

          <div className="bg-zinc-900/90 rounded-xl p-3.5 border border-zinc-800">
            <span className="text-[11px] uppercase tracking-wider text-zinc-400 font-bold block">Items Sold</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl sm:text-2xl font-black text-zinc-300">{summary.soldItems}</span>
              <span className="text-xs text-zinc-500 font-medium">({formatCurrency(summary.soldValuation)})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main 2-Column Layout: Left = Preload Form, Right = Stock Inventory List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (5 cols): Preload Form */}
        <div className="lg:col-span-5 space-y-4">
          <div
            className="bg-white rounded-2xl border transition-all duration-300 overflow-hidden shadow-xs"
            id="card-preload-stock-form"
            style={
              selectedVendorColor
                ? {
                    borderColor: selectedVendorColor,
                    borderWidth: '2px',
                    boxShadow: `0 0 0 1px ${selectedVendorColor}33, 0 8px 24px -4px ${selectedVendorColor}25`,
                  }
                : {
                    borderColor: '#d4d4d8',
                    borderWidth: '1px',
                  }
            }
          >
            {/* Card Header */}
            <div
              className="px-5 py-4 border-b transition-all duration-300 flex items-center justify-between flex-wrap gap-2.5"
              style={
                selectedVendorColor
                  ? {
                      background: `linear-gradient(135deg, ${selectedVendorColor}18 0%, ${selectedVendorColor}08 100%)`,
                      borderBottomColor: `${selectedVendorColor}35`,
                    }
                  : {
                      background: 'linear-gradient(to right, #f8fafc, #ffffff)',
                      borderBottomColor: '#e2e8f0',
                    }
              }
            >
              <div className="flex items-center gap-3">
                <div
                  className="p-2.5 rounded-xl font-bold transition-all shadow-2xs"
                  style={
                    selectedVendorColor
                      ? { backgroundColor: selectedVendorColor, color: '#ffffff' }
                      : { backgroundColor: '#1e293b', color: '#38bdf8' }
                  }
                >
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-black text-zinc-950 tracking-tight">
                      {isBulkMode ? 'Batch Preload Items' : 'Preload Vendor Stock'}
                    </h2>
                    {selectedVendorColor && vendorName && (
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-black text-white shadow-2xs"
                        style={{ backgroundColor: selectedVendorColor }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        <span>{vendorName}</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 font-medium mt-0.5">
                    {isBulkMode
                      ? 'Add multiple cards or items at once'
                      : 'Add items that will display in the sale drop-down'}
                  </p>
                </div>
              </div>

              {showSuccessToast && (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold rounded-full animate-fade-in shadow-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Preloaded: {lastAddedItem}</span>
                </div>
              )}
            </div>

            {/* SINGLE ITEM PRELOAD FORM */}
            {!isBulkMode ? (
              <form onSubmit={handlePreloadSingle} className="p-5 space-y-4" id="form-preload-stock">
                {/* Vendor Selector */}
                <div>
                  <label htmlFor="preload-vendor-select" className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1.5">
                    Vendor's Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      {selectedVendorColor ? (
                        <span
                          className="w-3.5 h-3.5 rounded-full inline-block border border-white shadow-2xs"
                          style={{ backgroundColor: selectedVendorColor }}
                        />
                      ) : (
                        <User className="w-4 h-4 text-zinc-400" />
                      )}
                    </div>
                    <select
                      id="preload-vendor-select"
                      value={vendorName}
                      onChange={(e) => {
                        setVendorName(e.target.value);
                        if (formErrors.vendorName) setFormErrors((prev) => ({ ...prev, vendorName: '' }));
                      }}
                      className={`w-full pl-9 pr-8 py-2 text-sm rounded-lg border bg-white focus:outline-hidden focus:ring-2 transition-all cursor-pointer font-medium ${
                        formErrors.vendorName
                          ? 'border-rose-400 focus:ring-rose-200 text-rose-900'
                          : selectedVendorColor
                          ? 'font-bold text-zinc-900'
                          : 'border-zinc-300 focus:border-zinc-900 focus:ring-zinc-900/10 text-zinc-900'
                      }`}
                    >
                      <option value="">-- Choose Vendor --</option>
                      {knownVendors.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {formErrors.vendorName && (
                    <p className="text-xs text-rose-600 mt-1 font-medium">{formErrors.vendorName}</p>
                  )}
                </div>

                {/* Category: Card vs General Stock */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1.5">
                    Inventory Category <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      id="btn-category-card"
                      onClick={() => setCategory('card')}
                      className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                        category === 'card'
                          ? 'bg-blue-50 border-blue-400 text-blue-900 shadow-2xs'
                          : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                      }`}
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${category === 'card' ? 'text-blue-600' : 'text-zinc-400'}`} />
                      <span>Trading Card</span>
                    </button>

                    <button
                      type="button"
                      id="btn-category-stock"
                      onClick={() => setCategory('stock')}
                      className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                        category === 'stock'
                          ? 'bg-purple-50 border-purple-400 text-purple-900 shadow-2xs'
                          : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                      }`}
                    >
                      <Boxes className={`w-3.5 h-3.5 ${category === 'stock' ? 'text-purple-600' : 'text-zinc-400'}`} />
                      <span>General Stock</span>
                    </button>
                  </div>
                </div>

                {/* Item / Card Title */}
                <div>
                  <label htmlFor="preload-title-input" className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1.5">
                    {category === 'card' ? 'Card Name & Set / Number' : 'Item Title / Description'}{' '}
                    <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Tag className="w-4 h-4 text-zinc-400" />
                    </div>
                    <input
                      type="text"
                      id="preload-title-input"
                      value={title}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        if (formErrors.title) setFormErrors((prev) => ({ ...prev, title: '' }));
                      }}
                      placeholder={
                        category === 'card'
                          ? 'e.g. Charizard Base Set Holo #4/102'
                          : 'e.g. Nintendo Game Boy Color Atomic Purple'
                      }
                      className={`w-full pl-9 pr-3 py-2 text-sm rounded-lg border bg-white focus:outline-hidden focus:ring-2 transition-all font-medium ${
                        formErrors.title
                          ? 'border-rose-400 focus:ring-rose-200 text-rose-900'
                          : 'border-zinc-300 focus:border-zinc-900 focus:ring-zinc-900/10 text-zinc-900'
                      }`}
                    />
                  </div>
                  {formErrors.title && (
                    <p className="text-xs text-rose-600 mt-1 font-medium">{formErrors.title}</p>
                  )}
                </div>

                {/* Price & Quantity Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="preload-price-input" className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1.5">
                      Asking Price (£) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400 text-sm font-bold">
                        £
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        id="preload-price-input"
                        value={price}
                        onChange={(e) => {
                          setPrice(e.target.value);
                          if (formErrors.price) setFormErrors((prev) => ({ ...prev, price: '' }));
                        }}
                        placeholder="0.00"
                        className={`w-full pl-7 pr-3 py-2 text-sm rounded-lg border bg-white focus:outline-hidden focus:ring-2 transition-all font-bold ${
                          formErrors.price
                            ? 'border-rose-400 focus:ring-rose-200 text-rose-900'
                            : 'border-zinc-300 focus:border-zinc-900 focus:ring-zinc-900/10 text-zinc-900'
                        }`}
                      />
                    </div>
                    {formErrors.price && (
                      <p className="text-xs text-rose-600 mt-1 font-medium">{formErrors.price}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="preload-quantity-input" className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1.5">
                      Quantity In Stock <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      id="preload-quantity-input"
                      value={quantity}
                      onChange={(e) => {
                        setQuantity(e.target.value);
                        if (formErrors.quantity) setFormErrors((prev) => ({ ...prev, quantity: '' }));
                      }}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 bg-white focus:outline-hidden focus:ring-2 focus:border-zinc-900 focus:ring-zinc-900/10 text-zinc-900 font-bold"
                    />
                    {formErrors.quantity && (
                      <p className="text-xs text-rose-600 mt-1 font-medium">{formErrors.quantity}</p>
                    )}
                  </div>
                </div>

                {/* Quick Price Buttons */}
                <div>
                  <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide block mb-1">
                    Quick Preset Price:
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[10, 25, 50, 100, 200, 350].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handleQuickAddPrice(val)}
                        className="px-2.5 py-1 text-xs font-bold rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-200 transition-colors cursor-pointer"
                      >
                        +£{val}
                      </button>
                    ))}
                    {price && (
                      <button
                        type="button"
                        onClick={() => setPrice('')}
                        className="px-2.5 py-1 text-xs font-bold rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Condition / Grade (Optional) */}
                <div>
                  <label htmlFor="preload-condition-input" className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1.5">
                    Condition / Grade (Optional)
                  </label>
                  <input
                    type="text"
                    id="preload-condition-input"
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    placeholder={
                      category === 'card'
                        ? 'e.g. PSA 10, Near Mint, BGS 9.5'
                        : 'e.g. Brand New Sealed, Boxed, Used'
                    }
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 bg-white focus:outline-hidden focus:ring-2 focus:border-zinc-900 focus:ring-zinc-900/10 text-zinc-900 font-medium"
                  />
                </div>

                {/* Notes (Optional) */}
                <div>
                  <label htmlFor="preload-notes-input" className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1.5">
                    Additional Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    id="preload-notes-input"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Top loader, foil reflection, provenance..."
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 bg-white focus:outline-hidden focus:ring-2 focus:border-zinc-900 focus:ring-zinc-900/10 text-zinc-900 font-medium resize-none"
                  />
                </div>

                {/* Submit Preload Button */}
                <button
                  type="submit"
                  id="btn-submit-preload-item"
                  className="w-full py-3 px-4 rounded-xl text-sm font-black text-white bg-zinc-900 hover:bg-zinc-800 transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                  style={
                    selectedVendorColor
                      ? {
                          backgroundColor: selectedVendorColor,
                        }
                      : undefined
                  }
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Preload Stock Item</span>
                </button>
              </form>
            ) : (
              /* BATCH / BULK PRELOAD FORM */
              <form onSubmit={handleBulkPreload} className="p-5 space-y-4" id="form-bulk-preload">
                <div>
                  <label htmlFor="bulk-vendor-select" className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1.5">
                    Assign Vendor <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="bulk-vendor-select"
                    value={bulkVendor}
                    onChange={(e) => setBulkVendor(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 bg-white font-bold text-zinc-900"
                  >
                    <option value="">-- Choose Vendor --</option>
                    {knownVendors.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1.5">
                    Category for Batch
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setBulkCategory('card')}
                      className={`py-2 px-3 rounded-lg border text-xs font-bold ${
                        bulkCategory === 'card'
                          ? 'bg-blue-50 border-blue-400 text-blue-900'
                          : 'bg-zinc-50 border-zinc-200 text-zinc-600'
                      }`}
                    >
                      Trading Cards
                    </button>
                    <button
                      type="button"
                      onClick={() => setBulkCategory('stock')}
                      className={`py-2 px-3 rounded-lg border text-xs font-bold ${
                        bulkCategory === 'stock'
                          ? 'bg-purple-50 border-purple-400 text-purple-900'
                          : 'bg-zinc-50 border-zinc-200 text-zinc-600'
                      }`}
                    >
                      General Stock
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="bulk-items-textarea" className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1.5">
                    Items List (One per line)
                  </label>
                  <p className="text-[11px] text-zinc-500 mb-1">
                    Format: <code>Item Title, Price, Quantity</code> (e.g. <code>Charizard V, 45.00, 1</code>)
                  </p>
                  <textarea
                    id="bulk-items-textarea"
                    rows={6}
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    placeholder={`Pikachu Promo 020, 25.00, 2\nDark Magician 1st Ed, 120.00, 1\nPlayStation Controller, 45.00, 3`}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-zinc-300 bg-white resize-none"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 px-4 rounded-xl text-xs font-black text-white bg-blue-600 hover:bg-blue-700 cursor-pointer"
                  >
                    Preload All Items
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsBulkMode(false)}
                    className="py-2.5 px-4 rounded-xl text-xs font-bold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Helpful Information Box */}
          <div className="p-4 bg-blue-50/70 border border-blue-200/80 rounded-2xl text-xs text-blue-900 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-blue-950">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>How Preloaded Stock Works</span>
            </div>
            <p className="text-blue-800 leading-relaxed">
              When a vendor is selected in the <strong>New Sale</strong> form, any in-stock cards or items they have
              preloaded will automatically appear in an <strong>alphabetical drop-down box</strong>.
            </p>
            <p className="text-blue-800 leading-relaxed">
              Selecting a preloaded item fills the description and price. Once the sale is submitted, the item is marked
              sold and immediately <strong>comes off the dropdown list</strong>.
            </p>
          </div>
        </div>

        {/* Right Column (7 cols): Inventory Stock Table & Filter Controls */}
        <div className="lg:col-span-7 space-y-4">
          {/* Controls Bar: Vendor filter, Category filter, Status, Search & Sorting */}
          <div className="bg-white rounded-2xl p-4 border border-zinc-200 shadow-xs space-y-3.5" id="card-stock-filters">
            {/* Vendor Filter Buttons */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-600">
                  Filter by Vendor:
                </span>
                <span className="text-xs text-zinc-500 font-medium">
                  {stockList.length} items shown
                </span>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setFilterVendor('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    filterVendor === 'all'
                      ? 'bg-zinc-900 text-white shadow-2xs'
                      : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                  }`}
                >
                  All Vendors
                </button>
                {knownVendors.map((v) => {
                  const color = cloudDb.getVendorColor(v);
                  const isSelected = filterVendor.toLowerCase() === v.toLowerCase();
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setFilterVendor(v)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                        isSelected
                          ? 'text-white shadow-2xs ring-2 ring-offset-1'
                          : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800'
                      }`}
                      style={
                        isSelected
                          ? { backgroundColor: color, ringColor: color }
                          : undefined
                      }
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: isSelected ? '#ffffff' : color }}
                      />
                      <span>{v}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Category & Status Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-zinc-100">
              {/* Category Filter */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                  Category:
                </span>
                <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setFilterCategory('all')}
                    className={`flex-1 py-1 text-xs font-bold rounded-md transition-all ${
                      filterCategory === 'all'
                        ? 'bg-white text-zinc-900 shadow-2xs'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterCategory('card')}
                    className={`flex-1 py-1 text-xs font-bold rounded-md transition-all ${
                      filterCategory === 'card'
                        ? 'bg-white text-blue-900 shadow-2xs'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    Cards
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterCategory('stock')}
                    className={`flex-1 py-1 text-xs font-bold rounded-md transition-all ${
                      filterCategory === 'stock'
                        ? 'bg-white text-purple-900 shadow-2xs'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    Stock
                  </button>
                </div>
              </div>

              {/* Status Filter: In Stock vs Sold */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                  Stock Status:
                </span>
                <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setFilterStatus('in_stock')}
                    className={`flex-1 py-1 text-xs font-bold rounded-md transition-all ${
                      filterStatus === 'in_stock'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    In Stock
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterStatus('sold')}
                    className={`flex-1 py-1 text-xs font-bold rounded-md transition-all ${
                      filterStatus === 'sold'
                        ? 'bg-zinc-700 text-white shadow-2xs'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    Sold Out
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterStatus('all')}
                    className={`flex-1 py-1 text-xs font-bold rounded-md transition-all ${
                      filterStatus === 'all'
                        ? 'bg-white text-zinc-900 shadow-2xs'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    All
                  </button>
                </div>
              </div>
            </div>

            {/* Search Input & Sort Selector */}
            <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-zinc-100">
              <div className="relative flex-1 w-full">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="w-3.5 h-3.5 text-zinc-400" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search cards, items, grades, or notes..."
                  className="w-full pl-9 pr-8 py-1.5 text-xs rounded-lg border border-zinc-300 bg-white focus:outline-hidden focus:ring-2 focus:border-zinc-900 focus:ring-zinc-900/10"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-zinc-400 hover:text-zinc-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto">
                <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wide">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-zinc-300 bg-white text-zinc-900"
                >
                  <option value="alpha">Alphabetical (A–Z)</option>
                  <option value="price-desc">Price (High to Low)</option>
                  <option value="price-asc">Price (Low to High)</option>
                  <option value="newest">Newest Added</option>
                </select>
              </div>
            </div>
          </div>

          {/* List of Stock Items */}
          <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs" id="card-stock-items-list">
            <div className="px-5 py-3.5 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-zinc-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-900">
                  Preloaded Inventory ({stockList.length} items)
                </h3>
              </div>
              <span className="text-xs text-zinc-500 font-medium">
                Sorted alphabetically by title
              </span>
            </div>

            {stockList.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto text-zinc-400">
                  <Boxes className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-zinc-900">No stock items match your filter</h4>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  {searchQuery || filterVendor !== 'all' || filterCategory !== 'all' || filterStatus !== 'in_stock'
                    ? 'Try clearing filters or search terms to see all preloaded items.'
                    : 'Use the preload form on the left to add trading cards and stock items for your vendors.'}
                </p>
                {(searchQuery || filterVendor !== 'all' || filterCategory !== 'all' || filterStatus !== 'in_stock') && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterVendor('all');
                      setFilterCategory('all');
                      setFilterStatus('in_stock');
                      setSearchQuery('');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Filters</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {stockList.map((item) => {
                  const vendorColor = cloudDb.getVendorColor(item.vendorName);
                  const isSold = item.status === 'sold' || item.quantity <= 0;

                  return (
                    <div
                      key={item.id}
                      className={`p-4 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isSold ? 'bg-zinc-50/70 opacity-75' : 'hover:bg-zinc-50/90'
                      }`}
                    >
                      {/* Left: Vendor Pill + Title + Category + Condition + Notes */}
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Vendor Tag */}
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold text-white shadow-2xs"
                            style={{ backgroundColor: vendorColor }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-white" />
                            <span>{item.vendorName}</span>
                          </span>

                          {/* Category Badge */}
                          <span
                            className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                              item.category === 'card'
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : 'bg-purple-100 text-purple-800 border border-purple-200'
                            }`}
                          >
                            {item.category === 'card' ? 'Card' : 'Stock'}
                          </span>

                          {/* Condition / Grade Badge */}
                          {item.condition && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200">
                              {item.condition}
                            </span>
                          )}

                          {/* Status Badge */}
                          <span
                            className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md inline-flex items-center gap-1 ${
                              !isSold
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-zinc-200 text-zinc-700 border border-zinc-300'
                            }`}
                          >
                            {!isSold ? (
                              <>
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                <span>In Stock (Qty: {item.quantity})</span>
                              </>
                            ) : (
                              <>
                                <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                                <span>Sold Out</span>
                              </>
                            )}
                          </span>
                        </div>

                        {/* Title */}
                        <h4
                          className={`text-sm font-black tracking-tight ${
                            isSold ? 'line-through text-zinc-500' : 'text-zinc-950'
                          }`}
                        >
                          {item.title}
                        </h4>

                        {/* Notes */}
                        {item.notes && (
                          <p className="text-xs text-zinc-500 font-medium line-clamp-1">
                            {item.notes}
                          </p>
                        )}
                      </div>

                      {/* Right: Price & Quick Action Buttons */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-100">
                        {/* Price */}
                        <div className="text-right">
                          <span className="text-base sm:text-lg font-black text-zinc-950 block">
                            {formatCurrency(item.price)}
                          </span>
                          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">
                            Asking Price
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5">
                          {/* Sell Now Action */}
                          {!isSold && onSellStockItem && (
                            <button
                              type="button"
                              onClick={() => onSellStockItem(item)}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-2xs cursor-pointer inline-flex items-center gap-1"
                              title="Record a sale for this preloaded item"
                            >
                              <ShoppingBag className="w-3.5 h-3.5" />
                              <span>Sell</span>
                            </button>
                          )}

                          {/* Quick Sold / In-Stock toggle */}
                          <button
                            type="button"
                            onClick={() => handleToggleSold(item)}
                            className={`p-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                              !isSold
                                ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border-zinc-300'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                            }`}
                            title={!isSold ? 'Mark item as sold' : 'Restore item to in-stock'}
                          >
                            {!isSold ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <RotateCcw className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 rounded-lg text-xs font-bold bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-200 transition-colors cursor-pointer"
                            title="Edit stock item"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => setDeletingItemId(item.id)}
                            className="p-1.5 rounded-lg text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer"
                            title="Delete stock item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-zinc-200 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-blue-600" />
                <h3 className="text-base font-black text-zinc-950">Edit Preloaded Item</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-sm">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1">
                  Vendor Name
                </label>
                <select
                  value={editVendor}
                  onChange={(e) => setEditVendor(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 bg-white font-bold"
                >
                  {knownVendors.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1">
                  Item Title / Description
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1">
                    Price (£)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editQuantity}
                    onChange={(e) => setEditQuantity(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1">
                    Category
                  </label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 bg-white font-medium"
                  >
                    <option value="card">Trading Card</option>
                    <option value="stock">General Stock</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1">
                    Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 bg-white font-bold"
                  >
                    <option value="in_stock">In Stock</option>
                    <option value="sold">Sold</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1">
                  Condition / Grade
                </label>
                <input
                  type="text"
                  value={editCondition}
                  onChange={(e) => setEditCondition(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 text-xs font-bold text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-4 py-2 text-xs font-black text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Item Confirmation Modal */}
      {deletingItemId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-zinc-200 space-y-4 animate-fade-in">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2 rounded-xl bg-rose-100">
                <AlertCircle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-black text-zinc-950">Remove Stock Item?</h3>
            </div>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Are you sure you want to delete this preloaded item from the database? This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setDeletingItemId(null)}
                className="px-3.5 py-2 text-xs font-bold text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteItem(deletingItemId)}
                className="px-3.5 py-2 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs cursor-pointer"
              >
                Yes, Delete Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
