import React, { useEffect, useRef } from 'react';
import {
  Banknote,
  CreditCard,
  Globe,
  ArrowLeftRight,
  Trophy,
  PartyPopper,
  Sparkles,
  X,
} from 'lucide-react';
import { SaleFlashEvent } from '../utils/sound';

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

    const createFireworkBurst = (bx: number, by: number, scale: number = 1) => {
      const palette = FIREWORK_PALETTES[Math.floor(Math.random() * FIREWORK_PALETTES.length)];
      const count = Math.floor((68 + Math.random() * 28) * scale);

      // Core flash ring sparks
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.14;
        const speed = (2.8 + Math.random() * 6.8) * scale;
        const color = palette[Math.floor(Math.random() * palette.length)];
        sparks.push({
          x: bx,
          y: by,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color,
          alpha: 1,
          decay: 0.011 + Math.random() * 0.012,
          size: 2.2 + Math.random() * 2.6,
          gravity: 0.085,
          drag: 0.968,
          twinkle: Math.random() > 0.35,
          trail: [],
        });
      }

      // Inner bright glitter ring
      const innerCount = Math.floor(24 * scale);
      for (let i = 0; i < innerCount; i++) {
        const angle = (Math.PI * 2 * i) / innerCount;
        const speed = (1.6 + Math.random() * 1.9) * scale;
        sparks.push({
          x: bx,
          y: by,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: '#ffffff',
          alpha: 1,
          decay: 0.018 + Math.random() * 0.014,
          size: 1.8 + Math.random() * 1.6,
          gravity: 0.05,
          drag: 0.955,
          twinkle: true,
          trail: [],
        });
      }
    };

    const launchRocket = (startXRatio?: number, targetYRatio?: number) => {
      const x = (startXRatio ?? (0.14 + Math.random() * 0.72)) * width;
      const targetY = (targetYRatio ?? (0.12 + Math.random() * 0.34)) * height;
      const palette = FIREWORK_PALETTES[Math.floor(Math.random() * FIREWORK_PALETTES.length)];
      const travelDist = Math.max(160, height - targetY);
      const speedY = -(10.5 + (travelDist / height) * 5.5 + Math.random() * 2.2);

      rockets.push({
        x,
        y: height + 10,
        vx: (Math.random() - 0.5) * 2.2,
        vy: speedY,
        targetY,
        color: palette[0],
        trail: [],
      });
    };

    const fireConfettiCannon = (side: 'left' | 'right' | 'center', count: number) => {
      const originX = side === 'left' ? -10 : side === 'right' ? width + 10 : width * 0.5;
      const originY = side === 'center' ? height * 0.28 : height * 0.88;

      for (let i = 0; i < count; i++) {
        let angle: number;
        let speed: number;
        if (side === 'left') {
          angle = -Math.PI * (0.18 + Math.random() * 0.28);
          speed = 11 + Math.random() * 13;
        } else if (side === 'right') {
          angle = -Math.PI * (0.54 + Math.random() * 0.28);
          speed = 11 + Math.random() * 13;
        } else {
          angle = Math.random() * Math.PI * 2;
          speed = 4 + Math.random() * 10;
        }

        const shapeRoll = Math.random();
        const shape: ConfettiPiece['shape'] =
          shapeRoll < 0.52 ? 'rect' : shapeRoll < 0.78 ? 'ribbon' : shapeRoll < 0.92 ? 'star' : 'circle';

        confetti.push({
          x: originX,
          y: originY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - (side === 'center' ? 3.5 : 1.5),
          width: shape === 'ribbon' ? 5 + Math.random() * 4 : 7 + Math.random() * 7,
          height: shape === 'ribbon' ? 14 + Math.random() * 10 : 5 + Math.random() * 5,
          color: CELEBRATION_PALETTE[Math.floor(Math.random() * CELEBRATION_PALETTE.length)],
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.22,
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
          shapeRoll < 0.55 ? 'rect' : shapeRoll < 0.8 ? 'ribbon' : shapeRoll < 0.93 ? 'star' : 'circle';

        confetti.push({
          x: Math.random() * width,
          y: -20 - Math.random() * height * 0.35,
          vx: (Math.random() - 0.5) * 2.4,
          vy: 2.2 + Math.random() * 3.8,
          width: shape === 'ribbon' ? 5 + Math.random() * 3 : 7 + Math.random() * 6,
          height: shape === 'ribbon' ? 13 + Math.random() * 9 : 5 + Math.random() * 5,
          color: CELEBRATION_PALETTE[Math.floor(Math.random() * CELEBRATION_PALETTE.length)],
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.16,
          tiltAngle: Math.random() * Math.PI * 2,
          tiltSpeed: 0.06 + Math.random() * 0.12,
          swayPhase: Math.random() * Math.PI * 2,
          swaySpeed: 0.03 + Math.random() * 0.04,
          shape,
          alpha: 1,
        });
      }
    };

    // Wave 1 (Immediate at t=0): Dual confetti cannons + instant sky bursts + rockets
    fireConfettiCannon('left', 90);
    fireConfettiCannon('right', 90);
    spawnTopConfettiRain(85);
    createFireworkBurst(width * 0.24, height * 0.24, 1.15);
    createFireworkBurst(width * 0.76, height * 0.22, 1.15);
    launchRocket(0.5, 0.18);

    // Choreographed multi-wave fireworks & confetti over the celebration duration
    const waveSchedule: { delay: number; action: () => void }[] = [
      { delay: 240, action: () => createFireworkBurst(width * 0.5, height * 0.18, 1.25) },
      { delay: 420, action: () => { launchRocket(0.18, 0.22); launchRocket(0.82, 0.20); } },
      { delay: 820, action: () => { fireConfettiCannon('left', 55); fireConfettiCannon('right', 55); } },
      { delay: 980, action: () => { launchRocket(0.35, 0.16); launchRocket(0.66, 0.25); } },
      { delay: 1450, action: () => { createFireworkBurst(width * 0.2, height * 0.28, 1.05); createFireworkBurst(width * 0.8, height * 0.26, 1.05); } },
      { delay: 1900, action: () => { launchRocket(0.48, 0.15); spawnTopConfettiRain(60); } },
      { delay: 2450, action: () => { launchRocket(0.26, 0.20); launchRocket(0.74, 0.18); } },
      { delay: 3000, action: () => { fireConfettiCannon('left', 45); fireConfettiCannon('right', 45); createFireworkBurst(width * 0.5, height * 0.22, 1.3); } },
      { delay: 3600, action: () => { launchRocket(0.32, 0.22); launchRocket(0.68, 0.20); } },
      { delay: 4200, action: () => { createFireworkBurst(width * 0.25, height * 0.22, 1.1); createFireworkBurst(width * 0.75, height * 0.22, 1.1); } },
    ];

    waveSchedule.forEach(({ delay, action }) => {
      if (delay < durationMs - 800) {
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

        // Draw rocket comet tail
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
          createFireworkBurst(r.x, r.y, 1.05 + Math.random() * 0.25);
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
          drawStar(ctx, 0, 0, c.width * 0.65, c.width * 0.28);
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
  }, [event.id, event.timestamp, durationMs]);

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

  return (
    <>
      {/* Full-Screen Fireworks & Confetti Canvas Overlay */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="fixed inset-0 z-[110] pointer-events-none"
      />

      {/* Subtle Golden Ambient Glow Vignette */}
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-[105] pointer-events-none bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.22),transparent_62%)] transition-opacity duration-300 ${
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
          className="fanfare-pop pointer-events-auto relative overflow-hidden rounded-3xl bg-zinc-950/95 backdrop-blur-xl text-white shadow-[0_24px_80px_-12px_rgba(251,191,36,0.55)] border-2 border-amber-400 ring-4 ring-amber-400/35 cursor-pointer"
          title="Click to dismiss celebration"
        >
          {/* Animated Gold Shimmer Sweep */}
          <div
            aria-hidden="true"
            className="fanfare-shimmer pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-amber-300/20 to-transparent -skew-x-12"
          />

          <div className="relative px-5 py-5 sm:px-7 sm:py-6 space-y-4">
            {/* Top Celebration Header */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-300 via-yellow-400 to-orange-500 text-zinc-950 flex items-center justify-center shadow-lg shadow-amber-500/40 shrink-0">
                  <Trophy className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-amber-300 text-xs sm:text-sm font-black tracking-wide">
                    <PartyPopper className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="truncate">Massive Sale Over £100!</span>
                    <Sparkles className="w-4 h-4 text-yellow-300 shrink-0" />
                  </div>
                  <p className="text-[11px] text-amber-100/80 font-semibold truncate">
                    {itemCount > 0 ? `Big Basket Checkout (${itemCount} items)` : 'Counter Celebration • Synced Live'}
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

            {/* Hero Amount Callout */}
            <div className="text-center py-2.5 px-4 rounded-2xl bg-gradient-to-b from-amber-400/20 via-amber-500/10 to-zinc-900/90 border border-amber-400/50">
              <div className="text-4xl sm:text-5xl font-black tracking-tight tabular-nums text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 drop-shadow-sm">
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
              className={`h-full transition-all ease-linear bg-gradient-to-r from-amber-300 via-yellow-400 to-emerald-400 ${
                progressWidth === '0%' ? 'w-0' : 'w-full'
              }`}
            />
          </div>
        </div>
      </div>
    </>
  );
};
