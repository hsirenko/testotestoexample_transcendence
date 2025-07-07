// frontend/src/notifications.ts

import { WS_BASE } from "./config.js";
import { loadFriendsSidebar } from "./friends.js";
import { connectWebSocket, enableRemoteMode, setGameId } from "./main.js";

//declaring the notification objec tstructure
interface Notification {
	id: number;
	text: string;
	date: string;
	read: boolean;
	type?: 'friend_request' | 'friend_accept' | "challenge" | string;
	reference_id?: number;
	gameId?: string;
}

//notifications objects
let notifications: Notification[] = [];
let notifSocket: WebSocket | null = null;
const bell   = document.querySelector<HTMLButtonElement>("#nav-notif");
const panel  = document.querySelector<HTMLDivElement>("#notif-panel");
const badge  = document.querySelector<HTMLSpanElement>("#notif-badge");


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
	const header = document.createElement("div");
	header.className = "relative h-6 mb-2";
	const clearBtn = document.createElement("button");
	clearBtn.setAttribute("aria-label", "Clear notifications");
	clearBtn.className =
		"absolute right-0 top-0 text-white-500 hover:text-red-600 " +
		"transition-transform duration-200 hover:scale-110";
	clearBtn.innerHTML = `
		<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
		  <path fill-rule="evenodd"
		    d="M6 2a1 1 0 011-1h6a1 1 0 011 1v1h4a1 1 0 010 2h-1v11a3 3 0
		       01-3 3H5a3 3 0 01-3-3V5H1a1 1 0 010-2h4V2zm2 4a1 1 0
		       10-2 0v9a1 1 0 102 0V6zm4 0a1 1 0
		       10-2 0v9a1 1 0 102 0V6z"
		    clip-rule="evenodd"/>
		</svg>`;
	clearBtn.onclick = async (e) => {
		notifications = [];
		const me = JSON.parse(localStorage.getItem("user") || "{}");
		e.stopPropagation();
		const t = localStorage.getItem("token")!;
	await fetch(`/api/notifications`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${t}` },
  });
	notifications = notifications.filter(x => x.id !== me.id);
		renderPanel();
		updateBadge();
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

	notifications.forEach(n => {
		const row = document.createElement("div");
		row.className = [
			"flex", "items-start", "gap-3", "p-3", "rounded-lg",
			"bg-white/5", "hover:bg-white/10", "transition"
		].join(" ");
		if (!n.read) row.classList.add("border-l-4", "border-amber-500");

		const icon = document.createElement("span");
		icon.textContent = "🔔";
		const wrap = document.createElement("div");
		const msg  = document.createElement("p");
		msg.textContent = n.text;
		const time = document.createElement("time");
		time.className = "block text-xs text-white/60";
		time.textContent = fmtDate(n.date);
		wrap.append(msg, time);

		row.append(icon, wrap);

		if (n.gameId) {
			const box = document.createElement("div");
			box.className = "relative left-[-20px] ml-auto flex gap-2";

			const accept = document.createElement("button");
			accept.textContent = "Accept";
			accept.className =
				"px-2 py-1 rounded-full bg-emerald-500 hover:bg-emerald-600 " +
				"text-sm font-semibold transition";

			accept.onclick = async (e) => {
				e.stopPropagation();

				setGameId(n.gameId!);
				enableRemoteMode();
				connectWebSocket();

				n.read = true;
				panel.classList.add("hidden");
				updateBadge();
				notifications = notifications.filter(x => x.id !== n.id);
			};

			const decline = document.createElement("button");
			decline.textContent = "Decline";
			decline.className =
				"px-2 py-1 rounded-full bg-rose-500 hover:bg-rose-600 " +
				"text-sm font-semibold transition";

			decline.onclick = async (e) => {
				e.stopPropagation();
				const t = localStorage.getItem("token")!;
				await fetch(`/api/notifications/${n.id}`, {
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

		else if (n.type === "friend_request" && n.reference_id) {
			const respond = async (
				e: MouseEvent,
				action: "accept" | "decline",
				btn: HTMLButtonElement
			) => {
				e.stopPropagation();
				btn.disabled = true;

				const token = localStorage.getItem("token")!;
				await fetch(`/api/users/respond-friend`, {
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
				await fetch(`/api/notifications/${n.id}`, {
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
				"left-20 px-3 py-1 rounded-full bg-rose-500 hover:bg-rose-600 " +
				"text-sm font-semibold transition";
			decline.onclick = (e) => respond(e, "decline", decline);

			box.append(accept, decline);
			row.append(box);
		}

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

export function pushNotification(text: string): void {
	notifications.unshift({
		id: Date.now(),
		text,
		date: new Date().toISOString(),
		read: false,
	});
	updateBadge();
	if (!panel?.classList.contains("hidden")) renderPanel();
}

export async function fetchNotifications(): Promise<void> {
	try {
		const token = localStorage.getItem("token");
		if (!token) return;
		const res = await fetch(`/api/notifications`, {
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

bell?.addEventListener("click", async ev => {
	ev.stopPropagation();
	const t = localStorage.getItem("token")!;
	await fetch(`/api/notifications/read`, {
		method: "POST",
		headers: { Authorization: `Bearer ${t}` },
	});
	panel?.classList.toggle("hidden");
	renderPanel();
	notifications.forEach(n => (n.read = true));
	updateBadge();
});

document.addEventListener("click", ev => {
	if (!panel || panel.classList.contains("hidden")) return;
	if (!panel.contains(ev.target as Node) && ev.target !== bell) {
		panel.classList.add("hidden");
	}
});

updateBadge();
let pingInterval: number | null = null;

function startNotificationsSocket(): void {
    const token = localStorage.getItem("token");
    if (!token) {
        console.log("[notif] no token, skipping WS connect");
        return;
    }
    const wsUrl = `${WS_BASE}/notifications?token=${token}`;
    const me = JSON.parse(localStorage.getItem("user") || "{}");
    const myUserId = me.id;
    console.log("[notif] connecting to WS at", wsUrl);
    notifSocket = new WebSocket(wsUrl);
    
    notifSocket.onopen = () => {
        console.log("[notif] WS open");
        // Start keepalive ping every 30 seconds
        pingInterval = window.setInterval(() => {
            if (notifSocket && notifSocket.readyState === WebSocket.OPEN) {
                notifSocket.send(JSON.stringify({ type: 'ping' }));
            }
        }, 30000);
    };
    
    notifSocket.onerror = err => console.log("[notif] WS error", err);
    
    notifSocket.onclose = ev => {
        console.log("[notif] WS closed", ev.code, ev.reason);
        // Clear ping interval on close
        if (pingInterval) {
            clearInterval(pingInterval);
            pingInterval = null;
        }
        // Auto-reconnect after 5 seconds if not intentionally closed
        if (ev.code !== 1000 && localStorage.getItem("token")) {
            setTimeout(() => {
                console.log("[notif] Attempting to reconnect...");
                startNotificationsSocket();
            }, 5000);
        }
    };
        notifSocket.onmessage = async ev => {
      try {
        const incoming = JSON.parse(ev.data);
        if (incoming.type === "challenge_cancelled") {
          notifications = notifications.filter(
            n => !(n.type === "challenge" && n.reference_id === incoming.from)
          );
          updateBadge();
          if (!panel?.classList.contains("hidden")) renderPanel();
          return;
        }
        if (incoming.type === "challenge_declined") {
          (window as any).removeWaitingOverlay?.();
        }
        if (incoming.type === "presence") {
          loadFriendsSidebar();
          return;
        }
        const n = incoming as Notification;
        notifications.unshift({ ...n, read: false });
        updateBadge();
        if (!panel?.classList.contains("hidden")) renderPanel();
        if (n.type === "friend_accept") loadFriendsSidebar();
      } catch (err) {
        console.log("[notif] WS parse error", err);
      }
    };

    window.addEventListener("beforeunload", () => {
        const t = localStorage.getItem("token");
        if (!t) return;
        notifications.filter(n => n.type === "challenge").forEach(n => {
            fetch(`/api/notifications/${n.id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${t}` },
                keepalive: true
            });
        });
    });
}



export function initNotifications() {
	if (!localStorage.getItem("token")) return;
	startNotificationsSocket();
	fetchNotifications();
}

export function stopNotifications() {
	if (pingInterval) {
		clearInterval(pingInterval);
		pingInterval = null;
	}
	if (notifSocket) {
		notifSocket.close(1000, "Manual disconnect");
		notifSocket = null;
	}
	notifications = [];
	updateBadge();
}

if (localStorage.getItem("token")) initNotifications();
