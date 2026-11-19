import { useState, useEffect, useCallback } from 'react';

const STORAGE_DEVICE_VENDOR_KEY = 'daily_sales_tracker_device_vendor_v1';
const DEVICE_VENDOR_EVENT = 'daily-sales-device-vendor-changed';

export function getRememberedDeviceVendor(): string {
  try {
    return (localStorage.getItem(STORAGE_DEVICE_VENDOR_KEY) || '').trim();
  } catch {
    return '';
  }
}

export function setRememberedDeviceVendor(vendorName: string | null): void {
  try {
    const clean = (vendorName || '').trim();
    if (clean) {
      localStorage.setItem(STORAGE_DEVICE_VENDOR_KEY, clean);
    } else {
      localStorage.removeItem(STORAGE_DEVICE_VENDOR_KEY);
    }
    window.dispatchEvent(new CustomEvent(DEVICE_VENDOR_EVENT, { detail: clean }));
  } catch {
    // ignore storage errors
  }
}

/**
 * Per-device (non-synced) vendor preference stored in localStorage.
 * Lets each vendor's phone/tablet default to their own name without affecting other terminals.
 */
export function useDeviceVendor(knownVendors: string[]) {
  const [rawVendor, setRawVendor] = useState<string>(() => getRememberedDeviceVendor());

  useEffect(() => {
    const syncState = () => setRawVendor(getRememberedDeviceVendor());
    const handleCustom = (e: Event) => {
      const custom = e as CustomEvent<string>;
      setRawVendor((custom.detail || getRememberedDeviceVendor()).trim());
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_DEVICE_VENDOR_KEY) {
        syncState();
      }
    };

    window.addEventListener(DEVICE_VENDOR_EVENT, handleCustom);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(DEVICE_VENDOR_EVENT, handleCustom);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Resolve canonical casing against knownVendors if available
  const resolvedVendor = (() => {
    if (!rawVendor) return '';
    if (knownVendors.length === 0) return rawVendor;
    const match = knownVendors.find((v) => v.toLowerCase() === rawVendor.toLowerCase());
    return match || '';
  })();

  // Clean up automatically if the remembered vendor was deleted from the team roster
  useEffect(() => {
    if (rawVendor && knownVendors.length > 0) {
      const exists = knownVendors.some((v) => v.toLowerCase() === rawVendor.toLowerCase());
      if (!exists) {
        setRememberedDeviceVendor(null);
      }
    }
  }, [rawVendor, knownVendors]);

  const pinVendor = useCallback((vendorName: string) => {
    const clean = vendorName.trim();
    if (!clean) return;
    setRememberedDeviceVendor(clean);
  }, []);

  const clearPinnedVendor = useCallback(() => {
    setRememberedDeviceVendor(null);
  }, []);

  const isPinned = useCallback(
    (vendorName: string) => {
      if (!resolvedVendor || !vendorName) return false;
      return resolvedVendor.toLowerCase() === vendorName.trim().toLowerCase();
    },
    [resolvedVendor]
  );

  return {
    rememberedVendor: resolvedVendor,
    pinVendor,
    clearPinnedVendor,
    isPinned,
  };
}
