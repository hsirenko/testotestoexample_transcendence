// notifications.ts – handles bell‑icon dropdown + in‑app notifications
// ---------------------------------------------------------------
// This module is completely self‑contained.  Simply import it once from any
// bootstrap file (e.g. nav.ts) or reference the compiled JS in <script type="module" …>.
// It will wire up the bell button (#nav-notif), render the dropdown panel
// (#notif-panel) and keep the unread badge (#notif-badge) in sync.

import { HOST } from "./config.js";

/* ------------------------------------------------------------------
 * Types & state
 * ----------------------------------------------------------------*/
interface Notification {
  id: number;          // unique id – milliseconds timestamp is fine
  text: string;        // main message
  date: string;        // ISO date string (for display only)
  read: boolean;       // unread ↔ read status
}

let notifications: Notification[] = [
  // newest first
  {
    id:   Date.now() - 2_000,
    text: "Mheisenberg accepted your friend request.",
    date: new Date(Date.now() - 2_000).toISOString(),
    read: false,
  },
  {
    id:   Date.now() - 86_400_000,
    text: "AI training mode unlocked by the one and only the AI eng. mohamibr.",
    date: new Date(Date.now() - 86_400_000).toISOString(),
    read: true,
  },
  {
    id:   Date.now() - 172_800_000,
    text: "Server maintenance tomorrow 2 AM UTC.",
    date: new Date(Date.now() - 172_800_000).toISOString(),
    read: true,
  },
];



/* ------------------------------------------------------------------
 * DOM handles (all exist in index.html)
 * ----------------------------------------------------------------*/
const bell   = document.querySelector<HTMLButtonElement>("#nav-notif");
const panel  = document.querySelector<HTMLDivElement>("#notif-panel");
const badge  = document.querySelector<HTMLSpanElement>("#notif-badge");

/* ------------------------------------------------------------------
 *  Helpers
 * ----------------------------------------------------------------*/
function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day:   "numeric",
    hour:  "2-digit",
    minute:"2-digit",
  });
}

function renderPanel(): void {
  if (!panel) return;
  panel.innerHTML = "";

  if (notifications.length === 0) {
    const empty = document.createElement("p");
    empty.className = "text-center text-sm text-white/70";
    empty.textContent = "No notifications yet.";
    panel.appendChild(empty);
    return;
  }

  notifications.forEach(n => {
    const row = document.createElement("div");
    row.className = [
      "flex", "items-start", "gap-3", "p-3", "rounded-lg",
      "bg-white/5", "hover:bg-white/10", "transition"
    ].join(" ");
    if (!n.read) row.classList.add("border-l-4", "border-amber-500");

    /* icon */
    const icon = document.createElement("span");
    icon.textContent = "🔔";

    /* text + time */
    const wrap = document.createElement("div");
    const msg  = document.createElement("p");
    msg.textContent = n.text;
    const time = document.createElement("time");
    time.className = "block text-xs text-white/60";
    time.textContent = fmtDate(n.date);
    wrap.append(msg, time);

    row.append(icon, wrap);
    row.addEventListener("click", () => {
      n.read = true;
      updateBadge();
      renderPanel();
    });

    panel.appendChild(row);
  });
}

function updateBadge(): void {
  if (!badge) return;
  const unread = notifications.filter(n => !n.read).length;
  badge.textContent = unread.toString();
  badge.style.opacity = unread > 0 ? "1" : "0";
}

/* ------------------------------------------------------------------
 *  Public API – import { pushNotification, fetchNotifications } …
 * ----------------------------------------------------------------*/
export function pushNotification(text: string): void {
  notifications.unshift({
    id: Date.now(),
    text,
    date: new Date().toISOString(),
    read: false,
  });
  updateBadge();
  // If panel is currently open, re‑render it immediately
  if (!panel?.classList.contains("hidden")) renderPanel();
}

export async function fetchNotifications(): Promise<void> {
  try {
    const token = localStorage.getItem("token");
    if (!token) return;
    const res = await fetch(`http://${HOST}:3000/api/notifications`, {
      headers: { "Authorization": `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data: Notification[] = await res.json();
    notifications = data.map(n => ({ ...n, read: false }));
    updateBadge();
  } catch (err) {
    console.error("Failed to fetch notifications", err);
  }
}

/* ------------------------------------------------------------------
 *  Event wiring – open/close dropdown & outside‑click handling
 * ----------------------------------------------------------------*/
bell?.addEventListener("click", ev => {
  ev.stopPropagation();
  panel?.classList.toggle("hidden");
  renderPanel();
  notifications.forEach(n => (n.read = true)); // mark all as read when opened
  updateBadge();
});

document.addEventListener("click", ev => {
  if (!panel || panel.classList.contains("hidden")) return;
  if (!panel.contains(ev.target as Node) && ev.target !== bell) {
    panel.classList.add("hidden");
  }
});

/* ------------------------------------------------------------------
 *  Initialise immediately (e.g. after login)
 * ----------------------------------------------------------------*/
updateBadge();
// Optional: fetchNotifications();
// Example: pushNotification("Welcome back! Good luck in the arena 🏓");
