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
import { connectWebSocket, setGameId, enableRemoteMode } from "./main.js";

/* ------------------------------------------------------------------
 * Types & state
 * ----------------------------------------------------------------*/
interface Notification {
	id: number;
	text: string;
	date: string;
	read: boolean;
	type?: 'friend_request' | 'friend_accept' | "challenge" | string;
	reference_id?: number;
	gameId?: string;
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
	/* ----------------------------------------------------------------
	 *  Reset / early-outs
	 * ---------------------------------------------------------------*/
	if (!panel) return;
	panel.innerHTML = "";

	/* top spacer so items don’t “stick” to the rounded border */
	const header = document.createElement("div");
	header.className = "relative h-6 mb-2";   // 1.5 rem tall spacer

	/* red trash-can to clear the list */
	const clearBtn = document.createElement("button");
	clearBtn.setAttribute("aria-label", "Clear notifications");
	clearBtn.className =
		"absolute right-0 top-0 text-red-500 hover:text-red-600 " +
		"transition-transform duration-200 hover:scale-110";

	/* heroicons/solid trash 20 px  – drop in any SVG you like */
	clearBtn.innerHTML = `
		<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
		  <path fill-rule="evenodd"
		    d="M6 2a1 1 0 011-1h6a1 1 0 011 1v1h4a1 1 0 010 2h-1v11a3 3 0
		       01-3 3H5a3 3 0 01-3-3V5H1a1 1 0 010-2h4V2zm2 4a1 1 0
		       10-2 0v9a1 1 0 102 0V6zm4 0a1 1 0
		       10-2 0v9a1 1 0 102 0V6z"
		    clip-rule="evenodd"/>
		</svg>`;

	/* optional behaviour – wipe client list & refresh badge */
	clearBtn.onclick = async (e) => {
		e.stopPropagation();
		notifications = [];
		renderPanel();      // re-render empty state
		updateBadge();      // badge already exists lower in the file

		//here you will apply the logic to remove the notf from the db
	};

	header.appendChild(clearBtn);
	panel.appendChild(header);

	if (notifications.length === 0) {
		const empty = document.createElement("p");
		empty.className = "text-center text-sm text-white/70";
		empty.textContent = "No notifications yet.";
		panel.appendChild(empty);
		return;
	}

	/* ----------------------------------------------------------------
	 *  One row per notification
	 * ---------------------------------------------------------------*/
	notifications.forEach(n => {
		/* Basic row skeleton */
		const row = document.createElement("div");
		row.className = [
			"flex", "items-start", "gap-3", "p-3", "rounded-lg",
			"bg-white/5", "hover:bg-white/10", "transition"
		].join(" ");
		if (!n.read) row.classList.add("border-l-4", "border-amber-500");

		/* 🔔 icon */
		const icon = document.createElement("span");
		icon.textContent = "🔔";

		/* message + timestamp */
		const wrap = document.createElement("div");
		const msg  = document.createElement("p");
		msg.textContent = n.text;
		const time = document.createElement("time");
		time.className = "block text-xs text-white/60";
		time.textContent = fmtDate(n.date);
		wrap.append(msg, time);

		row.append(icon, wrap);

		/* ============================================================
		 *  1. CHALLENGE  – anything that carries a gameId
		 * ==========================================================*/
		if (n.gameId) {
			const box = document.createElement("div");
			box.className = "ml-auto flex gap-2";

			/* Accept */
			const accept = document.createElement("button");
			accept.textContent = "Accept";
			accept.className =
				"px-3 py-1 rounded-full bg-emerald-500 hover:bg-emerald-600 " +
				"text-sm font-semibold transition";

			accept.onclick = async (e) => {
				e.stopPropagation();

				/* 🔸 (optional tidying) mark as read on the server */
				// const t = localStorage.getItem("token")!;
				// await fetch(`http://${HOST}:3000/api/notifications/${n.id}/read`, {
				// 	method: "POST",
				// 	headers: { Authorization: `Bearer ${t}` },
				// });

				/* 🔸 start the match – useful for stats/history tables        */
				// const me   = JSON.parse(localStorage.getItem("user") || "{}");
				// if (n.reference_id) {
				// 	await fetch(`http://${HOST}:3000/api/match/start`, {
				// 		method: "POST",
				// 		headers: {
				// 			"Content-Type": "application/json",
				// 			Authorization: `Bearer ${t}`,
				// 		},
				// 		body: JSON.stringify({
				// 			player1_id: n.reference_id, // challenger
				// 			player2_id: me.id,          // us
				// 			tournament_id: null,
				// 		}),
				// 	});
				// }

				/* 🔸 jump into the challenger’s room */
				setGameId(n.gameId!);
				enableRemoteMode();
				connectWebSocket();

				/* 🔸 local UI cleanup */
				n.read = true;
				panel.classList.add("hidden");
				updateBadge();
				notifications = notifications.filter(x => x.id !== n.id);
			};

			/* Decline */
			const decline = document.createElement("button");
			decline.textContent = "Decline";
			decline.className =
				"px-3 py-1 rounded-full bg-rose-500 hover:bg-rose-600 " +
				"text-sm font-semibold transition";

			decline.onclick = async (e) => {
				e.stopPropagation();
				const t = localStorage.getItem("token")!;
				await fetch(`http://${HOST}:3000/api/notifications/${n.id}`, {
					method: "DELETE",
					headers: { Authorization: `Bearer ${t}` },
				});
				notifications = notifications.filter(x => x.id !== n.id);
				updateBadge();
				renderPanel();
			};

			box.append(accept, decline);
			row.append(box);
		}

		/* ============================================================
		 *  2. FRIEND REQUEST  – only if it *wasn’t* a challenge
		 * ==========================================================*/
		else if (n.type === "friend_request" && n.reference_id) {
			/* shared helper for both buttons */
			const respond = async (
				e: MouseEvent,
				action: "accept" | "decline",
				btn: HTMLButtonElement
			) => {
				e.stopPropagation();
				btn.disabled = true;  // prevent double-clicks

				const token = localStorage.getItem("token")!;
				await fetch(`http://${HOST}:3000/api/users/respond-friend`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({
						request_id: n.reference_id,
						action,
					}),
				});
				await fetch(`http://${HOST}:3000/api/notifications/${n.id}`, {
					method: "DELETE",
					headers: { Authorization: `Bearer ${token}` },
				});

				notifications = notifications.filter(
					x => x.reference_id !== n.reference_id
				);
				n.read = true;
				updateBadge();
				renderPanel();
				loadFriendsSidebar();
			};

			const box = document.createElement("div");
			box.className = "ml-auto flex gap-2";

			const accept = document.createElement("button");
			accept.textContent = "Accept";
			accept.className =
				"px-3 py-1 rounded-full bg-emerald-500 hover:bg-emerald-600 " +
				"text-sm font-semibold transition";
			accept.onclick = (e) => respond(e, "accept", accept);

			const decline = document.createElement("button");
			decline.textContent = "Decline";
			decline.className =
				"px-3 py-1 rounded-full bg-rose-500 hover:bg-rose-600 " +
				"text-sm font-semibold transition";
			decline.onclick = (e) => respond(e, "decline", decline);

			box.append(accept, decline);
			row.append(box);
		}

		/* ------------------------------------------------------------
		 *  Click anywhere else on the row → mark as read
		 * -----------------------------------------------------------*/
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
		notifications = data.map(n => ({ ...n, read: n.read }));
		updateBadge();
	} catch (err) {
		console.error("Failed to fetch notifications", err);
	}
}

/* ------------------------------------------------------------------
 *  Event wiring – open/close dropdown & outside‑click handling
 * ----------------------------------------------------------------*/
bell?.addEventListener("click", async ev => {
	ev.stopPropagation();
	const t = localStorage.getItem("token")!;
	await fetch(`http://${HOST}:3000/api/notifications/read`, {
		method: "POST",
		headers: { Authorization: `Bearer ${t}` },
	});
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
function startNotificationsSocket(): void {
	const token = localStorage.getItem("token");
	if (!token) {
		console.log("[notif] no token, skipping WS connect");
		return;
	}

	const wsUrl = `ws://${HOST}:3000/ws/notifications?token=${token}`;
	const me = JSON.parse(localStorage.getItem("user") || "{}");
	const myUserId = me.id;

	console.log("[notif] connecting to WS at", wsUrl);
	notifSocket = new WebSocket(wsUrl);

	notifSocket.onopen  = () => console.log("[notif] WS open");
	notifSocket.onerror = (err) => console.log("[notif] WS error", err);
	notifSocket.onclose = (ev) =>
		console.log("[notif] WS closed", ev.code, ev.reason);

	notifSocket.onmessage = async (ev) => {
		try {
			const incoming = JSON.parse(ev.data) as Notification;
			notifications.unshift({ ...incoming, read: false });
			updateBadge();
			if (!panel?.classList.contains("hidden")) renderPanel();
			if (incoming.type === "friend_accept") loadFriendsSidebar();

			/* ------------------------------------------------------------
			 * CHALLENGE – user clicks “Accept”
			 * -----------------------------------------------------------*/
			// if (incoming.type === "challenge") {
			// 	const accepted = confirm(`${incoming.text}\nAccept?`);
			// 	if (!accepted) {
			// 		const t = localStorage.getItem("token")!;
			// 		await fetch(
			// 			`http://${HOST}:3000/api/notifications/${incoming.id}`,
			// 			{ method: "DELETE", headers: { Authorization: `Bearer ${t}` } }
			// 		);
			// 		return;
			// 	}

			// 	if (!incoming.gameId) {
			// 		alert("Challenge did not include a game ID. Please try again.");
			// 		return;
			// 	}

			// 	/* Join the challenger’s existing room */
			// 	setGameId(incoming.gameId);
			// 	enableRemoteMode();
			// 	connectWebSocket();

			// 	// /* Announce the match so stats & history tables stay in sync */
			// 	// const t = localStorage.getItem("token");
			// 	// if (t) {
			// 	// 	await fetch(`http://${HOST}:3000/api/match/start`, {
			// 	// 		method: "POST",
			// 	// 		headers: {
			// 	// 			"Content-Type": "application/json",
			// 	// 			Authorization: `Bearer ${t}`,
			// 	// 		},
			// 	// 		body: JSON.stringify({
			// 	// 			player1_id: incoming.reference_id, // challenger
			// 	// 			player2_id: myUserId,              // us
			// 	// 			tournament_id: null,
			// 	// 		}),
			// 	// 	});
			// 	// }
			// }
		} catch (err) {
			console.log("[notif] WS parse error", err);
		}
	};
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
