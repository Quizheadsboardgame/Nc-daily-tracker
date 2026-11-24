import React, { useEffect, useRef, useState } from 'react';
import { Radiation, X } from 'lucide-react';
import { SaleFlashEvent } from '../utils/sound';

interface NuclearSaleCelebrationProps {
  event: SaleFlashEvent;
  durationMs: number;
  isFadingOut: boolean;
  onDismiss: () => void;
}

interface BlastEmber {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
}

interface CloudPuff {
  angle: number;
  distFactor: number;
  radius: number;
  speed: number;
  hue: 'white' | 'yellow' | 'orange' | 'red';
}

const IMPACT_MS = 1750;
const WHITEOUT_START_MS = 2600;
const WHITEOUT_DURATION_MS = 10000;

export const NuclearSaleCelebration: React.FC<NuclearSaleCelebrationProps> = ({
  event,
  durationMs,
  isFadingOut,
  onDismiss,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [phase, setPhase] = useState<'drop' | 'detonate' | 'whiteout'>('drop');
  const [whiteoutSecondsLeft, setWhiteoutSecondsLeft] = useState<number>(10);

  useEffect(() => {
    const startTime = performance.now();
    let phaseState: 'drop' | 'detonate' | 'whiteout' = 'drop';

    const impactTimer = setTimeout(() => {
      phaseState = 'detonate';
      setPhase('detonate');
    }, IMPACT_MS);

    const whiteoutTimer = setTimeout(() => {
      phaseState = 'whiteout';
      setPhase('whiteout');
      setWhiteoutSecondsLeft(10);
    }, WHITEOUT_START_MS);

    const countdownInterval = setInterval(() => {
      const elapsed = performance.now() - startTime;
      if (elapsed >= WHITEOUT_START_MS) {
        const remainingMs = Math.max(0, WHITEOUT_START_MS + WHITEOUT_DURATION_MS - elapsed);
        setWhiteoutSecondsLeft(Math.max(1, Math.ceil(remainingMs / 1000)));
      }
    }, 150);

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || prefersReducedMotion) {
      return () => {
        clearTimeout(impactTimer);
        clearTimeout(whiteoutTimer);
        clearInterval(countdownInterval);
      };
    }

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

    const embers: BlastEmber[] = [];
    const smokeTrail: { x: number; y: number; r: number; alpha: number }[] = [];
    const capPuffs: CloudPuff[] = Array.from({ length: 28 }, (_, i) => ({
      angle: (Math.PI * 2 * i) / 28 + (Math.random() - 0.5) * 0.25,
      distFactor: 0.45 + Math.random() * 0.65,
      radius: 28 + Math.random() * 44,
      speed: 0.7 + Math.random() * 0.6,
      hue: i % 4 === 0 ? 'white' : i % 3 === 0 ? 'yellow' : i % 2 === 0 ? 'orange' : 'red',
    }));

    let embersSpawned = false;

    const spawnBlastEmbers = (cx: number, cy: number) => {
      const colors = ['#ffffff', '#fef08a', '#facc15', '#fb923c', '#ef4444'];
      for (let i = 0; i < 180; i++) {
        const angle = -Math.PI * Math.random(); // Upward hemisphere
        const speed = 4 + Math.random() * 18;
        embers.push({
          x: cx + (Math.random() - 0.5) * 40,
          y: cy,
          vx: Math.cos(angle) * speed * (0.7 + Math.random() * 0.8),
          vy: Math.sin(angle) * speed * (0.8 + Math.random() * 0.7),
          size: 2.5 + Math.random() * 5.5,
          color: colors[Math.floor(Math.random() * colors.length)],
          alpha: 1,
          decay: 0.012 + Math.random() * 0.018,
        });
      }
    };

    const drawBomb = (bx: number, by: number, scale: number) => {
      ctx.save();
      ctx.translate(bx, by);
      ctx.scale(scale, scale);

      // Tail fins
      ctx.fillStyle = '#27272a';
      ctx.strokeStyle = '#52525b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-18, -56);
      ctx.lineTo(-34, -84);
      ctx.lineTo(-10, -76);
      ctx.lineTo(10, -76);
      ctx.lineTo(34, -84);
      ctx.lineTo(18, -56);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Tail stabilizer ring
      ctx.fillStyle = '#eab308';
      ctx.fillRect(-26, -78, 52, 8);

      // Main bomb fuselage
      const bodyGrad = ctx.createLinearGradient(-26, 0, 26, 0);
      bodyGrad.addColorStop(0, '#18181b');
      bodyGrad.addColorStop(0.35, '#52525b');
      bodyGrad.addColorStop(0.65, '#27272a');
      bodyGrad.addColorStop(1, '#09090b');

      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.moveTo(0, 56);
      ctx.bezierCurveTo(30, 38, 30, -28, 16, -58);
      ctx.lineTo(-16, -58);
      ctx.bezierCurveTo(-30, -28, -30, 38, 0, 56);
      ctx.closePath();
      ctx.fill();

      // Yellow hazard band
      ctx.save();
      ctx.clip();
      ctx.fillStyle = '#facc15';
      ctx.fillRect(-34, -18, 68, 22);

      // Black hazard stripes
      ctx.fillStyle = '#09090b';
      for (let sx = -40; sx < 44; sx += 16) {
        ctx.beginPath();
        ctx.moveTo(sx, -18);
        ctx.lineTo(sx + 8, -18);
        ctx.lineTo(sx + 2, 4);
        ctx.lineTo(sx - 6, 4);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // Glowing red warhead tip
      const tipGrad = ctx.createRadialGradient(0, 44, 2, 0, 44, 18);
      tipGrad.addColorStop(0, '#fef08a');
      tipGrad.addColorStop(0.5, '#ef4444');
      tipGrad.addColorStop(1, 'rgba(239,68,68,0)');
      ctx.fillStyle = tipGrad;
      ctx.beginPath();
      ctx.arc(0, 44, 16, 0, Math.PI * 2);
      ctx.fill();

      // Specular metallic highlight
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-10, -44);
      ctx.quadraticCurveTo(-18, 0, -6, 36);
      ctx.stroke();

      ctx.restore();
    };

    const tick = (now: number) => {
      const elapsed = now - startTime;
      ctx.clearRect(0, 0, width, height);

      const cx = width * 0.5;
      const groundY = height * 0.84;

      if (elapsed < IMPACT_MS) {
        // PHASE 1: Bomb plummeting from top of screen
        const t = Math.min(1, elapsed / IMPACT_MS);
        const easeIn = Math.pow(t, 2.35);
        const startY = -120;
        const bombY = startY + (groundY - startY) * easeIn;

        // Subtle atmospheric darkening + red/amber alert vignette
        const alertPulse = 0.25 + Math.sin(elapsed * 0.025) * 0.12;
        const bgGrad = ctx.createRadialGradient(cx, bombY, 20, cx, height * 0.5, Math.max(width, height) * 0.85);
        bgGrad.addColorStop(0, `rgba(251, 146, 60, ${0.15 + t * 0.25})`);
        bgGrad.addColorStop(0.5, `rgba(127, 29, 29, ${alertPulse})`);
        bgGrad.addColorStop(1, 'rgba(9, 9, 11, 0.72)');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        // Speed streaks rushing upward
        ctx.strokeStyle = `rgba(254, 240, 138, ${0.18 + t * 0.35})`;
        ctx.lineWidth = 2;
        for (let i = 0; i < 16; i++) {
          const sx = ((i * 137.5) % width);
          const sy = ((elapsed * (1.2 + (i % 4) * 0.3) + i * 90) % (height + 160)) - 80;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx, sy + 55 + t * 90);
          ctx.stroke();
        }

        // Ground target reticle glow
        const reticleR = 30 + (1 - t) * 70;
        ctx.save();
        ctx.strokeStyle = `rgba(239, 68, 68, ${0.35 + t * 0.55})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(cx, groundY + 26, reticleR * 1.8, reticleR * 0.42, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Smoke trail behind bomb
        smokeTrail.push({
          x: cx + (Math.random() - 0.5) * 10,
          y: bombY - 68,
          r: 8 + Math.random() * 10,
          alpha: 0.65,
        });
        for (let i = smokeTrail.length - 1; i >= 0; i--) {
          const p = smokeTrail[i];
          p.r += 0.9;
          p.alpha -= 0.022;
          if (p.alpha <= 0.02) {
            smokeTrail.splice(i, 1);
            continue;
          }
          ctx.fillStyle = `rgba(228, 228, 231, ${p.alpha})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }

        // Draw falling atomic bomb
        const scale = Math.min(1.45, Math.max(0.85, Math.min(width, height) / 680)) * (0.9 + t * 0.35);
        drawBomb(cx, bombY, scale);
      } else if (elapsed < WHITEOUT_START_MS + 350) {
        // PHASE 2: Thermonuclear Detonation & Mushroom Cloud -> Blinding Whiteout
        if (!embersSpawned) {
          embersSpawned = true;
          spawnBlastEmbers(cx, groundY);
        }

        const blastElapsed = elapsed - IMPACT_MS;
        const blastProgress = Math.min(1, blastElapsed / (WHITEOUT_START_MS - IMPACT_MS));
        const maxRadius = Math.hypot(width, height) * 1.15;

        // Scorching fiery sky backdrop
        const skyGrad = ctx.createRadialGradient(cx, groundY, 20, cx, groundY, maxRadius);
        skyGrad.addColorStop(0, '#ffffff');
        skyGrad.addColorStop(0.25, '#fef08a');
        skyGrad.addColorStop(0.55, '#f97316');
        skyGrad.addColorStop(0.85, '#991b1b');
        skyGrad.addColorStop(1, '#18181b');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, width, height);

        // Rising Mushroom Cloud Stem
        const stemHeight = height * 0.56 * Math.min(1, blastProgress * 1.6);
        const stemWidth = Math.min(width * 0.16, 130) * (0.6 + blastProgress * 0.5);
        const stemGrad = ctx.createLinearGradient(cx - stemWidth, groundY, cx + stemWidth, groundY - stemHeight);
        stemGrad.addColorStop(0, '#ea580c');
        stemGrad.addColorStop(0.5, '#facc15');
        stemGrad.addColorStop(1, '#ffffff');
        ctx.fillStyle = stemGrad;
        ctx.beginPath();
        ctx.moveTo(cx - stemWidth * 0.9, groundY + 40);
        ctx.quadraticCurveTo(cx - stemWidth * 0.45, groundY - stemHeight * 0.5, cx - stemWidth * 0.55, groundY - stemHeight);
        ctx.lineTo(cx + stemWidth * 0.55, groundY - stemHeight);
        ctx.quadraticCurveTo(cx + stemWidth * 0.45, groundY - stemHeight * 0.5, cx + stemWidth * 0.9, groundY + 40);
        ctx.closePath();
        ctx.fill();

        // Mushroom Cloud Toroidal Cap
        const capY = groundY - stemHeight;
        const capSpreadX = Math.min(width * 0.42, 340) * Math.min(1.15, blastProgress * 1.5);
        const capSpreadY = Math.min(height * 0.22, 160) * Math.min(1.15, blastProgress * 1.5);

        capPuffs.forEach((puff) => {
          const px = cx + Math.cos(puff.angle) * capSpreadX * puff.distFactor;
          const py = capY + Math.sin(puff.angle) * capSpreadY * puff.distFactor;
          const pr = puff.radius * (0.7 + blastProgress * 1.5);

          const pGrad = ctx.createRadialGradient(px, py, pr * 0.1, px, py, pr);
          if (puff.hue === 'white') {
            pGrad.addColorStop(0, 'rgba(255,255,255,0.98)');
            pGrad.addColorStop(1, 'rgba(254,240,138,0)');
          } else if (puff.hue === 'yellow') {
            pGrad.addColorStop(0, 'rgba(254,240,138,0.95)');
            pGrad.addColorStop(1, 'rgba(249,115,22,0)');
          } else if (puff.hue === 'orange') {
            pGrad.addColorStop(0, 'rgba(251,146,60,0.92)');
            pGrad.addColorStop(1, 'rgba(220,38,38,0)');
          } else {
            pGrad.addColorStop(0, 'rgba(239,68,68,0.88)');
            pGrad.addColorStop(1, 'rgba(127,29,29,0)');
          }

          ctx.fillStyle = pGrad;
          ctx.beginPath();
          ctx.arc(px, py, pr, 0, Math.PI * 2);
          ctx.fill();
        });

        // Expanding Shockwave Rings
        const ringRadius1 = blastProgress * maxRadius * 1.05;
        ctx.save();
        ctx.strokeStyle = `rgba(255, 255, 255, ${Math.max(0, 0.95 - blastProgress * 0.5)})`;
        ctx.lineWidth = Math.max(4, 28 * (1 - blastProgress * 0.5));
        ctx.beginPath();
        ctx.arc(cx, groundY - stemHeight * 0.2, ringRadius1, 0, Math.PI * 2);
        ctx.stroke();

        // Ground Mach stem shockwave ellipse
        ctx.strokeStyle = 'rgba(254, 240, 138, 0.85)';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.ellipse(cx, groundY + 12, ringRadius1 * 1.25, ringRadius1 * 0.24, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Update & draw flying plasma embers
        for (let i = embers.length - 1; i >= 0; i--) {
          const e = embers[i];
          e.x += e.vx;
          e.y += e.vy;
          e.vy += 0.14;
          e.alpha -= e.decay;
          if (e.alpha <= 0.02) {
            embers.splice(i, 1);
            continue;
          }
          ctx.fillStyle = e.color;
          ctx.globalAlpha = Math.max(0, e.alpha);
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Blinding Whiteout Surge covering 100% of screen by WHITEOUT_START_MS
        const flashStart = 0.35;
        if (blastProgress > flashStart) {
          const flashT = Math.min(1, (blastProgress - flashStart) / (1 - flashStart));
          const flashAlpha = Math.pow(flashT, 1.45);
          ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
          ctx.fillRect(0, 0, width, height);
        }
      }

      if (phaseState !== 'whiteout' && elapsed < durationMs) {
        animId = requestAnimationFrame(tick);
      }
    };

    animId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animId);
      clearTimeout(impactTimer);
      clearTimeout(whiteoutTimer);
      clearInterval(countdownInterval);
      window.removeEventListener('resize', resize);
    };
  }, [event.id, event.timestamp, durationMs]);

  return (
    <div
      id="nuclear-sale-celebration"
      role="status"
      aria-live="assertive"
      className={`fixed inset-0 z-[200] transition-opacity duration-500 ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      } ${phase === 'detonate' ? 'nuclear-shake' : ''}`}
    >
      {/* Bomb Drop & Mushroom Cloud Canvas (Active during Drop & Detonation) */}
      {phase !== 'whiteout' && (
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="fixed inset-0 z-[205] pointer-events-none"
        />
      )}

      {/* Tactical Incoming Warning HUD (Visible while bomb is dropping) */}
      {phase === 'drop' && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[210] w-[calc(100%-2rem)] max-w-lg pointer-events-none">
          <div className="rounded-2xl bg-zinc-950/92 border-2 border-amber-400 shadow-[0_0_50px_rgba(239,68,68,0.6)] px-5 py-4 text-center text-white">
            <div className="flex items-center justify-center gap-2 text-amber-300 text-xs sm:text-sm font-black uppercase tracking-widest animate-pulse">
              <Radiation className="w-5 h-5 text-amber-400 animate-spin" />
              <span>NUCLEAR SALE ALERT • OVER £1,000!</span>
              <Radiation className="w-5 h-5 text-amber-400 animate-spin" />
            </div>
            <div className="mt-1.5 text-4xl sm:text-5xl font-black tabular-nums text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-amber-300 to-rose-400">
              {event.amount !== undefined ? `£${event.amount.toFixed(2)}` : '£1,000+'}
            </div>
            <p className="mt-1 text-xs font-bold text-zinc-300 truncate">
              {event.vendorName}
              {event.itemDescription ? ` • ${event.itemDescription}` : ''}
            </p>
          </div>
        </div>
      )}

      {/* FULL 10-SECOND BLINDING PURE WHITE SCREEN */}
      {phase === 'whiteout' && (
        <div
          id="nuclear-whiteout-screen"
          className="fixed inset-0 z-[220] bg-white flex flex-col items-center justify-end pb-6 px-4 select-none"
        >
          {/* Minimal discreet bottom whisper so screen stays pure blinding white while staff can skip if needed */}
          <div className="flex items-center gap-3 text-[11px] font-semibold text-zinc-300">
            <span className="tabular-nums">
              {event.amount !== undefined ? `£${event.amount.toFixed(2)}` : '£1,000+'} • {event.vendorName} • {whiteoutSecondsLeft}s
            </span>
            <button
              type="button"
              id="btn-dismiss-nuclear-whiteout"
              onClick={onDismiss}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-zinc-300 hover:text-zinc-600 hover:bg-zinc-100 transition-colors cursor-pointer"
              aria-label="Skip whiteout screen"
            >
              <X className="w-3 h-3" />
              <span>Skip</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
