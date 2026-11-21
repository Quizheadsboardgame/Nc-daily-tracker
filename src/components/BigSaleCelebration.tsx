import React, { useEffect, useRef } from 'react';
import {
  Banknote,
  CreditCard,
  Globe,
  ArrowLeftRight,
  Trophy,
  PartyPopper,
  Sparkles,
  Crown,
  Flame,
  X,
} from 'lucide-react';
import { SaleFlashEvent, getCelebrationTier } from '../utils/sound';

interface BigSaleCelebrationProps {
  event: SaleFlashEvent;
  durationMs: number;
  isFadingOut: boolean;
  progressWidth: '100%' | '0%';
  onDismiss: () => void;
}

interface FireworkRocket {
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetY: number;
  color: string;
  trail: { x: number; y: number }[];
}

interface FireworkSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  decay: number;
  size: number;
  gravity: number;
  drag: number;
  twinkle: boolean;
  trail: { x: number; y: number }[];
}

interface ConfettiPiece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  tiltAngle: number;
  tiltSpeed: number;
  swayPhase: number;
  swaySpeed: number;
  shape: 'rect' | 'ribbon' | 'star' | 'circle';
  alpha: number;
}

const CELEBRATION_PALETTE = [
  '#fbbf24', // Vibrant Gold
  '#fde047', // Bright Yellow
  '#34d399', // Emerald
  '#22d3ee', // Electric Cyan
  '#f472b6', // Hot Pink
  '#a855f7', // Vivid Violet
  '#fb7185', // Coral Rose
  '#38bdf8', // Sky Blue
  '#ffffff', // Starlight White
];

const LEGENDARY_PALETTE = [
  '#fde047',
  '#fbbf24',
  '#f59e0b',
  '#ffffff',
  '#e879f9',
  '#38bdf8',
  '#34d399',
];

const FIREWORK_PALETTES = [
  ['#fde047', '#fbbf24', '#f59e0b', '#ffffff'],
  ['#34d399', '#22d3ee', '#a7f3d0', '#ffffff'],
  ['#f472b6', '#fb7185', '#fde047', '#ffffff'],
  ['#a855f7', '#c084fc', '#38bdf8', '#ffffff'],
  ['#fb923c', '#facc15', '#f43f5e', '#ffffff'],
];

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, outerR: number, innerR: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

export const BigSaleCelebration: React.FC<BigSaleCelebrationProps> = ({
  event,
  durationMs,
  isFadingOut,
  progressWidth,
  onDismiss,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tier = event.celebrationTier || getCelebrationTier(event.amount);
  const isLegendary = tier === 'legendary';
  const isMega = tier === 'mega';

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let width = window.innerWidth;
    let height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const rockets: FireworkRocket[] = [];
    const sparks: FireworkSpark[] = [];
    const confetti: ConfettiPiece[] = [];
    const scheduledTimers: ReturnType<typeof setTimeout>[] = [];

    const intensityScale = isLegendary ? 1.4 : isMega ? 1.2 : 1.0;
    const activeConfettiColors = isLegendary ? LEGENDARY_PALETTE : CELEBRATION_PALETTE;

    const createFireworkBurst = (bx: number, by: number, scale: number = 1) => {
      const palette = FIREWORK_PALETTES[Math.floor(Math.random() * FIREWORK_PALETTES.length)];
      const count = Math.floor((68 + Math.random() * 28) * scale * intensityScale);

      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.14;
        const speed = (2.8 + Math.random() * 7.2) * scale;
        const color = palette[Math.floor(Math.random() * palette.length)];
        sparks.push({
          x: bx,
          y: by,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color,
          alpha: 1,
          decay: 0.01 + Math.random() * 0.011,
          size: 2.3 + Math.random() * 2.8,
          gravity: 0.085,
          drag: 0.968,
          twinkle: Math.random() > 0.3,
          trail: [],
        });
      }

      // Inner bright glitter ring (double ring for Mega & Legendary)
      const innerCount = Math.floor((isLegendary ? 36 : 24) * scale);
      for (let i = 0; i < innerCount; i++) {
        const angle = (Math.PI * 2 * i) / innerCount;
        const speed = (1.6 + Math.random() * 2.2) * scale;
        sparks.push({
          x: bx,
          y: by,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: isLegendary ? '#fde047' : '#ffffff',
          alpha: 1,
          decay: 0.016 + Math.random() * 0.012,
          size: 1.9 + Math.random() * 1.8,
          gravity: 0.05,
          drag: 0.955,
          twinkle: true,
          trail: [],
        });
      }
    };

    const launchRocket = (startXRatio?: number, targetYRatio?: number) => {
      const x = (startXRatio ?? (0.12 + Math.random() * 0.76)) * width;
      const targetY = (targetYRatio ?? (0.1 + Math.random() * 0.34)) * height;
      const palette = FIREWORK_PALETTES[Math.floor(Math.random() * FIREWORK_PALETTES.length)];
      const travelDist = Math.max(160, height - targetY);
      const speedY = -(10.8 + (travelDist / height) * 5.8 + Math.random() * 2.2);

      rockets.push({
        x,
        y: height + 10,
        vx: (Math.random() - 0.5) * 2.4,
        vy: speedY,
        targetY,
        color: palette[0],
        trail: [],
      });
    };

    const fireConfettiCannon = (side: 'left' | 'right' | 'center', count: number) => {
      const originX = side === 'left' ? -10 : side === 'right' ? width + 10 : width * 0.5;
      const originY = side === 'center' ? height * 0.24 : height * 0.88;

      for (let i = 0; i < count; i++) {
        let angle: number;
        let speed: number;
        if (side === 'left') {
          angle = -Math.PI * (0.18 + Math.random() * 0.28);
          speed = 11.5 + Math.random() * 13.5;
        } else if (side === 'right') {
          angle = -Math.PI * (0.54 + Math.random() * 0.28);
          speed = 11.5 + Math.random() * 13.5;
        } else {
          angle = Math.random() * Math.PI * 2;
          speed = 4.5 + Math.random() * 11;
        }

        const shapeRoll = Math.random();
        const starThreshold = isLegendary ? 0.65 : isMega ? 0.8 : 0.9;
        const shape: ConfettiPiece['shape'] =
          shapeRoll < 0.45 ? 'rect' : shapeRoll < starThreshold ? 'ribbon' : shapeRoll < 0.96 ? 'star' : 'circle';

        confetti.push({
          x: originX,
          y: originY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - (side === 'center' ? 3.8 : 1.6),
          width: shape === 'ribbon' ? 5 + Math.random() * 4 : 8 + Math.random() * 7,
          height: shape === 'ribbon' ? 14 + Math.random() * 10 : 5 + Math.random() * 5,
          color: activeConfettiColors[Math.floor(Math.random() * activeConfettiColors.length)],
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.24,
          tiltAngle: Math.random() * Math.PI * 2,
          tiltSpeed: 0.08 + Math.random() * 0.14,
          swayPhase: Math.random() * Math.PI * 2,
          swaySpeed: 0.04 + Math.random() * 0.05,
          shape,
          alpha: 1,
        });
      }
    };

    const spawnTopConfettiRain = (count: number) => {
      for (let i = 0; i < count; i++) {
        const shapeRoll = Math.random();
        const shape: ConfettiPiece['shape'] =
          shapeRoll < 0.5 ? 'rect' : shapeRoll < 0.78 ? 'ribbon' : shapeRoll < 0.94 ? 'star' : 'circle';

        confetti.push({
          x: Math.random() * width,
          y: -20 - Math.random() * height * 0.35,
          vx: (Math.random() - 0.5) * 2.5,
          vy: 2.3 + Math.random() * 4.0,
          width: shape === 'ribbon' ? 5 + Math.random() * 3 : 7 + Math.random() * 6,
          height: shape === 'ribbon' ? 13 + Math.random() * 9 : 5 + Math.random() * 5,
          color: activeConfettiColors[Math.floor(Math.random() * activeConfettiColors.length)],
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.18,
          tiltAngle: Math.random() * Math.PI * 2,
          tiltSpeed: 0.06 + Math.random() * 0.12,
          swayPhase: Math.random() * Math.PI * 2,
          swaySpeed: 0.03 + Math.random() * 0.04,
          shape,
          alpha: 1,
        });
      }
    };

    // Wave 1 (Immediate at t=0)
    const initialCannon = isLegendary ? 130 : isMega ? 110 : 90;
    fireConfettiCannon('left', initialCannon);
    fireConfettiCannon('right', initialCannon);
    if (isMega || isLegendary) {
      fireConfettiCannon('center', isLegendary ? 95 : 65);
    }
    spawnTopConfettiRain(isLegendary ? 120 : isMega ? 100 : 85);
    createFireworkBurst(width * 0.24, height * 0.24, 1.15);
    createFireworkBurst(width * 0.76, height * 0.22, 1.15);
    launchRocket(0.5, 0.18);

    // Choreographed multi-wave fireworks & confetti escalating by tier
    const waveSchedule: { delay: number; action: () => void }[] = [
      { delay: 240, action: () => createFireworkBurst(width * 0.5, height * 0.17, 1.25) },
      { delay: 420, action: () => { launchRocket(0.18, 0.22); launchRocket(0.82, 0.20); } },
      { delay: 820, action: () => { fireConfettiCannon('left', 55); fireConfettiCannon('right', 55); } },
      { delay: 980, action: () => { launchRocket(0.35, 0.16); launchRocket(0.66, 0.24); } },
      { delay: 1450, action: () => { createFireworkBurst(width * 0.2, height * 0.28, 1.1); createFireworkBurst(width * 0.8, height * 0.26, 1.1); } },
      { delay: 1900, action: () => { launchRocket(0.48, 0.15); spawnTopConfettiRain(65); } },
      { delay: 2450, action: () => { launchRocket(0.26, 0.20); launchRocket(0.74, 0.18); } },
      { delay: 3000, action: () => { fireConfettiCannon('left', 50); fireConfettiCannon('right', 50); createFireworkBurst(width * 0.5, height * 0.21, 1.3); } },
      { delay: 3600, action: () => { launchRocket(0.32, 0.22); launchRocket(0.68, 0.20); } },
      { delay: 4200, action: () => { createFireworkBurst(width * 0.25, height * 0.22, 1.15); createFireworkBurst(width * 0.75, height * 0.22, 1.15); } },
    ];

    if (isMega || isLegendary) {
      waveSchedule.push(
        { delay: 4750, action: () => { fireConfettiCannon('center', 75); launchRocket(0.16, 0.18); launchRocket(0.5, 0.15); launchRocket(0.84, 0.18); } },
        { delay: 5400, action: () => { createFireworkBurst(width * 0.3, height * 0.24, 1.25); createFireworkBurst(width * 0.7, height * 0.24, 1.25); } }
      );
    }

    if (isLegendary) {
      waveSchedule.push(
        { delay: 5950, action: () => { fireConfettiCannon('left', 70); fireConfettiCannon('right', 70); launchRocket(0.22, 0.16); launchRocket(0.5, 0.14); launchRocket(0.78, 0.16); } },
        { delay: 6600, action: () => { createFireworkBurst(width * 0.2, height * 0.2, 1.35); createFireworkBurst(width * 0.5, height * 0.17, 1.45); createFireworkBurst(width * 0.8, height * 0.2, 1.35); } }
      );
    }

    waveSchedule.forEach(({ delay, action }) => {
      if (delay < durationMs - 850) {
        scheduledTimers.push(setTimeout(action, delay));
      }
    });

    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const globalFade = elapsed > durationMs - 900 ? Math.max(0, (durationMs - elapsed) / 900) : 1;

      ctx.clearRect(0, 0, width, height);

      // 1. Update & draw ascending firework rockets
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.trail.push({ x: r.x, y: r.y });
        if (r.trail.length > 9) r.trail.shift();

        r.x += r.vx;
        r.y += r.vy;
        r.vy += 0.16;

        if (r.trail.length > 1) {
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(r.trail[0].x, r.trail[0].y);
          for (let j = 1; j < r.trail.length; j++) {
            ctx.lineTo(r.trail[j].x, r.trail[j].y);
          }
          ctx.strokeStyle = r.color;
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.globalAlpha = 0.85 * globalFade;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(r.x, r.y, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.restore();
        }

        if (r.y <= r.targetY || r.vy >= -1.2) {
          createFireworkBurst(r.x, r.y, 1.05 + Math.random() * 0.3);
          rockets.splice(i, 1);
        }
      }

      // 2. Update & draw firework burst sparks
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.trail.push({ x: s.x, y: s.y });
        if (s.trail.length > 5) s.trail.shift();

        s.vx *= s.drag;
        s.vy *= s.drag;
        s.vy += s.gravity;
        s.x += s.vx;
        s.y += s.vy;
        s.alpha -= s.decay;

        if (s.alpha <= 0.02) {
          sparks.splice(i, 1);
          continue;
        }

        const flicker = s.twinkle ? (Math.sin(now * 0.03 + i) > -0.35 ? 1 : 0.35) : 1;
        const drawAlpha = Math.max(0, Math.min(1, s.alpha * flicker * globalFade));

        ctx.save();
        if (s.trail.length > 1) {
          ctx.beginPath();
          ctx.moveTo(s.trail[0].x, s.trail[0].y);
          for (let j = 1; j < s.trail.length; j++) {
            ctx.lineTo(s.trail[j].x, s.trail[j].y);
          }
          ctx.strokeStyle = s.color;
          ctx.lineWidth = Math.max(1, s.size * 0.7);
          ctx.lineCap = 'round';
          ctx.globalAlpha = drawAlpha * 0.65;
          ctx.stroke();
        }

        ctx.globalAlpha = drawAlpha;
        ctx.fillStyle = s.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 3. Update & draw fluttering 3D-tumbling confetti
      for (let i = confetti.length - 1; i >= 0; i--) {
        const c = confetti[i];
        c.vx *= 0.985;
        c.vy = Math.min(c.vy + 0.19, 6.2);
        c.swayPhase += c.swaySpeed;
        c.x += c.vx + Math.sin(c.swayPhase) * 1.15;
        c.y += c.vy;
        c.rotation += c.rotationSpeed;
        c.tiltAngle += c.tiltSpeed;

        if (c.y > height + 40) {
          confetti.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rotation);
        const tiltScale = Math.cos(c.tiltAngle);
        ctx.scale(1, Math.abs(tiltScale) < 0.18 ? 0.18 : tiltScale);
        ctx.globalAlpha = c.alpha * globalFade;
        ctx.fillStyle = c.color;

        if (c.shape === 'star') {
          drawStar(ctx, 0, 0, c.width * 0.68, c.width * 0.28);
        } else if (c.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, c.width * 0.45, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-c.width / 2, -c.height / 2, c.width, c.height);
        }
        ctx.restore();
      }

      if (elapsed < durationMs + 300 || sparks.length > 0 || rockets.length > 0 || confetti.length > 0) {
        animId = requestAnimationFrame(tick);
      }
    };

    animId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animId);
      scheduledTimers.forEach((t) => clearTimeout(t));
      window.removeEventListener('resize', resize);
    };
  }, [event.id, event.timestamp, durationMs, isLegendary, isMega]);

  const getPaymentDisplay = (method: SaleFlashEvent['paymentMethod']) => {
    switch (method) {
      case 'cash':
        return { label: 'Cash', badgeClass: 'bg-emerald-500/25 text-emerald-200 border-emerald-400/70', Icon: Banknote };
      case 'online':
        return { label: 'Online', badgeClass: 'bg-sky-500/25 text-sky-200 border-sky-400/70', Icon: Globe };
      case 'traded_out':
        return { label: 'Trade Out', badgeClass: 'bg-amber-500/25 text-amber-200 border-amber-400/70', Icon: ArrowLeftRight };
      case 'card':
      default:
        return { label: 'Card', badgeClass: 'bg-indigo-500/25 text-indigo-200 border-indigo-400/70', Icon: CreditCard };
    }
  };

  const payment = getPaymentDisplay(event.paymentMethod);
  const PaymentIcon = payment.Icon;
  const isSplit = Boolean(event.isSplit && event.splitSummary);
  const itemCount = event.basketItemCount && event.basketItemCount > 1 ? event.basketItemCount : 0;

  // Escalating tier visual theme
  const tierConfig = isLegendary
    ? {
        headline: 'LEGENDARY SALE! £500+ JACKPOT!',
        subline: 'NEWTONS COLLECTABLES • Grand Jackpot Celebration',
        cardBorder: 'border-yellow-300 ring-4 ring-fuchsia-400/45 shadow-[0_24px_95px_-10px_rgba(232,121,249,0.65)]',
        glowBg: 'bg-[radial-gradient(circle_at_top,rgba(232,121,249,0.28),rgba(251,191,36,0.16)_40%,transparent_72%)]',
        iconBg: 'bg-gradient-to-br from-yellow-200 via-amber-400 to-fuchsia-500 text-zinc-950 shadow-fuchsia-500/50',
        heroBox: 'from-fuchsia-500/25 via-amber-400/20 to-zinc-900/95 border-yellow-300/70',
        amountGrad: 'from-white via-yellow-200 to-fuchsia-300',
        barGrad: 'from-fuchsia-400 via-yellow-300 to-cyan-300',
        Icon: Crown,
      }
    : isMega
    ? {
        headline: 'MEGA SALE! OVER £250!',
        subline: 'NEWTONS COLLECTABLES • Mega Counter Celebration',
        cardBorder: 'border-amber-300 ring-4 ring-cyan-400/35 shadow-[0_24px_85px_-12px_rgba(34,211,238,0.55)]',
        glowBg: 'bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.22),rgba(251,191,36,0.18)_40%,transparent_70%)]',
        iconBg: 'bg-gradient-to-br from-cyan-300 via-amber-300 to-orange-500 text-zinc-950 shadow-cyan-500/40',
        heroBox: 'from-cyan-400/20 via-amber-400/15 to-zinc-900/95 border-amber-300/60',
        amountGrad: 'from-cyan-200 via-yellow-200 to-amber-400',
        barGrad: 'from-cyan-300 via-amber-300 to-emerald-400',
        Icon: Flame,
      }
    : {
        headline: 'Massive Sale Over £100!',
        subline: 'NEWTONS COLLECTABLES • Counter Celebration',
        cardBorder: 'border-amber-400 ring-4 ring-amber-400/35 shadow-[0_24px_80px_-12px_rgba(251,191,36,0.55)]',
        glowBg: 'bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.22),transparent_62%)]',
        iconBg: 'bg-gradient-to-br from-amber-300 via-yellow-400 to-orange-500 text-zinc-950 shadow-amber-500/40',
        heroBox: 'from-amber-400/20 via-amber-500/10 to-zinc-900/90 border-amber-400/50',
        amountGrad: 'from-amber-200 via-yellow-300 to-amber-400',
        barGrad: 'from-amber-300 via-yellow-400 to-emerald-400',
        Icon: Trophy,
      };

  const TierIcon = tierConfig.Icon;

  return (
    <>
      {/* Full-Screen Fireworks & Confetti Canvas Overlay */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="fixed inset-0 z-[110] pointer-events-none"
      />

      {/* Ambient Celebratory Vignette */}
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-[105] pointer-events-none ${tierConfig.glowBg} transition-opacity duration-300 ${
          isFadingOut ? 'opacity-0' : 'opacity-100'
        }`}
      />

      {/* Grand Fanfare Celebration Banner */}
      <div
        id="big-sale-celebration-banner"
        role="status"
        aria-live="assertive"
        className={`fixed top-5 sm:top-8 left-1/2 -translate-x-1/2 z-[120] w-[calc(100%-1.5rem)] max-w-xl pointer-events-none transition-all duration-300 ${
          isFadingOut ? 'opacity-0 -translate-y-4 scale-95' : 'opacity-100 translate-y-0 scale-100'
        }`}
      >
        <div
          onClick={onDismiss}
          className={`fanfare-pop pointer-events-auto relative overflow-hidden rounded-3xl bg-zinc-950/95 backdrop-blur-xl text-white border-2 cursor-pointer ${tierConfig.cardBorder}`}
          title="Click to dismiss celebration"
        >
          {/* Animated Shimmer Sweep */}
          <div
            aria-hidden="true"
            className="fanfare-shimmer pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-amber-200/25 to-transparent -skew-x-12"
          />

          <div className="relative px-5 py-5 sm:px-7 sm:py-6 space-y-4">
            {/* Top Celebration Header */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg shrink-0 ${tierConfig.iconBg}`}>
                  <TierIcon className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-amber-200 text-xs sm:text-sm font-black tracking-wide">
                    <PartyPopper className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="truncate">{tierConfig.headline}</span>
                    <Sparkles className="w-4 h-4 text-yellow-300 shrink-0" />
                  </div>
                  <p className="text-[11px] text-amber-100/80 font-semibold truncate">
                    {itemCount > 0 ? `Big Basket Checkout (${itemCount} items) • ` : ''}
                    {tierConfig.subline}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss();
                }}
                className="p-2 rounded-xl text-amber-200/80 hover:text-white hover:bg-white/10 transition cursor-pointer shrink-0"
                aria-label="Dismiss big sale celebration"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Hero Amount Callout + New Top Sale of the Day Ribbon */}
            <div className={`text-center py-3 px-4 rounded-2xl bg-gradient-to-b border ${tierConfig.heroBox}`}>
              {event.isTopSaleOfDay && (
                <div className="inline-flex items-center gap-1.5 mb-1.5 text-[11px] font-black tracking-wide text-yellow-200">
                  <Crown className="w-3.5 h-3.5 text-yellow-300 shrink-0" />
                  <span>New Top Sale of the Day!</span>
                </div>
              )}
              <div className={`text-4xl sm:text-5xl font-black tracking-tight tabular-nums text-transparent bg-clip-text bg-gradient-to-r drop-shadow-sm ${tierConfig.amountGrad}`}>
                {event.amount !== undefined ? `£${event.amount.toFixed(2)}` : '£100+'}
              </div>
              {event.itemDescription && (
                <p className="mt-1 text-xs sm:text-sm font-bold text-zinc-200 truncate">
                  {event.itemDescription}
                </p>
              )}
            </div>

            {/* Vendor & Payment Method Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="rounded-2xl bg-zinc-900/95 border border-zinc-800 px-4 py-2.5 flex flex-col justify-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Sale For
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0 ring-2 ring-white/25"
                    style={{ backgroundColor: event.vendorColor }}
                  />
                  <span className="text-lg font-black text-white tracking-tight truncate">
                    {event.vendorName}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl bg-zinc-900/95 border border-zinc-800 px-4 py-2.5 flex flex-col justify-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Paid By
                </span>
                <div className="mt-1">
                  {isSplit ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs sm:text-sm font-black bg-cyan-500/20 text-cyan-200 border-cyan-400/60 leading-snug">
                      <ArrowLeftRight className="w-4 h-4 shrink-0 text-cyan-300" />
                      <span>{event.splitSummary}</span>
                    </span>
                  ) : (
                    <span
                      className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg border text-base font-black ${payment.badgeClass}`}
                    >
                      <PaymentIcon className="w-4 h-4 shrink-0" />
                      <span>{payment.label}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Countdown Progress Bar */}
          <div className="h-2 w-full bg-zinc-900">
            <div
              key={event.id + event.timestamp}
              style={{ transitionDuration: `${durationMs}ms` }}
              className={`h-full transition-all ease-linear bg-gradient-to-r ${tierConfig.barGrad} ${
                progressWidth === '0%' ? 'w-0' : 'w-full'
              }`}
            />
          </div>
        </div>
      </div>
    </>
  );
};
