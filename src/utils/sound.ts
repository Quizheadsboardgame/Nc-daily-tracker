import { useState, useEffect, useCallback } from 'react';

/**
 * Storage key for checkout sound preference
 */
export const STORAGE_SOUND_KEY = 'daily_sales_tracker_checkout_sound_enabled';

// In-memory listeners for reactive updates across components
const soundListeners = new Set<(enabled: boolean) => void>();
const unlockListeners = new Set<(unlocked: boolean) => void>();

// Track recently played sale IDs to avoid echo/double-triggering across local actions and Firestore snapshots
const recentlyPlayedSaleIds = new Map<string, number>();

// Timestamp of the most recent sound playback to prevent rapid stuttering (< 300ms)
let lastPlaybackTimestamp = 0;

// Singleton Web Audio context
let sharedAudioCtx: AudioContext | null = null;
let isAudioSessionUnlocked = false;
let keepAliveTimer: any = null;

// Pre-rendered Audio Blob URLs for dual-engine playback (HTML5 Audio + Web Audio)
let marioWavBlobUrl: string | null = null;
let fanfareWavBlobUrl: string | null = null;

/**
 * Helper to convert an AudioBuffer into a standard 16-bit PCM WAV Blob
 */
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numOfChan * bytesPerSample;
  const dataSize = buffer.length * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const arrayBuffer = new ArrayBuffer(totalSize);
  const dataView = new DataView(arrayBuffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      dataView.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  // RIFF Chunk
  writeString(0, 'RIFF');
  dataView.setUint32(4, totalSize - 8, true);
  writeString(8, 'WAVE');

  // fmt Subchunk
  writeString(12, 'fmt ');
  dataView.setUint32(16, 16, true); // Subchunk1Size
  dataView.setUint16(20, format, true); // AudioFormat
  dataView.setUint16(22, numOfChan, true); // NumChannels
  dataView.setUint32(24, sampleRate, true); // SampleRate
  dataView.setUint32(28, sampleRate * blockAlign, true); // ByteRate
  dataView.setUint16(32, blockAlign, true); // BlockAlign
  dataView.setUint16(34, bitDepth, true); // BitsPerSample

  // data Subchunk
  writeString(36, 'data');
  dataView.setUint32(40, dataSize, true);

  // Write interleaved PCM samples
  const channelData: Float32Array[] = [];
  for (let c = 0; c < numOfChan; c++) {
    channelData.push(buffer.getChannelData(c));
  }

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < numOfChan; c++) {
      const sample = Math.max(-1, Math.min(1, channelData[c][i]));
      const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      dataView.setInt16(offset, int16, true);
      offset += 2;
    }
  }

  return new Blob([dataView], { type: 'audio/wav' });
}

/**
 * Pre-render the Mario Coin and Fanfare sounds in memory via OfflineAudioContext
 * so they can be played through HTML5 Audio elements immediately and reliably across all devices.
 */
async function preRenderSoundBlobs() {
  if (typeof window === 'undefined') return;
  const OfflineCtx = (window as any).OfflineAudioContext || (window as any).webkitOfflineAudioContext;
  if (!OfflineCtx) return;

  try {
    // 1. Render Mario Coin (0.5s duration)
    const coinOffline = new OfflineCtx(1, 44100 * 0.5, 44100);
    renderMarioCoinToContext(coinOffline);
    const coinBuffer = await coinOffline.startRendering();
    const coinBlob = audioBufferToWavBlob(coinBuffer);
    marioWavBlobUrl = URL.createObjectURL(coinBlob);
  } catch (e) {
    console.warn('Could not pre-render Mario sound blob:', e);
  }

  try {
    // 2. Render Fanfare (2.0s duration)
    const fanfareOffline = new OfflineCtx(1, 44100 * 2.0, 44100);
    renderFanfareToContext(fanfareOffline);
    const fanfareBuffer = await fanfareOffline.startRendering();
    const fanfareBlob = audioBufferToWavBlob(fanfareBuffer);
    fanfareWavBlobUrl = URL.createObjectURL(fanfareBlob);
  } catch (e) {
    console.warn('Could not pre-render Fanfare sound blob:', e);
  }
}

// Start pre-rendering on module load
if (typeof window !== 'undefined') {
  setTimeout(() => {
    preRenderSoundBlobs();
  }, 100);
}

/**
 * Get or create the shared AudioContext
 */
export function getSharedAudioContext(): AudioContext | null {
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

/**
 * Checks whether audio has been unlocked via user interaction on this device
 */
export function isAudioUnlocked(): boolean {
  if (!sharedAudioCtx) return false;
  return sharedAudioCtx.state === 'running' || isAudioSessionUnlocked;
}

/**
 * Actively unlock the audio context and start an inaudible keep-alive loop
 * so iOS Safari / Chrome never suspends the audio session while the app is open.
 */
export async function unlockAudioContext(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return false;

    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    // Play a 1-sample silent buffer to unlock iOS Safari Web Audio
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);

    isAudioSessionUnlocked = true;

    // Start keep-alive loop to prevent iOS Safari auto-suspension during silence
    if (!keepAliveTimer) {
      keepAliveTimer = setInterval(() => {
        try {
          if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
            sharedAudioCtx.resume().catch(() => {});
          }
        } catch {
          // Ignore
        }
      }, 10000);
    }

    // Notify listeners
    unlockListeners.forEach((fn) => fn(true));
    return true;
  } catch {
    return false;
  }
}

// Auto-unlock on any user interaction anywhere on the page
if (typeof window !== 'undefined') {
  const handleUserInteraction = () => {
    unlockAudioContext();
  };

  ['click', 'touchstart', 'touchend', 'pointerdown', 'keydown'].forEach((evt) => {
    window.addEventListener(evt, handleUserInteraction, { passive: true });
  });
}

/**
 * React hook to observe audio unlock status
 */
export function useAudioUnlockStatus() {
  const [unlocked, setUnlocked] = useState<boolean>(() => isAudioUnlocked());

  useEffect(() => {
    const check = () => {
      setUnlocked(isAudioUnlocked());
    };
    check();

    unlockListeners.add(setUnlocked);
    return () => {
      unlockListeners.delete(setUnlocked);
    };
  }, []);

  const unlock = useCallback(async () => {
    const success = await unlockAudioContext();
    setUnlocked(success);
    if (success) {
      // Play a gentle Mario preview when manually tapped
      playCheckoutSound(true, undefined, 50);
    }
    return success;
  }, []);

  return { isUnlocked: unlocked, unlock };
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
    unlockAudioContext();
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
 * Render Mario Coin sound graph into an audio context (realtime or offline)
 */
function renderMarioCoinToContext(ctx: BaseAudioContext) {
  const now = ctx.currentTime;

  // 1. Box bump / head-butt transient (Mario hitting the ? block)
  const bumpOsc = ctx.createOscillator();
  const bumpGain = ctx.createGain();
  bumpOsc.type = 'triangle';
  bumpOsc.frequency.setValueAtTime(180, now);
  bumpOsc.frequency.exponentialRampToValueAtTime(70, now + 0.035);
  bumpGain.gain.setValueAtTime(0.14, now);
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

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(3600, now);

  coinOsc.type = 'square'; // Authentic NES pulse wave
  coinOsc.frequency.setValueAtTime(987.77, now + 0.005); // B5
  coinOsc.frequency.setValueAtTime(1318.51, now + 0.080); // E6

  coinGain.gain.setValueAtTime(0.0001, now);
  coinGain.gain.setValueAtTime(0.26, now + 0.006);
  coinGain.gain.setValueAtTime(0.26, now + 0.078);
  coinGain.gain.setValueAtTime(0.30, now + 0.080);
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
  sparkleGain.gain.setValueAtTime(0.11, now + 0.082);
  sparkleGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);

  sparkleOsc.connect(sparkleGain);
  sparkleGain.connect(ctx.destination);

  sparkleOsc.start(now + 0.080);
  sparkleOsc.stop(now + 0.42);
}

/**
 * Render Fanfare sound graph into an audio context (realtime or offline)
 */
function renderFanfareToContext(ctx: BaseAudioContext) {
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

  notes.forEach(({ start, dur, freq, gain }) => {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2400, now + start);
    filter.frequency.exponentialRampToValueAtTime(1400, now + start + dur);

    osc.type = 'sawtooth';
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
    { freq: 523.25, type: 'sawtooth' as OscillatorType, gain: 0.18 },
    { freq: 659.25, type: 'sawtooth' as OscillatorType, gain: 0.16 },
    { freq: 783.99, type: 'sawtooth' as OscillatorType, gain: 0.18 },
    { freq: 1046.50, type: 'square' as OscillatorType, gain: 0.14 },
    { freq: 2093.00, type: 'sine' as OscillatorType, gain: 0.09 },
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
 * Public methods to play sound effects directly
 */
export function playMarioCoinSound(ctx?: AudioContext) {
  const targetCtx = ctx || getSharedAudioContext();
  if (targetCtx && targetCtx.state === 'running') {
    renderMarioCoinToContext(targetCtx);
  } else if (marioWavBlobUrl) {
    const audio = new Audio(marioWavBlobUrl);
    audio.play().catch(() => {});
  }
}

export function playFanfareSound(ctx?: AudioContext) {
  const targetCtx = ctx || getSharedAudioContext();
  if (targetCtx && targetCtx.state === 'running') {
    renderFanfareToContext(targetCtx);
  } else if (fanfareWavBlobUrl) {
    const audio = new Audio(fanfareWavBlobUrl);
    audio.play().catch(() => {});
  }
}

/**
 * Plays sound across all connected devices whenever any sale is made!
 * - Mario getting coin from box sound for standard transactions
 * - Triumphant Fanfare sound for transactions over £100
 *
 * Uses dual-engine playback (Web Audio + HTML5 Audio fallback) so sound is
 * 100% reliably heard across all phones, tablets, and computers.
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

  // Prevent rapid double-firing within 300ms
  const nowMs = Date.now();
  if (nowMs - lastPlaybackTimestamp < 300) {
    return;
  }
  lastPlaybackTimestamp = nowMs;

  const isOver100 = amount !== undefined && amount > 100;

  // Try HTML5 Audio fallback first if Web Audio is suspended
  const ctx = getSharedAudioContext();

  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  if (ctx && ctx.state === 'running') {
    if (isOver100) {
      renderFanfareToContext(ctx);
    } else {
      renderMarioCoinToContext(ctx);
    }
  } else {
    // If Web Audio is not running, play pre-rendered audio element
    const targetUrl = isOver100 ? fanfareWavBlobUrl : marioWavBlobUrl;
    if (targetUrl) {
      try {
        const audio = new Audio(targetUrl);
        audio.play().catch(() => {
          // If browser blocked it, attempt to resume ctx
          if (ctx) ctx.resume().catch(() => {});
        });
      } catch {
        // Fallback error
      }
    }
  }
}

/**
 * Preview test sounds
 */
export function testMarioSound() {
  unlockAudioContext();
  playCheckoutSound(true, undefined, 50);
}

export function testFanfareSound() {
  unlockAudioContext();
  playCheckoutSound(true, undefined, 150);
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
      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, ctx.currentTime); // B5
      osc.frequency.setValueAtTime(1318.51, ctx.currentTime + 0.08); // E6
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.28);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch {
    // Audio context not allowed or blocked
  }
}
