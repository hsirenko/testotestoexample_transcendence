/* tournament.ts – local-only 4-player bracket with a shareable code  */
/* ----------------------------------------------------------------- */

export { showOverlay, hideOverlay };

const ov          = document.getElementById("tournament-overlay")   as HTMLElement;
const box         = document.getElementById("tournament-container") as HTMLElement;

const closeBtn    = document.getElementById("tour-close")!;
const stepMain    = document.getElementById("tour-step-main")!;
const stepCreated = document.getElementById("tour-step-created")!;
const stepJoin    = document.getElementById("tour-step-join")!;
const stepBracket = document.getElementById("tour-step-bracket")!;

const btnCreate   = document.getElementById("tour-create-btn")!;
const btnJoin     = document.getElementById("tour-join-btn")!;
const btnCopy     = document.getElementById("tour-copy-code")!;
const btnConfirm  = document.getElementById("tour-confirm-join-btn")!;

const createdCode = document.getElementById("tour-created-code")!;
const codeInput   = document.getElementById("tour-code-input")  as HTMLInputElement;
const errorEl     = document.getElementById("tour-error")!;
const bracketHint = document.getElementById("bracket-hint")!;

/* seven visible chips: 0-3 players • 4-5 winners • 6 champion */
const slotEls = Array.from(
  document.querySelectorAll<HTMLDivElement>('[data-slot]')
);

/* ───── types & state ───── */
export interface Player { id: number; username: string; }
interface Tournament    { id: string; players: Player[]; }

let current: Tournament | null = null;
const YOU = localStorage.getItem("username") ?? "mohamibr";

/* ───── helpers ───── */
function genCode(): string {
  /* Generate 8 chars (A-Z, 2-9) with crypto if possible, otherwise Math.random */
  const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0,O,1,I
  let code = "";

  /* secure, modern path */
  if (window.crypto?.getRandomValues) {
    const bytes = new Uint8Array(8);
    window.crypto.getRandomValues(bytes);
    bytes.forEach(b => (code += ALPHA[b % ALPHA.length]));
    return code;
  }

  /* fallback for HTTP or very old browsers */
  for (let i = 0; i < 8; i++) {
    code += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  }
  return code;
}

function copyToClipboard(text: string) {
  /* modern path – works only in secure contexts */
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => {});
    return;
  }

  /* fallback – create a hidden textarea, execCommand("copy") */
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); } catch { /* ignore */ }
  document.body.removeChild(ta);
}


/* ───── overlay animation helpers (unchanged) ───── */
function showOverlay(ovEl: HTMLElement, inner?: HTMLElement) {
  ovEl.classList.remove("hidden", "opacity-0", "animate__fadeOut", "animate__animated");
  ovEl.classList.add("animate__animated", "animate__fadeIn", "animate__fastest");

  inner?.classList.remove("animate__zoomOutUp", "animate__animated");
  inner?.classList.add("animate__animated", "animate__zoomInDown", "animate__fastest");
}

function hideOverlay(ovEl: HTMLElement, inner?: HTMLElement) {
  if (ovEl.classList.contains("hidden")) return;

  ovEl.classList.replace("animate__fadeIn", "animate__fadeOut");
  ovEl.classList.add("animate__fastest");

  inner?.classList.replace("animate__zoomInDown", "animate__zoomOutUp");
  inner?.classList.add("animate__fastest");

  inner?.addEventListener(
    "animationend",
    () => {
      ovEl.classList.add("hidden", "opacity-0");
      ovEl.classList.remove("animate__animated", "animate__fadeOut");
      inner?.classList.remove("animate__animated", "animate__zoomOutUp");
      resetView();
    },
    { once: true },
  );
}

/* ───── view reset ───── */
function resetView() {
  errorEl.textContent = "";
  codeInput.value     = "";
  stepMain.classList.remove("hidden");
  stepCreated.classList.add("hidden");
  stepJoin.classList.add("hidden");
  stepBracket.classList.add("hidden");
}

/* ───── public entry-point ───── */
export function initTournamentModal(): void {
  showOverlay(ov, box);
}

/* painter in tournament.ts */
function updateBracket(players: Player[]) {

  /* helper – paint ALL matching elements */
  const paint = (slot: number, txt: string) =>
    document
      .querySelectorAll<HTMLDivElement>(`[data-slot="${slot}"]`)
      .forEach(el => el.textContent = txt);

  /* seeds 0-3 */
  for (let i = 0; i < 4; i++) {
    paint(i, players[i]?.username.toUpperCase() ?? "PLAYER NAME");
  }

  /* winners & champion fade-in */
  document
    .querySelectorAll<HTMLDivElement>(`[data-slot="4"],
                                       [data-slot="5"],
                                       [data-slot="6"]`)
    .forEach(el => {
      if (el.textContent !== "—")
        el.classList.remove("opacity-0", "translate-x-4");
    });

  /* lobby hint */
  const remain = 4 - players.length;
  bracketHint.textContent =
    remain > 0 ? `Waiting for ${remain} more player${remain > 1 ? "s" : ""}…`
               : "Bracket ready – good luck!";
}


/* ───── wiring ───── */
closeBtn.addEventListener("click", () => hideOverlay(ov, box));
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && !ov.classList.contains("hidden")) hideOverlay(ov, box);
});

/* CREATE */
btnCreate.addEventListener("click", () => {
  current = { id: genCode(), players: [{ id: Date.now(), username: YOU }] };

  createdCode.textContent = current.id;
  copyToClipboard(current.id);          // helper from previous fix

  /* <<< the only new lines >>> */
  stepMain.classList.add("hidden");
  stepCreated.classList.remove("hidden");
  stepBracket.classList.remove("hidden");   // ← reveal bracket immediately
  updateBracket(current.players);           // ← paint your own name
});


/* copy again */
btnCopy.addEventListener("click", () =>
  copyToClipboard(createdCode.textContent ?? "players_name"),
);

/* JOIN */
btnJoin.addEventListener("click", () => {
  stepMain.classList.add("hidden");
  stepJoin.classList.remove("hidden");
  codeInput.focus();
});

btnConfirm.addEventListener("click", () => {
  const code = codeInput.value.trim().toUpperCase();
  if (!code) { errorEl.textContent = "Please enter a code."; return; }
  if (!current || current.id !== code) {
    errorEl.textContent = "Invalid code."; return;
  }
  if (current.players.some(p => p.username === YOU)) {
    errorEl.textContent = "You are already in."; return;
  }
  if (current.players.length >= 4) {
    errorEl.textContent = "Tournament is full."; return;
  }

  current.players.push({ id: Date.now(), username: YOU });
  stepJoin.classList.add("hidden");
  stepBracket.classList.remove("hidden");
  updateBracket(current.players);
});

/* ───── optional external hooks (for WebSocket integration later) ───── */
(window as any).tourAddPlayer = (username: string) => {
  if (!current || current.players.length >= 4) return;
  current.players.push({ id: Date.now(), username });
  if (!stepBracket.classList.contains("hidden")) updateBracket(current.players);
};

(window as any).tourSetWinner = (semi: 0 | 1, user: string) => {
  const slot = semi === 0 ? 4 : 5;
  slotEls[slot].textContent = user.toUpperCase();
  updateBracket(current?.players ?? []);
};

(window as any).tourSetChampion = (user: string) => {
  slotEls[6].textContent = user.toUpperCase();
  slotEls[6].classList.remove("opacity-0", "translate-x-4");
  slotEls[6].classList.add("pulse");
};
