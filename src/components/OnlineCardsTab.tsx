import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ShoppingBag,
  Barcode,
  Search,
  Plus,
  Printer,
  CheckCircle2,
  AlertCircle,
  Tag,
  DollarSign,
  Camera,
  CameraOff,
  Trash2,
  Edit3,
  ExternalLink,
  RotateCcw,
  Sparkles,
  FileDown,
  Layers,
  ArrowRight,
  Check,
  X,
  Volume2,
  RefreshCw,
  Cloud,
} from 'lucide-react';
import { OnlineCard, OnlineCardsSummary, SaleRecord } from '../types';
import { cloudDb, formatCurrency, getLocalDateKey, formatDisplayDate } from '../db/cloudDatabase';
import { VendorDropdown } from './VendorDropdown';
import { downloadSingleLabelPdf, downloadBatchLabelsPdf, generateBarcodeDataUrl } from '../utils/labelPdf';
import { BrowserMultiFormatReader } from '@zxing/library';

interface OnlineCardsTabProps {
  onNavigateToLedger?: () => void;
  knownVendors?: string[];
  currentDateKey?: string;
}

// Audio synthesizer for scanner beeps
function playScannerBeep(isSuccess = true) {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (isSuccess) {
      // Pleasant high double beep
      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, ctx.currentTime); // B5
      osc.frequency.setValueAtTime(1318.51, ctx.currentTime + 0.08); // E6
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.28);
    } else {
      // Error low buzz
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch (e) {
    // Audio context not allowed or blocked
  }
}

export const OnlineCardsTab: React.FC<OnlineCardsTabProps> = ({
  onNavigateToLedger,
  knownVendors: propKnownVendors,
  currentDateKey = getLocalDateKey(),
}) => {
  const [cards, setCards] = useState<OnlineCard[]>([]);
  const [summary, setSummary] = useState<OnlineCardsSummary>({
    totalCards: 0,
    availableCount: 0,
    availableValue: 0,
    soldCount: 0,
    soldValue: 0,
  });

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'sold'>('all');
  const [vendorFilter, setVendorFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'price-high' | 'price-low' | 'name'>('newest');

  // Form State
  const [formVendor, setFormVendor] = useState('');
  const [formCardName, setFormCardName] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [autoDownloadPdf, setAutoDownloadPdf] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [justAddedCard, setJustAddedCard] = useState<OnlineCard | null>(null);

  // Barcode Scanner State
  const [scanInput, setScanInput] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [scannedCard, setScannedCard] = useState<OnlineCard | null>(null);
  const [lastSoldSale, setLastSoldSale] = useState<{ card: OnlineCard; sale: SaleRecord } | null>(null);
  const [scanMessage, setScanMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Edit Card Modal
  const [editingCard, setEditingCard] = useState<OnlineCard | null>(null);
  const [editCardName, setEditCardName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editVendor, setEditVendor] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Bulk Selection
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());

  // Label Preview Modal
  const [previewCard, setPreviewCard] = useState<OnlineCard | null>(null);

  // Cloud Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Confirmation modal state (replaces window.confirm)
  const [confirmAction, setConfirmAction] = useState<{
    type: 'delete' | 'return';
    card: OnlineCard;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const scanInputRef = useRef<HTMLInputElement | null>(null);

  const allVendors = useMemo(() => {
    return propKnownVendors && propKnownVendors.length > 0
      ? propKnownVendors
      : cloudDb.getKnownVendors();
  }, [propKnownVendors]);

  // Sync data from database
  const refreshData = () => {
    setCards(cloudDb.getOnlineCards());
    setSummary(cloudDb.getOnlineCardsSummary());
  };

  useEffect(() => {
    refreshData();
    const unsubscribe = cloudDb.subscribe(() => {
      refreshData();
    });
    return () => unsubscribe();
  }, []);

  // Camera scanner lifecycle
  useEffect(() => {
    if (isCameraActive) {
      const reader = new BrowserMultiFormatReader();
      codeReaderRef.current = reader;
      setCameraError('');

      reader
        .decodeFromVideoDevice(undefined, videoRef.current!, (result, err) => {
          if (result) {
            const text = result.getText();
            handleProcessScannedCode(text);
          }
          if (err && err.name !== 'NotFoundException') {
            // normal scanning loop errors are ignored
          }
        })
        .catch((err) => {
          console.error('Camera access error:', err);
          setCameraError('Unable to access camera. Please check camera permissions.');
          setIsCameraActive(false);
        });
    } else {
      codeReaderRef.current?.reset();
      codeReaderRef.current = null;
    }

    return () => {
      codeReaderRef.current?.reset();
      codeReaderRef.current = null;
    };
  }, [isCameraActive]);

  // Handle barcode submission (from input gun or camera)
  const handleProcessScannedCode = async (barcodeText: string) => {
    const clean = barcodeText.trim();
    if (!clean) return;

    const found = cloudDb.getOnlineCardByBarcode(clean);
    if (!found) {
      playScannerBeep(false);
      setScanMessage({
        type: 'error',
        text: `No card found matching barcode "${clean}". Check the barcode or add it below.`,
      });
      return;
    }

    if (found.status === 'sold') {
      playScannerBeep(false);
      setScanMessage({
        type: 'error',
        text: `Card "${found.cardName}" (${found.barcode}) was ALREADY SOLD on ${found.soldDateKey || 'a previous date'}!`,
      });
      setScannedCard(found);
      return;
    }

    // Found available card -> open confirmation
    playScannerBeep(true);
    setScannedCard(found);
    setScanMessage({
      type: 'info',
      text: `Card identified: ${found.cardName} (${formatCurrency(found.price)}) - Vendor: ${found.vendorName}`,
    });
    setScanInput('');
  };

  // Confirm selling the scanned card
  const handleConfirmSale = async (cardToSell: OnlineCard) => {
    try {
      const result = await cloudDb.sellOnlineCard(cardToSell.id, {
        targetDateKey: currentDateKey,
      });

      playScannerBeep(true);
      setLastSoldSale(result);
      setScannedCard(null);
      setScanMessage({
        type: 'success',
        text: `Successfully logged online sale of "${result.card.cardName}" for ${formatCurrency(result.card.price)} into Daily Sales Report (${result.sale.dateKey})!`,
      });

      // Clear after 8s
      setTimeout(() => {
        setScanMessage(null);
      }, 8000);
    } catch (err: any) {
      playScannerBeep(false);
      setScanMessage({
        type: 'error',
        text: err.message || 'Error recording sale',
      });
    }
  };

  // Add new online card
  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formVendor.trim()) {
      setFormError('Please select a vendor.');
      return;
    }
    if (!formCardName.trim()) {
      setFormError('Please enter the card name / title.');
      return;
    }
    const priceNum = parseFloat(formPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      setFormError('Please enter a valid price greater than £0.');
      return;
    }

    setIsSubmitting(true);
    try {
      const newCard = await cloudDb.addOnlineCard({
        vendorName: formVendor.trim(),
        cardName: formCardName.trim(),
        price: priceNum,
        notes: formNotes.trim() || undefined,
      });

      setJustAddedCard(newCard);
      setFormCardName('');
      setFormPrice('');
      setFormNotes('');

      if (autoDownloadPdf) {
        const vendorColor = cloudDb.getVendorColor(newCard.vendorName);
        downloadSingleLabelPdf(newCard, vendorColor);
      }

      setScanMessage({
        type: 'success',
        text: `Card "${newCard.cardName}" added! Barcode: ${newCard.barcode} (PDF label generated).`,
      });
    } catch (err: any) {
      setFormError(err.message || 'Could not save online card');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit card handler
  const handleSaveEdit = async () => {
    if (!editingCard) return;
    const priceNum = parseFloat(editPrice);
    if (isNaN(priceNum) || priceNum <= 0) return;

    await cloudDb.updateOnlineCard(editingCard.id, {
      cardName: editCardName.trim(),
      price: priceNum,
      vendorName: editVendor.trim(),
      notes: editNotes.trim() || undefined,
    });

    setEditingCard(null);
  };

  // Real-time Cloud Sync trigger across all devices
  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      const res = await cloudDb.syncNow();
      setSyncFeedback(`Successfully synchronized! ${res.onlineCards} cards and ${res.sales} sales updated.`);
      playScannerBeep(true);
      setTimeout(() => setSyncFeedback(null), 4000);
    } catch (err: any) {
      setSyncFeedback(`Cloud sync error: ${err.message || 'Check network connection'}`);
      setTimeout(() => setSyncFeedback(null), 5000);
    } finally {
      setIsSyncing(false);
    }
  };

  // Return card to stock (un-sell) - opens confirmation modal
  const handleReturnToStock = (card: OnlineCard) => {
    setConfirmAction({
      type: 'return',
      card,
    });
  };

  // Delete card - opens confirmation modal
  const handleDeleteCard = (card: OnlineCard) => {
    setConfirmAction({
      type: 'delete',
      card,
    });
  };

  // Execute modal confirmation
  const handleExecuteConfirm = async () => {
    if (!confirmAction) return;
    const { type, card } = confirmAction;

    if (type === 'return') {
      await cloudDb.returnOnlineCardToStock(card.id);
      setScanMessage({
        type: 'info',
        text: `"${card.cardName}" (${card.barcode}) has been returned to stock and its online sale removed from the daily sales ledger.`,
      });
    } else if (type === 'delete') {
      await cloudDb.deleteOnlineCard(card.id);
      setSelectedCardIds((prev) => {
        const next = new Set(prev);
        next.delete(card.id);
        return next;
      });
      setScanMessage({
        type: 'info',
        text: `"${card.cardName}" (${card.barcode}) has been deleted from online inventory.`,
      });
    }

    setConfirmAction(null);
  };

  // Batch PDF Print
  const handlePrintBatch = () => {
    const selectedCards = cards.filter((c) => selectedCardIds.has(c.id));
    if (selectedCards.length === 0) return;
    downloadBatchLabelsPdf(selectedCards, (name) => cloudDb.getVendorColor(name));
  };

  const handleSelectAllAvailable = () => {
    const available = cards.filter((c) => c.status === 'available');
    if (selectedCardIds.size === available.length) {
      setSelectedCardIds(new Set());
    } else {
      setSelectedCardIds(new Set(available.map((c) => c.id)));
    }
  };

  // Filtered and sorted cards
  const filteredCards = useMemo(() => {
    return cards
      .filter((card) => {
        if (statusFilter !== 'all' && card.status !== statusFilter) return false;
        if (vendorFilter !== 'all' && card.vendorName.toLowerCase() !== vendorFilter.toLowerCase()) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchName = card.cardName.toLowerCase().includes(q);
          const matchBarcode = card.barcode.toLowerCase().includes(q);
          const matchVendor = card.vendorName.toLowerCase().includes(q);
          const matchNotes = card.notes ? card.notes.toLowerCase().includes(q) : false;
          if (!matchName && !matchBarcode && !matchVendor && !matchNotes) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') return b.timestamp - a.timestamp;
        if (sortBy === 'oldest') return a.timestamp - b.timestamp;
        if (sortBy === 'price-high') return b.price - a.price;
        if (sortBy === 'price-low') return a.price - b.price;
        if (sortBy === 'name') return a.cardName.localeCompare(b.cardName);
        return 0;
      });
  }, [cards, statusFilter, vendorFilter, searchQuery, sortBy]);

  return (
    <div className="space-y-6 animate-fade-in" id="online-cards-tab-container">
      {/* Top Banner / Header */}
      <div className="bg-gradient-to-r from-violet-950 via-zinc-900 to-zinc-950 rounded-3xl p-5 sm:p-7 text-white shadow-xl border border-violet-900/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-violet-600/10 to-transparent pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="p-2.5 rounded-2xl bg-violet-600/30 border border-violet-500/40 text-violet-300">
                <ShoppingBag className="w-6 h-6 text-violet-400" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Online Cards Inventory & Barcode System
              </h2>
              <span className="px-3 py-1 rounded-full text-xs font-black bg-violet-500/20 text-violet-300 border border-violet-400/30 shadow-xs">
                Scan-to-Sale
              </span>
            </div>
            <p className="text-xs sm:text-sm text-zinc-300 font-medium max-w-2xl leading-relaxed">
              Add cards to sell online with vendor attribution, generate printable PDF barcode stickers, and scan when sold to automatically record an <strong>Online Sale</strong> in your Daily Sales Ledger.
            </p>
          </div>

          {/* Action buttons & Cloud Sync */}
          <div className="flex items-center gap-2.5 flex-wrap shrink-0 self-start lg:self-auto">
            <button
              type="button"
              id="btn-sync-online-cards"
              onClick={handleSyncNow}
              disabled={isSyncing}
              className="px-3.5 py-2.5 rounded-xl bg-violet-600/70 hover:bg-violet-600 text-white text-xs font-bold border border-violet-400/40 transition-all flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
              title="Sync online cards, barcodes, and inventory across all devices via Cloud Firestore"
            >
              <RefreshCw className={`w-4 h-4 text-violet-200 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync with Devices'}</span>
            </button>

            {onNavigateToLedger && (
              <button
                type="button"
                onClick={onNavigateToLedger}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition-all flex items-center gap-2 shrink-0 cursor-pointer"
              >
                <span>View Daily Sales Report</span>
                <ArrowRight className="w-4 h-4 text-violet-400" />
              </button>
            )}
          </div>
        </div>

        {syncFeedback && (
          <div className="mt-3.5 py-2.5 px-4 rounded-xl bg-violet-900/90 border border-violet-400/50 text-violet-100 text-xs font-semibold flex items-center gap-2.5 animate-fade-in shadow-inner">
            <Cloud className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{syncFeedback}</span>
          </div>
        )}

        {/* 4 KPI Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-5 border-t border-white/10">
          <div className="bg-black/30 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10">
            <span className="text-[11px] font-bold uppercase tracking-wider text-violet-300 block">
              In-Stock Online
            </span>
            <div className="text-xl sm:text-2xl font-black text-white mt-1 tabular-nums">
              {formatCurrency(summary.availableValue)}
            </div>
            <span className="text-[11px] text-zinc-400 font-medium">
              {summary.availableCount} available {summary.availableCount === 1 ? 'card' : 'cards'}
            </span>
          </div>

          <div className="bg-black/30 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block">
              Sold Online Revenue
            </span>
            <div className="text-xl sm:text-2xl font-black text-emerald-300 mt-1 tabular-nums">
              {formatCurrency(summary.soldValue)}
            </div>
            <span className="text-[11px] text-zinc-400 font-medium">
              {summary.soldCount} {summary.soldCount === 1 ? 'card sold' : 'cards sold'}
            </span>
          </div>

          <div className="bg-black/30 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 block">
              Total Cataloged
            </span>
            <div className="text-xl sm:text-2xl font-black text-white mt-1 tabular-nums">
              {summary.totalCards}
            </div>
            <span className="text-[11px] text-zinc-400 font-medium">
              Across all vendors
            </span>
          </div>

          <div className="bg-black/30 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10 flex flex-col justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 block">
              Barcode Engine
            </span>
            <div className="flex items-center gap-1.5 text-xs text-zinc-200 font-semibold mt-1">
              <Barcode className="w-4 h-4 text-amber-400" />
              <span>Standard Code 128</span>
            </div>
            <span className="text-[10px] text-zinc-400">
              54×28mm PDF label stickers
            </span>
          </div>
        </div>
      </div>

      {/* FEEDBACK BANNER */}
      {scanMessage && (
        <div
          className={`p-4 rounded-2xl border flex items-start justify-between gap-3 shadow-md animate-fade-in ${
            scanMessage.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500 text-emerald-100'
              : scanMessage.type === 'error'
              ? 'bg-rose-950/90 border-rose-500 text-rose-100'
              : 'bg-blue-950/90 border-blue-500 text-blue-100'
          }`}
        >
          <div className="flex items-center gap-3">
            {scanMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : scanMessage.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            ) : (
              <Barcode className="w-5 h-5 text-blue-400 shrink-0" />
            )}
            <span className="text-xs sm:text-sm font-bold">{scanMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setScanMessage(null)}
            className="text-white/60 hover:text-white p-1 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* QUICK BARCODE SCANNER BAR (USB Barcode Gun, Keyboard or Camera) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border-2 border-violet-400 shadow-md p-4 sm:p-5 relative" id="card-scanner-box">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-violet-100 text-violet-800">
              <Barcode className="w-5 h-5 text-violet-700" />
            </div>
            <div>
              <h3 className="text-sm font-black text-zinc-950 uppercase tracking-wide">
                Scan Sold Card Barcode
              </h3>
              <p className="text-xs text-zinc-500">
                Scan with a handheld barcode scanner gun, phone camera, or type the code below.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-toggle-camera-scanner"
              onClick={() => setIsCameraActive(!isCameraActive)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                isCameraActive
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs'
                  : 'bg-violet-50 hover:bg-violet-100 text-violet-800 border border-violet-300'
              }`}
            >
              {isCameraActive ? (
                <>
                  <CameraOff className="w-4 h-4" />
                  <span>Turn Off Camera</span>
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4 text-violet-600" />
                  <span>Use Camera Scanner</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Camera Live Viewfinder */}
        {isCameraActive && (
          <div className="mb-4 bg-zinc-950 rounded-2xl p-4 border border-zinc-800 relative overflow-hidden animate-fade-in flex flex-col items-center">
            <div className="relative w-full max-w-sm aspect-video bg-black rounded-xl overflow-hidden border-2 border-violet-500 shadow-inner">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
                muted
              />
              {/* Scan Reticle */}
              <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse" />
              <div className="absolute inset-6 border border-white/40 rounded-lg pointer-events-none" />
            </div>
            <p className="text-xs text-zinc-400 mt-2 font-medium">
              Hold the card's barcode label in front of the camera to scan
            </p>
            {cameraError && (
              <p className="text-xs text-rose-400 mt-1 font-semibold">{cameraError}</p>
            )}
          </div>
        )}

        {/* Input barcode gun box */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleProcessScannedCode(scanInput);
          }}
          className="flex items-center gap-2"
        >
          <div className="relative flex-1">
            <Barcode className="w-5 h-5 absolute left-3.5 top-3 text-zinc-400 pointer-events-none" />
            <input
              ref={scanInputRef}
              type="text"
              id="input-barcode-scanner"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              placeholder="Scan barcode with gun or type code (e.g. ONL-123456) and press Enter..."
              className="w-full pl-11 pr-4 py-2.5 text-sm font-mono font-bold tracking-wider rounded-xl border border-zinc-300 bg-zinc-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-violet-500 focus:border-violet-500 text-zinc-900 shadow-inner"
              autoFocus
            />
          </div>

          <button
            type="submit"
            id="btn-scan-barcode-submit"
            disabled={!scanInput.trim()}
            className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white font-bold text-xs shadow-sm transition-all cursor-pointer whitespace-nowrap"
          >
            Lookup Barcode
          </button>
        </form>

        {/* Scanned Card Confirmation Dialog / Panel */}
        {scannedCard && (
          <div className="mt-4 p-4 rounded-2xl bg-violet-50 border-2 border-violet-500/80 animate-fade-in shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-violet-900 text-white">
                    {scannedCard.barcode}
                  </span>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white border border-zinc-300 text-xs font-bold text-zinc-800">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: cloudDb.getVendorColor(scannedCard.vendorName) }}
                    />
                    <span>Vendor: {scannedCard.vendorName}</span>
                  </div>
                  {scannedCard.status === 'sold' && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                      Already Sold ({scannedCard.soldDateKey})
                    </span>
                  )}
                </div>

                <h4 className="text-base font-black text-zinc-950 mt-1">
                  {scannedCard.cardName}
                </h4>
                {scannedCard.notes && (
                  <p className="text-xs text-zinc-600 font-medium">Memo: {scannedCard.notes}</p>
                )}
              </div>

              <div className="flex items-center gap-3 self-end sm:self-auto">
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-zinc-500 block">Price</span>
                  <span className="text-xl font-black text-emerald-700 tabular-nums">
                    {formatCurrency(scannedCard.price)}
                  </span>
                </div>

                {scannedCard.status === 'available' ? (
                  <button
                    type="button"
                    id="btn-confirm-online-sale"
                    onClick={() => handleConfirmSale(scannedCard)}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer animate-pulse"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm Online Sale ({formatCurrency(scannedCard.price)})</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setScannedCard(null)}
                    className="px-4 py-2 rounded-xl bg-zinc-200 hover:bg-zinc-300 text-zinc-800 text-xs font-bold cursor-pointer"
                  >
                    Dismiss
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* ADD NEW ONLINE CARD FORM */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-xs relative" id="card-add-online-form">
        <div className="h-1.5 bg-gradient-to-r from-violet-600 via-indigo-500 to-purple-600 rounded-t-2xl" />
        <form onSubmit={handleAddCard} className="p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-violet-100 text-violet-800">
                <Plus className="w-4 h-4 text-violet-700" />
              </div>
              <h3 className="text-sm sm:text-base font-black text-zinc-950">
                Add Online Card & Generate PDF Barcode Label
              </h3>
            </div>
            <span className="text-xs text-zinc-500">
              Select vendor, enter card name & price
            </span>
          </div>

          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
            {/* Vendor Selector with dots */}
            <div className="sm:col-span-4">
              <label className="block text-xs font-bold text-zinc-700 mb-1">
                Vendor <span className="text-rose-500">*</span>
              </label>
              <VendorDropdown
                id="select-online-vendor"
                value={formVendor}
                onChange={setFormVendor}
                vendors={allVendors}
                placeholder="Select Vendor..."
              />
            </div>

            {/* Card Name */}
            <div className="sm:col-span-5">
              <label className="block text-xs font-bold text-zinc-700 mb-1">
                Card Name / Description <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                id="input-online-card-name"
                value={formCardName}
                onChange={(e) => setFormCardName(e.target.value)}
                placeholder="e.g. Charizard ex 199/165 SIR / Gengar VMAX Alt Art"
                className="w-full px-3.5 py-2 text-xs font-semibold rounded-xl border border-zinc-300 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 text-zinc-900"
                required
              />
            </div>

            {/* Price in GBP */}
            <div className="sm:col-span-3">
              <label className="block text-xs font-bold text-zinc-700 mb-1">
                Price (£) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs font-bold text-zinc-400">£</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  id="input-online-price"
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2 text-xs font-black rounded-xl border border-zinc-300 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 text-zinc-900 tabular-nums"
                  required
                />
              </div>
            </div>

            {/* Notes / Condition (Optional) */}
            <div className="sm:col-span-9">
              <label className="block text-xs font-bold text-zinc-700 mb-1">
                Notes / Condition / SKU (Optional)
              </label>
              <input
                type="text"
                id="input-online-notes"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="e.g. Near Mint, PSA 9, Sleeve Box #3, English 151"
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-zinc-300 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 text-zinc-900"
              />
            </div>

            {/* Checkbox: Auto-download PDF Label */}
            <div className="sm:col-span-3 flex items-center pt-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="check-auto-download-pdf"
                  checked={autoDownloadPdf}
                  onChange={(e) => setAutoDownloadPdf(e.target.checked)}
                  className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500 border-zinc-300"
                />
                <span className="text-xs font-bold text-zinc-700 flex items-center gap-1">
                  <Printer className="w-3.5 h-3.5 text-violet-600" />
                  Auto-download PDF label
                </span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-zinc-100 flex-wrap gap-2">
            <span className="text-xs text-zinc-500 font-medium">
              A unique Code 128 barcode will be assigned automatically.
            </span>

            <button
              type="submit"
              id="btn-add-online-card-submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving Card...' : 'Add Online Card & Generate Barcode'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* ========================================================================= */}
      {/* INVENTORY TABLE & CONTROLS */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-xs" id="card-online-inventory-ledger">
        <div className="p-4 sm:p-5 border-b border-zinc-100 space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                <span>Online Cards Catalog</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-black bg-zinc-100 text-zinc-800 border border-zinc-200">
                  {filteredCards.length}
                </span>
              </h3>
              <p className="text-xs text-zinc-500">
                Filter by status, search card or barcode, print PDF labels, and mark as sold.
              </p>
            </div>

            {/* Batch actions */}
            {selectedCardIds.size > 0 && (
              <div className="flex items-center gap-2 animate-fade-in flex-wrap">
                <span className="text-xs font-bold text-zinc-700">
                  {selectedCardIds.size} selected
                </span>
                <button
                  type="button"
                  id="btn-batch-print-labels"
                  onClick={handlePrintBatch}
                  className="px-3.5 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <FileDown className="w-4 h-4" />
                  <span>Download Sheet PDF ({selectedCardIds.size})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCardIds(new Set())}
                  className="text-xs text-zinc-500 hover:underline cursor-pointer"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* Search and Filters Bar */}
          <div className="flex flex-col md:flex-row gap-2.5 pt-1">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
              <input
                type="text"
                id="input-search-online-cards"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search card title, barcode (ONL-...), vendor, notes..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-zinc-200 bg-zinc-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 text-zinc-900 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-zinc-400 hover:text-zinc-600 text-xs"
                >
                  ×
                </button>
              )}
            </div>

            {/* Status Filter Pills */}
            <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg text-xs font-semibold overflow-x-auto shrink-0">
              <button
                type="button"
                id="filter-online-status-all"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === 'all'
                    ? 'bg-white text-zinc-950 font-bold shadow-2xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                All Cards ({cards.length})
              </button>
              <button
                type="button"
                id="filter-online-status-available"
                onClick={() => setStatusFilter('available')}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  statusFilter === 'available'
                    ? 'bg-emerald-600 text-white font-bold shadow-2xs'
                    : 'text-zinc-600 hover:text-emerald-700'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Available ({summary.availableCount})</span>
              </button>
              <button
                type="button"
                id="filter-online-status-sold"
                onClick={() => setStatusFilter('sold')}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  statusFilter === 'sold'
                    ? 'bg-zinc-800 text-white font-bold shadow-2xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-zinc-400" />
                <span>Sold ({summary.soldCount})</span>
              </button>
            </div>

            {/* Vendor Filter */}
            <div className="w-full sm:w-44 shrink-0">
              <VendorDropdown
                id="select-online-vendor-filter"
                value={vendorFilter}
                onChange={setVendorFilter}
                vendors={allVendors}
                includeAllOption={true}
                allOptionLabel="All Vendors"
                placeholder="All Vendors"
              />
            </div>

            {/* Sort */}
            <select
              id="select-online-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-xs font-medium text-zinc-800 bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-zinc-900/10 cursor-pointer shrink-0"
            >
              <option value="newest">Newest Added</option>
              <option value="oldest">Oldest First</option>
              <option value="price-high">Price: High to Low</option>
              <option value="price-low">Price: Low to High</option>
              <option value="name">Card Name A–Z</option>
            </select>
          </div>
        </div>

        {/* Card List / Table */}
        {filteredCards.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-12 h-12 rounded-full bg-violet-50 text-violet-500 flex items-center justify-center mx-auto mb-3">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-zinc-800 mb-1">
              No online cards found
            </h4>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              {cards.length === 0
                ? 'Add your first online card above to generate a barcode and PDF label.'
                : 'Try adjusting your search query or status filter.'}
            </p>
          </div>
        ) : (
          <div>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left text-xs" id="table-online-cards">
                <thead className="bg-zinc-50/80 border-b border-zinc-200/80 text-zinc-500 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4 w-10">
                      <input
                        type="checkbox"
                        checked={
                          selectedCardIds.size > 0 &&
                          selectedCardIds.size === cards.filter((c) => c.status === 'available').length
                        }
                        onChange={handleSelectAllAvailable}
                        className="w-3.5 h-3.5 rounded text-violet-600"
                        title="Select all available cards"
                      />
                    </th>
                    <th className="py-3 px-4">Barcode / SKU</th>
                    <th className="py-3 px-4">Vendor</th>
                    <th className="py-3 px-4">Card Name & Details</th>
                    <th className="py-3 px-4 text-right">Price (£)</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4">Date Added / Sold</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredCards.map((card) => {
                    const vendorColor = cloudDb.getVendorColor(card.vendorName);
                    const isSelected = selectedCardIds.has(card.id);
                    const isSold = card.status === 'sold';

                    return (
                      <tr
                        key={card.id}
                        className={`transition-colors hover:bg-zinc-50/80 ${
                          isSold ? 'bg-zinc-50/40 text-zinc-600' : 'bg-white'
                        }`}
                      >
                        <td className="py-3 px-4">
                          {!isSold && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                setSelectedCardIds((prev) => {
                                  const next = new Set(prev);
                                  if (e.target.checked) next.add(card.id);
                                  else next.delete(card.id);
                                  return next;
                                });
                              }}
                              className="w-3.5 h-3.5 rounded text-violet-600 cursor-pointer"
                            />
                          )}
                        </td>

                        {/* Barcode display */}
                        <td className="py-3 px-4 font-mono font-bold text-zinc-900">
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-800 border border-zinc-200">
                              {card.barcode}
                            </span>
                          </div>
                        </td>

                        {/* Vendor with color dot */}
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1.5 font-bold text-zinc-900">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                              style={{ backgroundColor: vendorColor }}
                            />
                            <span>{card.vendorName}</span>
                          </span>
                        </td>

                        {/* Card Name */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-zinc-900 max-w-xs">{card.cardName}</div>
                          {card.notes && (
                            <p className="text-[11px] text-zinc-500 italic mt-0.5">{card.notes}</p>
                          )}
                        </td>

                        {/* Price */}
                        <td className="py-3 px-4 text-right font-black text-sm text-zinc-950 tabular-nums">
                          {formatCurrency(card.price)}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 text-center">
                          {isSold ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-zinc-100 text-zinc-700 border border-zinc-300">
                              <Check className="w-3 h-3 text-zinc-500" />
                              <span>Sold Online</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <span>Available</span>
                            </span>
                          )}
                        </td>

                        {/* Date */}
                        <td className="py-3 px-4 text-zinc-500 text-[11px]">
                          <div>Added: {card.dateKey}</div>
                          {isSold && card.soldDateKey && (
                            <div className="text-zinc-700 font-bold">Sold: {card.soldDateKey}</div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Download Single Label PDF */}
                            <button
                              type="button"
                              onClick={() => downloadSingleLabelPdf(card, vendorColor)}
                              className="p-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-100 text-zinc-700 transition-colors cursor-pointer"
                              title="Download single 54×28mm PDF label"
                            >
                              <FileDown className="w-3.5 h-3.5 text-violet-600" />
                            </button>

                            {/* Preview Label */}
                            <button
                              type="button"
                              onClick={() => setPreviewCard(card)}
                              className="p-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-100 text-zinc-700 transition-colors cursor-pointer"
                              title="Preview Barcode Sticker"
                            >
                              <Printer className="w-3.5 h-3.5 text-zinc-700" />
                            </button>

                            {/* Mark Sold or Return to Stock */}
                            {!isSold ? (
                              <button
                                type="button"
                                onClick={() => setScannedCard(card)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-2xs cursor-pointer"
                                title="Record sale now"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Sell Online</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleReturnToStock(card)}
                                className="px-2 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium text-xs flex items-center gap-1 border border-zinc-200 cursor-pointer"
                                title="Return to stock (undo sale)"
                              >
                                <RotateCcw className="w-3 h-3 text-zinc-500" />
                                <span>Return</span>
                              </button>
                            )}

                            {/* Edit */}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCard(card);
                                setEditCardName(card.cardName);
                                setEditPrice(card.price.toString());
                                setEditVendor(card.vendorName);
                                setEditNotes(card.notes || '');
                              }}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
                              title="Edit card"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete */}
                            <button
                              type="button"
                              onClick={() => handleDeleteCard(card)}
                              className="p-1.5 rounded-lg text-rose-400 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Delete card"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View */}
            <div className="lg:hidden divide-y divide-zinc-100">
              {filteredCards.map((card) => {
                const vendorColor = cloudDb.getVendorColor(card.vendorName);
                const isSold = card.status === 'sold';

                return (
                  <div
                    key={`mobile-${card.id}`}
                    className={`p-4 space-y-2.5 ${
                      isSold ? 'bg-zinc-50/50' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-3 h-3 rounded-full shrink-0 shadow-2xs border border-white"
                          style={{ backgroundColor: vendorColor }}
                        />
                        <span className="font-bold text-xs text-zinc-900 truncate">
                          {card.vendorName}
                        </span>
                        <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-800">
                          {card.barcode}
                        </span>
                      </div>

                      <div className="shrink-0">
                        {isSold ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-700 border border-zinc-200">
                            Sold
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                            Available
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-xs font-bold text-zinc-950">
                      {card.cardName}
                      {card.notes && (
                        <p className="text-[11px] text-zinc-500 font-normal italic mt-0.5">
                          Memo: {card.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-zinc-100">
                      <div className="text-base font-black text-zinc-950 tabular-nums">
                        {formatCurrency(card.price)}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => downloadSingleLabelPdf(card, vendorColor)}
                          className="p-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-100 text-violet-700 text-xs font-semibold flex items-center gap-1"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>

                        {!isSold ? (
                          <button
                            type="button"
                            onClick={() => setScannedCard(card)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center gap-1 shadow-2xs"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Sell</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleReturnToStock(card)}
                            className="px-2 py-1 rounded-lg bg-zinc-100 text-zinc-700 text-xs font-medium border border-zinc-200"
                          >
                            Return
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDeleteCard(card)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* LABEL PREVIEW MODAL */}
      {/* ========================================================================= */}
      {previewCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-zinc-200 space-y-4 relative">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 className="text-sm font-black text-zinc-900 flex items-center gap-2">
                <Printer className="w-4 h-4 text-violet-600" />
                <span>Barcode Label Sticker Preview (54×28mm)</span>
              </h3>
              <button
                type="button"
                onClick={() => setPreviewCard(null)}
                className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sticker Preview Box */}
            <div className="p-4 bg-zinc-100 rounded-2xl flex items-center justify-center">
              <div className="w-[280px] bg-white rounded-lg border-2 border-zinc-300 p-3 shadow-md space-y-1 text-center font-sans">
                {/* Header Strip */}
                <div className="flex items-center justify-between border-b border-zinc-200 pb-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: cloudDb.getVendorColor(previewCard.vendorName) }}
                    />
                    <span className="text-[10px] font-black uppercase text-zinc-800">
                      {previewCard.vendorName}
                    </span>
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-wider text-violet-600">
                    ONLINE CARD
                  </span>
                </div>

                {/* Card Title & Price */}
                <div className="flex items-start justify-between gap-2 pt-1 text-left">
                  <span className="text-xs font-black text-zinc-900 line-clamp-2 leading-tight">
                    {previewCard.cardName}
                  </span>
                  <span className="text-sm font-black text-emerald-700 whitespace-nowrap">
                    {formatCurrency(previewCard.price)}
                  </span>
                </div>

                {/* Barcode image */}
                <div className="pt-1.5 flex flex-col items-center justify-center">
                  <img
                    src={generateBarcodeDataUrl(previewCard.barcode)}
                    alt={previewCard.barcode}
                    className="max-h-12 object-contain"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPreviewCard(null)}
                className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  downloadSingleLabelPdf(previewCard, cloudDb.getVendorColor(previewCard.vendorName));
                  setPreviewCard(null);
                }}
                className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-black shadow-md flex items-center gap-2 cursor-pointer"
              >
                <FileDown className="w-4 h-4" />
                <span>Download PDF Sticker</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EDIT CARD MODAL */}
      {/* ========================================================================= */}
      {editingCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-zinc-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 className="text-sm font-black text-zinc-900">
                Edit Online Card ({editingCard.barcode})
              </h3>
              <button
                type="button"
                onClick={() => setEditingCard(null)}
                className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">Vendor</label>
                <VendorDropdown
                  value={editVendor}
                  onChange={setEditVendor}
                  vendors={allVendors}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">Card Name</label>
                <input
                  type="text"
                  value={editCardName}
                  onChange={(e) => setEditCardName(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-zinc-300 text-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">Price (£)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-zinc-300 text-zinc-900 tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 text-zinc-900"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingCard(null)}
                className="px-4 py-2 rounded-xl bg-zinc-100 text-zinc-700 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-black shadow-md cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CONFIRMATION DIALOG MODAL (No window.confirm, safe for all iframes) */}
      {/* ========================================================================= */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-zinc-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-2xl ${confirmAction.type === 'delete' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                {confirmAction.type === 'delete' ? <Trash2 className="w-5 h-5" /> : <RotateCcw className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-sm font-black text-zinc-900">
                  {confirmAction.type === 'delete' ? 'Delete Online Card?' : 'Return Card to Stock?'}
                </h3>
                <p className="text-xs text-zinc-500 font-medium">
                  {confirmAction.type === 'delete'
                    ? 'This card will be permanently deleted from online inventory across all devices.'
                    : 'This will change status back to available and remove its recorded online sale from the daily sales ledger.'}
                </p>
              </div>
            </div>

            <div className="p-3 bg-zinc-50 rounded-2xl border border-zinc-200 text-xs space-y-1">
              <div className="font-bold text-zinc-900">{confirmAction.card.cardName}</div>
              <div className="text-zinc-500 flex items-center justify-between">
                <span>Vendor: {confirmAction.card.vendorName}</span>
                <span className="font-mono text-zinc-700 font-bold">{confirmAction.card.barcode}</span>
              </div>
              <div className="font-bold text-emerald-700">{formatCurrency(confirmAction.card.price)}</div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 rounded-xl bg-zinc-100 text-zinc-700 text-xs font-bold hover:bg-zinc-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteConfirm}
                className={`px-5 py-2 rounded-xl text-white text-xs font-black shadow-md cursor-pointer ${
                  confirmAction.type === 'delete'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                {confirmAction.type === 'delete' ? 'Yes, Delete' : 'Yes, Return to Stock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
