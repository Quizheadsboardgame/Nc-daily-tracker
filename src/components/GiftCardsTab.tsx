import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Gift,
  ScanBarcode,
  Camera,
  CameraOff,
  Search,
  CheckCircle2,
  AlertCircle,
  Plus,
  Minus,
  SlidersHorizontal,
  Ban,
  RotateCcw,
  Trash2,
  History,
  Banknote,
  CreditCard,
  X,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  ExternalLink,
  RefreshCw,
  SwitchCamera,
  Flashlight,
} from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/library';
import {
  GiftCardRecord,
  GiftCardStatus,
  GiftCardTransaction,
  GiftCardsOverview,
  PaymentMethod,
} from '../types';
import { cloudDb, formatCurrency } from '../db/cloudDatabase';
import { playSaleBeep } from '../utils/sound';
import { VendorDropdown } from './VendorDropdown';

interface GiftCardsTabProps {
  knownVendors: string[];
  currentDateKey: string;
  onNavigateToLedger?: () => void;
}

const QUICK_VALUES = [5, 10, 20, 25, 50, 100];

export const GiftCardsTab: React.FC<GiftCardsTabProps> = ({
  knownVendors,
  currentDateKey,
  onNavigateToLedger,
}) => {
  // Reactive cloudDb state
  const [cards, setCards] = useState<GiftCardRecord[]>(() => cloudDb.getGiftCards());
  const [overview, setOverview] = useState<GiftCardsOverview>(() => cloudDb.getGiftCardsOverview());
  const [allTransactions, setAllTransactions] = useState<GiftCardTransaction[]>(() =>
    cloudDb.getGiftCardTransactions()
  );

  // Scanner & lookup state
  const [scanInput, setScanInput] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'info' | 'error';
    text: string;
  } | null>(null);

  // Active workstation mode: either registering a new barcode or updating an existing card
  const [pendingNewBarcode, setPendingNewBarcode] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [cardActionMode, setCardActionMode] = useState<'redeem' | 'topup' | 'manage'>('redeem');

  // Activate new card form state
  const [activateValue, setActivateValue] = useState('');
  const [activatePayment, setActivatePayment] = useState<'cash' | 'card'>('card');
  const [activateRecipient, setActivateRecipient] = useState('');
  const [activateNotes, setActivateNotes] = useState('');
  const [activateRecordSale, setActivateRecordSale] = useState(true);
  const [activateVendor, setActivateVendor] = useState(() => knownVendors[0] || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redeem form state
  const [redeemAmount, setRedeemAmount] = useState('');
  const [redeemDescription, setRedeemDescription] = useState('');
  const [redeemRecordVendorSale, setRedeemRecordVendorSale] = useState(false);
  const [redeemVendor, setRedeemVendor] = useState(() => knownVendors[0] || '');

  // Top-up form state
  const [topUpAmount, setTopUpAmount] = useState('');
  const [topUpPayment, setTopUpPayment] = useState<'cash' | 'card'>('card');
  const [topUpDescription, setTopUpDescription] = useState('');
  const [topUpRecordSale, setTopUpRecordSale] = useState(true);
  const [topUpVendor, setTopUpVendor] = useState(() => knownVendors[0] || '');

  // Adjust / manage form state
  const [adjustBalanceInput, setAdjustBalanceInput] = useState('');
  const [adjustRecipientInput, setAdjustRecipientInput] = useState('');
  const [adjustNotesInput, setAdjustNotesInput] = useState('');
  const [adjustReasonInput, setAdjustReasonInput] = useState('');
  const [voidReasonInput, setVoidReasonInput] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Directory filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | GiftCardStatus>('all');

  // Refs
  const scanInputRef = useRef<HTMLInputElement>(null);
  const activateValueRef = useRef<HTMLInputElement>(null);
  const redeemAmountRef = useRef<HTMLInputElement>(null);
  const actionPanelRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const lastScannedRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });
  const handleBarcodeLookupRef = useRef<(rawCode: string) => void>(() => {});

  // Keep vendor defaults valid if knownVendors populates asynchronously
  useEffect(() => {
    if (!activateVendor && knownVendors.length > 0) setActivateVendor(knownVendors[0]);
    if (!redeemVendor && knownVendors.length > 0) setRedeemVendor(knownVendors[0]);
    if (!topUpVendor && knownVendors.length > 0) setTopUpVendor(knownVendors[0]);
  }, [knownVendors, activateVendor, redeemVendor, topUpVendor]);

  // Subscribe to cloudDb live updates
  useEffect(() => {
    const syncState = () => {
      setCards(cloudDb.getGiftCards());
      setOverview(cloudDb.getGiftCardsOverview());
      setAllTransactions(cloudDb.getGiftCardTransactions());
    };
    syncState();
    return cloudDb.subscribe(syncState);
  }, []);

  // Currently selected card (always fresh from state)
  const selectedCard = useMemo(
    () => (selectedCardId ? cards.find((c) => c.id === selectedCardId) || null : null),
    [cards, selectedCardId]
  );

  // Transactions for the selected card
  const selectedCardTransactions = useMemo(
    () => (selectedCard ? allTransactions.filter((t) => t.giftCardId === selectedCard.id) : []),
    [allTransactions, selectedCard]
  );

  // Sync Manage inputs whenever selectedCard changes
  useEffect(() => {
    if (selectedCard) {
      setAdjustBalanceInput(selectedCard.balance.toFixed(2));
      setAdjustRecipientInput(selectedCard.recipientName || '');
      setAdjustNotesInput(selectedCard.notes || '');
      setAdjustReasonInput('');
      setVoidReasonInput('');
      setConfirmDeleteId(null);
    }
  }, [selectedCard?.id, selectedCard?.balance, selectedCard?.updatedAt]);

  // Auto-focus scanner input on mount so USB/Bluetooth scanner works immediately
  useEffect(() => {
    scanInputRef.current?.focus();
  }, []);

  // Core lookup handler: auto-detects New Card vs Existing Card
  const handleBarcodeLookup = (rawCode: string) => {
    const clean = rawCode.trim();
    if (!clean) return;

    setScanInput('');
    setConfirmDeleteId(null);

    const existing = cloudDb.getGiftCardByBarcode(clean);

    if (existing) {
      playSaleBeep(true);
      setPendingNewBarcode(null);
      setSelectedCardId(existing.id);
      setRedeemAmount('');
      setRedeemDescription('');
      setTopUpAmount('');
      setTopUpDescription('');

      if (existing.status === 'void') {
        setCardActionMode('manage');
        setStatusBanner({
          type: 'error',
          text: `Scanned voided gift card #${existing.barcode}. Reactivate it below if needed.`,
        });
      } else if (existing.balance <= 0.004 || existing.status === 'empty') {
        setCardActionMode('topup');
        setStatusBanner({
          type: 'info',
          text: `Gift card #${existing.barcode} has £0.00 remaining. You can top it up below.`,
        });
      } else {
        setCardActionMode('redeem');
        setStatusBanner({
          type: 'success',
          text: `Loaded gift card #${existing.barcode} — Current balance: ${formatCurrency(existing.balance)}`,
        });
        setTimeout(() => redeemAmountRef.current?.focus(), 60);
      }
    } else {
      playSaleBeep(true);
      setSelectedCardId(null);
      setPendingNewBarcode(clean);
      setActivateValue('');
      setActivateRecipient('');
      setActivateNotes('');
      setStatusBanner({
        type: 'info',
        text: `New gift card detected (#${clean}). Choose a value below to activate it.`,
      });
      setTimeout(() => activateValueRef.current?.focus(), 60);
    }
  };

  // Keep ref pointed at latest handler for camera callback
  handleBarcodeLookupRef.current = handleBarcodeLookup;

  const stopCamera = () => {
    try {
      codeReaderRef.current?.reset();
    } catch {
      // ignore reset errors
    }
    codeReaderRef.current = null;

    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      activeStreamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setTorchSupported(false);
    setTorchEnabled(false);
    setIsCameraStarting(false);
    setIsCameraActive(false);
  };

  // Request camera stream directly inside the click handler (required by iOS Safari & strict mobile browsers)
  const startCamera = async (requestedFacing: 'environment' | 'user' = cameraFacingMode) => {
    setCameraError('');
    setIsCameraStarting(true);

    // Clean up any existing stream before opening a new one
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((track) => track.stop());
      activeStreamRef.current = null;
    }
    try {
      codeReaderRef.current?.reset();
    } catch {
      // ignore
    }
    codeReaderRef.current = null;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setIsCameraStarting(false);
      setIsCameraActive(false);
      setCameraError(
        'Camera API is not available in this browser context. Make sure the page is open over HTTPS or use a USB/Bluetooth scanner.'
      );
      return;
    }

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: requestedFacing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch {
        // Fallback to any available camera (e.g., laptop webcam that rejects facingMode)
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      activeStreamRef.current = stream;
      setCameraFacingMode(requestedFacing);
      setIsCameraActive(true);

      // Detect torch / flashlight capability on rear phone cameras
      const videoTrack = stream.getVideoTracks()[0];
      const capabilities =
        videoTrack && typeof (videoTrack as any).getCapabilities === 'function'
          ? (videoTrack as any).getCapabilities()
          : null;
      setTorchSupported(Boolean(capabilities && capabilities.torch));
      setTorchEnabled(false);

      // Wait two animation frames so the video element is mounted cleanly in the DOM
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      );

      const videoEl = videoRef.current;
      if (!videoEl || !activeStreamRef.current) {
        setIsCameraStarting(false);
        return;
      }

      const reader = new BrowserMultiFormatReader();
      codeReaderRef.current = reader;

      await reader.decodeFromStream(stream, videoEl, (result, err) => {
        if (result) {
          const text = result.getText();
          const now = Date.now();
          if (text === lastScannedRef.current.code && now - lastScannedRef.current.time < 2500) {
            return;
          }
          lastScannedRef.current = { code: text, time: now };
          handleBarcodeLookupRef.current(text);
        }
        if (err && err.name !== 'NotFoundException') {
          // Normal scanning loop frame misses are ignored
        }
      });

      setIsCameraStarting(false);
    } catch (err: any) {
      console.error('Gift card camera error:', err);
      stopCamera();
      const errName = err?.name || '';
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        setCameraError(
          'Camera permission was denied. Allow camera access in your browser settings (or tap the lock/camera icon in the address bar) and tap Camera Scan again.'
        );
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        setCameraError(
          'No camera was found on this device. You can plug in a USB/Bluetooth barcode scanner or type the code manually.'
        );
      } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
        setCameraError(
          'Your camera is currently being used by another app or tab. Close the other camera app and try again.'
        );
      } else {
        setCameraError(
          `Unable to open camera${err?.message ? ` (${err.message})` : ''}. Check camera permissions and try again.`
        );
      }
    }
  };

  const handleToggleTorch = async () => {
    const track = activeStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchEnabled;
    try {
      await track.applyConstraints({
        advanced: [{ torch: next } as any],
      });
      setTorchEnabled(next);
    } catch {
      setTorchSupported(false);
    }
  };

  // Stop camera tracks cleanly when leaving the Gift Cards tab
  useEffect(() => {
    return () => {
      try {
        codeReaderRef.current?.reset();
      } catch {
        // ignore
      }
      codeReaderRef.current = null;
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach((t) => t.stop());
        activeStreamRef.current = null;
      }
    };
  }, []);

  const handleScanFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleBarcodeLookup(scanInput);
  };

  // Submit: Activate New Gift Card
  const handleActivateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingNewBarcode || isSubmitting) return;

    const val = parseFloat(activateValue);
    if (isNaN(val) || val <= 0) {
      playSaleBeep(false);
      setStatusBanner({ type: 'error', text: 'Enter a gift card value greater than £0.00.' });
      return;
    }

    if (activateRecordSale && !activateVendor.trim()) {
      playSaleBeep(false);
      setStatusBanner({
        type: 'error',
        text: 'Select a vendor to record this gift card sale in today’s Sales Ledger, or untick the ledger option.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { card } = await cloudDb.activateGiftCard({
        barcode: pendingNewBarcode,
        initialValue: val,
        paymentMethod: activatePayment,
        recipientName: activateRecipient,
        notes: activateNotes,
        recordAsSale: activateRecordSale,
        vendorName: activateRecordSale ? activateVendor : undefined,
        dateKey: currentDateKey,
      });

      if (!activateRecordSale) {
        playSaleBeep(true);
      }

      setPendingNewBarcode(null);
      setSelectedCardId(card.id);
      setCardActionMode('redeem');
      setActivateValue('');
      setActivateRecipient('');
      setActivateNotes('');
      setStatusBanner({
        type: 'success',
        text: `Gift card #${card.barcode} activated with ${formatCurrency(card.balance)}${
          activateRecordSale ? ` and logged to ${activateVendor}` : ''
        }.`,
      });
      setTimeout(() => scanInputRef.current?.focus(), 80);
    } catch (err: any) {
      playSaleBeep(false);
      setStatusBanner({ type: 'error', text: err?.message || 'Could not activate gift card.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit: Redeem / Deduct from Gift Card
  const handleRedeemCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCard || isSubmitting) return;

    const val = parseFloat(redeemAmount);
    if (isNaN(val) || val <= 0) {
      playSaleBeep(false);
      setStatusBanner({ type: 'error', text: 'Enter an amount to deduct greater than £0.00.' });
      return;
    }
    if (val > selectedCard.balance + 0.004) {
      playSaleBeep(false);
      setStatusBanner({
        type: 'error',
        text: `Amount (${formatCurrency(val)}) exceeds remaining balance (${formatCurrency(selectedCard.balance)}).`,
      });
      return;
    }
    if (redeemRecordVendorSale && !redeemVendor.trim()) {
      playSaleBeep(false);
      setStatusBanner({
        type: 'error',
        text: 'Select a vendor to attribute this redemption to, or untick the vendor sale option.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { card } = await cloudDb.redeemGiftCard(selectedCard.id, {
        amount: val,
        description: redeemDescription,
        vendorName: redeemRecordVendorSale ? redeemVendor : undefined,
        recordVendorRedemptionSale: redeemRecordVendorSale,
        dateKey: currentDateKey,
      });

      if (!redeemRecordVendorSale) {
        playSaleBeep(true);
      }

      setRedeemAmount('');
      setRedeemDescription('');
      setStatusBanner({
        type: 'success',
        text: `Redeemed ${formatCurrency(val)} from #${card.barcode}. Remaining balance: ${formatCurrency(
          card.balance
        )}${card.balance <= 0.004 ? ' (Card is now empty)' : ''}.`,
      });
      setTimeout(() => scanInputRef.current?.focus(), 80);
    } catch (err: any) {
      playSaleBeep(false);
      setStatusBanner({ type: 'error', text: err?.message || 'Could not redeem gift card.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit: Top Up / Reload Gift Card
  const handleTopUpCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCard || isSubmitting) return;

    const val = parseFloat(topUpAmount);
    if (isNaN(val) || val <= 0) {
      playSaleBeep(false);
      setStatusBanner({ type: 'error', text: 'Enter a top-up amount greater than £0.00.' });
      return;
    }
    if (topUpRecordSale && !topUpVendor.trim()) {
      playSaleBeep(false);
      setStatusBanner({
        type: 'error',
        text: 'Select a vendor to record this top-up in today’s Sales Ledger, or untick the ledger option.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { card } = await cloudDb.topUpGiftCard(selectedCard.id, {
        amount: val,
        paymentMethod: topUpPayment,
        description: topUpDescription,
        recordAsSale: topUpRecordSale,
        vendorName: topUpRecordSale ? topUpVendor : undefined,
        dateKey: currentDateKey,
      });

      if (!topUpRecordSale) {
        playSaleBeep(true);
      }

      setTopUpAmount('');
      setTopUpDescription('');
      setCardActionMode('redeem');
      setStatusBanner({
        type: 'success',
        text: `Added ${formatCurrency(val)} to #${card.barcode}. New balance: ${formatCurrency(card.balance)}.`,
      });
      setTimeout(() => scanInputRef.current?.focus(), 80);
    } catch (err: any) {
      playSaleBeep(false);
      setStatusBanner({ type: 'error', text: err?.message || 'Could not top up gift card.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit: Manual Adjustment / Details Update
  const handleAdjustCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCard || isSubmitting) return;

    const targetBalance = parseFloat(adjustBalanceInput);
    if (isNaN(targetBalance) || targetBalance < 0) {
      playSaleBeep(false);
      setStatusBanner({ type: 'error', text: 'Enter a valid balance (£0.00 or higher).' });
      return;
    }

    setIsSubmitting(true);
    try {
      const { card } = await cloudDb.adjustGiftCardBalance(selectedCard.id, {
        newBalance: targetBalance,
        reason: adjustReasonInput,
        recipientName: adjustRecipientInput,
        notes: adjustNotesInput,
        dateKey: currentDateKey,
      });
      playSaleBeep(true);
      setAdjustReasonInput('');
      setStatusBanner({
        type: 'success',
        text: `Updated gift card #${card.barcode} — Balance set to ${formatCurrency(card.balance)}.`,
      });
    } catch (err: any) {
      playSaleBeep(false);
      setStatusBanner({ type: 'error', text: err?.message || 'Could not update gift card.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleVoid = async () => {
    if (!selectedCard || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const shouldVoid = selectedCard.status !== 'void';
      const updated = await cloudDb.toggleVoidGiftCard(selectedCard.id, shouldVoid, voidReasonInput);
      if (updated) {
        playSaleBeep(true);
        setVoidReasonInput('');
        setStatusBanner({
          type: shouldVoid ? 'info' : 'success',
          text: shouldVoid
            ? `Gift card #${updated.barcode} has been voided and locked from spending.`
            : `Gift card #${updated.barcode} reactivated (Balance: ${formatCurrency(updated.balance)}).`,
        });
      }
    } catch (err: any) {
      playSaleBeep(false);
      setStatusBanner({ type: 'error', text: err?.message || 'Could not change card status.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCard = async (card: GiftCardRecord) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await cloudDb.deleteGiftCard(card.id);
      setSelectedCardId(null);
      setConfirmDeleteId(null);
      setStatusBanner({
        type: 'info',
        text: `Removed gift card #${card.barcode} from records.`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectCardFromList = (card: GiftCardRecord) => {
    setPendingNewBarcode(null);
    setSelectedCardId(card.id);
    setConfirmDeleteId(null);
    setCardActionMode(
      card.status === 'void' ? 'manage' : card.balance <= 0.004 ? 'topup' : 'redeem'
    );
    setRedeemAmount('');
    setTopUpAmount('');
    actionPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const handleExportCsv = () => {
    const headers = [
      'Barcode',
      'Status',
      'Current Balance (£)',
      'Initial Value (£)',
      'Total Loaded (£)',
      'Total Redeemed (£)',
      'Recipient',
      'Payment Method',
      'Sold Vendor',
      'Notes',
      'Issued Date',
      'Last Updated',
    ];
    const escape = (v: string | number | undefined | null) =>
      `"${String(v ?? '').replace(/"/g, '""')}"`;

    const rows = cards.map((c) => [
      escape(c.barcode),
      escape(c.status.toUpperCase()),
      c.balance.toFixed(2),
      c.initialValue.toFixed(2),
      c.totalLoaded.toFixed(2),
      c.totalRedeemed.toFixed(2),
      escape(c.recipientName || ''),
      escape(c.soldPaymentMethod || ''),
      escape(c.soldVendorName || ''),
      escape(c.notes || ''),
      escape(c.dateKey),
      escape(new Date(c.updatedAt).toLocaleString('en-GB')),
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `market-gift-cards-${currentDateKey}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Filtered directory
  const filteredCards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return cards.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (!q) return true;
      return (
        c.barcode.toLowerCase().includes(q) ||
        (c.recipientName || '').toLowerCase().includes(q) ||
        (c.notes || '').toLowerCase().includes(q) ||
        (c.soldVendorName || '').toLowerCase().includes(q)
      );
    });
  }, [cards, searchQuery, statusFilter]);

  const parsedRedeem = parseFloat(redeemAmount);
  const projectedBalanceAfterRedeem =
    selectedCard && !isNaN(parsedRedeem) && parsedRedeem > 0
      ? Math.max(0, Math.round((selectedCard.balance - parsedRedeem) * 100) / 100)
      : null;

  const formatTxTime = (ts: number) =>
    new Date(ts).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

  const getStatusIndicator = (status: GiftCardStatus) => {
    if (status === 'active') {
      return {
        dot: 'bg-emerald-500',
        text: 'text-emerald-700',
        label: 'Active',
      };
    }
    if (status === 'void') {
      return {
        dot: 'bg-rose-500',
        text: 'text-rose-700',
        label: 'Voided',
      };
    }
    return {
      dot: 'bg-zinc-400',
      text: 'text-zinc-500',
      label: 'Empty',
    };
  };

  return (
    <div className="space-y-6" id="gift-cards-tab-root">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-950 flex items-center gap-2.5">
            <Gift className="w-7 h-7 text-pink-600 shrink-0" />
            <span>Market Gift Cards</span>
          </h2>
          <p className="text-xs sm:text-sm font-medium text-zinc-500 mt-1">
            Scan a blank card to activate with value, or scan an existing card again to redeem or top up.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={cards.length === 0}
            className="min-h-[40px] px-3.5 py-2 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 text-xs font-bold text-zinc-800 inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-zinc-500" />
            <span>Export CSV</span>
          </button>
          {onNavigateToLedger && (
            <button
              type="button"
              onClick={onNavigateToLedger}
              className="min-h-[40px] px-3.5 py-2 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 text-xs font-bold text-zinc-800 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-zinc-500" />
              <span>Sales Ledger</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-2xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
            Active Cards
          </p>
          <p className="text-2xl sm:text-3xl font-black text-zinc-950 tabular-nums mt-1">
            {overview.activeCardsCount}
          </p>
          <p className="text-xs text-zinc-500 mt-1 tabular-nums">
            {overview.emptyCardsCount} empty · {overview.voidCardsCount} void
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-2xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-pink-700">
            Unredeemed Balance
          </p>
          <p className="text-2xl sm:text-3xl font-black text-pink-600 tabular-nums mt-1">
            {formatCurrency(overview.totalOutstandingBalance)}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            Live liability across active cards
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-2xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
            Total Loaded
          </p>
          <p className="text-2xl sm:text-3xl font-black text-zinc-950 tabular-nums mt-1">
            {formatCurrency(overview.totalLifetimeLoaded)}
          </p>
          <p className="text-xs text-zinc-500 mt-1 tabular-nums">
            Across {overview.totalCardsCount} issued card{overview.totalCardsCount === 1 ? '' : 's'}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-2xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
            Total Redeemed
          </p>
          <p className="text-2xl sm:text-3xl font-black text-emerald-700 tabular-nums mt-1">
            {formatCurrency(overview.totalLifetimeRedeemed)}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            Spent at market stall
          </p>
        </div>
      </div>

      {/* Main Two-Column Workstation: Scanner + Dynamic Action Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Barcode / QR Scanner Card */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">
          <div className="bg-zinc-950 text-white px-5 py-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-pink-500/20 border border-pink-400/30 flex items-center justify-center shrink-0">
                <ScanBarcode className="w-5 h-5 text-pink-400" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-black tracking-tight">Scan Gift Card</h3>
                <p className="text-[11px] text-zinc-400 truncate">
                  USB/Bluetooth scanner, phone camera, or manual code
                </p>
              </div>
            </div>

            <button
              type="button"
              id="btn-toggle-giftcard-camera"
              disabled={isCameraStarting}
              onClick={() => {
                if (isCameraActive) {
                  stopCamera();
                } else {
                  startCamera(cameraFacingMode);
                }
              }}
              className={`min-h-[40px] px-3 py-2 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 disabled:opacity-60 ${
                isCameraActive
                  ? 'bg-rose-500 hover:bg-rose-600 text-white'
                  : 'bg-white text-zinc-950 hover:bg-zinc-100'
              }`}
            >
              {isCameraStarting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Opening...</span>
                </>
              ) : isCameraActive ? (
                <>
                  <CameraOff className="w-4 h-4" />
                  <span>Stop Camera</span>
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" />
                  <span>Open Camera</span>
                </>
              )}
            </button>
          </div>

          <div className="p-5 space-y-4">
            {/* Live Camera Viewfinder (always rendered when active or starting so ref is ready) */}
            {(isCameraActive || isCameraStarting) && (
              <div className="relative rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800 aspect-[4/3]">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  autoPlay
                  muted
                  playsInline
                />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="w-4/5 h-28 border-2 border-pink-400/90 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.42)]" />
                </div>

                {/* Camera Controls Overlay (Switch Rear/Front + Torch) */}
                <div className="absolute top-2 right-2 flex items-center gap-1.5">
                  {torchSupported && (
                    <button
                      type="button"
                      onClick={handleToggleTorch}
                      className={`min-h-[36px] px-2.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors ${
                        torchEnabled
                          ? 'bg-amber-400 text-zinc-950'
                          : 'bg-zinc-950/80 text-white hover:bg-zinc-900'
                      }`}
                      title="Toggle camera flashlight"
                    >
                      <Flashlight className="w-3.5 h-3.5" />
                      <span>{torchEnabled ? 'Light On' : 'Light'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      startCamera(cameraFacingMode === 'environment' ? 'user' : 'environment')
                    }
                    className="min-h-[36px] px-2.5 rounded-lg bg-zinc-950/80 hover:bg-zinc-900 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                    title="Switch between rear and front camera"
                  >
                    <SwitchCamera className="w-3.5 h-3.5" />
                    <span>Flip</span>
                  </button>
                </div>

                <div className="absolute bottom-2 inset-x-2 text-center">
                  <span className="inline-block bg-zinc-950/80 text-white text-[11px] font-bold px-3 py-1 rounded-lg">
                    {isCameraStarting
                      ? 'Starting camera...'
                      : 'Hold barcode or QR steady inside the frame'}
                  </span>
                </div>
              </div>
            )}

            {/* Scanner Input Form */}
            <form onSubmit={handleScanFormSubmit} className="space-y-2.5">
              <label
                htmlFor="input-giftcard-barcode"
                className="block text-xs font-bold text-zinc-700"
              >
                Barcode / QR / Serial Number
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <ScanBarcode className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    ref={scanInputRef}
                    id="input-giftcard-barcode"
                    type="text"
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    placeholder="Scan card or type code & press Enter..."
                    autoComplete="off"
                    className="w-full min-h-[44px] pl-9 pr-3 py-2 text-sm font-mono font-bold text-zinc-950 bg-zinc-50 focus:bg-white rounded-xl border border-zinc-300 focus:border-zinc-950 focus:outline-hidden transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  id="btn-giftcard-lookup"
                  className="min-h-[44px] px-4 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-black cursor-pointer transition-colors shrink-0"
                >
                  Check
                </button>
              </div>
              <p className="text-[11px] text-zinc-500">
                Unregistered codes open <strong className="text-zinc-700">Activate New Card</strong>. Existing codes open <strong className="text-zinc-700">Redeem / Top Up</strong> immediately.
              </p>
            </form>

            {cameraError && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs font-semibold text-rose-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{cameraError}</span>
              </div>
            )}

            {/* Status Feedback Banner */}
            {statusBanner && (
              <div
                className={`rounded-xl px-3.5 py-3 text-xs font-bold flex items-start justify-between gap-2 border ${
                  statusBanner.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : statusBanner.type === 'error'
                    ? 'bg-rose-50 border-rose-200 text-rose-900'
                    : 'bg-sky-50 border-sky-200 text-sky-900'
                }`}
              >
                <div className="flex items-start gap-2">
                  {statusBanner.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle
                      className={`w-4 h-4 shrink-0 mt-0.5 ${
                        statusBanner.type === 'error' ? 'text-rose-600' : 'text-sky-600'
                      }`}
                    />
                  )}
                  <span>{statusBanner.text}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setStatusBanner(null)}
                  className="text-current opacity-60 hover:opacity-100 cursor-pointer shrink-0"
                  aria-label="Dismiss message"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Quick Recent Cards List (when user wants 1-tap access without rescanning) */}
            {cards.length > 0 && (
              <div className="pt-2 border-t border-zinc-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                    Recently Updated
                  </span>
                  <span className="text-[11px] text-zinc-400">Tap to open</span>
                </div>
                <div className="space-y-1.5">
                  {cards.slice(0, 4).map((card) => {
                    const isSelected = selectedCard?.id === card.id;
                    const st = getStatusIndicator(card.status);
                    return (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => handleSelectCardFromList(card)}
                        className={`w-full min-h-[44px] px-3 py-2 rounded-xl border text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-zinc-950 text-white border-zinc-950'
                            : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-900 border-zinc-200'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${st.dot}`} />
                            <span className="font-mono text-xs font-extrabold truncate">
                              {card.barcode}
                            </span>
                          </div>
                          {card.recipientName && (
                            <p
                              className={`text-[11px] truncate pl-4 ${
                                isSelected ? 'text-zinc-300' : 'text-zinc-500'
                              }`}
                            >
                              {card.recipientName}
                            </p>
                          )}
                        </div>
                        <span
                          className={`text-sm font-black tabular-nums shrink-0 ${
                            isSelected
                              ? 'text-emerald-300'
                              : card.balance > 0 && card.status === 'active'
                              ? 'text-zinc-950'
                              : 'text-zinc-400'
                          }`}
                        >
                          {formatCurrency(card.balance)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Dynamic Action Panel (Activate New Card OR Update Existing Card) */}
        <div ref={actionPanelRef} className="lg:col-span-7 space-y-5">
          {/* STATE A: NEW BARCODE SCANNED -> ACTIVATE NEW GIFT CARD */}
          {pendingNewBarcode && (
            <div
              id="panel-activate-giftcard"
              className="bg-white rounded-2xl border-2 border-pink-500 shadow-sm overflow-hidden"
            >
              <div className="bg-pink-50 border-b border-pink-200 px-5 py-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-wider text-pink-700">
                    Step 1 · Activate New Gift Card
                  </p>
                  <p className="text-lg font-mono font-black text-zinc-950 truncate mt-0.5">
                    #{pendingNewBarcode}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPendingNewBarcode(null);
                    setStatusBanner(null);
                    scanInputRef.current?.focus();
                  }}
                  className="min-h-[38px] px-3 rounded-xl border border-pink-200 bg-white hover:bg-pink-100 text-xs font-bold text-zinc-700 cursor-pointer transition-colors shrink-0"
                >
                  Cancel
                </button>
              </div>

              <form onSubmit={handleActivateCard} className="p-5 space-y-4">
                {/* Quick Value Chips */}
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-2">
                    Select Starting Value (£)
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
                    {QUICK_VALUES.map((amt) => {
                      const isActive = parseFloat(activateValue) === amt;
                      return (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setActivateValue(amt.toFixed(2))}
                          className={`min-h-[44px] rounded-xl text-sm font-black tabular-nums border transition-colors cursor-pointer ${
                            isActive
                              ? 'bg-zinc-950 text-white border-zinc-950'
                              : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-900 border-zinc-200'
                          }`}
                        >
                          £{amt}
                        </button>
                      );
                    })}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-black text-zinc-400">
                      £
                    </span>
                    <input
                      ref={activateValueRef}
                      id="input-activate-giftcard-value"
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={activateValue}
                      onChange={(e) => setActivateValue(e.target.value)}
                      placeholder="0.00"
                      className="w-full min-h-[48px] pl-8 pr-4 py-2.5 text-lg font-black tabular-nums text-zinc-950 bg-white rounded-xl border border-zinc-300 focus:border-zinc-950 focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Payment Method */}
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-2">
                    How did the customer pay for this gift card?
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setActivatePayment('cash')}
                      className={`min-h-[44px] px-4 rounded-xl border text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                        activatePayment === 'cash'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50'
                      }`}
                    >
                      <Banknote className="w-4 h-4" />
                      <span>Cash</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActivatePayment('card')}
                      className={`min-h-[44px] px-4 rounded-xl border text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                        activatePayment === 'card'
                          ? 'bg-sky-600 text-white border-sky-600'
                          : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50'
                      }`}
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Card</span>
                    </button>
                  </div>
                </div>

                {/* Optional Recipient & Notes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="input-activate-recipient"
                      className="block text-xs font-bold text-zinc-700 mb-1"
                    >
                      Buyer / Recipient Name (Optional)
                    </label>
                    <input
                      id="input-activate-recipient"
                      type="text"
                      value={activateRecipient}
                      onChange={(e) => setActivateRecipient(e.target.value)}
                      placeholder="e.g. Sarah's Birthday"
                      className="w-full min-h-[42px] px-3 py-2 text-xs font-semibold text-zinc-900 bg-white rounded-xl border border-zinc-300 focus:border-zinc-950 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="input-activate-notes"
                      className="block text-xs font-bold text-zinc-700 mb-1"
                    >
                      Notes (Optional)
                    </label>
                    <input
                      id="input-activate-notes"
                      type="text"
                      value={activateNotes}
                      onChange={(e) => setActivateNotes(e.target.value)}
                      placeholder="e.g. Sold at Sunday Market"
                      className="w-full min-h-[42px] px-3 py-2 text-xs font-semibold text-zinc-900 bg-white rounded-xl border border-zinc-300 focus:border-zinc-950 focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Optional Record in Sales Ledger */}
                <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-3.5 space-y-3">
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={activateRecordSale}
                      onChange={(e) => setActivateRecordSale(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded accent-zinc-950 cursor-pointer"
                    />
                    <span className="text-xs leading-snug">
                      <strong className="text-zinc-900 block">
                        Also record in today&apos;s Sales Ledger
                      </strong>
                      <span className="text-zinc-500">
                        Keeps your Cash Drawer and Card reader totals accurate at the end of the market day.
                      </span>
                    </span>
                  </label>

                  {activateRecordSale && (
                    <div>
                      <label className="block text-[11px] font-bold text-zinc-600 mb-1">
                        Assign Gift Card Sale To Vendor / Store Account
                      </label>
                      <VendorDropdown
                        id="select-activate-giftcard-vendor"
                        value={activateVendor}
                        onChange={setActivateVendor}
                        vendors={knownVendors}
                        placeholder="-- Choose Vendor / Store --"
                        buttonClassName="min-h-[42px]"
                      />
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  id="btn-confirm-activate-giftcard"
                  disabled={isSubmitting}
                  className="w-full min-h-[48px] px-5 rounded-xl bg-pink-600 hover:bg-pink-700 active:scale-[0.99] text-white text-sm font-black flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50 transition-all"
                >
                  <Gift className="w-4 h-4" />
                  <span>
                    {isSubmitting
                      ? 'Activating...'
                      : activateValue && parseFloat(activateValue) > 0
                      ? `Activate Gift Card (${formatCurrency(parseFloat(activateValue))})`
                      : 'Activate Gift Card'}
                  </span>
                </button>
              </form>
            </div>
          )}

          {/* STATE B: EXISTING CARD SCANNED OR CLICKED -> BALANCE & UPDATE PANEL */}
          {!pendingNewBarcode && selectedCard && (
            <div
              id="panel-update-giftcard"
              className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden"
            >
              {/* Card Balance Banner */}
              <div className="bg-zinc-950 text-white p-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-mono text-sm sm:text-base font-black text-white tracking-wide">
                        #{selectedCard.barcode}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-300">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            getStatusIndicator(selectedCard.status).dot
                          }`}
                        />
                        {getStatusIndicator(selectedCard.status).label}
                      </span>
                    </div>
                    {selectedCard.recipientName && (
                      <p className="text-xs font-semibold text-zinc-300">
                        Holder: <span className="text-white">{selectedCard.recipientName}</span>
                      </p>
                    )}
                    {selectedCard.notes && (
                      <p className="text-xs text-zinc-400">{selectedCard.notes}</p>
                    )}
                    <p className="text-[11px] text-zinc-500 pt-1 tabular-nums">
                      Issued {selectedCard.dateKey} · Loaded {formatCurrency(selectedCard.totalLoaded)} · Spent{' '}
                      {formatCurrency(selectedCard.totalRedeemed)}
                    </p>
                  </div>

                  <div className="sm:text-right shrink-0 flex sm:flex-col items-baseline sm:items-end justify-between gap-2 border-t sm:border-t-0 border-zinc-800 pt-3 sm:pt-0">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                      Remaining Balance
                    </span>
                    <span
                      className={`text-3xl sm:text-4xl font-black tabular-nums tracking-tight ${
                        selectedCard.status === 'void'
                          ? 'text-rose-400 line-through'
                          : selectedCard.balance > 0
                          ? 'text-emerald-400'
                          : 'text-zinc-400'
                      }`}
                    >
                      {formatCurrency(selectedCard.balance)}
                    </span>
                  </div>
                </div>

                {/* Action Mode Tabs */}
                <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-zinc-800">
                  <button
                    type="button"
                    id="btn-gc-mode-redeem"
                    onClick={() => setCardActionMode('redeem')}
                    className={`min-h-[42px] px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                      cardActionMode === 'redeem'
                        ? 'bg-emerald-400 text-zinc-950'
                        : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    <Minus className="w-3.5 h-3.5" />
                    <span>Redeem</span>
                  </button>
                  <button
                    type="button"
                    id="btn-gc-mode-topup"
                    onClick={() => setCardActionMode('topup')}
                    className={`min-h-[42px] px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                      cardActionMode === 'topup'
                        ? 'bg-sky-400 text-zinc-950'
                        : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Top Up</span>
                  </button>
                  <button
                    type="button"
                    id="btn-gc-mode-manage"
                    onClick={() => setCardActionMode('manage')}
                    className={`min-h-[42px] px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                      cardActionMode === 'manage'
                        ? 'bg-white text-zinc-950'
                        : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Manage</span>
                  </button>
                </div>
              </div>

              {/* Action Mode Body */}
              <div className="p-5">
                {/* SUB-TAB 1: REDEEM / SPEND */}
                {cardActionMode === 'redeem' && (
                  <form onSubmit={handleRedeemCard} className="space-y-4">
                    {selectedCard.status === 'void' ? (
                      <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs font-bold text-rose-800">
                        This card is currently voided and cannot be redeemed. Switch to the Manage tab to reactivate it.
                      </div>
                    ) : selectedCard.balance <= 0.004 ? (
                      <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <p className="text-xs font-bold text-zinc-700">
                          This gift card has £0.00 left. Need to add more value to it?
                        </p>
                        <button
                          type="button"
                          onClick={() => setCardActionMode('topup')}
                          className="min-h-[40px] px-4 rounded-xl bg-zinc-950 text-white text-xs font-black cursor-pointer shrink-0"
                        >
                          Switch to Top Up
                        </button>
                      </div>
                    ) : (
                      <>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label
                              htmlFor="input-redeem-amount"
                              className="text-xs font-bold text-zinc-700"
                            >
                              Amount to Spend / Deduct (£)
                            </label>
                            <button
                              type="button"
                              onClick={() => setRedeemAmount(selectedCard.balance.toFixed(2))}
                              className="text-xs font-black text-emerald-700 hover:text-emerald-800 underline cursor-pointer"
                            >
                              Use Full Balance ({formatCurrency(selectedCard.balance)})
                            </button>
                          </div>

                          <div className="grid grid-cols-4 gap-2 mb-3">
                            {[5, 10, 20, 50].map((amt) => {
                              const disabled = amt > selectedCard.balance + 0.004;
                              const isSelected = parseFloat(redeemAmount) === amt;
                              return (
                                <button
                                  key={amt}
                                  type="button"
                                  disabled={disabled}
                                  onClick={() => setRedeemAmount(amt.toFixed(2))}
                                  className={`min-h-[42px] rounded-xl text-xs font-black tabular-nums border transition-colors ${
                                    disabled
                                      ? 'bg-zinc-50 text-zinc-300 border-zinc-100 cursor-not-allowed'
                                      : isSelected
                                      ? 'bg-zinc-950 text-white border-zinc-950 cursor-pointer'
                                      : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-900 border-zinc-200 cursor-pointer'
                                  }`}
                                >
                                  £{amt}
                                </button>
                              );
                            })}
                          </div>

                          <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-black text-zinc-400">
                              £
                            </span>
                            <input
                              ref={redeemAmountRef}
                              id="input-redeem-amount"
                              type="number"
                              step="0.01"
                              min="0.01"
                              max={selectedCard.balance}
                              required
                              value={redeemAmount}
                              onChange={(e) => setRedeemAmount(e.target.value)}
                              placeholder="0.00"
                              className="w-full min-h-[48px] pl-8 pr-4 py-2.5 text-lg font-black tabular-nums text-zinc-950 bg-white rounded-xl border border-zinc-300 focus:border-zinc-950 focus:outline-hidden"
                            />
                          </div>

                          {projectedBalanceAfterRedeem !== null && (
                            <p className="text-xs font-semibold text-zinc-600 mt-2 tabular-nums">
                              New balance after redemption:{' '}
                              <strong
                                className={
                                  projectedBalanceAfterRedeem <= 0.004
                                    ? 'text-amber-700'
                                    : 'text-emerald-700'
                                }
                              >
                                {formatCurrency(projectedBalanceAfterRedeem)}
                                {projectedBalanceAfterRedeem <= 0.004 ? ' (Card will be marked Empty)' : ''}
                              </strong>
                            </p>
                          )}
                        </div>

                        <div>
                          <label
                            htmlFor="input-redeem-description"
                            className="block text-xs font-bold text-zinc-700 mb-1"
                          >
                            What did they buy? (Optional)
                          </label>
                          <input
                            id="input-redeem-description"
                            type="text"
                            value={redeemDescription}
                            onChange={(e) => setRedeemDescription(e.target.value)}
                            placeholder="e.g. 2x Booster Packs, Graded Pikachu..."
                            className="w-full min-h-[42px] px-3 py-2 text-xs font-semibold text-zinc-900 bg-white rounded-xl border border-zinc-300 focus:border-zinc-950 focus:outline-hidden"
                          />
                        </div>

                        {/* Optional Vendor Attribution */}
                        <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-3.5 space-y-3">
                          <label className="flex items-start gap-2.5 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={redeemRecordVendorSale}
                              onChange={(e) => setRedeemRecordVendorSale(e.target.checked)}
                              className="mt-0.5 w-4 h-4 rounded accent-zinc-950 cursor-pointer"
                            />
                            <span className="text-xs leading-snug">
                              <strong className="text-zinc-900 block">
                                Credit a vendor in today&apos;s Sales Ledger (logged as Trade Out)
                              </strong>
                              <span className="text-zinc-500">
                                Credits the vendor for the item sold without adding duplicate Cash or Card into the till.
                              </span>
                            </span>
                          </label>

                          {redeemRecordVendorSale && (
                            <div>
                              <label className="block text-[11px] font-bold text-zinc-600 mb-1">
                                Vendor Whose Stock Was Purchased
                              </label>
                              <VendorDropdown
                                id="select-redeem-giftcard-vendor"
                                value={redeemVendor}
                                onChange={setRedeemVendor}
                                vendors={knownVendors}
                                placeholder="-- Choose Vendor --"
                                buttonClassName="min-h-[42px]"
                              />
                            </div>
                          )}
                        </div>

                        <button
                          type="submit"
                          id="btn-confirm-redeem-giftcard"
                          disabled={isSubmitting}
                          className="w-full min-h-[48px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white text-sm font-black flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50 transition-all"
                        >
                          <Minus className="w-4 h-4" />
                          <span>
                            {isSubmitting
                              ? 'Updating...'
                              : !isNaN(parsedRedeem) && parsedRedeem > 0
                              ? `Deduct ${formatCurrency(parsedRedeem)} & Update Card`
                              : 'Deduct from Gift Card'}
                          </span>
                        </button>
                      </>
                    )}
                  </form>
                )}

                {/* SUB-TAB 2: TOP UP / RELOAD */}
                {cardActionMode === 'topup' && (
                  <form onSubmit={handleTopUpCard} className="space-y-4">
                    {selectedCard.status === 'void' ? (
                      <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs font-bold text-rose-800">
                        Voided cards cannot be topped up. Reactivate the card in the Manage tab first.
                      </div>
                    ) : (
                      <>
                        <div>
                          <label
                            htmlFor="input-topup-amount"
                            className="block text-xs font-bold text-zinc-700 mb-2"
                          >
                            Amount to Add (£)
                          </label>
                          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
                            {QUICK_VALUES.map((amt) => {
                              const isSelected = parseFloat(topUpAmount) === amt;
                              return (
                                <button
                                  key={amt}
                                  type="button"
                                  onClick={() => setTopUpAmount(amt.toFixed(2))}
                                  className={`min-h-[42px] rounded-xl text-xs font-black tabular-nums border transition-colors cursor-pointer ${
                                    isSelected
                                      ? 'bg-zinc-950 text-white border-zinc-950'
                                      : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-900 border-zinc-200'
                                  }`}
                                >
                                  +£{amt}
                                </button>
                              );
                            })}
                          </div>
                          <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-black text-zinc-400">
                              £
                            </span>
                            <input
                              id="input-topup-amount"
                              type="number"
                              step="0.01"
                              min="0.01"
                              required
                              value={topUpAmount}
                              onChange={(e) => setTopUpAmount(e.target.value)}
                              placeholder="0.00"
                              className="w-full min-h-[48px] pl-8 pr-4 py-2.5 text-lg font-black tabular-nums text-zinc-950 bg-white rounded-xl border border-zinc-300 focus:border-zinc-950 focus:outline-hidden"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            onClick={() => setTopUpPayment('cash')}
                            className={`min-h-[44px] px-4 rounded-xl border text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                              topUpPayment === 'cash'
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50'
                            }`}
                          >
                            <Banknote className="w-4 h-4" />
                            <span>Cash</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setTopUpPayment('card')}
                            className={`min-h-[44px] px-4 rounded-xl border text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                              topUpPayment === 'card'
                                ? 'bg-sky-600 text-white border-sky-600'
                                : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50'
                            }`}
                          >
                            <CreditCard className="w-4 h-4" />
                            <span>Card</span>
                          </button>
                        </div>

                        <div>
                          <label
                            htmlFor="input-topup-description"
                            className="block text-xs font-bold text-zinc-700 mb-1"
                          >
                            Note (Optional)
                          </label>
                          <input
                            id="input-topup-description"
                            type="text"
                            value={topUpDescription}
                            onChange={(e) => setTopUpDescription(e.target.value)}
                            placeholder="e.g. Topped up at stall"
                            className="w-full min-h-[42px] px-3 py-2 text-xs font-semibold text-zinc-900 bg-white rounded-xl border border-zinc-300 focus:border-zinc-950 focus:outline-hidden"
                          />
                        </div>

                        <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-3.5 space-y-3">
                          <label className="flex items-start gap-2.5 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={topUpRecordSale}
                              onChange={(e) => setTopUpRecordSale(e.target.checked)}
                              className="mt-0.5 w-4 h-4 rounded accent-zinc-950 cursor-pointer"
                            />
                            <span className="text-xs leading-snug">
                              <strong className="text-zinc-900 block">
                                Record top-up in today&apos;s Sales Ledger
                              </strong>
                              <span className="text-zinc-500">
                                Keeps till Cash / Card totals aligned with money received.
                              </span>
                            </span>
                          </label>

                          {topUpRecordSale && (
                            <VendorDropdown
                              id="select-topup-giftcard-vendor"
                              value={topUpVendor}
                              onChange={setTopUpVendor}
                              vendors={knownVendors}
                              placeholder="-- Choose Vendor / Store --"
                              buttonClassName="min-h-[42px]"
                            />
                          )}
                        </div>

                        <button
                          type="submit"
                          id="btn-confirm-topup-giftcard"
                          disabled={isSubmitting}
                          className="w-full min-h-[48px] px-5 rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-[0.99] text-white text-sm font-black flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50 transition-all"
                        >
                          <Plus className="w-4 h-4" />
                          <span>
                            {isSubmitting
                              ? 'Adding...'
                              : topUpAmount && parseFloat(topUpAmount) > 0
                              ? `Add ${formatCurrency(parseFloat(topUpAmount))} to Card`
                              : 'Add Value to Card'}
                          </span>
                        </button>
                      </>
                    )}
                  </form>
                )}

                {/* SUB-TAB 3: ADJUST & MANAGE */}
                {cardActionMode === 'manage' && (
                  <div className="space-y-5">
                    <form onSubmit={handleAdjustCard} className="space-y-3.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label
                            htmlFor="input-adjust-balance"
                            className="block text-xs font-bold text-zinc-700 mb-1"
                          >
                            Set Exact Balance (£)
                          </label>
                          <input
                            id="input-adjust-balance"
                            type="number"
                            step="0.01"
                            min="0"
                            required
                            value={adjustBalanceInput}
                            onChange={(e) => setAdjustBalanceInput(e.target.value)}
                            className="w-full min-h-[42px] px-3 py-2 text-sm font-black tabular-nums text-zinc-950 bg-white rounded-xl border border-zinc-300 focus:border-zinc-950 focus:outline-hidden"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="input-adjust-recipient"
                            className="block text-xs font-bold text-zinc-700 mb-1"
                          >
                            Holder / Recipient Name
                          </label>
                          <input
                            id="input-adjust-recipient"
                            type="text"
                            value={adjustRecipientInput}
                            onChange={(e) => setAdjustRecipientInput(e.target.value)}
                            placeholder="Optional"
                            className="w-full min-h-[42px] px-3 py-2 text-xs font-semibold text-zinc-900 bg-white rounded-xl border border-zinc-300 focus:border-zinc-950 focus:outline-hidden"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label
                            htmlFor="input-adjust-notes"
                            className="block text-xs font-bold text-zinc-700 mb-1"
                          >
                            Card Notes
                          </label>
                          <input
                            id="input-adjust-notes"
                            type="text"
                            value={adjustNotesInput}
                            onChange={(e) => setAdjustNotesInput(e.target.value)}
                            placeholder="Optional notes"
                            className="w-full min-h-[42px] px-3 py-2 text-xs font-semibold text-zinc-900 bg-white rounded-xl border border-zinc-300 focus:border-zinc-950 focus:outline-hidden"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="input-adjust-reason"
                            className="block text-xs font-bold text-zinc-700 mb-1"
                          >
                            Reason for Change (Audit Log)
                          </label>
                          <input
                            id="input-adjust-reason"
                            type="text"
                            value={adjustReasonInput}
                            onChange={(e) => setAdjustReasonInput(e.target.value)}
                            placeholder="e.g. Fixed typo on activation"
                            className="w-full min-h-[42px] px-3 py-2 text-xs font-semibold text-zinc-900 bg-white rounded-xl border border-zinc-300 focus:border-zinc-950 focus:outline-hidden"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="min-h-[44px] px-4 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-black cursor-pointer disabled:opacity-50 transition-colors"
                      >
                        Save Balance & Details
                      </button>
                    </form>

                    {/* Void / Reactivate + Delete */}
                    <div className="pt-4 border-t border-zinc-200 space-y-3">
                      <div className="flex flex-col sm:flex-row gap-2.5">
                        {selectedCard.status !== 'void' && (
                          <input
                            type="text"
                            value={voidReasonInput}
                            onChange={(e) => setVoidReasonInput(e.target.value)}
                            placeholder="Optional reason for voiding (e.g. Lost / Stolen card)"
                            className="flex-1 min-h-[42px] px-3 py-2 text-xs font-semibold text-zinc-900 bg-zinc-50 rounded-xl border border-zinc-200 focus:bg-white focus:border-zinc-400 focus:outline-hidden"
                          />
                        )}
                        <button
                          type="button"
                          onClick={handleToggleVoid}
                          disabled={isSubmitting}
                          className={`min-h-[42px] px-4 rounded-xl text-xs font-black inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors shrink-0 ${
                            selectedCard.status === 'void'
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              : 'bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300'
                          }`}
                        >
                          {selectedCard.status === 'void' ? (
                            <>
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Reactivate Card</span>
                            </>
                          ) : (
                            <>
                              <Ban className="w-3.5 h-3.5" />
                              <span>Void / Lock Card</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <span className="text-[11px] text-zinc-500">
                          Need to erase a mistaken test scan?
                        </span>
                        {confirmDeleteId === selectedCard.id ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleDeleteCard(selectedCard)}
                              className="min-h-[36px] px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-black cursor-pointer"
                            >
                              Confirm Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="min-h-[36px] px-3 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(selectedCard.id)}
                            className="text-xs font-bold text-rose-600 hover:text-rose-700 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete Card</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Card Transaction History */}
              <div className="border-t border-zinc-200 bg-zinc-50/70 px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-zinc-600 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Card Activity History ({selectedCardTransactions.length})</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCardId(null);
                      scanInputRef.current?.focus();
                    }}
                    className="text-xs font-bold text-zinc-500 hover:text-zinc-900 cursor-pointer"
                  >
                    Done / Scan Next
                  </button>
                </div>

                {selectedCardTransactions.length === 0 ? (
                  <p className="text-xs text-zinc-500">No history recorded yet.</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {selectedCardTransactions.map((tx) => {
                      const isPositive = tx.delta > 0;
                      const isNegative = tx.delta < 0;
                      return (
                        <div
                          key={tx.id}
                          className="bg-white rounded-xl border border-zinc-200 px-3.5 py-2.5 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0 flex items-start gap-2.5">
                            <div
                              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                                isPositive
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : isNegative
                                  ? 'bg-rose-50 text-rose-700'
                                  : 'bg-zinc-100 text-zinc-600'
                              }`}
                            >
                              {isPositive ? (
                                <ArrowUpRight className="w-4 h-4" />
                              ) : isNegative ? (
                                <ArrowDownRight className="w-4 h-4" />
                              ) : (
                                <RefreshCw className="w-3.5 h-3.5" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-zinc-900 leading-snug">
                                {tx.description}
                              </p>
                              <p className="text-[11px] text-zinc-500 mt-0.5">
                                {formatTxTime(tx.timestamp)}
                                {tx.vendorName ? ` · ${tx.vendorName}` : ''}
                                {tx.operatorName ? ` · Till: ${tx.operatorName}` : ''}
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0 tabular-nums">
                            {tx.delta !== 0 && (
                              <p
                                className={`text-xs font-black ${
                                  isPositive ? 'text-emerald-700' : 'text-rose-600'
                                }`}
                              >
                                {isPositive ? '+' : '-'}
                                {formatCurrency(Math.abs(tx.delta))}
                              </p>
                            )}
                            <p className="text-[11px] font-semibold text-zinc-500">
                              Bal: {formatCurrency(tx.balanceAfter)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STATE C: IDLE / READY */}
          {!pendingNewBarcode && !selectedCard && (
            <div className="bg-white rounded-2xl border border-dashed border-zinc-300 p-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-pink-50 border border-pink-100 text-pink-600 flex items-center justify-center mx-auto">
                <Gift className="w-6 h-6" />
              </div>
              <div className="max-w-md mx-auto space-y-1.5">
                <h3 className="text-base font-black text-zinc-950">
                  Ready to Scan a Market Gift Card
                </h3>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Scan a new card to load its starting value, or scan an already-sold card to deduct a purchase or add a top-up. You can also click any card in the directory below.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto text-left pt-2">
                <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-3.5">
                  <p className="text-xs font-black text-zinc-900">1. First Scan (New Card)</p>
                  <p className="text-[11px] text-zinc-500 mt-1">
                    Pick £5–£100 or a custom amount, choose Cash/Card, and activate. Syncs live to all till devices.
                  </p>
                </div>
                <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-3.5">
                  <p className="text-xs font-black text-zinc-900">2. Repeat Scan (Update)</p>
                  <p className="text-[11px] text-zinc-500 mt-1">
                    Instantly shows the live remaining balance so you can redeem partial/full spend or reload value.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* All Gift Cards Directory */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-zinc-950">
              All Issued Gift Cards ({filteredCards.length})
            </h3>
            <p className="text-xs text-zinc-500">
              Click any card row to inspect history, redeem balance, or top up.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search barcode or name..."
                className="w-full sm:w-56 min-h-[40px] pl-8 pr-3 py-1.5 text-xs font-semibold text-zinc-900 bg-zinc-50 focus:bg-white rounded-xl border border-zinc-200 focus:border-zinc-950 focus:outline-hidden"
              />
            </div>

            {/* Status Filter */}
            <div className="inline-flex bg-zinc-100 p-1 rounded-xl border border-zinc-200">
              {(['all', 'active', 'empty', 'void'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setStatusFilter(tab)}
                  className={`px-3 min-h-[32px] rounded-lg text-xs font-bold capitalize cursor-pointer transition-colors ${
                    statusFilter === tab
                      ? 'bg-white text-zinc-950 shadow-2xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredCards.length === 0 ? (
          <div className="p-10 text-center text-xs text-zinc-500">
            {cards.length === 0
              ? 'No gift cards activated yet. Scan your first physical gift card above to get started.'
              : 'No gift cards match your current search or filter.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  <th className="py-3 px-4">Card Barcode</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Holder / Notes</th>
                  <th className="py-3 px-4 text-right">Loaded</th>
                  <th className="py-3 px-4 text-right">Spent</th>
                  <th className="py-3 px-4 text-right">Balance</th>
                  <th className="py-3 px-4 text-right">Issued</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-xs">
                {filteredCards.map((card) => {
                  const st = getStatusIndicator(card.status);
                  const isSelected = selectedCard?.id === card.id;
                  return (
                    <tr
                      key={card.id}
                      onClick={() => handleSelectCardFromList(card)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-pink-50/70' : 'hover:bg-zinc-50'
                      }`}
                    >
                      <td className="py-3.5 px-4 font-mono font-black text-zinc-950 whitespace-nowrap">
                        {card.barcode}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 font-bold ${st.text}`}>
                          <span className={`w-2 h-2 rounded-full ${st.dot}`} />
                          {st.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 max-w-[240px]">
                        <p className="font-bold text-zinc-900 truncate">
                          {card.recipientName || <span className="text-zinc-400 font-normal">—</span>}
                        </p>
                        {card.notes && (
                          <p className="text-[11px] text-zinc-500 truncate">{card.notes}</p>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-zinc-700 tabular-nums whitespace-nowrap">
                        {formatCurrency(card.totalLoaded)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-zinc-500 tabular-nums whitespace-nowrap">
                        {formatCurrency(card.totalRedeemed)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-black tabular-nums whitespace-nowrap">
                        <span
                          className={
                            card.status === 'void'
                              ? 'text-rose-600 line-through'
                              : card.balance > 0
                              ? 'text-emerald-700'
                              : 'text-zinc-400'
                          }
                        >
                          {formatCurrency(card.balance)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right text-zinc-500 tabular-nums whitespace-nowrap">
                        {card.dateKey}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
