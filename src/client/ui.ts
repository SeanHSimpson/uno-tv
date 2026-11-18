import type { PublicPlayer } from "../shared/types";

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

export function avatar(p: Pick<PublicPlayer, "name" | "hue">, cls = ""): string {
  const initial = esc([...p.name.trim()][0]?.toUpperCase() ?? "?");
  return `<span class="avatar ${cls}" style="--av:${avatarColor(p.hue)}">${initial}</span>`;
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
export async function keepAwake() {
  try {
    const wl = await (navigator as Navigator & { wakeLock?: { request(t: "screen"): Promise<unknown> } }).wakeLock?.request("screen");
    if (wl) document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && keepAwake(), { once: true });
  } catch {
    /* not allowed / unsupported */
  }
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
