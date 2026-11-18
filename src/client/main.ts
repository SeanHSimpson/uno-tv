import "./styles.css";
import { cardEl, installCardDefs } from "./cards";
import { createRoom, roomExists, saveName, savedName } from "./net";
import { mountPhone } from "./phone";
import { mountTv } from "./tv";
import { $, esc, toast } from "./ui";

// Routes (query-string based so it works as a plain static site):
//   /                 home: host or join
//   /?tv=CODE         the shared TV table
//   /?join=CODE       phone: pick a name (QR codes point here)
//   /?play=CODE       phone: in the game (survives refresh)

installCardDefs();
const root = $("#app");
const params = new URLSearchParams(location.search);
const norm = (c: string | null) => (c ?? "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);

const tv = norm(params.get("tv"));
const play = norm(params.get("play"));
const join = norm(params.get("join"));

if (tv.length === 4) mountTv(root, tv);
else if (play.length === 4 && savedName()) mountPhone(root, play, savedName());
else home(join || play);

function home(prefill: string) {
  document.body.className = "mode-home";
  const joining = prefill.length === 4;
  root.innerHTML = `
  <div class="home">
    <div class="home-hero">
      <div class="hero-cards" aria-hidden="true"></div>
      <div class="logo logo-xl">Oh<span>No!</span></div>
      <p class="tagline">The cozy card game for one TV and a room full of phones.</p>
    </div>
    <div class="home-panels ${joining ? "joining" : ""}">
      <form class="panel" id="join-form" autocomplete="off">
        <h2>Join a game</h2>
        <label>Your name<input id="name" maxlength="14" required placeholder="e.g. Grandma Jo" value="${esc(savedName())}" autocapitalize="words" enterkeyhint="next"></label>
        <label>Room code<input id="code" maxlength="4" required placeholder="ABCD" value="${esc(prefill)}" autocapitalize="characters" inputmode="text" enterkeyhint="go"></label>
        <button class="btn btn-primary btn-xl wide" type="submit">Pull up a chair</button>
      </form>
      <div class="panel panel-host">
        <h2>On the TV?</h2>
        <p class="muted">Open this page on the big screen and start a table. Everyone joins with their phone.</p>
        <button class="btn btn-ghost btn-xl wide" id="host-btn">Host on this screen</button>
      </div>
    </div>
  </div>`;

  // A few decorative cards fanned behind the logo.
  const fan = root.querySelector(".hero-cards")!;
  (
    [
      ["red", "7"],
      ["yellow", "reverse"],
      ["wild", "wild"],
      ["green", "draw2"],
      ["blue", "skip"],
    ] as const
  ).forEach(([color, value], i) => {
    const el = cardEl({ id: -1 - i, color, value }, "hero-card");
    el.style.setProperty("--i", String(i - 2));
    fan.append(el);
  });

  if (joining && savedName()) ($("#name") as HTMLInputElement).focus();
  else ($(joining ? "#name" : "#name") as HTMLInputElement).focus({ preventScroll: true });

  const codeInput = $("#code") as HTMLInputElement;
  codeInput.addEventListener("input", () => (codeInput.value = norm(codeInput.value)));

  $("#join-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = ($("#name") as HTMLInputElement).value.trim();
    const code = norm(codeInput.value);
    if (!name) return toast("Pop your name in first.");
    if (code.length !== 4) return toast("Room codes are 4 letters — check the TV.");
    if (!(await roomExists(code).catch(() => false))) return toast("Can't find that room. Check the code on the TV.", "error");
    saveName(name);
    history.replaceState(null, "", `/?play=${code}`);
    mountPhone(root, code, name);
  });

  $("#host-btn").addEventListener("click", async (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = "Setting the table…";
    try {
      const code = await createRoom();
      history.replaceState(null, "", `/?tv=${code}`);
      mountTv(root, code);
      document.documentElement.requestFullscreen?.().catch(() => {});
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't create a room.", "error");
      btn.disabled = false;
      btn.textContent = "Host on this screen";
    }
  });
}
