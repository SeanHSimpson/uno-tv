import { AVATARS } from "../shared/common";

/** Tiny tagged-template helper that escapes interpolated values. */
export function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

export function $(sel: string, root: ParentNode = document): HTMLElement {
  const el = root.querySelector<HTMLElement>(sel);
  if (!el) throw new Error(`missing ${sel}`);
  return el;
}

// Warm avatar palette (seat colours), distinct from the card colours.
const AVATAR = ["#e98a5b", "#7fb7a4", "#c98bb9", "#e6c069", "#8aa6d6", "#d98282", "#9bc47c", "#b49a7a", "#73b6c9", "#d6a2e0"];
export const avatarColor = (hue: number) => AVATAR[hue % AVATAR.length]!;

export function avatar(p: { name: string; hue: number; bot?: boolean; avatar?: string | null }, cls = ""): string {
  const pic = p.bot ? "🤖" : p.avatar;
  const face = pic ? esc(pic) : esc([...p.name.trim()][0]?.toUpperCase() ?? "?");
  return `<span class="avatar ${pic ? "emoji" : ""} ${cls}" style="--av:${avatarColor(p.hue)}">${face}</span>`;
}

/** Grid of pictures to choose from; `data-avatar` on each button. */
export function avatarPicker(selected: string | null): string {
  return `<div class="avatar-picker" role="radiogroup" aria-label="Pick your picture">${AVATARS.map(
    (a) => `<button type="button" class="avatar-choice ${a === selected ? "on" : ""}" data-avatar="${a}" role="radio" aria-checked="${a === selected}">${a}</button>`,
  ).join("")}</div>`;
}

let toastTimer = 0;
export function toast(message: string, kind: "info" | "error" = "info") {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.setAttribute("role", "status");
    document.body.append(el);
  }
  el.textContent = message;
  el.className = `toast show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el!.classList.remove("show"), 2600);
}

export function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}

/** Keep the screen awake (TVs dimming mid-game is the worst). */
type WakeLockSentinelLike = { addEventListener(t: "release", f: () => void): void };
let wakeLock: WakeLockSentinelLike | null = null;
let wakeLockPending = false;

/**
 * Keep the screen on, so phones don't lock (and drop their connection) between turns.
 * The browser releases the lock whenever the page is hidden, and some browsers only
 * grant it after a tap, so we ask again on every return and on taps until it sticks.
 */
export function keepAwake() {
  const request = async () => {
    if (wakeLock || wakeLockPending || document.visibilityState !== "visible") return;
    const api = (navigator as Navigator & { wakeLock?: { request(t: "screen"): Promise<WakeLockSentinelLike> } }).wakeLock;
    if (!api) return;
    wakeLockPending = true;
    try {
      wakeLock = await api.request("screen");
      wakeLock.addEventListener("release", () => (wakeLock = null));
    } catch {
      /* not allowed yet (needs a tap) or unsupported */
    } finally {
      wakeLockPending = false;
    }
  };
  request();
  document.addEventListener("visibilitychange", request);
  window.addEventListener("pointerdown", request, { passive: true });
}

/** Fly a clone of `el` from one rect to another (Web Animations API). */
export function fly(el: HTMLElement, from: DOMRect, to: DOMRect, opts: { duration?: number; delay?: number; spin?: number } = {}) {
  const { duration = 520, delay = 0, spin = 0 } = opts;
  el.classList.add("flyer");
  el.style.width = `${to.width}px`;
  el.style.height = `${to.height}px`;
  el.style.left = `${to.left}px`;
  el.style.top = `${to.top}px`;
  document.body.append(el);
  const sx = from.width / to.width;
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  const anim = el.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(${sx}) rotate(${spin}deg)`, opacity: 0.4 },
      { opacity: 1, offset: 0.2 },
      { transform: "translate(0,0) scale(1) rotate(0deg)", opacity: 1 },
    ],
    { duration, delay, easing: "cubic-bezier(.2,.8,.25,1)", fill: "backwards" },
  );
  // Background tabs throttle animations; never leave a stray card on screen.
  const failsafe = setTimeout(() => el.remove(), delay + duration + 800);
  return anim.finished.then(() => el.remove()).catch(() => el.remove()).finally(() => clearTimeout(failsafe));
}

export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Lan-friendly origin for QR codes: during local dev, point phones at the computer's Wi-Fi IP. */
export function joinOrigin(): string {
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
  if (local && __LAN_IP__) return `${location.protocol}//${__LAN_IP__}${location.port ? `:${location.port}` : ""}`;
  return location.origin;
}

declare global {
  const __LAN_IP__: string;
}
