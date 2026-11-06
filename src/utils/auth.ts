import { useState, useEffect } from 'react';

const STORAGE_KEY = 'pos_total_sales_auth_unlocked';
const AUTH_EVENT = 'pos_total_sales_auth_changed';

export function isTotalSalesUnlocked(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setTotalSalesUnlocked(unlocked: boolean) {
  try {
    if (unlocked) {
      sessionStorage.setItem(STORAGE_KEY, 'true');
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
    window.dispatchEvent(new Event(AUTH_EVENT));
  } catch (e) {
    console.warn('Could not update session auth:', e);
  }
}

export function verifyTotalSalesCode(code: string): boolean {
  return code.trim() === '0907';
}

export function useTotalSalesAuth() {
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => isTotalSalesUnlocked());

  useEffect(() => {
    const handleAuthChange = () => {
      setIsUnlocked(isTotalSalesUnlocked());
    };
    window.addEventListener(AUTH_EVENT, handleAuthChange);
    return () => window.removeEventListener(AUTH_EVENT, handleAuthChange);
  }, []);

  const unlock = (code: string): boolean => {
    if (verifyTotalSalesCode(code)) {
      setTotalSalesUnlocked(true);
      return true;
    }
    return false;
  };

  const lock = () => {
    setTotalSalesUnlocked(false);
  };

  return { isUnlocked, unlock, lock };
}
