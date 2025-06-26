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

/* =========================================================================
 *  PROFILE OVERLAY  (tabs, avatar, etc.)
 * =======================================================================*/
//const profileOv = $("#profile-overlay")!;
$("#avatar-input")?.addEventListener("change", ev => {
  const f = (ev.currentTarget as HTMLInputElement).files?.[0];
  if (f) $<HTMLImageElement>("#avatar-img")!.src = URL.createObjectURL(f);
});

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
    const res = await fetch(`https://${HOST}:8443/api/2fa/remove`, {
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

