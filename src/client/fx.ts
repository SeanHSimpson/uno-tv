import { reducedMotion } from "./ui";

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
