/* friends.ts – sidebar with two-click “Remove friend” confirmation  */
/* =================================================================*/

import { HOST } from "./config.js";
import { openFriendStats } from "./friendstats.js";

/* map friendId → <span.status-dot> for live updates */
const statusDots = new Map<number, HTMLSpanElement>();

/* 2 ░ helpers ------------------------------------------------------*/
function getAuthHeader(): HeadersInit {
    const t = localStorage.getItem("token");
    return t ? { Authorization: `Bearer ${t}` } : {};
}

function showToast(msg: string, isError = false): void {
    const t = document.getElementById("friends-toast")!;
    t.textContent = msg;
    t.classList.toggle("bg-red-500", isError);
    t.classList.toggle("bg-emerald-500", !isError);
    t.classList.add("opacity-100");
    t.classList.remove("pointer-events-none");
    setTimeout(() => {
        t.classList.remove("opacity-100");
        t.classList.add("pointer-events-none");
    }, 2_000);
}


/* ░ API ──────────────────────────────────────────────────────────── */
export async function fetchFriends(): Promise<any[]> {
  const res = await fetch(`http://${HOST}:3000/api/users/me/friends`, {
    headers: getAuthHeader(),
  });

  if (!res.ok) {
    /* optional: log the full response for debugging */
    console.error("fetchFriends()", res.status, await res.text());
    throw new Error("Failed to load friends.");
  }

  return (await res.json()) as any[];
}


    const ASTRONAUT =
    "https://img.freepik.com/free-vector/" +
    "cute-astronaut-playing-vr-game-with-controller-cartoon-vector-icon-" +
    "illustration-science-technology_138676-13977.jpg?semt=ais_hybrid&w=740";

    export function resolveAvatar(raw?: string | null): string {
    const val = raw?.trim() ?? "";
    if (!val) return ASTRONAUT;                   // empty  → robot
    if (/^https?:\/\//i.test(val)) return val;   // full URL → use as-is
    return `http://${HOST}:3000/uploads/${val}`; // relative → prepend
    }

function updateDot(el: HTMLSpanElement, online: boolean): void {
  if (online) {
    el.classList.remove("bg-red-500", "animate-none");
    el.classList.add("bg-emerald-400", "animate-pulse");
  } else {
    el.classList.remove("bg-emerald-400", "animate-pulse");
    el.classList.add("bg-red-500");           // ← red when offline
  }
}


/* 3 ░ render list --------------------------------------------------*/
function render(friends: any[]): void {
    const list = document.getElementById("friends-list")!;
    const tpl = document.getElementById(
        "friend-row-template"
    ) as HTMLTemplateElement;
    list.innerHTML = "";

    if (!friends.length) {
        list.innerHTML = `<p class="text-white/70">You have no friends yet.</p>`;
        return;
    }

    friends.forEach((f) => {
        /* ─ clone row template */
        const frag = tpl.content.cloneNode(true) as DocumentFragment;
        const row = frag.firstElementChild as HTMLDivElement;

        /* numeric id expected by backend */
        const friendId = Number(f.userId ?? f.id ?? f.friend_id ?? NaN);
        if (Number.isNaN(friendId)) return; // skip bad rows

        /* fill visuals */
        (row.querySelector(".avatar") as HTMLImageElement).src = resolveAvatar(f.avatar_url);

        (row.querySelector(".username") as HTMLElement).textContent =
            f.username;
        (row.querySelector(".email") as HTMLElement).textContent = f.email;
        /* ─ ONLINE DOT ─────────────────────────────────────────────── */
        const dot = row.querySelector(".status-dot") as HTMLSpanElement;
        statusDots.set(friendId, dot);                    // remember it

        const online = Boolean(f.online ?? f.isOnline);   // back-end flag
        updateDot(dot, online);


        /* ─ DOM refs */
        const moreBtn = row.querySelector<HTMLButtonElement>(".more-btn")!;
        const submenu = row.querySelector<HTMLDivElement>(".submenu")!;
        const confirm = row.querySelector<HTMLDivElement>(".confirm-box")!;
        const removeBtn = row.querySelector<HTMLButtonElement>(".remove-btn")!;
        const stats = row.querySelector<HTMLButtonElement>(".stats-btn")!;
        const yesBtn = row.querySelector<HTMLButtonElement>(".yes-btn")!;
        const noBtn = row.querySelector<HTMLButtonElement>(".no-btn")!;

        /* submenu toggle */
        let open = false;
        moreBtn.addEventListener("click", () => {
            open = !open;
            submenu.classList.toggle("hidden", !open);
            confirm.classList.add("hidden");
            row.style.maxHeight = open
                ? submenu.scrollHeight + 56 + "px"
                : "56px";
            moreBtn.textContent = open ? "less ▲" : "more ▾";
        });

        /* step-1  Remove → show confirm bar */
        stats.addEventListener("click", () => {
            openFriendStats(friendId, f);
        });

        

        /* step-1  Remove → show confirm bar */
        removeBtn.addEventListener("click", () => {
            submenu.classList.add("hidden");
            confirm.classList.remove("hidden");
            row.style.maxHeight = confirm.scrollHeight + 56 + "px";
        });

        /* step-2a User cancels */
        noBtn.addEventListener("click", () => {
            confirm.classList.add("hidden");
            submenu.classList.remove("hidden");
            row.style.maxHeight = submenu.scrollHeight + 56 + "px";
        });

        /* step-2b User confirms */
        yesBtn.addEventListener("click", async () => {
            row.style.opacity = "0.6";
            yesBtn.disabled = noBtn.disabled = true;

            try {
                const r = await fetch(
                    `http://${HOST}:3000/api/users/remove-friend/${friendId}`,
                    { method: "DELETE", headers: getAuthHeader() }
                );
                const body = await r.json().catch(() => ({}));
                if (!r.ok) throw new Error(body.error || r.statusText);

                /* success – slide up & toast */
                row.style.maxHeight = "0";
                row.style.opacity = "0";
                setTimeout(() => {
                    row.remove();
                    if (!list.querySelector(".bg-white/10"))
                        list.innerHTML = `<p class="text-white/70">You have no friends yet.</p>`;
                }, 300);
                showToast(`${f.username} has been removed.`, false);
            } catch (e: any) {
                row.style.opacity = "1";
                yesBtn.disabled = noBtn.disabled = false;
                showToast(`Could not remove ${f.username}: ${e.message}`, true);
            }
        });

        list.appendChild(frag);
    });
    
}

/* 4 ░ public loader + auto-init ----------------------------------*/
export async function loadFriendsSidebar(): Promise<void> {
    const list = document.getElementById("friends-list")!;
    list.innerHTML = `<p class="text-white/70">Loading…</p>`;
    try {
        render(await fetchFriends());
    } catch (e: any) {
        list.innerHTML = `<p class="text-red-400">${
            e?.error ?? "Failed to load friends."
        }</p>`;
    }
}

/* ░░ LIVE ONLINE STATUS ░░
 * Back-end sends:  { "userId": 17, "online": true }
 * Endpoint:  ws://HOST:3000/ws/status   (token in query for auth)
 */
function initStatusSocket(): void {
    const token = localStorage.getItem("token");
    if (!token) return;

    const ws = new WebSocket(`ws://${HOST}:3000/ws/status?token=${token}`);

    ws.onmessage = (ev) => {
        try {
            const { userId, online } = JSON.parse(ev.data);
            const dot = statusDots.get(Number(userId));
            if (dot) updateDot(dot, online);
        } catch {
            /* silently ignore malformed events */
        }
    };

    ws.onerror = console.error;
}

(async () => {
  if (!localStorage.getItem("token")) return;

  await loadFriendsSidebar();   // list ready – statusDots filled
  initStatusSocket();           // start listening
})();

/* ------------------------------------------------------------------
 * Refresh-button handler
 * ----------------------------------------------------------------*/
const refreshBtn = document.getElementById('friends-refresh') as HTMLButtonElement | null;

if (refreshBtn) {
  refreshBtn.addEventListener('click', async () => {
    /* quick visual feedback – spin while we’re loading */
    refreshBtn.classList.add('animate-spin');
    refreshBtn.disabled = true;

    try {
      await loadFriendsSidebar();      // already shows “Loading…” etc.
    } finally {
      refreshBtn.disabled = false;
      refreshBtn.classList.remove('animate-spin');
    }
  });
}

export function initFriendsSidebarToggle(): void {
    const sidebar = document.getElementById(
        "friends-sidebar"
    ) as HTMLElement | null;
    const btn = document.getElementById("friends-toggle") as HTMLElement | null;
    if (!sidebar || !btn) return;

    let open = false;

    const apply = () => {
        sidebar.classList.toggle("translate-x-full", !open);
        btn.innerHTML = open ? "❯" : "❮";
    };

    /* click-toggle */
    btn.addEventListener("click", () => { open = !open; apply(); });

    /* NEW: Esc key closes the sidebar if it’s open */
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && open) {
        open = false;
        apply();
        }
    });

    apply();
}

if (document.readyState !== "loading") {
    initFriendsSidebarToggle();
} else {
    document.addEventListener("DOMContentLoaded", initFriendsSidebarToggle);
}
