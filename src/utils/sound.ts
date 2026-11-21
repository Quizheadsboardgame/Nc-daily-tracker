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
let megaFanfareWavBlobUrl: string | null = null;
let legendaryFanfareWavBlobUrl: string | null = null;

export type CelebrationTier = 'standard' | 'big' | 'mega' | 'legendary';

export function getCelebrationTier(amount?: number): CelebrationTier {
  if (amount === undefined || isNaN(amount) || amount <= 100) return 'standard';
  if (amount >= 500) return 'legendary';
  if (amount >= 250) return 'mega';
  return 'big';
}

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
    // 2. Render Tier 1 Big Fanfare + Fireworks Audio (3.6s duration)
    const fanfareOffline = new OfflineCtx(1, Math.floor(44100 * 3.6), 44100);
    renderFanfareToContext(fanfareOffline);
    const fanfareBuffer = await fanfareOffline.startRendering();
    const fanfareBlob = audioBufferToWavBlob(fanfareBuffer);
    fanfareWavBlobUrl = URL.createObjectURL(fanfareBlob);
  } catch (e) {
    console.warn('Could not pre-render Fanfare sound blob:', e);
  }

  try {
    // 3. Render Tier 2 Mega Fanfare Audio (£250+, 4.6s duration)
    const megaOffline = new OfflineCtx(1, Math.floor(44100 * 4.6), 44100);
    renderMegaFanfareToContext(megaOffline);
    const megaBuffer = await megaOffline.startRendering();
    megaFanfareWavBlobUrl = URL.createObjectURL(audioBufferToWavBlob(megaBuffer));
  } catch (e) {
    console.warn('Could not pre-render Mega Fanfare sound blob:', e);
  }

  try {
    // 4. Render Tier 3 Legendary Fanfare Audio (£500+, 5.6s duration)
    const legOffline = new OfflineCtx(1, Math.floor(44100 * 5.6), 44100);
    renderLegendaryFanfareToContext(legOffline);
    const legBuffer = await legOffline.startRendering();
    legendaryFanfareWavBlobUrl = URL.createObjectURL(audioBufferToWavBlob(legBuffer));
  } catch (e) {
    console.warn('Could not pre-render Legendary Fanfare sound blob:', e);
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
 * Render Massive Celebratory Fanfare + Fireworks sound graph into an audio context (realtime or offline)
 */
function renderFanfareToContext(ctx: BaseAudioContext) {
  const now = ctx.currentTime;

  // Helper: Synthesized firework burst crackle & pop
  const scheduleFireworkPop = (startOffset: number, intensity: number) => {
    const duration = 0.32;
    const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const noiseBuffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const channel = noiseBuffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      const env = Math.pow(1 - i / sampleCount, 2.2);
      const crackle = Math.random() > 0.88 ? 1.5 : 0.6;
      channel[i] = (Math.random() * 2 - 1) * env * crackle;
    }

    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuffer;

    const bandFilter = ctx.createBiquadFilter();
    bandFilter.type = 'bandpass';
    bandFilter.frequency.setValueAtTime(1400 + Math.random() * 900, now + startOffset);
    bandFilter.Q.setValueAtTime(0.8, now + startOffset);

    const popGain = ctx.createGain();
    popGain.gain.setValueAtTime(0.0001, now + startOffset);
    popGain.gain.linearRampToValueAtTime(0.24 * intensity, now + startOffset + 0.012);
    popGain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + duration);

    noiseSrc.connect(bandFilter);
    bandFilter.connect(popGain);
    popGain.connect(ctx.destination);

    noiseSrc.start(now + startOffset);
    noiseSrc.stop(now + startOffset + duration);

    // Sub-thump boom for big firework shell
    const boomOsc = ctx.createOscillator();
    const boomGain = ctx.createGain();
    boomOsc.type = 'sine';
    boomOsc.frequency.setValueAtTime(135, now + startOffset);
    boomOsc.frequency.exponentialRampToValueAtTime(38, now + startOffset + 0.16);
    boomGain.gain.setValueAtTime(0.22 * intensity, now + startOffset);
    boomGain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + 0.18);
    boomOsc.connect(boomGain);
    boomGain.connect(ctx.destination);
    boomOsc.start(now + startOffset);
    boomOsc.stop(now + startOffset + 0.19);
  };

  // Helper: Timpani victory drum hit
  const scheduleTimpani = (startOffset: number, freq: number, volume: number) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq * 1.15, now + startOffset);
    osc.frequency.exponentialRampToValueAtTime(freq, now + startOffset + 0.08);
    g.gain.setValueAtTime(0.0001, now + startOffset);
    g.gain.linearRampToValueAtTime(volume, now + startOffset + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + 0.28);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now + startOffset);
    osc.stop(now + startOffset + 0.3);
  };

  // 1. Opening celebratory brass fanfare melody with warm fifth/third harmonies
  const fanfareSteps = [
    { start: 0.00, dur: 0.12, lead: 392.00, harmony: 293.66, gain: 0.18 }, // G4 + D4
    { start: 0.13, dur: 0.12, lead: 523.25, harmony: 392.00, gain: 0.20 }, // C5 + G4
    { start: 0.26, dur: 0.12, lead: 659.25, harmony: 523.25, gain: 0.21 }, // E5 + C5
    { start: 0.39, dur: 0.18, lead: 783.99, harmony: 587.33, gain: 0.22 }, // G5 + D5
    { start: 0.58, dur: 0.11, lead: 659.25, harmony: 523.25, gain: 0.19 }, // E5 + C5
    { start: 0.70, dur: 0.13, lead: 783.99, harmony: 659.25, gain: 0.22 }, // G5 + E5
    { start: 0.85, dur: 0.12, lead: 880.00, harmony: 659.25, gain: 0.22 }, // A5 + E5
    { start: 0.98, dur: 0.14, lead: 987.77, harmony: 783.99, gain: 0.24 }, // B5 + G5
  ];

  fanfareSteps.forEach(({ start, dur, lead, harmony, gain }) => {
    [
      { freq: lead, type: 'sawtooth' as OscillatorType, amp: gain },
      { freq: harmony, type: 'triangle' as OscillatorType, amp: gain * 0.75 },
    ].forEach(({ freq, type, amp }) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2800, now + start);
      filter.frequency.exponentialRampToValueAtTime(1400, now + start + dur);

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now + start);

      gainNode.gain.setValueAtTime(0.0001, now + start);
      gainNode.gain.linearRampToValueAtTime(amp, now + start + 0.015);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);

      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(now + start);
      osc.stop(now + start + dur + 0.01);
    });
  });

  // 2. Timpani accents on major downbeats
  scheduleTimpani(0.00, 130.81, 0.22); // C3
  scheduleTimpani(0.39, 196.00, 0.24); // G3
  scheduleTimpani(1.14, 130.81, 0.28); // Grand Finale C3

  // 3. Grand Finale Victory Chord at 1.14s (C Major 9 with shimmering bells)
  const chordStart = 1.14;
  const chordDur = 1.85;

  const chordFrequencies = [
    { freq: 261.63, type: 'triangle' as OscillatorType, gain: 0.18 }, // C4 bass warmth
    { freq: 523.25, type: 'sawtooth' as OscillatorType, gain: 0.15 }, // C5
    { freq: 659.25, type: 'sawtooth' as OscillatorType, gain: 0.14 }, // E5
    { freq: 783.99, type: 'sawtooth' as OscillatorType, gain: 0.15 }, // G5
    { freq: 1046.50, type: 'square' as OscillatorType, gain: 0.11 },  // C6
    { freq: 1174.66, type: 'sine' as OscillatorType, gain: 0.07 },    // D6 sparkle
    { freq: 1567.98, type: 'sine' as OscillatorType, gain: 0.08 },    // G6
    { freq: 2093.00, type: 'sine' as OscillatorType, gain: 0.07 },    // C7 shimmer
  ];

  chordFrequencies.forEach(({ freq, type, gain }) => {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3600, now + chordStart);
    filter.frequency.exponentialRampToValueAtTime(1200, now + chordStart + chordDur);

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now + chordStart);

    gainNode.gain.setValueAtTime(0.0001, now + chordStart);
    gainNode.gain.linearRampToValueAtTime(gain, now + chordStart + 0.03);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + chordStart + chordDur);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(now + chordStart);
    osc.stop(now + chordStart + chordDur + 0.02);
  });

  // 4. Sparkling ascending celebration bell glissando
  const glissNotes = [1046.5, 1318.51, 1567.98, 1975.53, 2093.0, 2637.02, 3135.96];
  glissNotes.forEach((freq, idx) => {
    const t = 1.22 + idx * 0.07;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + t);
    g.gain.setValueAtTime(0.0001, now + t);
    g.gain.linearRampToValueAtTime(0.09, now + t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.55);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now + t);
    osc.stop(now + t + 0.56);
  });

  // 5. Synchronized Firework Bursts & Crackles
  scheduleFireworkPop(0.06, 0.9);
  scheduleFireworkPop(0.45, 0.8);
  scheduleFireworkPop(1.16, 1.0);
  scheduleFireworkPop(1.65, 0.85);
  scheduleFireworkPop(2.25, 0.9);
  scheduleFireworkPop(2.85, 0.75);
}

/**
 * Helper: Reusable firework burst + timpani schedulers for Mega & Legendary Fanfares
 */
function scheduleExtraFireworkPop(ctx: BaseAudioContext, startOffset: number, intensity: number) {
  const now = ctx.currentTime;
  const duration = 0.36;
  const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const noiseBuffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
  const channel = noiseBuffer.getChannelData(0);
  for (let i = 0; i < sampleCount; i++) {
    const env = Math.pow(1 - i / sampleCount, 2.0);
    const crackle = Math.random() > 0.85 ? 1.6 : 0.55;
    channel[i] = (Math.random() * 2 - 1) * env * crackle;
  }

  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = noiseBuffer;

  const bandFilter = ctx.createBiquadFilter();
  bandFilter.type = 'bandpass';
  bandFilter.frequency.setValueAtTime(1250 + Math.random() * 1100, now + startOffset);
  bandFilter.Q.setValueAtTime(0.75, now + startOffset);

  const popGain = ctx.createGain();
  popGain.gain.setValueAtTime(0.0001, now + startOffset);
  popGain.gain.linearRampToValueAtTime(0.26 * intensity, now + startOffset + 0.012);
  popGain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + duration);

  noiseSrc.connect(bandFilter);
  bandFilter.connect(popGain);
  popGain.connect(ctx.destination);
  noiseSrc.start(now + startOffset);
  noiseSrc.stop(now + startOffset + duration);

  const boomOsc = ctx.createOscillator();
  const boomGain = ctx.createGain();
  boomOsc.type = 'sine';
  boomOsc.frequency.setValueAtTime(145, now + startOffset);
  boomOsc.frequency.exponentialRampToValueAtTime(34, now + startOffset + 0.2);
  boomGain.gain.setValueAtTime(0.25 * intensity, now + startOffset);
  boomGain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + 0.22);
  boomOsc.connect(boomGain);
  boomGain.connect(ctx.destination);
  boomOsc.start(now + startOffset);
  boomOsc.stop(now + startOffset + 0.23);
}

/**
 * Tier 2 (£250+): Extended Mega Fanfare — modulates upward into triumphant D Major finale with richer harmony & fireworks
 */
function renderMegaFanfareToContext(ctx: BaseAudioContext) {
  // Start with core fanfare
  renderFanfareToContext(ctx);
  const now = ctx.currentTime;

  // Ascending key-change brass flourish at 1.95s -> D Major Finale!
  const stepUp = [
    { start: 1.95, dur: 0.13, lead: 587.33, harm: 440.00, gain: 0.22 }, // D5 + A4
    { start: 2.09, dur: 0.13, lead: 739.99, harm: 587.33, gain: 0.23 }, // F#5 + D5
    { start: 2.23, dur: 0.14, lead: 880.00, harm: 659.25, gain: 0.24 }, // A5 + E5
    { start: 2.38, dur: 0.16, lead: 1108.73, harm: 880.00, gain: 0.25 }, // C#6 + A5
  ];

  stepUp.forEach(({ start, dur, lead, harm, gain }) => {
    [
      { freq: lead, type: 'sawtooth' as OscillatorType, amp: gain },
      { freq: harm, type: 'triangle' as OscillatorType, amp: gain * 0.8 },
    ].forEach(({ freq, type, amp }) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3200, now + start);
      filter.frequency.exponentialRampToValueAtTime(1600, now + start + dur);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now + start);
      g.gain.setValueAtTime(0.0001, now + start);
      g.gain.linearRampToValueAtTime(amp, now + start + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      osc.connect(filter);
      filter.connect(g);
      g.connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.01);
    });
  });

  // Grand D-Major Victory Chord at 2.56s
  const megaChordStart = 2.56;
  const megaChordDur = 1.9;
  [
    { freq: 293.66, type: 'triangle' as OscillatorType, gain: 0.19 }, // D4
    { freq: 587.33, type: 'sawtooth' as OscillatorType, gain: 0.16 }, // D5
    { freq: 739.99, type: 'sawtooth' as OscillatorType, gain: 0.15 }, // F#5
    { freq: 880.00, type: 'sawtooth' as OscillatorType, gain: 0.16 }, // A5
    { freq: 1174.66, type: 'square' as OscillatorType, gain: 0.12 },  // D6
    { freq: 1760.00, type: 'sine' as OscillatorType, gain: 0.08 },    // A6
    { freq: 2349.32, type: 'sine' as OscillatorType, gain: 0.08 },    // D7
  ].forEach(({ freq, type, gain }) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3900, now + megaChordStart);
    filter.frequency.exponentialRampToValueAtTime(1300, now + megaChordStart + megaChordDur);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now + megaChordStart);
    g.gain.setValueAtTime(0.0001, now + megaChordStart);
    g.gain.linearRampToValueAtTime(gain, now + megaChordStart + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, now + megaChordStart + megaChordDur);
    osc.connect(filter);
    filter.connect(g);
    g.connect(ctx.destination);
    osc.start(now + megaChordStart);
    osc.stop(now + megaChordStart + megaChordDur + 0.02);
  });

  // Extra cascading sparkle bells & firework finale
  [1174.66, 1479.98, 1760.0, 2217.46, 2349.32, 2959.96, 3520.0].forEach((freq, idx) => {
    const t = 2.65 + idx * 0.065;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + t);
    g.gain.setValueAtTime(0.0001, now + t);
    g.gain.linearRampToValueAtTime(0.095, now + t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.6);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now + t);
    osc.stop(now + t + 0.62);
  });

  scheduleExtraFireworkPop(ctx, 2.58, 1.05);
  scheduleExtraFireworkPop(ctx, 3.15, 0.95);
  scheduleExtraFireworkPop(ctx, 3.72, 1.0);
  scheduleExtraFireworkPop(ctx, 4.15, 0.85);
}

/**
 * Tier 3 (£500+): Legendary Jackpot Fanfare — soaring double-modulation stadium finale + epic firework barrage
 */
function renderLegendaryFanfareToContext(ctx: BaseAudioContext) {
  renderMegaFanfareToContext(ctx);
  const now = ctx.currentTime;

  // Third heroic key lift at 3.45s -> E Major Royal Jackpot Finale!
  const royalStep = [
    { start: 3.45, dur: 0.13, lead: 659.25, harm: 493.88, gain: 0.23 }, // E5 + B4
    { start: 3.59, dur: 0.13, lead: 830.61, harm: 659.25, gain: 0.24 }, // G#5 + E5
    { start: 3.73, dur: 0.15, lead: 987.77, harm: 739.99, gain: 0.25 }, // B5 + F#5
    { start: 3.89, dur: 0.16, lead: 1244.51, harm: 987.77, gain: 0.25 }, // D#6 + B5
  ];

  royalStep.forEach(({ start, dur, lead, harm, gain }) => {
    [
      { freq: lead, type: 'sawtooth' as OscillatorType, amp: gain },
      { freq: harm, type: 'triangle' as OscillatorType, amp: gain * 0.8 },
    ].forEach(({ freq, type, amp }) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3600, now + start);
      filter.frequency.exponentialRampToValueAtTime(1800, now + start + dur);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now + start);
      g.gain.setValueAtTime(0.0001, now + start);
      g.gain.linearRampToValueAtTime(amp, now + start + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      osc.connect(filter);
      filter.connect(g);
      g.connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.01);
    });
  });

  // Epic E-Major Stadium Finale Chord at 4.08s
  const epicStart = 4.08;
  const epicDur = 1.45;
  [
    { freq: 329.63, type: 'triangle' as OscillatorType, gain: 0.20 }, // E4
    { freq: 659.25, type: 'sawtooth' as OscillatorType, gain: 0.16 }, // E5
    { freq: 830.61, type: 'sawtooth' as OscillatorType, gain: 0.15 }, // G#5
    { freq: 987.77, type: 'sawtooth' as OscillatorType, gain: 0.16 }, // B5
    { freq: 1318.51, type: 'square' as OscillatorType, gain: 0.12 },  // E6
    { freq: 1975.53, type: 'sine' as OscillatorType, gain: 0.09 },    // B6
    { freq: 2637.02, type: 'sine' as OscillatorType, gain: 0.09 },    // E7
  ].forEach(({ freq, type, gain }) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(4200, now + epicStart);
    filter.frequency.exponentialRampToValueAtTime(1400, now + epicStart + epicDur);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now + epicStart);
    g.gain.setValueAtTime(0.0001, now + epicStart);
    g.gain.linearRampToValueAtTime(gain, now + epicStart + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, now + epicStart + epicDur);
    osc.connect(filter);
    filter.connect(g);
    g.connect(ctx.destination);
    osc.start(now + epicStart);
    osc.stop(now + epicStart + epicDur + 0.02);
  });

  // Rapid finale firework barrage
  scheduleExtraFireworkPop(ctx, 4.10, 1.15);
  scheduleExtraFireworkPop(ctx, 4.42, 1.05);
  scheduleExtraFireworkPop(ctx, 4.78, 1.15);
  scheduleExtraFireworkPop(ctx, 5.12, 1.0);
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

export function playFanfareSound(ctx?: AudioContext, tier: CelebrationTier = 'big') {
  const targetCtx = ctx || getSharedAudioContext();
  if (targetCtx && targetCtx.state === 'running') {
    if (tier === 'legendary') renderLegendaryFanfareToContext(targetCtx);
    else if (tier === 'mega') renderMegaFanfareToContext(targetCtx);
    else renderFanfareToContext(targetCtx);
  } else {
    const blobUrl =
      tier === 'legendary'
        ? legendaryFanfareWavBlobUrl || megaFanfareWavBlobUrl || fanfareWavBlobUrl
        : tier === 'mega'
        ? megaFanfareWavBlobUrl || fanfareWavBlobUrl
        : fanfareWavBlobUrl;
    if (blobUrl) {
      const audio = new Audio(blobUrl);
      audio.play().catch(() => {});
    }
  }
}

/**
 * Plays sound across all connected devices whenever any sale is made!
 * - Mario getting coin from box sound for standard transactions (<= £100)
 * - Tier 1 Big Fanfare for > £100
 * - Tier 2 Mega Fanfare for >= £250
 * - Tier 3 Legendary Fanfare for >= £500
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

  const tier = getCelebrationTier(amount);

  const ctx = getSharedAudioContext();

  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  if (ctx && ctx.state === 'running') {
    if (tier === 'legendary') {
      renderLegendaryFanfareToContext(ctx);
    } else if (tier === 'mega') {
      renderMegaFanfareToContext(ctx);
    } else if (tier === 'big') {
      renderFanfareToContext(ctx);
    } else {
      renderMarioCoinToContext(ctx);
    }
  } else {
    // If Web Audio is not running, play pre-rendered audio element
    const targetUrl =
      tier === 'legendary'
        ? legendaryFanfareWavBlobUrl || fanfareWavBlobUrl
        : tier === 'mega'
        ? megaFanfareWavBlobUrl || fanfareWavBlobUrl
        : tier === 'big'
        ? fanfareWavBlobUrl
        : marioWavBlobUrl;
    if (targetUrl) {
      try {
        const audio = new Audio(targetUrl);
        audio.play().catch(() => {
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

let testFanfareCycleIdx = 0;

export function testFanfareSound() {
  unlockAudioContext();
  const demoTiers: { amount: number; label: string; isTop: boolean }[] = [
    { amount: 125, label: 'Charizard ex SIR (Demo £100+ Tier)', isTop: false },
    { amount: 275, label: 'PSA 10 Umbreon VMAX (Demo £250+ Mega Tier)', isTop: true },
    { amount: 550, label: '1st Edition Booster Box (Demo £500+ Legendary Tier)', isTop: true },
  ];
  const sample = demoTiers[testFanfareCycleIdx % demoTiers.length];
  testFanfareCycleIdx += 1;

  playCheckoutSound(true, undefined, sample.amount);
  emitSaleFlash({
    id: `demo_fanfare_${Date.now()}`,
    vendorName: 'Newtons',
    vendorColor: '#7c3aed',
    paymentMethod: 'card',
    itemDescription: sample.label,
    amount: sample.amount,
    isOver100: true,
    celebrationTier: getCelebrationTier(sample.amount),
    isTopSaleOfDay: sample.isTop,
  });
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

export interface SaleFlashEvent {
  id: string;
  vendorName: string;
  vendorColor: string;
  paymentMethod: 'cash' | 'card' | 'traded_out' | 'online';
  itemDescription?: string;
  amount?: number;
  isOver100?: boolean;
  celebrationTier?: CelebrationTier;
  isTopSaleOfDay?: boolean;
  isSplit?: boolean;
  splitSummary?: string;
  basketItemCount?: number;
  timestamp: number;
}

const saleFlashListeners = new Set<(event: SaleFlashEvent) => void>();
const recentlyFlashedSaleIds = new Map<string, number>();

export function isSaleRecentlyFlashed(saleId: string): boolean {
  if (!saleId) return false;
  const time = recentlyFlashedSaleIds.get(saleId);
  if (!time) return false;
  if (Date.now() - time < 45000) {
    return true;
  }
  recentlyFlashedSaleIds.delete(saleId);
  return false;
}

export function emitSaleFlash(event: Omit<SaleFlashEvent, 'timestamp'>): void {
  if (event.id) {
    if (isSaleRecentlyFlashed(event.id)) {
      return;
    }
    const now = Date.now();
    recentlyFlashedSaleIds.set(event.id, now);
    for (const [id, t] of recentlyFlashedSaleIds.entries()) {
      if (now - t > 60000) {
        recentlyFlashedSaleIds.delete(id);
      }
    }
  }

  const fullEvent: SaleFlashEvent = {
    ...event,
    timestamp: Date.now(),
  };

  saleFlashListeners.forEach((listener) => {
    try {
      listener(fullEvent);
    } catch {
      // Ignore listener error
    }
  });
}

export function subscribeToSaleFlash(listener: (event: SaleFlashEvent) => void): () => void {
  saleFlashListeners.add(listener);
  return () => {
    saleFlashListeners.delete(listener);
  };
}

