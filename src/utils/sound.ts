import { useState, useEffect, useCallback } from 'react';

/**
 * Storage key for checkout sound preference
 */
export const STORAGE_SOUND_KEY = 'daily_sales_tracker_checkout_sound_enabled';

// In-memory listeners for reactive updates across components
const soundListeners = new Set<(enabled: boolean) => void>();

// Track recently played sale IDs to avoid echo/double-triggering across local actions and Firestore snapshots
const recentlyPlayedSaleIds = new Map<string, number>();

// Timestamp of the most recent sound playback to prevent rapid stuttering (< 350ms)
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
 * If toggled on, plays a test preview Mario coin chime.
 */
export function toggleCheckoutSound(): boolean {
  const next = !isCheckoutSoundEnabled();
  setCheckoutSoundEnabled(next);
  if (next) {
    // Preview Mario coin sound when toggled ON
    playCheckoutSound(true, undefined, 50);
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
 * Synthesize the iconic Super Mario Bros coin sound from hitting a question block.
 * Uses the authentic 8-bit pulse jump: B5 (987.77 Hz) jumping to E6 (1318.51 Hz)
 * with a subtle box-bump transient.
 */
export function playMarioCoinSound(ctx: AudioContext) {
  const now = ctx.currentTime;

  // 1. Box bump / head-butt transient (Mario hitting the ? block)
  const bumpOsc = ctx.createOscillator();
  const bumpGain = ctx.createGain();
  bumpOsc.type = 'triangle';
  bumpOsc.frequency.setValueAtTime(180, now);
  bumpOsc.frequency.exponentialRampToValueAtTime(70, now + 0.035);
  bumpGain.gain.setValueAtTime(0.12, now);
  bumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
  bumpOsc.connect(bumpGain);
  bumpGain.connect(ctx.destination);
  bumpOsc.start(now);
  bumpOsc.stop(now + 0.04);

  // 2. Mario Coin Arpeggio Note 1: B5 (987.77 Hz) for ~0.075s
  // 3. Mario Coin Arpeggio Note 2: E6 (1318.51 Hz) sustained for ~0.38s
  const coinOsc = ctx.createOscillator();
  const coinGain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  // Lowpass filter to soften raw harshness while preserving 8-bit NES square character
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(3600, now);

  coinOsc.type = 'square'; // Authentic NES pulse wave
  coinOsc.frequency.setValueAtTime(987.77, now + 0.005); // B5
  coinOsc.frequency.setValueAtTime(1318.51, now + 0.080); // E6

  coinGain.gain.setValueAtTime(0.0001, now);
  // Note 1 gain
  coinGain.gain.setValueAtTime(0.24, now + 0.006);
  coinGain.gain.setValueAtTime(0.24, now + 0.078);
  // Note 2 jump
  coinGain.gain.setValueAtTime(0.28, now + 0.080);
  coinGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.46);

  coinOsc.connect(filter);
  filter.connect(coinGain);
  coinGain.connect(ctx.destination);

  coinOsc.start(now + 0.005);
  coinOsc.stop(now + 0.46);

  // 4. Sparkling harmonic overtone (E7 = 2637 Hz sine) for crisp metallic sheen
  const sparkleOsc = ctx.createOscillator();
  const sparkleGain = ctx.createGain();
  sparkleOsc.type = 'sine';
  sparkleOsc.frequency.setValueAtTime(2637.02, now + 0.080);

  sparkleGain.gain.setValueAtTime(0.0001, now);
  sparkleGain.gain.setValueAtTime(0.10, now + 0.082);
  sparkleGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);

  sparkleOsc.connect(sparkleGain);
  sparkleGain.connect(ctx.destination);

  sparkleOsc.start(now + 0.080);
  sparkleOsc.stop(now + 0.42);
}

/**
 * Triumphant victory fanfare for high-value sales (> £100).
 * Plays a celebratory trumpet fanfare with rich brass chords and shimmering octave finale.
 */
export function playFanfareSound(ctx: AudioContext) {
  const now = ctx.currentTime;

  // Melody notes: G4 -> C5 -> E5 -> G5 -> E5 -> G5 -> C6 (Finale Chord)
  const notes = [
    { start: 0.00, dur: 0.11, freq: 392.00, gain: 0.22 }, // G4
    { start: 0.12, dur: 0.11, freq: 523.25, gain: 0.24 }, // C5
    { start: 0.24, dur: 0.11, freq: 659.25, gain: 0.25 }, // E5
    { start: 0.36, dur: 0.16, freq: 783.99, gain: 0.26 }, // G5
    { start: 0.53, dur: 0.11, freq: 659.25, gain: 0.23 }, // E5
    { start: 0.65, dur: 0.14, freq: 783.99, gain: 0.25 }, // G5
  ];

  // Play melodic intro notes
  notes.forEach(({ start, dur, freq, gain }) => {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    // Brass filter character
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2400, now + start);
    filter.frequency.exponentialRampToValueAtTime(1400, now + start + dur);

    osc.type = 'sawtooth'; // Brass / horn tone
    osc.frequency.setValueAtTime(freq, now + start);

    gainNode.gain.setValueAtTime(0.0001, now + start);
    gainNode.gain.setValueAtTime(gain, now + start + 0.015);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(now + start);
    osc.stop(now + start + dur);
  });

  // Grand Finale Celebratory Chord at now + 0.82s (C Major Triad with high shimmer)
  const chordStart = 0.82;
  const chordDur = 1.05;

  const chordFrequencies = [
    { freq: 523.25, type: 'sawtooth' as OscillatorType, gain: 0.18 },  // C5 root
    { freq: 659.25, type: 'sawtooth' as OscillatorType, gain: 0.16 },  // E5 3rd
    { freq: 783.99, type: 'sawtooth' as OscillatorType, gain: 0.18 },  // G5 5th
    { freq: 1046.50, type: 'square' as OscillatorType, gain: 0.14 },   // C6 octave
    { freq: 2093.00, type: 'sine' as OscillatorType, gain: 0.09 },     // C7 sparkle
  ];

  chordFrequencies.forEach(({ freq, type, gain }) => {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3200, now + chordStart);
    filter.frequency.exponentialRampToValueAtTime(1200, now + chordStart + chordDur);

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now + chordStart);

    gainNode.gain.setValueAtTime(0.0001, now + chordStart);
    gainNode.gain.setValueAtTime(gain, now + chordStart + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + chordStart + chordDur);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(now + chordStart);
    osc.stop(now + chordStart + chordDur);
  });
}

/**
 * Plays sound across all connected devices whenever any sale is made!
 * - Mario getting coin from box sound for standard transactions
 * - Triumphant Fanfare sound for transactions over £100
 *
 * @param force If true, plays regardless of the current sound toggle (e.g. for previewing toggle on)
 * @param saleId Optional sale identifier for deduplication across local and remote Firestore events
 * @param amount Optional sale amount in GBP (£). If > 100, plays the triumphant fanfare!
 */
export function playCheckoutSound(force: boolean = false, saleId?: string, amount?: number) {
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

    // Over £100 transaction -> Fanfare sound!
    if (amount !== undefined && amount > 100) {
      playFanfareSound(ctx);
    } else {
      // Standard transaction -> Mario coin from box sound!
      playMarioCoinSound(ctx);
    }
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
