/* friends.ts – sidebar with two-click “Remove friend” confirmation  */
/* =================================================================*/

import { HOST } from "./config.js";

/* 1 ░ mock toggle + dummy users -----------------------------------*/
const USE_MOCK_DATA = false;

const MOCK_FRIENDS = [
    {
        userId: 1,
        username: "Aya",
        email: "aya@example.com",
        avatar_url: "https://i.pravatar.cc/40?u=aya",
    },
    {
        userId: 2,
        username: "Karim",
        email: "karim@example.com",
        avatar_url: "https://i.pravatar.cc/40?u=karim",
    },
    {
        userId: 3,
        username: "Maya",
        email: "maya@example.com",
        avatar_url: "https://i.pravatar.cc/40?u=maya",
    },
];

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

async function fetchFriends(): Promise<any[]> {
    if (USE_MOCK_DATA) return MOCK_FRIENDS;

    try {
        const r = await fetch(`http://${HOST}:3000/api/users/me/friends`, {
            headers: getAuthHeader(),
        });
        if (!r.ok) throw await r.json();
        return (await r.json()) as any[];
    } catch {
        return MOCK_FRIENDS; // offline fallback
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
        (row.querySelector(".avatar") as HTMLImageElement).src =
            f.avatar_url ?? "https://i.pravatar.cc/40?u=placeholder";
        (row.querySelector(".username") as HTMLElement).textContent =
            f.username;
        (row.querySelector(".email") as HTMLElement).textContent = f.email;

        /* ─ DOM refs */
        const moreBtn = row.querySelector<HTMLButtonElement>(".more-btn")!;
        const submenu = row.querySelector<HTMLDivElement>(".submenu")!;
        const confirm = row.querySelector<HTMLDivElement>(".confirm-box")!;
        const removeBtn = row.querySelector<HTMLButtonElement>(".remove-btn")!;
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

if (localStorage.getItem("token")) loadFriendsSidebar();

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

    btn.addEventListener("click", () => {
        open = !open;
        apply();
    });

    apply();
}

if (document.readyState !== "loading") {
    initFriendsSidebarToggle();
} else {
    document.addEventListener("DOMContentLoaded", initFriendsSidebarToggle);
}
