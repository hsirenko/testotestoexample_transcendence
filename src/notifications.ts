// frontend/src/notifications.ts
// ---------------------------------------------------------------
// This module is completely self‑contained.  Simply import it once from any
// bootstrap file (e.g. nav.ts) or reference the compiled JS in <script type="module" …>.
// It will wire up the bell button (#nav-notif), render the dropdown panel
// (#notif-panel) and keep the unread badge (#notif-badge) in sync.

import { HOST } from "./config.js";
import { loadFriendsSidebar } from "./friends.js";
import {
  ClientMsgJoin,
} from "./types/ws.js";
import { connectWebSocket } from "./main.js";
import { setGameId } from "./main.js";

/* ------------------------------------------------------------------
 * Types & state
 * ----------------------------------------------------------------*/
interface Notification {
  id: number;
  text: string;
  date: string;
  read: boolean;
  type?: 'friend_request' | 'friend_accept' | string;
  reference_id?: number;
}

let notifications: Notification[] = [];

let notifSocket: WebSocket | null = null;


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

/* ─── Friend-request action pills ─────────────────────────────── */
if (n.type === "friend_request" && n.reference_id) {
  /* shared helper for both buttons */
  const respond = async (
    e: MouseEvent,
    action: "accept" | "decline",
    btn: HTMLButtonElement
  ) => {
    e.stopPropagation();
    btn.disabled = true;                     // prevent double-clicks
    const token = localStorage.getItem("token");
    if (!token) return;

    await fetch(`http://${HOST}:3000/api/users/respond-friend`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        request_id: n.reference_id,
        action,                              // "accept" or "decline"
      }),
    });

	// Delete notification from DB
	console.log("xxx: " + n.id);
	console.log("yyy: " + n.reference_id);
	await fetch(`http://${HOST}:3000/api/notifications/${n.id}`, {
		method: "DELETE",
		headers: {
		Authorization: `Bearer ${token}`,
		},
	});

	notifications = notifications.filter(x => x.reference_id !== n.reference_id);

    /* mark as read and refresh UI */
    n.read = true;
    updateBadge();
    renderPanel();
	loadFriendsSidebar();
  };

  /* wrapper so both pills align right with a gap */
  const box = document.createElement("div");
  box.className = "ml-auto flex gap-2";

  /* Accept pill */
  const accept = document.createElement("button");
  accept.textContent = "Accept";
  accept.className =
    "px-3 py-1 rounded-full bg-emerald-500 hover:bg-emerald-600 " +
    "text-sm font-semibold transition";
  accept.onclick = (e) => respond(e, "accept", accept);

  /* Decline pill */
  const decline = document.createElement("button");
  decline.textContent = "Decline";
  decline.className =
    "px-3 py-1 rounded-full bg-rose-500 hover:bg-rose-600 " +
    "text-sm font-semibold transition";
  decline.onclick = (e) => respond(e, "decline", decline);

  box.append(accept, decline);
  row.append(box);
}


    // ────────────────────────────────────────────────────────────────

    // clicking the row (outside the button) marks as read
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
// Optional: 
// Example: pushNotification("Welcome back! Good luck in the arena 🏓");

//MHEISENBERG
// 2. connect to WS so we get new ones in real time
function startNotificationsSocket()
{
	const token = localStorage.getItem('token');
	if (token) {
	  const wsUrl = `ws://${HOST}:3000/ws/notifications?token=${token}`;
	  const me = JSON.parse(localStorage.getItem("user") || "{}");
	  const myUserId = me.id;
	  console.log("player2_id myUserId: " + myUserId);
	  console.log('[notif] connecting to WS at', wsUrl);
	  notifSocket = new WebSocket(wsUrl);
	  notifSocket.onopen = () => console.log('[notif] WS open, readyState=', notifSocket?.readyState);
	  notifSocket.onerror = err => console.log('[notif] WS error', err);
	  notifSocket.onclose = ev => console.log('[notif] WS closed', ev.code, ev.reason);
	  notifSocket.onmessage = async ev => {
		  console.log('[notif] WS message received raw:', ev.data);
		  try {
			  const incoming = JSON.parse(ev.data) as Notification;
			  console.log("player1_id incoming.reference_id: " + incoming.reference_id)
			  console.log('[notif] WS parsed notification:', incoming);
			  notifications.unshift({ ...incoming, read: false });
			  updateBadge();
			  if (!panel?.classList.contains('hidden')) renderPanel();
			  if (incoming.type === 'friend_accept') {
				  loadFriendsSidebar();
				}
				if (incoming.type === "challenge") {
					// prompt the user immediately
					if (confirm(`${incoming.text}\nAccept?`)) {
						// Accept → kick off a private game:
						// 1) send back a WS “ready” for the game
						const ws = new WebSocket(`ws://${HOST}:3000/ws/game?token=${localStorage.getItem("token")}`);
						ws.onopen = () => {
							const join: ClientMsgJoin = { type: "join", gameId: "" /* we'll get from server */ };
							// we need a fresh “game” REST create first:
							fetch(`http://${HOST}:3000/api/game`, {
								method: "POST",
								headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
							})
							.then((r) => r.json())
							.then(({ gameId }) => {
								// notify server we're joining this new private game
								join.gameId = gameId;
								ws.send(JSON.stringify(join));
								
								// tell the challenger via REST that we’re ready
								fetch(`http://${HOST}:3000/api/match/start`, {
									method: "POST",
									headers: {
										"Content-Type": "application/json",
										Authorization: `Bearer ${localStorage.getItem("token")}`,
									},
									body: JSON.stringify({
										player1_id: incoming.reference_id, // challenger
										player2_id: myUserId,
										tournament_id: null,
									}),
								});
								setGameId(gameId);     // assuming `gameId` is a top‑level `let` in main.ts
								connectWebSocket();         // will open WS, send join, handle ready, start, state…
							});
						};
						// and of course wire up ws.onmessage etc exactly like your existing connectWebSocket
					}
					else {
						// Decline → delete that notification so it disappears
						const token = localStorage.getItem("token")!;
						await fetch(
							`http://${HOST}:3000/api/notifications/${incoming.id}`,
							{
								method: "DELETE",
								headers: { Authorization: `Bearer ${token}` },
							}
						);
					}
				}
			} catch (err) {
				console.log('[notif] WS message parse error', err);
			}
		};
	} else {
		console.log('[notif] no token, skipping WS connect');
	}
}

export function initNotifications() {
  if (!localStorage.getItem("token")) return;
  startNotificationsSocket();
  fetchNotifications();
}

// new exported “stop” function
export function stopNotifications() {
  if (notifSocket) {
    notifSocket.close();
    notifSocket = null;
  }
  notifications = [];   // (optional) wipe out local state
  updateBadge();
}

if (localStorage.getItem("token")) initNotifications();
