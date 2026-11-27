import { esc, reducedMotion } from "./ui";

const COLORS = ["#ef6a4f", "#f8c14a", "#62b36e", "#5a98dd", "#fff6e6"];

/** Lightweight DOM confetti — no canvas, cleans itself up. */
export function confetti(host: HTMLElement, pieces = 120) {
  if (reducedMotion()) return;
  const layer = document.createElement("div");
  layer.className = "confetti";
  host.append(layer);
  for (let i = 0; i < pieces; i++) {
    const p = document.createElement("i");
    const x = Math.random() * 100;
    const drift = (Math.random() - 0.5) * 30;
    p.style.left = `${x}%`;
    p.style.background = COLORS[i % COLORS.length]!;
    p.style.width = `${6 + Math.random() * 8}px`;
    p.style.height = `${10 + Math.random() * 10}px`;
    layer.append(p);
    p.animate(
      [
        { transform: `translate(0, -10vh) rotate(0deg)`, opacity: 1 },
        { transform: `translate(${drift}vw, 110vh) rotate(${720 * (Math.random() - 0.5)}deg)`, opacity: 0.9 },
      ],
      { duration: 2600 + Math.random() * 2200, delay: Math.random() * 900, easing: "cubic-bezier(.25,.6,.5,1)", fill: "both" },
    );
  }
  setTimeout(() => layer.remove(), 6000);
}

export type CalloutTone = "gold" | "danger" | "cool" | "good";

let activeCallout: HTMLElement | null = null;
let calloutTimer = 0;

/**
 * Bold theatrical TV moment banner (e.g. "CONTRACT DOWN!", "EUCHRED!", "STACK +4!").
 * Never intercepts clicks and gracefully simplifies under reduced-motion.
 */
export function callout(title: string, opts: { sub?: string; tone?: CalloutTone; icon?: string; duration?: number } = {}) {
  const { sub, tone = "gold", icon, duration = 1850 } = opts;
  if (activeCallout) {
    activeCallout.remove();
    activeCallout = null;
  }
  clearTimeout(calloutTimer);
  const el = document.createElement("div");
  el.className = `tv-callout tone-${tone}`;
  el.setAttribute("aria-live", "polite");
  el.innerHTML = `<div class="tv-callout-card">
    ${icon ? `<span class="tv-callout-ico">${esc(icon)}</span>` : ""}
    <div class="tv-callout-title">${esc(title)}</div>
    ${sub ? `<div class="tv-callout-sub">${esc(sub)}</div>` : ""}
  </div>`;
  document.body.append(el);
  activeCallout = el;
  calloutTimer = window.setTimeout(() => {
    el.remove();
    if (activeCallout === el) activeCallout = null;
  }, duration);
}
