export type DiscountSelection =
  | { kind: 'percent'; value: number; label: string }
  | { kind: 'flat'; value: number; label: string }
  | { kind: 'bundle'; targetPrice: number; label: string }
  | null;

export const QUICK_DISCOUNT_PERCENTS = [5, 10, 15, 20] as const;
export const QUICK_DISCOUNT_FLATS = [1, 2, 5] as const;

export const QUICK_BUNDLE_PRESETS = [
  { qty: 3, price: 10, label: '3 for £10' },
  { qty: 3, price: 12, label: '3 for £12' },
  { qty: 5, price: 20, label: '5 for £20' },
] as const;

export function calculateCheckoutPricing(rawSubtotal: number, discount: DiscountSelection) {
  const rawPence = Math.max(0, Math.round((Number(rawSubtotal) || 0) * 100));
  if (rawPence <= 0 || !discount) {
    return {
      rawSubtotal: rawPence / 100,
      finalTotal: rawPence / 100,
      discountAmount: 0,
      discountLabel: undefined as string | undefined,
    };
  }

  let discountPence = 0;
  if (discount.kind === 'percent') {
    discountPence = Math.min(rawPence - 1, Math.round((rawPence * discount.value) / 100));
  } else if (discount.kind === 'flat') {
    discountPence = Math.min(rawPence - 1, Math.round(discount.value * 100));
  } else if (discount.kind === 'bundle') {
    const targetPence = Math.max(1, Math.round(discount.targetPrice * 100));
    discountPence = Math.max(0, rawPence - targetPence);
  }

  discountPence = Math.max(0, Math.min(rawPence - 1, discountPence));
  const finalPence = rawPence - discountPence;

  return {
    rawSubtotal: rawPence / 100,
    finalTotal: finalPence / 100,
    discountAmount: discountPence / 100,
    discountLabel: discountPence > 0 ? discount.label : undefined,
  };
}
