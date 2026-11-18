import { useState, useEffect, useCallback } from 'react';

const DEVICE_OPERATOR_KEY = 'pos_device_operator_vendor_v1';
const OPERATOR_CHANGED_EVENT = 'pos_device_operator_changed';

export function getDeviceOperator(): string {
  try {
    return localStorage.getItem(DEVICE_OPERATOR_KEY)?.trim() || '';
  } catch {
    return '';
  }
}

export function setDeviceOperator(vendorName: string): void {
  const clean = vendorName.trim();
  try {
    if (clean) {
      localStorage.setItem(DEVICE_OPERATOR_KEY, clean);
    } else {
      localStorage.removeItem(DEVICE_OPERATOR_KEY);
    }
  } catch {
    // ignore storage errors
  }
  window.dispatchEvent(new CustomEvent(OPERATOR_CHANGED_EVENT, { detail: clean }));
}

export function useDeviceOperator() {
  const [operatorName, setOperatorState] = useState<string>(() => getDeviceOperator());

  useEffect(() => {
    const syncOperator = () => {
      setOperatorState(getDeviceOperator());
    };
    window.addEventListener(OPERATOR_CHANGED_EVENT, syncOperator);
    window.addEventListener('storage', syncOperator);
    return () => {
      window.removeEventListener(OPERATOR_CHANGED_EVENT, syncOperator);
      window.removeEventListener('storage', syncOperator);
    };
  }, []);

  const selectOperator = useCallback((vendorName: string) => {
    setDeviceOperator(vendorName);
  }, []);

  return {
    operatorName,
    hasOperator: Boolean(operatorName),
    selectOperator,
  };
}
