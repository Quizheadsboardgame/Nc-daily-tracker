import { useState, useEffect, useCallback } from 'react';

/**
 * Storage key for checkout sound preference
 */
export const STORAGE_SOUND_KEY = 'daily_sales_tracker_checkout_sound_enabled';

// In-memory listeners for reactive updates across components
const soundListeners = new Set<(enabled: boolean) => void>();

// Track recently played sale IDs to avoid echo/double-triggering across local actions and Firestore snapshots
const recentlyPlayedSaleIds = new Map<string, number>();

// Timestamp of the most recent sound playback to prevent rapid stuttering (< 400ms)
let lastPlaybackTimestamp = 0;

// Singleton Web Audio context
let sharedAudioCtx: AudioContext | null = null;

function getSharedAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioCtx();
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

// Auto-unlock Web Audio context on user interactions so incoming Firestore snapshot events
// from other devices can immediately play the sound without being blocked by browser autoplay policy
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    try {
      const ctx = getSharedAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    } catch {
      // Ignore
    }
  };

  ['click', 'touchstart', 'touchend', 'pointerdown', 'keydown'].forEach((evt) => {
    window.addEventListener(evt, unlockAudio, { passive: true });
  });
}

/**
 * Check if a sale sound was already played recently (within 45 seconds)
 */
export function isSaleSoundRecentlyPlayed(saleId: string): boolean {
  if (!saleId) return false;
  const time = recentlyPlayedSaleIds.get(saleId);
  if (!time) return false;
  if (Date.now() - time < 45000) {
    return true;
  }
  recentlyPlayedSaleIds.delete(saleId);
  return false;
}

/**
 * Mark a sale sound as played
 */
export function markSaleSoundPlayed(saleId: string): void {
  if (!saleId) return;
  const now = Date.now();
  recentlyPlayedSaleIds.set(saleId, now);

  // Clean up entries older than 60 seconds
  for (const [id, t] of recentlyPlayedSaleIds.entries()) {
    if (now - t > 60000) {
      recentlyPlayedSaleIds.delete(id);
    }
  }
}

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
 * Authentic retail cash register changing till sound ("ka-ching!" drawer slide & coin change rattle).
 * Synthesized using the Web Audio API with zero external audio file dependencies.
 * Plays across all connected devices whenever any sale is made!
 *
 * @param force If true, plays regardless of the current sound toggle (e.g. for previewing toggle on)
 * @param saleId Optional sale identifier for deduplication across local and remote Firestore events
 */
export function playCheckoutSound(force: boolean = false, saleId?: string) {
  if (!force && !isCheckoutSoundEnabled()) {
    return;
  }

  // Deduplicate by sale ID
  if (saleId) {
    if (isSaleSoundRecentlyPlayed(saleId)) {
      return;
    }
    markSaleSoundPlayed(saleId);
  }

  // Prevent rapid double-firing within 350ms
  const nowMs = Date.now();
  if (nowMs - lastPlaybackTimestamp < 350) {
    return;
  }
  lastPlaybackTimestamp = nowMs;

  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // 1. "Ka-" Mechanical till drawer latch release & spring pop (0.00s - 0.05s)
    const latchOsc = ctx.createOscillator();
    const latchGain = ctx.createGain();
    latchOsc.type = 'triangle';
    latchOsc.frequency.setValueAtTime(1400, now);
    latchOsc.frequency.exponentialRampToValueAtTime(500, now + 0.045);
    latchGain.gain.setValueAtTime(0.14, now);
    latchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    latchOsc.connect(latchGain);
    latchGain.connect(ctx.destination);
    latchOsc.start(now);
    latchOsc.stop(now + 0.05);

    // 2. Mechanical drawer runner roll / slide friction (0.01s - 0.12s)
    const slideOsc = ctx.createOscillator();
    const slideGain = ctx.createGain();
    slideOsc.type = 'sine';
    slideOsc.frequency.setValueAtTime(180, now + 0.01);
    slideOsc.frequency.linearRampToValueAtTime(320, now + 0.08);
    slideGain.gain.setValueAtTime(0.001, now);
    slideGain.gain.setValueAtTime(0.07, now + 0.02);
    slideGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    slideOsc.connect(slideGain);
    slideGain.connect(ctx.destination);
    slideOsc.start(now + 0.01);
    slideOsc.stop(now + 0.12);

    // 3. "-Ching!" Dual Harmonic Cash Register Till Bell Chimes (0.05s - 0.95s)
    // Primary resonant bell tones: C7 (2093 Hz), E7 (2637 Hz), G7 (3136 Hz), C8 (4186 Hz), E8 (5274 Hz)
    const bellFrequencies = [
      { freq: 2093, gainVal: 0.22, decay: 0.75 }, // Fundamental C7 bell
      { freq: 2637, gainVal: 0.16, decay: 0.65 }, // Major third E7
      { freq: 3136, gainVal: 0.18, decay: 0.85 }, // Fifth G7
      { freq: 4186, gainVal: 0.12, decay: 0.50 }, // Sparkling C8
      { freq: 5274, gainVal: 0.07, decay: 0.35 }, // High shimmer E8
    ];

    bellFrequencies.forEach(({ freq, gainVal, decay }) => {
      const bellOsc = ctx.createOscillator();
      const bellGain = ctx.createGain();
      bellOsc.type = 'sine';
      bellOsc.frequency.setValueAtTime(freq, now + 0.05);

      bellGain.gain.setValueAtTime(0.0001, now);
      bellGain.gain.setValueAtTime(gainVal, now + 0.05);
      bellGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05 + decay);

      bellOsc.connect(bellGain);
      bellGain.connect(ctx.destination);
      bellOsc.start(now + 0.05);
      bellOsc.stop(now + 0.05 + decay);
    });

    // 4. "Changing Till" Coin Rattle & Clatter in Till Drawer Cups (0.07s - 0.38s)
    // Staggered metallic coin strikes as the drawer hits its stop and coins clink in the change cups
    const coinClinks = [
      { timeOffset: 0.07, freq: 2960, gainVal: 0.13, decay: 0.07 }, // F#7
      { timeOffset: 0.12, freq: 3520, gainVal: 0.15, decay: 0.08 }, // A7
      { timeOffset: 0.18, freq: 2489, gainVal: 0.12, decay: 0.07 }, // D#7
      { timeOffset: 0.23, freq: 4186, gainVal: 0.10, decay: 0.08 }, // C8
      { timeOffset: 0.29, freq: 3136, gainVal: 0.09, decay: 0.09 }, // G7
    ];

    coinClinks.forEach(({ timeOffset, freq, gainVal, decay }) => {
      const coinOsc = ctx.createOscillator();
      const coinGain = ctx.createGain();
      coinOsc.type = 'triangle'; // metallic overtone
      coinOsc.frequency.setValueAtTime(freq, now + timeOffset);
      coinOsc.frequency.exponentialRampToValueAtTime(freq * 0.92, now + timeOffset + decay);

      coinGain.gain.setValueAtTime(0.0001, now + timeOffset);
      coinGain.gain.setValueAtTime(gainVal, now + timeOffset + 0.003);
      coinGain.gain.exponentialRampToValueAtTime(0.0001, now + timeOffset + decay);

      coinOsc.connect(coinGain);
      coinGain.connect(ctx.destination);
      coinOsc.start(now + timeOffset);
      coinOsc.stop(now + timeOffset + decay);
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
    const ctx = getSharedAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

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
