/* nav.ts – navbar, overlays, tabs, play-flow
 * ------------------------------------------
 *  Inline-profile editor code was moved to profile-setting.ts
 */
import { showOverlay, hideOverlay }   from './tournament.js'; 
import { pushHome , pushOverlay} from "./nav_history.js";
import { initStatsTab }          from "./stats.js";
import { initHistoryTab }        from "./history.js";
import { populateProfileViews,
  setActiveTab, 
  refreshProfileHeader }          from "./profile-setting.js";
  import "./welcome.js";
  import { initRemoteModal } from './main.js';
  import { HOST } from './config.js';
  import { initTournamentModal } from "./tournament.js";


  /* cache the two DOM nodes once */
const profileOv  = document.getElementById('profile-overlay')!;    // wrapper  (class="overlay")
const profileBox = document.getElementById('profile-container')!;  // inner panel

/* ───── shorthand ───── */
const $ = <T extends HTMLElement = HTMLElement>(sel: string) =>
  document.querySelector<T>(sel);

/* =========================================================================
 *  NAVBAR  (burger, mobile dropdown)
 * =======================================================================*/
const navMenu   = $("#nav-menu");
const BURGER    = $("#burger");
const MOBILE_BP = 640;
const DROP = [
  "flex","flex-col","absolute","left-0","right-0","top-16",
  "w-screen","space-y-4","items-center","py-4","bg-violet-950/95"
] as const;

function applyMobile(on: boolean) {
  if (!navMenu) return;
  DROP.forEach(c => navMenu.classList[on ? "add" : "remove"](c));
}
function openMenu()  { if (navMenu){ navMenu.classList.remove("hidden"); applyMobile(true);} }
function closeMenu() { if (navMenu){ applyMobile(false); navMenu.classList.add("hidden");} }

BURGER?.addEventListener("click", () =>
  (navMenu && navMenu.classList.contains("hidden") ? openMenu() : closeMenu())
);
navMenu?.querySelectorAll("button").forEach(btn =>
  btn.addEventListener("click", () => innerWidth < MOBILE_BP && closeMenu())
);
addEventListener("resize", () => {
  if (!navMenu) return;
  if (innerWidth >= MOBILE_BP) { navMenu.classList.remove("hidden"); applyMobile(false); }
  else if (navMenu.classList.contains("hidden")) applyMobile(false);
  else applyMobile(true);
});

/* ── Friendly toast used only for avatar messages ─────────────── */
function flashAvatarWarn(text: string): void {
  let n = document.getElementById("avatar-warn") as HTMLDivElement | null;

  if (!n) {
    n = document.createElement("div");
    n.id = "avatar-warn";
    n.className =
      "fixed top-6 left-1/2 -translate-x-1/2 z-[80] " +
      "px-4 py-2 rounded-full text-sm font-medium " +
      "bg-emerald-500/90 text-white shadow-lg " +   // ← here
      "opacity-0 pointer-events-none transition-opacity duration-300";
    document.body.appendChild(n);
  }

  n.textContent = text;

  /* trigger fade-in */
  n.classList.remove("opacity-0");

  /* auto-hide after 2 s */
  setTimeout(() => n!.classList.add("opacity-0"), 2_000);
}


/* PROFILE OVERLAY – avatar upload */
const avatarInput = document.getElementById('avatar-input') as HTMLInputElement | null;
const avatarImg   = document.getElementById('avatar-img')   as HTMLImageElement  | null;

/* --------------- remove-avatar button -------------------------- */
const removeBtn = document.getElementById('avatar-remove-btn') as HTMLButtonElement | null;

if (removeBtn) {
  removeBtn.addEventListener('click', async () => {
    /* 1) optimistic UI */
    const FALLBACK =
      "https://img.freepik.com/free-vector/" +
      "cute-astronaut-playing-vr-game-with-controller-cartoon-vector-icon-" +
      "illustration-science-technology_138676-13977.jpg?semt=ais_hybrid&w=740";
    if (avatarImg) avatarImg.src = FALLBACK;
    if (avatarInput) avatarInput.value = "";

    /* 2) API call */
    const token = localStorage.getItem('token');
    const res = await fetch(`http://${HOST}:3000/api/users/avatar`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      console.error('Avatar delete failed');
      return;
    }

    /* 3) update localStorage cache */
    const user = JSON.parse(localStorage.getItem('user') ?? '{}');
    user.avatar_url = null;
    localStorage.setItem('user', JSON.stringify(user));
    flashAvatarWarn("Avatar removed 👌");
  });
}


if (avatarInput) {
  avatarInput.addEventListener('change', async (ev) => {
    const file = (ev.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;

    /* —— 1. optimistic preview —— */
    if (avatarImg) avatarImg.src = URL.createObjectURL(file);

    /* —— 2. upload to backend —— */
    const fd = new FormData();
    fd.append('avatar', file);

    const token = localStorage.getItem('token');
    const res = await fetch(`http://${HOST}:3000/api/users/avatar`, {
      method: 'PUT',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });

    if (!res.ok) {
      console.error('Avatar upload failed');            // dev aid
      return;
    }

    const { avatar_url } = await res.json();             // avatars/xyz.png
    const fullUrl = `http://${HOST}:3000/uploads/${avatar_url}`;

    /* —— 3. update all cached places —— */
    if (avatarImg) avatarImg.src = fullUrl;

    const user = JSON.parse(localStorage.getItem('user') ?? '{}');
    user.avatar_url = avatar_url;                        // keep *relative* in LS
    localStorage.setItem('user', JSON.stringify(user));
    flashAvatarWarn("Avatar updated 👍");
  });
}


/* tabs */
const tabBtns   = document.querySelectorAll<HTMLButtonElement>("#profile-tabs .tab-btn");
const panels    = document.querySelectorAll<HTMLElement>      ("#tab-panels .panel");
const underline = $("#tab-underline")!;

function updateUnderline(): void {
  const active = document.querySelector<HTMLButtonElement>(
    "#profile-tabs .tab-btn.text-white"
  );
  if (active) {
    underline.style.width     = `${active.offsetWidth}px`;
    underline.style.transform = `translateX(${active.offsetLeft}px)`;
  }
}

tabBtns.forEach(btn =>
  btn.addEventListener("click", () => {
    tabBtns.forEach(b => {
      b.classList.toggle("text-white",     b === btn);
      b.classList.toggle("text-white/70",  b !== btn);
    });
    underline.style.width      = `${btn.offsetWidth}px`;
    underline.style.transform  = `translateX(${btn.offsetLeft}px)`;
    panels.forEach(p => p.classList.toggle("hidden", p.dataset.panel !== btn.dataset.tab));
    if (btn.dataset.tab === "stats")   initStatsTab();
    if (btn.dataset.tab === "history") initHistoryTab();
  })
);
addEventListener("resize", updateUnderline);

/* open / close overlay */
$("#nav-profile")?.addEventListener("click", () => {
  populateProfileViews();        // fresh user data
  setActiveTab("info");          // always start on Info
  showOverlay(profileOv, profileBox);
  //pushOverlay('profile-overlay', 'profile-container');               
  updateUnderline();
  refreshProfileHeader();
});


/* close via × button */
document.getElementById('profile-close')?.addEventListener('click', () => {
  hideOverlay(profileOv, profileBox);   // fade/scale-out
  pushHome();                           // history: back to home
});

/* close via Esc key (only if overlay is visible) */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !profileOv.classList.contains('hidden')) {
    hideOverlay(profileOv, profileBox);
    pushHome();
  }
});

/* =========================================================================
 *  GENERIC OVERLAY HELPERS
 * =======================================================================*/
function show(ov: HTMLElement, inner?: HTMLElement) {
  ov.classList.remove("hidden","opacity-0","animate__fadeOut","animate__animated");
  if (inner) inner.classList.remove("scale-90");
  ov.classList.add("opacity-0");
  requestAnimationFrame(() => {
    ov.classList.add("animate__animated","animate__fadeIn");
    ov.classList.remove("opacity-0");
  });
}
function hide(ov: HTMLElement, inner?: HTMLElement) {
  if (ov.classList.contains("hidden")) return;
  ov.classList.remove("animate__fadeIn");
  ov.classList.add   ("animate__fadeOut");
  if (inner) inner.classList.add("scale-90");
  ov.addEventListener("animationend", () => {
    ov.classList.add("hidden","opacity-0");
    ov.classList.remove("animate__animated","animate__fadeOut");
  }, { once:true });
}

/* =========================================================================
 *  PLAY → DIFFICULTY FLOW   (unchanged)
 * =======================================================================*/
const playOv  = document.getElementById('play-overlay')!;    // wrapper
const playBox = document.getElementById('play-container')!;  // inner panel

$("#nav-play")?.addEventListener("click", () => show(playOv));

/* CLOSE via × button */
document.getElementById('play-close')?.addEventListener('click', () => {
  hideOverlay(playOv, playBox);   // fade/scale-out both layers
  pushHome();                     // history: overlay → home
});

/* CLOSE via Esc key */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !playOv.classList.contains('hidden')) {
    hideOverlay(playOv, playBox);
    pushHome();
  }
});

document.querySelectorAll<HTMLButtonElement>('.mode-card').forEach(card => {
  card.addEventListener('click', () => {
    const mode = card.dataset.mode as
      | 'ai' | 'offline' | 'remote' | 'tournament';
    hide(playOv);
    if (mode === 'ai') {
      show($('#difficulty-overlay')!, $('#difficulty-container')!);
    } else if (mode === 'offline') {
      (window as any).setGameMode('pvp');
    }
	else if (mode === 'remote') {
      initRemoteModal();
    }
	else {
      initTournamentModal();
    }
  });
});

const diffOv  = $("#difficulty-overlay")!;
const diffBox = $("#difficulty-container")!;
$("#difficulty-close")?.addEventListener("click", () => hide(diffOv, diffBox));
addEventListener("keydown", e => e.key === "Escape" && hide(diffOv, diffBox));
document.querySelectorAll<HTMLButtonElement>(".diff-btn").forEach(btn =>
  btn.addEventListener("click", () => {
    const diff = btn.dataset.diff as "easy"|"medium"|"hard";
    hide(diffOv, diffBox);
    const rate = diff === "easy" ? 1.5 : diff === "medium" ? 1 : 0.5;
    (window as any).setAIRefresh(rate);
    (window as any).setGameMode("ai");
  })
);

//TWO FACTOR AUTHENTICATION
document.getElementById('remove-2fa-btn')?.addEventListener('click', () => {
  (document.getElementById('remove-2fa-modal') as HTMLElement).classList.remove('hidden');
  (document.getElementById('remove-2fa-token-input') as HTMLInputElement).value = '';
  (document.getElementById('remove-2fa-error') as HTMLElement).textContent = '';
});

document.getElementById('remove-2fa-cancel-btn')?.addEventListener('click', () => {
  (document.getElementById('remove-2fa-modal') as HTMLElement).classList.add('hidden');
});

document.getElementById('remove-2fa-confirm-btn')?.addEventListener('click', async () => {
  const token = (document.getElementById('remove-2fa-token-input') as HTMLInputElement).value;
  const errorEl = document.getElementById('remove-2fa-error')!;
  const tokenStorage = localStorage.getItem('token');

  try {
    const res = await fetch(`http://${HOST}:3000/api/2fa/remove`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenStorage}`
      },
      body: JSON.stringify({ token })
    });

    const result = await res.json();
    if (!res.ok) {
      errorEl.textContent = result.error || 'Something went wrong.';
      return;
    }

    // Success
    (document.getElementById('remove-2fa-modal') as HTMLElement).classList.add('hidden');
    refreshProfileHeader(); // Refresh UI
  } catch (err) {
    errorEl.textContent = 'Network error';
  }
});
