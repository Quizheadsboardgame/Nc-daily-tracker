import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  Tag,
  Banknote,
  CreditCard,
  ArrowLeftRight,
  CheckCircle2,
  Plus,
  Users,
  X,
  Sparkles,
  Volume2,
  VolumeX,
  ShoppingCart,
  Trash2,
  Split,
  Percent,
  ChevronDown,
} from 'lucide-react';
import { PaymentMethod, BasketItemInput, SplitPaymentBreakdown, StoreCreditCustomer, GiftCardRecord } from '../types';
import { cloudDb, formatCurrency, isConnorVendor, isValidFourDigitItemNumber } from '../db/cloudDatabase';
import { VendorDropdown } from './VendorDropdown';
import { useCheckoutSound } from '../utils/sound';
import { StoreCreditCheckoutPicker } from './StoreCreditCheckoutPicker';
import { GiftCardCheckoutPicker } from './GiftCardCheckoutPicker';
import {
  DiscountSelection,
  QUICK_DISCOUNT_PERCENTS,
  QUICK_DISCOUNT_FLATS,
  QUICK_BUNDLE_PRESETS,
  calculateCheckoutPricing,
} from '../utils/checkoutDiscount';

interface NewSaleFormProps {
  currentDateKey: string;
  knownVendors?: string[];
  knownSalesmen?: string[];
  onSubmitSale: (sale: {
    salesmanName: string;
    itemDescription: string;
    isMiscellaneous?: boolean;
    amount: number;
    originalAmount?: number;
    discountAmount?: number;
    discountLabel?: string;
    paymentMethod: PaymentMethod;
    notes?: string;
    storeCredit?: { customerId: string; amount: number };
    giftCard?: { cardId: string; amount: number };
  }) => void;
  onCheckoutBasket?: (payload: {
    items: BasketItemInput[];
    payments: SplitPaymentBreakdown;
    notes?: string;
    discount?: {
      label: string;
      amount: number;
      originalSubtotal: number;
    };
    storeCredit?: { customerId: string; amount: number };
    giftCard?: { cardId: string; amount: number };
  }) => Promise<void> | void;
  onAddVendor?: (name: string) => void;
  onAddSalesman?: (name: string) => void;
  onOpenManageVendors?: () => void;
  onOpenManageSalesmen?: () => void;
  onNavigateToTrades?: () => void;
  onOpenGiftCardsTab?: () => void;
}

export const NewSaleForm: React.FC<NewSaleFormProps> = ({
  currentDateKey,
  knownVendors: propKnownVendors,
  knownSalesmen: propKnownSalesmen,
  onSubmitSale,
  onCheckoutBasket,
  onAddVendor,
  onAddSalesman,
  onOpenManageVendors,
  onOpenManageSalesmen,
  onNavigateToTrades,
  onOpenGiftCardsTab,
}) => {
  const knownVendors = propKnownVendors || propKnownSalesmen || [];
  const handleAddVendor = onAddVendor || onAddSalesman;
  const handleOpenManageVendors = onOpenManageVendors || onOpenManageSalesmen;
  const { soundEnabled, toggle: toggleSound } = useCheckoutSound();

  const [vendorName, setVendorName] = useState('');
  const [itemDescription, setItemDescription] = useState('Miscellaneous');
  const [isMiscellaneous, setIsMiscellaneous] = useState(true);
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<PaymentMethod | 'split'>('card');
  const [splitAmounts, setSplitAmounts] = useState<{
    cash: string;
    card: string;
    online: string;
    traded_out: string;
  }>({ cash: '', card: '', online: '', traded_out: '' });
  const [notes, setNotes] = useState('');
  const [basketItems, setBasketItems] = useState<BasketItemInput[]>([]);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [storeCreditSelection, setStoreCreditSelection] = useState<{
    customer: StoreCreditCustomer;
    amountToUse: number;
  } | null>(null);
  const [giftCardSelection, setGiftCardSelection] = useState<{
    card: GiftCardRecord;
    amountToUse: number;
  } | null>(null);
  const [activeDiscount, setActiveDiscount] = useState<DiscountSelection>(null);
  const [customDealMode, setCustomDealMode] = useState<'none' | 'flat' | 'bundle'>('none');
  const [customDealInput, setCustomDealInput] = useState('');

  const [showSuccessBadge, setShowSuccessBadge] = useState(false);
  const [lastRecordedInfo, setLastRecordedInfo] = useState('');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Inline Quick Add Vendor State
  const [isAddingInline, setIsAddingInline] = useState(false);
  const [inlineVendorName, setInlineVendorName] = useState('');

  const itemInputRef = useRef<HTMLInputElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);

  const [frequentVendors, setFrequentVendors] = useState<string[]>(
    () => cloudDb.getFrequentVendors(3)
  );

  useEffect(() => {
    const syncDbState = () => {
      setFrequentVendors(cloudDb.getFrequentVendors(3));
    };
    syncDbState();
    return cloudDb.subscribe(syncDbState);
  }, [knownVendors]);

  const basketSubtotal = useMemo(
    () => Math.round(basketItems.reduce((sum, item) => sum + item.amount, 0) * 100) / 100,
    [basketItems]
  );

  const currentFieldAmount = parseFloat(amount) || 0;
  const rawCheckoutSubtotal = basketItems.length > 0 ? basketSubtotal : currentFieldAmount;
  const pricing = useMemo(
    () => calculateCheckoutPricing(rawCheckoutSubtotal, activeDiscount),
    [rawCheckoutSubtotal, activeDiscount]
  );
  const checkoutTargetTotal = pricing.finalTotal;

  const splitSum = useMemo(() => {
    const c = parseFloat(splitAmounts.cash) || 0;
    const d = parseFloat(splitAmounts.card) || 0;
    const o = parseFloat(splitAmounts.online) || 0;
    const t = parseFloat(splitAmounts.traded_out) || 0;
    return Math.round((c + d + o + t) * 100) / 100;
  }, [splitAmounts]);

  const splitRemaining = Math.round((checkoutTargetTotal - splitSum) * 100) / 100;
  const isSplitBalanced = Math.abs(splitRemaining) < 0.005 && checkoutTargetTotal > 0;

  const isConnorSelected = isConnorVendor(vendorName);
  const isConnorCodeValid = isValidFourDigitItemNumber(itemDescription);

  const handleSelectVendor = (val: string, focusAfter = false) => {
    setVendorName(val);
    if (errors.vendor) setErrors((prev) => ({ ...prev, vendor: '' }));

    if (isConnorVendor(val)) {
      setIsMiscellaneous(false);
      if (!isValidFourDigitItemNumber(itemDescription)) {
        setItemDescription('');
      }
      if (errors.item) setErrors((prev) => ({ ...prev, item: '' }));
      setTimeout(() => {
        itemInputRef.current?.focus();
      }, 50);
      return;
    }

    if (focusAfter) {
      if (isMiscellaneous || itemDescription.trim()) {
        amountInputRef.current?.focus();
      } else {
        itemInputRef.current?.focus();
      }
    }
  };

  const handleToggleMisc = (checked: boolean) => {
    if (isConnorSelected && checked) {
      setIsMiscellaneous(false);
      setErrors((prev) => ({
        ...prev,
        item: 'For Connor, Miscellaneous cannot be used — enter a 4-digit number (e.g. 1234).',
      }));
      setTimeout(() => itemInputRef.current?.focus(), 50);
      return;
    }

    setIsMiscellaneous(checked);
    if (checked) {
      setItemDescription('Miscellaneous');
      if (errors.item) setErrors((prev) => ({ ...prev, item: '' }));
      setTimeout(() => {
        amountInputRef.current?.focus();
      }, 50);
    } else {
      if (itemDescription === 'Miscellaneous') {
        setItemDescription('');
      }
      setTimeout(() => {
        itemInputRef.current?.focus();
      }, 50);
    }
  };

  const resolveTargetVendor = (target: 'Kieron' | 'Newtons'): string => {
    if (target === 'Kieron') {
      const found = knownVendors.find((v) => v.toLowerCase() === 'kieron');
      return found || '';
    }
    if (target === 'Newtons') {
      const found = knownVendors.find((v) => v.toLowerCase().startsWith('newton'));
      return found || '';
    }
    return '';
  };

  const handleSelectQuickCategory = (category: 'misc' | 'comics' | 'accessories' | 'packs' | 'custom') => {
    if (category === 'misc') {
      if (isConnorSelected) {
        setErrors((prev) => ({
          ...prev,
          item: 'For Connor, Miscellaneous cannot be used — enter a 4-digit number (e.g. 1234).',
        }));
        setTimeout(() => itemInputRef.current?.focus(), 50);
        return;
      }
      setIsMiscellaneous(true);
      setItemDescription('Miscellaneous');
      if (errors.item) setErrors((prev) => ({ ...prev, item: '' }));
      setTimeout(() => amountInputRef.current?.focus(), 50);
      return;
    }

    if (category === 'packs' && isConnorSelected) {
      setErrors((prev) => ({
        ...prev,
        item: 'For Connor, enter a 4-digit item number (e.g. 1234).',
      }));
      setTimeout(() => itemInputRef.current?.focus(), 50);
      return;
    }

    if (category === 'custom') {
      setIsMiscellaneous(false);
      if (
        itemDescription === 'Miscellaneous' ||
        itemDescription === 'Comics' ||
        itemDescription === 'Accessories' ||
        itemDescription === 'Packs'
      ) {
        setItemDescription('');
      }
      setTimeout(() => itemInputRef.current?.focus(), 50);
      return;
    }

    setIsMiscellaneous(false);

    if (category === 'comics') {
      setItemDescription('Comics');
      const vendor = resolveTargetVendor('Kieron');
      setVendorName(vendor);
      if (errors.vendor) setErrors((prev) => ({ ...prev, vendor: '' }));
      if (errors.item) setErrors((prev) => ({ ...prev, item: '' }));
      setTimeout(() => amountInputRef.current?.focus(), 50);
    } else if (category === 'accessories') {
      setItemDescription('Accessories');
      const vendor = resolveTargetVendor('Newtons');
      setVendorName(vendor);
      if (errors.vendor) setErrors((prev) => ({ ...prev, vendor: '' }));
      if (errors.item) setErrors((prev) => ({ ...prev, item: '' }));
      setTimeout(() => amountInputRef.current?.focus(), 50);
    } else if (category === 'packs') {
      setItemDescription('Packs');
      if (errors.item) setErrors((prev) => ({ ...prev, item: '' }));
      setTimeout(() => amountInputRef.current?.focus(), 50);
    }
  };

  const selectedQuickCategoryValue: 'misc' | 'comics' | 'accessories' | 'packs' | 'custom' = isMiscellaneous
    ? 'misc'
    : itemDescription.toLowerCase() === 'comics'
    ? 'comics'
    : itemDescription.toLowerCase() === 'accessories'
    ? 'accessories'
    : itemDescription.toLowerCase() === 'packs'
    ? 'packs'
    : 'custom';

  const selectedDiscountDropdownValue = (() => {
    if (customDealMode === 'flat') return 'custom-flat';
    if (customDealMode === 'bundle') return 'custom-bundle';
    if (!activeDiscount) return 'none';
    if (activeDiscount.kind === 'percent') return `pct-${activeDiscount.value}`;
    if (activeDiscount.kind === 'flat') {
      const isPreset = (QUICK_DISCOUNT_FLATS as readonly number[]).includes(activeDiscount.value);
      return isPreset ? `flat-${activeDiscount.value}` : 'custom-flat';
    }
    if (activeDiscount.kind === 'bundle') {
      const match = QUICK_BUNDLE_PRESETS.find((b) => b.price === activeDiscount.targetPrice);
      return match ? `bundle-${match.price}` : 'custom-bundle';
    }
    return 'none';
  })();

  const handleSelectQuickDiscount = (value: string) => {
    if (value === 'none') {
      setActiveDiscount(null);
      setCustomDealMode('none');
      setCustomDealInput('');
      return;
    }

    if (value === 'custom-flat') {
      setCustomDealMode('flat');
      return;
    }

    if (value === 'custom-bundle') {
      setCustomDealMode('bundle');
      return;
    }

    setCustomDealMode('none');
    setCustomDealInput('');

    if (value.startsWith('pct-')) {
      const pct = Number(value.replace('pct-', ''));
      if (pct > 0) {
        setActiveDiscount({ kind: 'percent', value: pct, label: `${pct}% Off` });
      }
      return;
    }

    if (value.startsWith('flat-')) {
      const amt = Number(value.replace('flat-', ''));
      if (amt > 0) {
        setActiveDiscount({ kind: 'flat', value: amt, label: `-£${amt} Off` });
      }
      return;
    }

    if (value.startsWith('bundle-')) {
      const targetPrice = Number(value.replace('bundle-', ''));
      const bundle = QUICK_BUNDLE_PRESETS.find((b) => b.price === targetPrice);
      if (!bundle) return;

      if (basketItems.length === 0 && currentFieldAmount <= 0) {
        if (!itemDescription.trim() && !isMiscellaneous) {
          setItemDescription(`Bundle (${bundle.label})`);
        }
        setAmount(bundle.price.toFixed(2));
        setActiveDiscount(null);
        if (errors.item || errors.amount) {
          setErrors((prev) => ({ ...prev, item: '', amount: '' }));
        }
      } else {
        setActiveDiscount({
          kind: 'bundle',
          targetPrice: bundle.price,
          label: `Bundle: ${bundle.label}`,
        });
      }
    }
  };

  const validateCurrentItemFields = (): boolean => {
    const errs: { [key: string]: string } = {};

    if (!vendorName.trim()) {
      errs.vendor = 'Please select a vendor from the dropdown';
    }

    if (isConnorVendor(vendorName)) {
      if (isMiscellaneous || !isValidFourDigitItemNumber(itemDescription)) {
        errs.item = 'For Connor, Miscellaneous cannot be used — enter a 4-digit number (e.g. 1234).';
      }
    } else if (!isMiscellaneous && !itemDescription.trim()) {
      errs.item = 'Item description is required (or tick Miscellaneous)';
    }

    const numAmount = parseFloat(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      errs.amount = 'Valid sale amount greater than £0 is required';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleAddCurrentToBasket = () => {
    if (!validateCurrentItemFields()) return;

    const numAmount = Math.round(parseFloat(amount) * 100) / 100;
    const finalItemDesc = isMiscellaneous ? 'Miscellaneous' : itemDescription.trim();

    const newItem: BasketItemInput = {
      id: 'bkt_' + Math.random().toString(36).substring(2, 9),
      salesmanName: vendorName.trim(),
      itemDescription: finalItemDesc,
      isMiscellaneous,
      amount: numAmount,
    };

    setBasketItems((prev) => [...prev, newItem]);
    if (!isMiscellaneous) {
      setItemDescription('');
    }
    setAmount('');
    setErrors({});
    setTimeout(() => {
      if (isMiscellaneous) amountInputRef.current?.focus();
      else itemInputRef.current?.focus();
    }, 50);
  };

  const handleRemoveBasketItem = (id: string) => {
    setBasketItems((prev) => prev.filter((item) => item.id !== id));
    setErrors((prev) => ({ ...prev, split: '', checkout: '' }));
  };

  const handleFillRemainder = (target: PaymentMethod) => {
    const currentOther =
      (target === 'cash' ? 0 : parseFloat(splitAmounts.cash) || 0) +
      (target === 'card' ? 0 : parseFloat(splitAmounts.card) || 0) +
      (target === 'online' ? 0 : parseFloat(splitAmounts.online) || 0) +
      (target === 'traded_out' ? 0 : parseFloat(splitAmounts.traded_out) || 0);
    const rem = Math.max(0, Math.round((checkoutTargetTotal - currentOther) * 100) / 100);
    setSplitAmounts((prev) => ({
      ...prev,
      [target]: rem > 0 ? rem.toFixed(2) : '',
    }));
    if (errors.split) setErrors((prev) => ({ ...prev, split: '' }));
  };

  const syncNonTillPaymentMode = (nextCreditAmt: number, nextGiftAmt: number) => {
    const totalApplied = Math.round((nextCreditAmt + nextGiftAmt) * 100) / 100;
    if (totalApplied <= 0) {
      if (paymentMode === 'traded_out') setPaymentMode('card');
      if (paymentMode === 'split') {
        setSplitAmounts((prev) => ({ ...prev, traded_out: '' }));
      }
      return;
    }

    const total = checkoutTargetTotal;
    if (total > 0 && totalApplied >= total - 0.004) {
      setPaymentMode('traded_out');
    } else {
      setPaymentMode('split');
      setSplitAmounts((prev) => ({
        ...prev,
        traded_out: totalApplied.toFixed(2),
      }));
    }
  };

  const handleApplyStoreCredit = (
    selection: { customer: StoreCreditCustomer; amountToUse: number } | null
  ) => {
    setStoreCreditSelection(selection);
    setErrors((prev) => ({ ...prev, split: '', checkout: '' }));
    syncNonTillPaymentMode(selection?.amountToUse || 0, giftCardSelection?.amountToUse || 0);
  };

  const handleApplyGiftCard = (
    selection: { card: GiftCardRecord; amountToUse: number } | null
  ) => {
    setGiftCardSelection(selection);
    setErrors((prev) => ({ ...prev, split: '', checkout: '' }));
    syncNonTillPaymentMode(storeCreditSelection?.amountToUse || 0, selection?.amountToUse || 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Determine items to check out:
    // If basket has items, check out the basket; if basket is empty, validate & use single item form.
    let itemsToCheckout: BasketItemInput[] = [...basketItems];

    if (itemsToCheckout.length === 0) {
      if (!validateCurrentItemFields()) return;
      const numAmount = Math.round(parseFloat(amount) * 100) / 100;
      const finalItemDesc = isMiscellaneous ? 'Miscellaneous' : itemDescription.trim();
      itemsToCheckout = [
        {
          id: 'single_' + Date.now(),
          salesmanName: vendorName.trim(),
          itemDescription: finalItemDesc,
          isMiscellaneous,
          amount: numAmount,
        },
      ];
    }

    const rawTotalVal = Math.round(itemsToCheckout.reduce((s, i) => s + i.amount, 0) * 100) / 100;
    const submitPricing = calculateCheckoutPricing(rawTotalVal, activeDiscount);
    const totalVal = submitPricing.finalTotal;
    const discountPayload =
      submitPricing.discountAmount > 0 && submitPricing.discountLabel
        ? {
            label: submitPricing.discountLabel,
            amount: submitPricing.discountAmount,
            originalSubtotal: submitPricing.rawSubtotal,
          }
        : undefined;

    // Validate Store Credit if applied
    let storeCreditPayload: { customerId: string; amount: number } | undefined;
    if (storeCreditSelection && storeCreditSelection.amountToUse > 0) {
      const creditUsed = Math.round(Math.min(storeCreditSelection.amountToUse, totalVal) * 100) / 100;
      if (creditUsed > 0) {
        storeCreditPayload = {
          customerId: storeCreditSelection.customer.id,
          amount: creditUsed,
        };
      }
    }

    // Validate Gift Card if applied
    let giftCardPayload: { cardId: string; amount: number } | undefined;
    if (giftCardSelection && giftCardSelection.amountToUse > 0) {
      const remainingAfterCredit = Math.max(
        0,
        Math.round((totalVal - (storeCreditPayload?.amount || 0)) * 100) / 100
      );
      const giftUsed = Math.round(Math.min(giftCardSelection.amountToUse, remainingAfterCredit) * 100) / 100;
      if (giftUsed > 0) {
        giftCardPayload = {
          cardId: giftCardSelection.card.id,
          amount: giftUsed,
        };
      }
    }

    const totalNonTillCredit =
      Math.round(((storeCreditPayload?.amount || 0) + (giftCardPayload?.amount || 0)) * 100) / 100;

    // Validate Split Payments if split mode selected
    let payments: SplitPaymentBreakdown;
    if (paymentMode === 'split') {
      const c = Math.max(0, Math.round((parseFloat(splitAmounts.cash) || 0) * 100) / 100);
      const d = Math.max(0, Math.round((parseFloat(splitAmounts.card) || 0) * 100) / 100);
      const o = Math.max(0, Math.round((parseFloat(splitAmounts.online) || 0) * 100) / 100);
      const t = Math.max(0, Math.round((parseFloat(splitAmounts.traded_out) || 0) * 100) / 100);
      const enteredSum = Math.round((c + d + o + t) * 100) / 100;

      if (Math.abs(enteredSum - totalVal) >= 0.005) {
        setErrors((prev) => ({
          ...prev,
          split: `Split amounts (£${enteredSum.toFixed(2)}) must equal checkout total (£${totalVal.toFixed(2)}).`,
        }));
        return;
      }

      if (totalNonTillCredit > 0 && t < totalNonTillCredit - 0.004) {
        const appliedLabels = [
          storeCreditPayload ? 'store credit' : null,
          giftCardPayload ? 'gift card' : null,
        ]
          .filter(Boolean)
          .join(' + ');
        setErrors((prev) => ({
          ...prev,
          split: `Trade Out / Credit / Gift leg (£${t.toFixed(2)}) must be at least £${totalNonTillCredit.toFixed(2)} to match applied ${appliedLabels}.`,
        }));
        return;
      }

      payments = { cash: c, card: d, online: o, traded_out: t };
    } else {
      if (totalNonTillCredit > 0 && paymentMode !== 'traded_out') {
        // Ensure non-till credit/gift card leg is tracked properly when partial/full credit or gift card was applied
        if (totalNonTillCredit >= totalVal - 0.004) {
          payments = { traded_out: totalVal };
        } else {
          const rem = Math.round((totalVal - totalNonTillCredit) * 100) / 100;
          payments = { traded_out: totalNonTillCredit, [paymentMode]: rem };
        }
      } else {
        payments = { [paymentMode]: totalVal };
      }
    }

    setIsCheckingOut(true);
    try {
      const isSinglePurePayment =
        itemsToCheckout.length === 1 &&
        paymentMode !== 'split' &&
        (totalNonTillCredit <= 0 || (paymentMode === 'traded_out' && totalNonTillCredit >= totalVal - 0.004));

      if (isSinglePurePayment) {
        const single = itemsToCheckout[0];
        onSubmitSale({
          salesmanName: single.salesmanName,
          itemDescription: single.itemDescription,
          isMiscellaneous: single.isMiscellaneous,
          amount: totalVal,
          originalAmount: discountPayload ? discountPayload.originalSubtotal : undefined,
          discountAmount: discountPayload ? discountPayload.amount : undefined,
          discountLabel: discountPayload ? discountPayload.label : undefined,
          paymentMethod: paymentMode as PaymentMethod,
          notes: notes.trim() || undefined,
          storeCredit: storeCreditPayload,
          giftCard: giftCardPayload,
        });
      } else if (onCheckoutBasket) {
        await onCheckoutBasket({
          items: itemsToCheckout,
          payments,
          notes: notes.trim() || undefined,
          discount: discountPayload,
          storeCredit: storeCreditPayload,
          giftCard: giftCardPayload,
        });
      } else {
        await cloudDb.insertBasketCheckout({
          items: itemsToCheckout,
          payments,
          dateKey: currentDateKey,
          notes: notes.trim() || undefined,
          discount: discountPayload,
          storeCredit: storeCreditPayload,
          giftCard: giftCardPayload,
        });
      }

      const methodSummary =
        storeCreditPayload && giftCardPayload
          ? `GIFT CARD (#${giftCardSelection!.card.barcode}) + CREDIT`
          : giftCardPayload
          ? `GIFT CARD (#${giftCardSelection!.card.barcode})`
          : storeCreditPayload
          ? `STORE CREDIT (${storeCreditSelection!.customer.name})`
          : paymentMode === 'split'
          ? 'SPLIT PAYMENT'
          : paymentMode === 'traded_out'
          ? 'TRADE OUT'
          : paymentMode.toUpperCase();

      const itemSummaryText =
        itemsToCheckout.length > 1
          ? `Basket (${itemsToCheckout.length} items)`
          : `${itemsToCheckout[0].salesmanName} • ${itemsToCheckout[0].itemDescription}`;

      setLastRecordedInfo(`${itemSummaryText} • £${totalVal.toFixed(2)} (${methodSummary})`);
      setShowSuccessBadge(true);
      setTimeout(() => {
        setShowSuccessBadge(false);
      }, 3500);

      // Reset form & basket (keep 4-digit prompt if Connor remains selected; otherwise default back to Miscellaneous)
      setBasketItems([]);
      setStoreCreditSelection(null);
      setGiftCardSelection(null);
      setActiveDiscount(null);
      setCustomDealMode('none');
      setCustomDealInput('');
      if (isConnorVendor(vendorName)) {
        setIsMiscellaneous(false);
        setItemDescription('');
      } else {
        setIsMiscellaneous(true);
        setItemDescription('Miscellaneous');
      }
      setAmount('');
      setNotes('');
      setSplitAmounts({ cash: '', card: '', online: '', traded_out: '' });
      if (paymentMode === 'split' || (paymentMode === 'traded_out' && totalNonTillCredit > 0)) {
        setPaymentMode('card');
      }
      setErrors({});

      setTimeout(() => {
        if (isConnorVendor(vendorName)) {
          itemInputRef.current?.focus();
        } else {
          amountInputRef.current?.focus();
        }
      }, 50);
    } catch (err: any) {
      setErrors((prev) => ({ ...prev, checkout: err?.message || 'Failed to complete checkout.' }));
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handleQuickAddAmount = (addVal: number) => {
    const current = parseFloat(amount) || 0;
    setAmount((current + addVal).toFixed(2));
    if (errors.amount) {
      setErrors((prev) => ({ ...prev, amount: '' }));
    }
  };

  const handleCreateInlineVendor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlineVendorName.trim()) return;
    const clean = inlineVendorName.trim();
    if (handleAddVendor) {
      handleAddVendor(clean);
    } else {
      cloudDb.addVendor(clean);
    }
    handleSelectVendor(clean, false);
    setInlineVendorName('');
    setIsAddingInline(false);
  };

  const hasUnsavedItemInput =
    basketItems.length > 0 && (Boolean(itemDescription.trim() && !isMiscellaneous) || currentFieldAmount > 0);

  return (
    <div
      className="bg-white rounded-2xl border border-zinc-200/90 shadow-xs relative transition-all duration-200"
      id="card-new-sale-form"
    >
      {/* Decorative top accent strip */}
      <div className="h-1 bg-gradient-to-r from-emerald-500 via-blue-500 to-emerald-400 rounded-t-2xl" />

      {/* Header bar */}
      <div className="px-4 sm:px-5 py-3.5 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-zinc-50/70">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white flex items-center justify-center font-bold text-xs shadow-2xs shrink-0">
            +£
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-zinc-900 tracking-tight flex items-center gap-2 flex-wrap">
              <span>Record New Sale</span>
              <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 whitespace-nowrap">
                Multi-Item Basket • Split Pay
              </span>
            </h2>
            <p className="text-[11px] text-zinc-500">
              Till gross transactions • For customer cards traded in (cash payout / credit), use the independent{' '}
              <button
                type="button"
                onClick={onNavigateToTrades}
                className="text-amber-700 hover:text-amber-900 font-bold underline cursor-pointer"
              >
                Trade In page
              </button>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {handleOpenManageVendors && (
            <button
              type="button"
              id="btn-open-manage-vendors-top"
              onClick={handleOpenManageVendors}
              className="text-xs font-semibold text-zinc-700 bg-white hover:bg-zinc-100 border border-zinc-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              title="Manage vendor names and assigned colors"
            >
              <Users className="w-3.5 h-3.5 text-zinc-500" />
              <span>Vendors</span>
            </button>
          )}

          {showSuccessBadge && (
            <div className="animate-fade-in flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold shadow-2xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="truncate max-w-[220px]">Logged: {lastRecordedInfo}</span>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-3.5 sm:p-5 space-y-4">
        {/* Quick Category Dropdown */}
        <div className="pb-2.5 border-b border-zinc-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label
              htmlFor="select-quick-category"
              className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5 shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>Quick Categories</span>
            </label>

            <div className="relative w-full sm:w-80">
              <select
                id="select-quick-category"
                value={selectedQuickCategoryValue}
                onChange={(e) =>
                  handleSelectQuickCategory(
                    e.target.value as 'misc' | 'comics' | 'accessories' | 'packs' | 'custom'
                  )
                }
                className="w-full appearance-none min-h-[38px] pl-3 pr-9 py-1.5 text-xs font-bold rounded-xl border border-zinc-300 bg-zinc-50 hover:bg-white hover:border-zinc-400 focus:bg-white focus:border-zinc-900 focus:outline-hidden text-zinc-900 cursor-pointer transition-all"
              >
                <option value="misc" disabled={isConnorSelected}>
                  {isConnorSelected ? 'Miscellaneous (Disabled for Connor)' : 'Miscellaneous (Any vendor)'}
                </option>
                <option value="comics">Comics (Auto: Kieron)</option>
                <option value="accessories">Accessories (Auto: Newtons)</option>
                <option value="packs" disabled={isConnorSelected}>
                  {isConnorSelected ? 'Packs (Disabled for Connor)' : 'Packs (Any vendor)'}
                </option>
                <option value="custom">
                  {isConnorSelected ? '4-Digit Item Number (Connor)' : 'Custom Item Description...'}
                </option>
              </select>
              <ChevronDown className="w-4 h-4 text-zinc-500 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>
        </div>

        {/* ROW 1: Vendor Selection & Item Description */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Vendor Selector */}
          <div className="md:col-span-5 space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="select-vendor-name" className="block text-xs font-bold text-zinc-800">
                Vendor / Seller <span className="text-rose-500">*</span>
              </label>

              {!isAddingInline ? (
                <button
                  type="button"
                  onClick={() => setIsAddingInline(true)}
                  className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>New Vendor</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddingInline(false)}
                  className="text-[11px] font-semibold text-zinc-400 hover:text-zinc-600 flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                  <span>Cancel</span>
                </button>
              )}
            </div>

            {isAddingInline ? (
              <div className="flex items-center gap-1.5 animate-fade-in">
                <input
                  type="text"
                  id="input-inline-vendor-name"
                  value={inlineVendorName}
                  onChange={(e) => setInlineVendorName(e.target.value)}
                  placeholder="Enter vendor name..."
                  autoFocus
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-emerald-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 bg-emerald-50/40 text-zinc-900 font-semibold"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateInlineVendor(e);
                    }
                  }}
                />
                <button
                  type="button"
                  id="btn-save-inline-vendor"
                  onClick={handleCreateInlineVendor}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Add
                </button>
              </div>
            ) : (
              <VendorDropdown
                id="select-vendor-name"
                value={vendorName}
                onChange={(val) => handleSelectVendor(val, false)}
                vendors={knownVendors}
                placeholder="-- Choose Vendor --"
                hasError={Boolean(errors.vendor)}
              />
            )}

            {errors.vendor && <p className="text-[11px] font-semibold text-rose-600">{errors.vendor}</p>}

            {/* 1-Tap Top 3 Vendor Quick Buttons (Full width matching dropdown) */}
            {frequentVendors.length > 0 && !isAddingInline && (
              <div
                className={`grid gap-1.5 w-full pt-1 ${
                  frequentVendors.length === 1
                    ? 'grid-cols-1'
                    : frequentVendors.length === 2
                    ? 'grid-cols-2'
                    : 'grid-cols-3'
                }`}
                aria-label="Top 3 frequent vendors"
              >
                {frequentVendors.map((vendor) => {
                  const isSelected = vendorName.toLowerCase() === vendor.toLowerCase();
                  const color = cloudDb.getVendorColor(vendor);
                  return (
                    <button
                      key={vendor}
                      type="button"
                      id={`btn-form-vendor-quick-${vendor.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                      onClick={() => handleSelectVendor(vendor, true)}
                      className={`min-w-0 min-h-[34px] px-2 py-1 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-zinc-950 text-white border-zinc-950 shadow-xs'
                          : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-800 border-zinc-200'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="truncate">{vendor}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Item Sold Description */}
          <div className="md:col-span-7 space-y-1.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label htmlFor="input-item-sold" className="flex items-center gap-1.5 text-xs font-bold text-zinc-800">
                <span>{isConnorSelected ? '4-Digit Item Number' : 'Item Sold'}</span>
                <span className="text-rose-500">*</span>
                {isConnorSelected && (
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300">
                    Connor: 4 digits required
                  </span>
                )}
              </label>

              <label
                htmlFor="check-misc-sale"
                title={
                  isConnorSelected
                    ? 'Miscellaneous cannot be used when Connor is selected — enter a 4-digit number'
                    : 'Tick to record as Miscellaneous'
                }
                className={`flex items-center gap-1.5 text-[11px] font-bold select-none px-2 py-0.5 rounded-md border ${
                  isConnorSelected
                    ? 'bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed line-through opacity-70'
                    : 'text-zinc-700 hover:text-zinc-950 cursor-pointer bg-zinc-100 border-zinc-200'
                }`}
              >
                <input
                  type="checkbox"
                  id="check-misc-sale"
                  checked={isConnorSelected ? false : isMiscellaneous}
                  disabled={isConnorSelected}
                  onChange={(e) => handleToggleMisc(e.target.checked)}
                  className="rounded-xs text-zinc-900 focus:ring-zinc-900 cursor-pointer disabled:cursor-not-allowed w-3.5 h-3.5"
                />
                <span>Miscellaneous</span>
              </label>
            </div>

            <div className="relative">
              <Tag className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400 pointer-events-none" />
              <input
                ref={itemInputRef}
                type="text"
                inputMode={isConnorSelected ? 'numeric' : undefined}
                maxLength={isConnorSelected ? 4 : undefined}
                pattern={isConnorSelected ? '[0-9]{4}' : undefined}
                id="input-item-sold"
                value={itemDescription}
                disabled={!isConnorSelected && isMiscellaneous}
                onChange={(e) => {
                  const nextVal = isConnorSelected
                    ? e.target.value.replace(/\D/g, '').slice(0, 4)
                    : e.target.value;
                  setItemDescription(nextVal);
                  if (errors.item) setErrors((prev) => ({ ...prev, item: '' }));
                }}
                placeholder={
                  isConnorSelected
                    ? 'Enter 4-digit number (e.g. 1234)'
                    : isMiscellaneous
                    ? 'Miscellaneous'
                    : 'e.g. 151 Booster Pack, PSA 10 Pikachu, Binder...'
                }
                className={`w-full pl-9 ${isConnorSelected ? 'pr-16 font-mono font-black tracking-widest' : 'pr-3'} py-2 text-xs rounded-xl border transition-all ${
                  !isConnorSelected && isMiscellaneous
                    ? 'bg-zinc-100 text-zinc-600 font-bold border-zinc-200 cursor-not-allowed'
                    : errors.item
                    ? 'border-rose-400 bg-rose-50/30 text-rose-900 focus:ring-rose-500/20'
                    : isConnorSelected && isConnorCodeValid
                    ? 'border-emerald-400 bg-emerald-50/30 text-zinc-950 focus:ring-emerald-500/20 focus:border-emerald-600'
                    : 'border-zinc-300 bg-white text-zinc-900 hover:border-zinc-400 focus:ring-zinc-900/10 focus:border-zinc-900'
                }`}
              />
              {isConnorSelected && (
                <span
                  className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-extrabold px-1.5 py-0.5 rounded tabular-nums ${
                    isConnorCodeValid
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}
                >
                  {itemDescription.trim().length}/4{isConnorCodeValid ? ' ✓' : ''}
                </span>
              )}
            </div>

            {errors.item && <p className="text-[11px] font-semibold text-rose-600">{errors.item}</p>}
          </div>
        </div>

        {/* ROW 2: Price (£) + Add to Basket + Payment Method */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-1">
          {/* Amount / Price + Add to Basket */}
          <div className="md:col-span-5 space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="input-sale-amount" className="block text-xs font-bold text-zinc-800">
                Sale Price (£ GBP) <span className="text-rose-500">*</span>
              </label>

              <div className="flex items-center gap-1">
                {[1, 5, 10].map((inc) => (
                  <button
                    key={inc}
                    type="button"
                    onClick={() => handleQuickAddAmount(inc)}
                    className="text-[10px] font-bold px-1.5 py-0.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-md border border-zinc-200 transition-colors cursor-pointer"
                  >
                    +{inc}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-stretch gap-2">
              <div className="relative flex-1 min-w-0">
                <span className="absolute left-3.5 top-2.5 text-sm font-black text-zinc-500 pointer-events-none">
                  £
                </span>
                <input
                  ref={amountInputRef}
                  type="number"
                  step="0.01"
                  min="0.01"
                  id="input-sale-amount"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    if (errors.amount) setErrors((prev) => ({ ...prev, amount: '' }));
                  }}
                  placeholder="0.00"
                  className={`w-full min-h-[42px] pl-8 pr-3 py-2 text-sm font-black tracking-tight rounded-xl border tabular-nums transition-all ${
                    errors.amount
                      ? 'border-rose-400 bg-rose-50/30 text-rose-900 focus:ring-rose-500/20'
                      : 'border-zinc-300 bg-white text-zinc-950 hover:border-zinc-400 focus:ring-zinc-900/10 focus:border-zinc-900'
                  }`}
                />
              </div>

              <button
                type="button"
                id="btn-add-to-basket"
                onClick={handleAddCurrentToBasket}
                className="min-h-[42px] px-3 py-2 rounded-xl border border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-extrabold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                title="Add this item to multi-item basket (mix items across vendors in one checkout)"
              >
                <ShoppingCart className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
                <span>+ Basket</span>
              </button>
            </div>

            {errors.amount && <p className="text-[11px] font-semibold text-rose-600">{errors.amount}</p>}
          </div>

          {/* Payment Method Selector (Cash, Card, Trade Out, Split) */}
          <div className="md:col-span-7 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-zinc-800">
                Payment / Settlement Method <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-zinc-400 font-medium hidden sm:inline">
                Use Split to mix Cash + Card + Trade
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                id="btn-payment-cash"
                onClick={() => setPaymentMode('cash')}
                className={`min-h-[44px] py-2 px-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  paymentMode === 'cash'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm ring-2 ring-emerald-600/25 font-black'
                    : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-300'
                }`}
              >
                <Banknote className="w-4 h-4 shrink-0" />
                <span>Cash</span>
              </button>

              <button
                type="button"
                id="btn-payment-card"
                onClick={() => setPaymentMode('card')}
                className={`min-h-[44px] py-2 px-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  paymentMode === 'card'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-600/25 font-black'
                    : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-300'
                }`}
              >
                <CreditCard className="w-4 h-4 shrink-0" />
                <span>Card</span>
              </button>

              <button
                type="button"
                id="btn-payment-traded-out"
                onClick={() => setPaymentMode('traded_out')}
                className={`min-h-[44px] py-2 px-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  paymentMode === 'traded_out'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-sm ring-2 ring-amber-600/25 font-black'
                    : 'bg-amber-50/60 hover:bg-amber-100 text-amber-900 border-amber-300'
                }`}
                title="Item traded out from vendor's inventory/till"
              >
                <ArrowLeftRight className={`w-4 h-4 shrink-0 ${paymentMode === 'traded_out' ? 'text-amber-200' : 'text-amber-700'}`} />
                <span>Trade Out</span>
              </button>

              <button
                type="button"
                id="btn-payment-split"
                onClick={() => setPaymentMode('split')}
                className={`min-h-[44px] py-2 px-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  paymentMode === 'split'
                    ? 'bg-cyan-700 text-white border-cyan-700 shadow-sm ring-2 ring-cyan-600/25 font-black'
                    : 'bg-cyan-50/70 hover:bg-cyan-100 text-cyan-900 border-cyan-300'
                }`}
                title="Split payment across Cash, Card, or Trade Out"
              >
                <Split className={`w-4 h-4 shrink-0 ${paymentMode === 'split' ? 'text-cyan-200' : 'text-cyan-700'}`} />
                <span>Split</span>
              </button>
            </div>

            {paymentMode === 'traded_out' && (
              <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1 flex items-center gap-1.5 animate-fade-in">
                <span className="font-bold">Notice:</span>
                <span>This item is recorded as trade out from stock. (Cards traded in to store are logged separately on Trade In page).</span>
              </div>
            )}
          </div>
        </div>

        {/* Multi-Item Basket Panel (Visible whenever items are in the basket) */}
        {basketItems.length > 0 && (
          <div
            id="panel-sale-basket"
            className="rounded-2xl bg-indigo-50/70 border border-indigo-200 p-3.5 sm:p-4 space-y-3 animate-fade-in"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                  <ShoppingCart className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-indigo-950 uppercase tracking-wider">
                    Multi-Item Basket ({basketItems.length} {basketItems.length === 1 ? 'item' : 'items'})
                  </h3>
                  <p className="text-[11px] text-indigo-700 font-medium">
                    One combined chime &amp; flash banner on checkout (Fanfare if total &gt; £100)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-indigo-950 tabular-nums bg-white px-2.5 py-1 rounded-lg border border-indigo-200">
                  Total: {formatCurrency(pricing.finalTotal)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setBasketItems([]);
                    setActiveDiscount(null);
                  }}
                  className="text-[11px] font-bold text-rose-600 hover:text-rose-800 px-2 py-1 rounded-lg hover:bg-rose-50 cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="divide-y divide-indigo-200/70 bg-white rounded-xl border border-indigo-200/80 overflow-hidden">
              {basketItems.map((item, idx) => (
                <div
                  key={item.id}
                  className="px-3 py-2 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-bold text-zinc-400 w-4 shrink-0">
                      #{idx + 1}
                    </span>
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: cloudDb.getVendorColor(item.salesmanName) }}
                    />
                    <span className="font-bold text-zinc-900 shrink-0">{item.salesmanName}</span>
                    <span className="text-zinc-400">•</span>
                    <span className="font-medium text-zinc-700 truncate">{item.itemDescription}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-black text-zinc-950 tabular-nums">
                      {formatCurrency(item.amount)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveBasketItem(item.id)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      aria-label={`Remove ${item.itemDescription}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {hasUnsavedItemInput && (
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
                <span>
                  You also have details typed above—tap <strong>+ Basket</strong> to include them before checkout.
                </span>
                <button
                  type="button"
                  onClick={handleAddCurrentToBasket}
                  className="font-extrabold text-amber-950 underline shrink-0 cursor-pointer"
                >
                  + Add Now
                </button>
              </div>
            )}
          </div>
        )}

        {/* Split Payment Panel (Visible whenever Split is selected) */}
        {paymentMode === 'split' && (
          <div
            id="panel-split-payment"
            className="rounded-2xl bg-cyan-50/70 border border-cyan-200 p-3.5 sm:p-4 space-y-3 animate-fade-in"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Split className="w-4 h-4 text-cyan-700 shrink-0" />
                <span className="text-xs font-black text-cyan-950 uppercase tracking-wider">
                  Split Payment Allocation
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-zinc-600">
                  Target: <strong className="text-zinc-950 tabular-nums">{formatCurrency(checkoutTargetTotal)}</strong>
                </span>
                {checkoutTargetTotal > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-md font-extrabold text-[11px] tabular-nums border ${
                      isSplitBalanced
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : splitRemaining > 0
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : 'bg-rose-100 text-rose-800 border-rose-300'
                    }`}
                  >
                    {isSplitBalanced
                      ? 'Balanced ✓'
                      : splitRemaining > 0
                      ? `Remaining: ${formatCurrency(splitRemaining)}`
                      : `Over by: ${formatCurrency(Math.abs(splitRemaining))}`}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {(
                [
                  { key: 'cash', label: 'Cash (£)', color: 'emerald' },
                  { key: 'card', label: 'Card (£)', color: 'blue' },
                  {
                    key: 'traded_out',
                    label: giftCardSelection || storeCreditSelection ? 'Credit / Gift / Trade (£)' : 'Trade Out (£)',
                    color: 'amber',
                  },
                ] as const
              ).map(({ key, label }) => (
                <div
                  key={key}
                  className="bg-white rounded-xl border border-cyan-200/80 p-2.5 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-1">
                    <label className="text-[11px] font-bold text-zinc-700">
                      {label}
                    </label>
                    {checkoutTargetTotal > 0 && (
                      <button
                        type="button"
                        onClick={() => handleFillRemainder(key)}
                        className="text-[10px] font-extrabold text-cyan-700 hover:text-cyan-950 bg-cyan-50 hover:bg-cyan-100 px-1.5 py-0.5 rounded border border-cyan-200 cursor-pointer"
                        title={`Put remaining balance into ${label}`}
                      >
                        Rem
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1.5 text-xs font-bold text-zinc-400 pointer-events-none">£</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={splitAmounts[key]}
                      onChange={(e) => {
                        setSplitAmounts((prev) => ({ ...prev, [key]: e.target.value }));
                        if (errors.split) setErrors((prev) => ({ ...prev, split: '' }));
                      }}
                      placeholder="0.00"
                      className="w-full pl-6 pr-2 py-1 text-xs font-black tabular-nums rounded-lg border border-zinc-300 focus:border-cyan-600 focus:outline-hidden text-zinc-950"
                    />
                  </div>
                </div>
              ))}
            </div>

            {errors.split && <p className="text-[11px] font-bold text-rose-600">{errors.split}</p>}
          </div>
        )}

        {/* Quick Discount & Bundle Dropdown */}
        <div className="rounded-2xl bg-zinc-50 border border-zinc-200 p-3 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label
              htmlFor="select-quick-discount"
              className="text-[11px] font-black uppercase tracking-wider text-zinc-600 flex items-center gap-1.5 shrink-0"
            >
              <Percent className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span>Quick Discounts &amp; Bundles</span>
            </label>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-72">
                <select
                  id="select-quick-discount"
                  value={selectedDiscountDropdownValue}
                  onChange={(e) => handleSelectQuickDiscount(e.target.value)}
                  className="w-full appearance-none min-h-[38px] pl-3 pr-9 py-1.5 text-xs font-bold rounded-xl border border-zinc-300 bg-white hover:border-zinc-400 focus:border-zinc-900 focus:outline-hidden text-zinc-900 cursor-pointer transition-all"
                >
                  <option value="none">No discount / Standard price</option>
                  <optgroup label="Percentage Off">
                    {QUICK_DISCOUNT_PERCENTS.map((pct) => (
                      <option key={`pct-${pct}`} value={`pct-${pct}`} disabled={rawCheckoutSubtotal <= 0}>
                        -{pct}% Off
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Flat £ Off">
                    {QUICK_DISCOUNT_FLATS.map((amt) => (
                      <option key={`flat-${amt}`} value={`flat-${amt}`} disabled={rawCheckoutSubtotal <= amt}>
                        -£{amt} Off
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Bundle Deals">
                    {QUICK_BUNDLE_PRESETS.map((bundle) => (
                      <option key={`bundle-${bundle.price}`} value={`bundle-${bundle.price}`}>
                        Bundle: {bundle.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Custom Deal">
                    <option value="custom-flat">Custom -£ Off...</option>
                    <option value="custom-bundle">Custom Bundle Price £...</option>
                  </optgroup>
                </select>
                <ChevronDown className="w-4 h-4 text-zinc-500 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
              </div>

              {customDealMode !== 'none' && (
                <div className="flex items-center gap-1.5 animate-fade-in">
                  <div className="relative flex-1 sm:flex-none">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400 pointer-events-none">
                      £
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={customDealInput}
                      onChange={(e) => setCustomDealInput(e.target.value)}
                      placeholder={customDealMode === 'flat' ? 'Off' : 'Total'}
                      className="w-full sm:w-24 min-h-[38px] pl-6 pr-2 py-1 text-xs font-bold tabular-nums rounded-xl border border-zinc-300 bg-white text-zinc-900"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={!parseFloat(customDealInput) || parseFloat(customDealInput) <= 0}
                    onClick={() => {
                      const val = parseFloat(customDealInput);
                      if (!val || val <= 0) return;
                      if (customDealMode === 'flat') {
                        setActiveDiscount({ kind: 'flat', value: val, label: `-£${val.toFixed(2)} Off` });
                      } else if (basketItems.length === 0 && currentFieldAmount <= 0) {
                        if (!itemDescription.trim() && !isMiscellaneous) {
                          setItemDescription(`Custom Bundle (£${val.toFixed(2)})`);
                        }
                        setAmount(val.toFixed(2));
                        setActiveDiscount(null);
                      } else {
                        setActiveDiscount({
                          kind: 'bundle',
                          targetPrice: val,
                          label: `Bundle: £${val.toFixed(2)}`,
                        });
                      }
                      setCustomDealInput('');
                    }}
                    className="min-h-[38px] px-3 py-1 rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-white text-xs font-bold cursor-pointer shrink-0"
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>
          </div>

          {pricing.discountAmount > 0 && (
            <div className="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-zinc-200/80">
              <span className="text-[11px] font-black px-2.5 py-1 rounded-lg bg-rose-100 text-rose-900 border border-rose-300 tabular-nums">
                {pricing.discountLabel}: Was {formatCurrency(pricing.rawSubtotal)} &rarr; Now{' '}
                {formatCurrency(pricing.finalTotal)} (-{formatCurrency(pricing.discountAmount)})
              </span>
              <button
                type="button"
                onClick={() => {
                  setActiveDiscount(null);
                  setCustomDealMode('none');
                  setCustomDealInput('');
                }}
                className="text-[11px] font-bold text-zinc-500 hover:text-rose-700 underline cursor-pointer"
              >
                Clear Discount
              </button>
            </div>
          )}
        </div>

        {/* Customer Store Credit & Gift Card Payment Pickers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <StoreCreditCheckoutPicker
            theme="light"
            checkoutTotal={checkoutTargetTotal}
            selectedCustomerId={storeCreditSelection?.customer.id || null}
            appliedAmount={storeCreditSelection?.amountToUse || 0}
            onApplyStoreCredit={handleApplyStoreCredit}
          />

          <GiftCardCheckoutPicker
            theme="light"
            checkoutTotal={checkoutTargetTotal}
            maxAllowedAmount={Math.max(0, checkoutTargetTotal - (storeCreditSelection?.amountToUse || 0))}
            selectedCardId={giftCardSelection?.card.id || null}
            appliedAmount={giftCardSelection?.amountToUse || 0}
            onApplyGiftCard={handleApplyGiftCard}
            onOpenGiftCardsTab={onOpenGiftCardsTab}
          />
        </div>

        {errors.checkout && (
          <p className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 px-3 py-2 rounded-xl">
            {errors.checkout}
          </p>
        )}

        {/* Optional Notes & Action Submit */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-zinc-100">
          <div className="flex-1 min-w-0">
            <input
              type="text"
              id="input-sale-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes or receipt memo..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 bg-zinc-50/60 hover:bg-white focus:bg-white focus:border-zinc-900 focus:outline-hidden text-zinc-800"
            />
          </div>

          <div className="flex items-stretch gap-2 w-full sm:w-auto">
            <button
              type="button"
              id="btn-form-sound-toggle"
              onClick={toggleSound}
              className={`min-h-[44px] px-3 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                soundEnabled
                  ? 'bg-zinc-100 text-emerald-800 border-emerald-300/80 hover:bg-emerald-50'
                  : 'bg-zinc-100 text-zinc-400 border-zinc-200 hover:bg-zinc-200 hover:text-zinc-600'
              }`}
              title={soundEnabled ? 'Checkout sound is ON (click to mute)' : 'Checkout sound is OFF (click to turn on)'}
              aria-label="Toggle checkout chime sound"
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-[11px] font-bold">Sound: ON</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 text-zinc-400 shrink-0" />
                  <span className="text-[11px] font-bold">Sound: OFF</span>
                </>
              )}
            </button>

            <button
              type="submit"
              id="btn-submit-new-sale"
              disabled={isCheckingOut}
              className="flex-1 sm:flex-none min-w-0 min-h-[44px] px-4 sm:px-6 py-2.5 bg-zinc-950 hover:bg-zinc-800 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98 whitespace-nowrap"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="truncate">
                {basketItems.length > 0
                  ? `Checkout Basket (${basketItems.length} • ${formatCurrency(pricing.finalTotal)})`
                  : paymentMode === 'split'
                  ? `Record Split Sale${pricing.finalTotal > 0 ? ` (${formatCurrency(pricing.finalTotal)})` : ''}`
                  : `Record Sale${pricing.finalTotal > 0 ? ` (${formatCurrency(pricing.finalTotal)})` : ''}`}
              </span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
