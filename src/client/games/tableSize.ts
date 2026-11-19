// The host's "Cards on the TV" control (Contract Rummy and Euchre), shown in the host menu.

const LABELS = ["Normal", "Big", "Huge"];

export function tableSizeMenu(current: number, sizes: number[]): string {
  return `<h4>Cards on the TV</h4>
    <div class="seg wide" role="group" aria-label="Card size on the TV">${sizes
      .map(
        (v, i) =>
          `<button class="seg-btn ${Math.abs(v - current) < 0.01 ? "on" : ""}" data-gact='${JSON.stringify({ t: "table", size: v })}'>${LABELS[i] ?? `${v}×`}</button>`,
      )
      .join("")}</div>`;
}
