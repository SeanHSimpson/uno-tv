// Lightweight 2D <canvas> ambient & impact FX layer for the TV screen.
// Runs at a capped DPR (<=1.5) with a small particle budget and auto-pauses
// whenever the tab is hidden or prefers-reduced-motion is enabled.

import { reducedMotion } from "./ui";

export type FxTheme = "lobby" | "ohno" | "euchre" | "rummy" | "fizzle" | "hush";

interface Ambient {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  phase: number;
  speed: number;
  color: string;
  alpha: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  maxLife: number;
  color: string;
  gravity: number;
}

interface Ring {
  x: number;
  y: number;
  r: number;
  maxR: number;
  life: number;
  maxLife: number;
  color: string;
}

const THEME_CFG: Record<FxTheme, { count: number; colors: string[]; vyMin: number; vyMax: number; drift: number; rMin: number; rMax: number }> = {
  lobby: { count: 22, colors: ["#ffcf7a", "#ffe6b3", "#f29d52"], vyMin: -14, vyMax: -4, drift: 10, rMin: 1.4, rMax: 3.2 },
  ohno: { count: 20, colors: ["#ffcf7a", "#f27b4b", "#ffd88a", "#9be5a6"], vyMin: -12, vyMax: -4, drift: 12, rMin: 1.5, rMax: 3.2 },
  euchre: { count: 28, colors: ["#ffe787", "#c7f27a", "#fff3b8", "#7bd3f7"], vyMin: -8, vyMax: 6, drift: 18, rMin: 1.6, rMax: 3.6 },
  rummy: { count: 18, colors: ["#ffd480", "#f5e3ba", "#a8e0b2"], vyMin: -11, vyMax: -3, drift: 8, rMin: 1.2, rMax: 2.8 },
  fizzle: { count: 30, colors: ["#ff8c42", "#ff5938", "#ffd166", "#ffb703"], vyMin: -34, vyMax: -12, drift: 22, rMin: 1.4, rMax: 3.6 },
  hush: { count: 32, colors: ["#fff6e6", "#ffcf5c", "#a5b4fc", "#c4b5fd"], vyMin: -7, vyMax: 5, drift: 9, rMin: 1.0, rMax: 2.6 },
};

class TvFxCanvas {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private theme: FxTheme = "lobby";
  private ambient: Ambient[] = [];
  private sparks: Spark[] = [];
  private rings: Ring[] = [];
  private raf = 0;
  private lastT = 0;
  private w = 0;
  private h = 0;

  mount() {
    if (this.canvas || reducedMotion()) return;
    const c = document.createElement("canvas");
    c.className = "tv-fx-canvas";
    c.setAttribute("aria-hidden", "true");
    document.body.append(c);
    this.canvas = c;
    this.ctx = c.getContext("2d");
    this.resize();
    this.seedAmbient();
    window.addEventListener("resize", this.onResize);
    document.addEventListener("visibilitychange", this.onVis);
    this.startLoop();
  }

  unmount() {
    this.stopLoop();
    window.removeEventListener("resize", this.onResize);
    document.removeEventListener("visibilitychange", this.onVis);
    this.canvas?.remove();
    this.canvas = null;
    this.ctx = null;
    this.ambient = [];
    this.sparks = [];
    this.rings = [];
  }

  setTheme(theme: FxTheme) {
    if (this.theme === theme && this.ambient.length) return;
    this.theme = theme;
    if (this.canvas) this.seedAmbient();
  }

  /** Trigger a celebratory burst of sparks at (x, y) in viewport coordinates. */
  burst(x: number, y: number, colors: string[] = ["#ffbf5e", "#fff6e6", "#ef6a4f", "#6cc17a"], count = 34) {
    if (!this.canvas || reducedMotion()) return;
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.45;
      const spd = 90 + Math.random() * 260;
      const maxLife = 0.55 + Math.random() * 0.55;
      this.sparks.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 40,
        r: 2.2 + Math.random() * 3.8,
        life: maxLife,
        maxLife,
        color: colors[i % colors.length]!,
        gravity: 260,
      });
    }
    if (this.sparks.length > 220) this.sparks.splice(0, this.sparks.length - 220);
  }

  /** Expanding luminous shockwave ring for dramatic TV moments. */
  shockwave(x: number, y: number, color = "#ffbf5e", maxR = Math.min(window.innerWidth, window.innerHeight) * 0.28) {
    if (!this.canvas || reducedMotion()) return;
    this.rings.push({ x, y, r: 12, maxR, life: 0.65, maxLife: 0.65, color });
  }

  /** Center-of-screen burst convenience helper. */
  centerBurst(colors?: string[], count = 42, ringColor?: string) {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight * 0.46;
    this.burst(cx, cy, colors, count);
    if (ringColor) this.shockwave(cx, cy, ringColor);
  }

  private onResize = () => this.resize();
  private onVis = () => {
    if (document.visibilityState === "hidden") this.stopLoop();
    else this.startLoop();
  };

  private resize() {
    if (!this.canvas || !this.ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private seedAmbient() {
    const cfg = THEME_CFG[this.theme];
    const w = this.w || window.innerWidth;
    const h = this.h || window.innerHeight;
    this.ambient = Array.from({ length: cfg.count }, (_, i) => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * cfg.drift,
      vy: cfg.vyMin + Math.random() * (cfg.vyMax - cfg.vyMin),
      r: cfg.rMin + Math.random() * (cfg.rMax - cfg.rMin),
      phase: Math.random() * Math.PI * 2,
      speed: 1.1 + Math.random() * 1.8,
      color: cfg.colors[i % cfg.colors.length]!,
      alpha: this.theme === "euchre" || this.theme === "fizzle" ? 0.55 : 0.36,
    }));
  }

  private startLoop() {
    if (this.raf || !this.canvas || document.visibilityState === "hidden") return;
    this.lastT = performance.now();
    const tick = (now: number) => {
      this.raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, Math.max(0.001, (now - this.lastT) / 1000));
      this.lastT = now;
      this.draw(dt);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private stopLoop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private draw(dt: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const w = this.w;
    const h = this.h;
    ctx.clearRect(0, 0, w, h);

    // 1. Ambient atmospheric particles (fireflies, embers, stardust, candlelight motes).
    for (const p of this.ambient) {
      p.phase += p.speed * dt;
      p.x += (p.vx + Math.sin(p.phase) * 9) * dt;
      p.y += p.vy * dt;
      if (p.y < -12) {
        p.y = h + 10;
        p.x = Math.random() * w;
      } else if (p.y > h + 12) {
        p.y = -10;
        p.x = Math.random() * w;
      }
      if (p.x < -12) p.x = w + 10;
      else if (p.x > w + 12) p.x = -10;

      const twinkle = 0.38 + 0.62 * (0.5 + 0.5 * Math.sin(p.phase * 1.4));
      const a = p.alpha * twinkle;
      ctx.globalAlpha = a * 0.32;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 2.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Expanding shockwave rings.
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]!;
      r.life -= dt;
      if (r.life <= 0) {
        this.rings.splice(i, 1);
        continue;
      }
      const prog = 1 - r.life / r.maxLife;
      const ease = 1 - Math.pow(1 - prog, 3);
      r.r = 14 + (r.maxR - 14) * ease;
      ctx.globalAlpha = (1 - prog) * 0.72;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = Math.max(1.5, (1 - prog) * 7);
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 3. Impact sparks.
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i]!;
      s.life -= dt;
      if (s.life <= 0) {
        this.sparks.splice(i, 1);
        continue;
      }
      s.vy += s.gravity * dt;
      s.vx *= 0.985;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      const t = s.life / s.maxLife;
      ctx.globalAlpha = t;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * (0.4 + 0.6 * t), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

export const tvFx = new TvFxCanvas();
