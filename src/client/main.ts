import "./styles.css";
import { audio } from "./audio";
import { cardEl, installCardDefs } from "./cards";
import { ecardEl } from "./games/euchre/cards";
import { fcardHtml } from "./games/fizzle/common";
import { numCard } from "./games/hush/common";
import { pcardEl } from "./playingCards";
import { AVATARS } from "../shared/common";
import { createRoom, roomExists, saveAvatar, savedAvatar, saveName, savedName } from "./net";
import { mountPhone } from "./shell/phone";
import { mountTv } from "./shell/tv";
import { $, avatarPicker, esc, toast } from "./ui";

// Routes (query-string based so it works as a plain static site):
//   /                 home: host, join, or watch a table from another screen
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
  let pickedAvatar = savedAvatar() ?? AVATARS[Math.floor(Math.random() * AVATARS.length)]!;
  root.innerHTML = `
  <div class="home">
    <div class="home-hero">
      <div class="hero-cards" aria-hidden="true"></div>
      <div class="logo logo-xl">Oh<span>No!</span></div>
      <p class="tagline">Cozy party card games for one TV and a room full of phones.</p>
    </div>
    <div class="home-panels ${joining ? "joining" : ""}">
      <form class="panel" id="join-form" autocomplete="off">
        <h2>Join a game</h2>
        <label>Your name<input id="name" maxlength="14" required placeholder="e.g. Grandma Jo" value="${esc(savedName())}" autocapitalize="words" enterkeyhint="next"></label>
        <div class="pick-label">Your picture</div>
        ${avatarPicker(pickedAvatar)}
        <label>Room code<input id="code" maxlength="4" required placeholder="ABCD" value="${esc(prefill)}" autocapitalize="characters" inputmode="text" enterkeyhint="go"></label>
        <button class="btn btn-primary btn-xl wide" type="submit">Pull up a chair</button>
      </form>
      <div class="panel panel-host">
        <h2>On the TV?</h2>
        <p class="muted">Open this page on the big screen and start a table. Everyone joins with their phone.</p>
        <button class="btn btn-ghost btn-xl wide" id="host-btn">Host on this screen</button>
        <div class="or-line"><span>or watch a table already going</span></div>
        <form class="watch-form" id="watch-form" autocomplete="off">
          <label>Room code<input id="watch-code" class="code-input" maxlength="4" required placeholder="ABCD" autocapitalize="characters" inputmode="text" enterkeyhint="go"></label>
          <button class="btn btn-ghost wide" type="submit">Watch table</button>
        </form>
        <p class="muted small">Far away? Put the table on your own screen, then join on your phone with the same code.</p>
      </div>
    </div>
  </div>`;

  // A decorative fan showcasing all five games in the hub.
  const fan = root.querySelector(".hero-cards")!;
  const htmlEl = (html: string) => {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild as HTMLElement;
  };
  const heroCards: HTMLElement[] = [
    htmlEl(numCard(24, "hero-card")),
    ecardEl({ id: -2, suit: "H", rank: 11 }, "hero-card"),
    cardEl({ id: -3, color: "wild", value: "wild" }, "hero-card"),
    pcardEl({ id: -4, suit: null, rank: 0 }, "hero-card"),
    htmlEl(fcardHtml({ kind: "toss" }, "hero-card")),
  ];
  heroCards.forEach((el, idx) => {
    const i = idx - 2;
    el.style.setProperty("--i", String(i));
    el.style.setProperty("--abs", String(Math.abs(i)));
    fan.append(el);
  });

  if (joining && savedName()) ($("#join-form button[type=submit]") as HTMLButtonElement).focus({ preventScroll: true });
  else if (!joining && savedName()) ($("#code") as HTMLInputElement).focus({ preventScroll: true });
  else ($("#name") as HTMLInputElement).focus({ preventScroll: true });

  root.querySelector(".avatar-picker")!.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-avatar]");
    if (!btn) return;
    pickedAvatar = btn.dataset.avatar!;
    root.querySelectorAll(".avatar-choice").forEach((b) => {
      b.classList.toggle("on", b === btn);
      b.setAttribute("aria-checked", String(b === btn));
    });
  });

  const codeInput = $("#code") as HTMLInputElement;
  codeInput.addEventListener("input", () => (codeInput.value = norm(codeInput.value)));

  $("#join-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    audio.unlock(); // this tap counts as the gesture browsers need before playing sound
    const name = ($("#name") as HTMLInputElement).value.trim();
    const code = norm(codeInput.value);
    if (!name) return toast("Pop your name in first.");
    if (code.length !== 4) return toast("Room codes are 4 letters — check the TV.");
    if (!(await roomExists(code).catch(() => false))) return toast("Can't find that room. Check the code on the TV.", "error");
    saveName(name);
    saveAvatar(pickedAvatar);
    history.replaceState(null, "", `/?play=${code}`);
    mountPhone(root, code, name);
  });

  // Watch someone else's table on this screen (a friend or family member somewhere else).
  const watchInput = $("#watch-code") as HTMLInputElement;
  watchInput.addEventListener("input", () => (watchInput.value = norm(watchInput.value)));
  $("#watch-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    audio.unlock(); // the TV plays music; this click lets it
    const code = norm(watchInput.value);
    if (code.length !== 4) return toast("Room codes are 4 letters. Ask whoever's hosting.");
    if (!(await roomExists(code).catch(() => false))) return toast("Can't find that room. Check the code on the TV.", "error");
    history.replaceState(null, "", `/?tv=${code}`);
    mountTv(root, code);
    document.documentElement.requestFullscreen?.().catch(() => {});
  });

  $("#host-btn").addEventListener("click", async (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    audio.unlock(); // start the TV's audio from this click
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
