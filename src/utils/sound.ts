import { useState, useEffect, useCallback } from 'react';

/**
 * Storage key for checkout sound preference
 */
export const STORAGE_SOUND_KEY = 'daily_sales_tracker_checkout_sound_enabled';

// In-memory listeners for reactive updates across components
const soundListeners = new Set<(enabled: boolean) => void>();

/**
 * Check if the checkout sound effect is enabled (defaults to true)
 */
export function isCheckoutSoundEnabled(): boolean {
  try {
    const val = localStorage.getItem(STORAGE_SOUND_KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

/**
 * Update checkout sound setting and notify all listeners
 */
export function setCheckoutSoundEnabled(enabled: boolean) {
  try {
    localStorage.setItem(STORAGE_SOUND_KEY, enabled ? 'true' : 'false');
  } catch {
    // Ignore storage errors
  }
  soundListeners.forEach((fn) => {
    try {
      fn(enabled);
    } catch {
      // Ignore listener error
    }
  });
}

/**
 * Toggle checkout sound setting on or off.
 * If toggled on, plays a test preview chime.
 */
export function toggleCheckoutSound(): boolean {
  const next = !isCheckoutSoundEnabled();
  setCheckoutSoundEnabled(next);
  if (next) {
    // Preview chime when toggled ON
    playCheckoutSound(true);
  }
  return next;
}

/**
 * Subscribe to sound setting changes
 */
export function subscribeToSoundSetting(listener: (enabled: boolean) => void): () => void {
  soundListeners.add(listener);
  return () => {
    soundListeners.delete(listener);
  };
}

/**
 * React hook to reactively read and toggle checkout sound
 */
export function useCheckoutSound() {
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(() => isCheckoutSoundEnabled());

  useEffect(() => {
    const unsubscribe = subscribeToSoundSetting((enabled) => {
      setSoundEnabledState(enabled);
    });
    return unsubscribe;
  }, []);

  const toggle = useCallback(() => {
    return toggleCheckoutSound();
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    setCheckoutSoundEnabled(enabled);
  }, []);

  return {
    soundEnabled,
    toggle,
    setEnabled,
  };
}

/**
 * Authentic retail cash register checkout chime ("cha-ching" register bell).
 * Synthesized using the Web Audio API with zero external audio file dependencies.
 *
 * @param force If true, plays regardless of the current sound toggle (e.g. for previewing toggle on)
 */
export function playCheckoutSound(force: boolean = false) {
  if (!force && !isCheckoutSoundEnabled()) {
    return;
  }

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // 1. "Cha-" Initial mechanical drawer click & coin rattle (0.00s - 0.06s)
    const clickOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(1200, now);
    clickOsc.frequency.exponentialRampToValueAtTime(700, now + 0.05);
    clickGain.gain.setValueAtTime(0.12, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    clickOsc.connect(clickGain);
    clickGain.connect(ctx.destination);
    clickOsc.start(now);
    clickOsc.stop(now + 0.06);

    // 2. Coin Clink metallic ring (0.03s - 0.14s)
    const coinOsc = ctx.createOscillator();
    const coinGain = ctx.createGain();
    coinOsc.type = 'sine';
    coinOsc.frequency.setValueAtTime(1760, now + 0.02); // A6
    coinOsc.frequency.setValueAtTime(2093, now + 0.05); // C7
    coinGain.gain.setValueAtTime(0.001, now);
    coinGain.gain.setValueAtTime(0.18, now + 0.03);
    coinGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    coinOsc.connect(coinGain);
    coinGain.connect(ctx.destination);
    coinOsc.start(now + 0.02);
    coinOsc.stop(now + 0.14);

    // 3. "-Ching!" Dual Harmonic Cash Register Bell Chimes (0.07s - 0.80s)
    // Primary bell tone (C7 = 2093 Hz), E7 (2637 Hz), G7 (3136 Hz), and sparkling harmonic C8 (4186 Hz)
    const bellFrequencies = [
      { freq: 2093, gainVal: 0.24, decay: 0.70 }, // Fundamental C7 bell
      { freq: 2637, gainVal: 0.15, decay: 0.55 }, // Major third E7
      { freq: 3136, gainVal: 0.18, decay: 0.75 }, // Fifth G7
      { freq: 4186, gainVal: 0.10, decay: 0.40 }, // Octave sparkle C8
    ];

    bellFrequencies.forEach(({ freq, gainVal, decay }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + 0.07);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.setValueAtTime(gainVal, now + 0.07);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07 + decay);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + 0.07);
      osc.stop(now + 0.07 + decay);
    });
  } catch (e) {
    // AudioContext autoplay restrictions or blocked
  }
}

/**
 * Standard barcode scanner beep or error buzz
 */
export function playSaleBeep(isSuccess: boolean = true) {
  if (isSuccess && !isCheckoutSoundEnabled()) {
    return;
  }

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
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
      // Low warning buzz for errors or duplicates
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
