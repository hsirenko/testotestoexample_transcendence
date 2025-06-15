import {
ClientMsgJoin,
ClientMsgMove,
ClientMsgStart,
StateMsg,
GameOverMsg,
ServerMsg,
} from "./types/ws.js";
import { HOST } from "./config.js";
import { showOverlay, hideOverlay } from "./tournament.js";


/* ---------- NEW AI IMPORTS -------------------------------------- */
import {
nextAIPaddleY,
setAIRefresh as setAIRefreshAI,
} from "./ai.js";

/* ------------------------------------------------------------------
* Game constants (unchanged)
* ----------------------------------------------------------------*/
const WORLD_WIDTH  = 800;
const WORLD_HEIGHT = 600;

const GSpeed     = 1.25;           // global game speed multiplier
const BallSpeed  = 330;            // ball speed in px/s
const MobileW    = 640;
const PadSpeed   = window.innerWidth <= MobileW ? 0.75 : 0.45; // height / s
let   BallSize   = window.innerWidth <= MobileW ? 5 : 10;
const PadW       = window.innerWidth <= MobileW ? 10 : 12;
const PadH       = window.innerWidth <= MobileW ? 60 : 80;
const PadGap     = 24;

let ignoreServerState = false;

const ColLPad = "#22d3ee";
const ColRPad = "#fbbf24";
const ColBall = "#f472b6";
const ColLine = "#f3f4f6";

const TimeToIncSpeed = 12;   // seconds until speed increases
const IncRate        = 0.1;  // increment per second after the above
const WinScore       = 3;    // points to win

/* ------------------------------------------------------------------
* Types
* ----------------------------------------------------------------*/
interface Vec { x: number; y: number }
interface Paddle extends Vec { w: number; h: number }
interface Ball   extends Vec { v: Vec; r: number }

/* ------------------------------------------------------------------
* Canvas + DOM handles
* ----------------------------------------------------------------*/
const CanvasHtml = document.getElementById("pong-canvas") as HTMLCanvasElement;
const ctx        = CanvasHtml.getContext("2d")!;
const sLeft      = document.getElementById("score-left")!;
const sRight     = document.getElementById("score-right")!;

/* ------------------------------------------------------------------
* Game-state variables
* ----------------------------------------------------------------*/
let left:  Paddle;
let right: Paddle;
let ball:  Ball;

let LScore = 0;
let RScore = 0;

let playing   = false;
let gameMode: "pvp" | "ai" = "pvp";
let lastTime  = performance.now();

let roundElapsed = 0;
let prevSpeed    = GSpeed;

/* ------------------------------------------------------------------
* Remote-play state
* ----------------------------------------------------------------*/
let socket: WebSocket | null = null;
let remoteMode  = false;
let gameId      = "";
let ownGameId: string | null = null;
let hasJoined   = false;


const pauseAndReset = (dir: 1 | -1): void => {
// /* ---------- REMOTE: just freeze rendering & network for 1 s -------- */
// if (remoteMode) {
//   playing            = false;        // stop loop (no render / key spam)
//   ignoreServerState  = true;         // drop incoming “state” frames
//   render();                          // paint the last frame once

//   setTimeout(() => {                 // after 1 s: resume everything
//     ignoreServerState = false;
//     lastTime          = performance.now();
//     resetObjects();
//     playing           = true;
//   }, 1000);

//   return;                            // never touch local positions/vels
// }

// /* ---------- LOCAL (PvP / AI) behaviour, unchanged ------------------ */
playing  = false;
ball.v.x = ball.v.y = 0;
resetPositions(dir);

setTimeout(() => {
	lastTime = performance.now();
	playing  = true;
}, 1000);
};
/* Shared key state (for human control) ---------------------------- */
const keys: Record<string, boolean> = {};

/* Key listeners – W/S + Arrows ----------------------------------- */
for (const type of ["keydown", "keyup"] as const) {
window.addEventListener(type, (evt) => {
	const e = evt as KeyboardEvent;
	if (!["w", "s", "ArrowUp", "ArrowDown"].includes(e.key)) return;

	/* ignore if user is typing in an input */
	const active = document.activeElement as HTMLElement | null;
	if (
	active &&
	(["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName) ||
	active.isContentEditable)
	) return;

	e.preventDefault();
	keys[e.key] = type === "keydown";

	/* Remote paddle-move messages */
	if (
	remoteMode &&
	socket?.readyState === WebSocket.OPEN &&
	type === "keydown"
	) {
	const dir: "up" | "down" =
		e.key === "w" || e.key === "ArrowUp" ? "up" : "down";
	const mv: ClientMsgMove = { type: "move", dir };
	socket.send(JSON.stringify(mv));
	}
});
}

/* Helpers --------------------------------------------------------- */
const clamp = (v: number, lo: number, hi: number) =>
v < lo ? lo : v > hi ? hi : v;

/* ------------------------------------------------------------------
* Setup / reset helpers
* ----------------------------------------------------------------*/
export function resetObjects(): void {
const scale = window.innerWidth <= MobileW ? 0.7 : 1;
BallSize    = window.innerWidth <= MobileW ? 7 : 10;

left  = { x: PadGap, y: 0, w: PadW * scale, h: PadH * scale };
right = { x: 0,      y: 0, w: PadW * scale, h: PadH * scale };
ball  = { x: 0, y: 0, v: { x: 0, y: 0 }, r: BallSize };

roundElapsed = 0;
prevSpeed    = GSpeed;
}

function resetPositions(dir: 1 | -1): void {
left.y  = (CanvasHtml.height - left.h) / 2;
right.y = (CanvasHtml.height - right.h) / 2;

ball.x = CanvasHtml.width  / 2;
ball.y = CanvasHtml.height / 2;

const speed = BallSpeed * GSpeed;
const angle = (Math.random() - 0.5) * (Math.PI / 3);

ball.v.x = dir * speed * Math.cos(angle);
ball.v.y =       speed * Math.sin(angle);

roundElapsed = 0;
prevSpeed    = GSpeed;
}

export function resizeCanvas(): void {
CanvasHtml.width  = CanvasHtml.clientWidth;
CanvasHtml.height = CanvasHtml.clientHeight;
right.x           = CanvasHtml.width - PadGap - right.w;
resetPositions(Math.random() < 0.5 ? 1 : -1);
render();
}

/* ------------------------------------------------------------------
* Animation loop
* ----------------------------------------------------------------*/
function loop(now: number): void {
const dt = (now - lastTime) / 1000;
lastTime = now;

if (playing) {
	/* Remote – continuously send held keys */
	if (remoteMode && socket?.readyState === WebSocket.OPEN) {
	if (keys["w"] || keys["ArrowUp"]) {
		socket.send(JSON.stringify({ type: "move", dir: "up" } as ClientMsgMove));
	}
	if (keys["s"] || keys["ArrowDown"]) {
		socket.send(JSON.stringify({ type: "move", dir: "down" } as ClientMsgMove));
	}
	}

	if (!remoteMode) update(dt);   // physics only locally
	render();                      // always draw latest state
}

requestAnimationFrame(loop);
}

/* ------------------------------------------------------------------
* Physics + game rules
* ----------------------------------------------------------------*/
function update(dt: number): void {
/* --- Speed ramping -------------------------------------------------- */
roundElapsed += dt;
const currSpeed =
	GSpeed + Math.max(0, roundElapsed - TimeToIncSpeed) * IncRate;

if (currSpeed !== prevSpeed) {
	const scale = currSpeed / prevSpeed;
	ball.v.x   *= scale;
	ball.v.y   *= scale;
	prevSpeed   = currSpeed;
}

const paddleV = CanvasHtml.height * PadSpeed * currSpeed;

/* --- Left paddle (player – W/S) ------------------------------------- */
if (keys["w"]) left.y -= paddleV * dt;
if (keys["s"]) left.y += paddleV * dt;
left.y = clamp(left.y, 0, CanvasHtml.height - left.h);

/* --- Right paddle (PvP or AI) -------------------------------------- */
if (!remoteMode) {
	if (gameMode === "pvp") {
	if (keys["ArrowUp"])   right.y -= paddleV * dt;
	if (keys["ArrowDown"]) right.y += paddleV * dt;
	} else {  // AI mode
		right.y = nextAIPaddleY(ball, right, dt, CanvasHtml.height, paddleV);
	//   const move = computeMove(ball, right, dt, CanvasHtml.height);
	//   if (move.up)   right.y -= paddleV * AI_MAX_SPEED * dt;
	//   if (move.down) right.y += paddleV * AI_MAX_SPEED * dt;
	}
	right.y = clamp(right.y, 0, CanvasHtml.height - right.h);
}

/* --- Ball ----------------------------------------------------------- */
ball.x += ball.v.x * dt;
ball.y += ball.v.y * dt;

if (ball.y - BallSize < 0 || ball.y + BallSize > CanvasHtml.height) {
	ball.v.y *= -1;
	ball.y    = clamp(ball.y, BallSize, CanvasHtml.height - BallSize);
}

const hitPaddle = (p: Paddle, side: "left" | "right"): boolean => {
	const inY = ball.y >= p.y && ball.y <= p.y + p.h;
	if (!inY) return false;

	if (
	side === "left"  && ball.v.x < 0 && ball.x - BallSize <= p.x + p.w
	) {
	ball.x = p.x + p.w + BallSize;
	return true;
	}
	if (
	side === "right" && ball.v.x > 0 && ball.x + BallSize >= p.x
	) {
	ball.x = p.x - BallSize;
	return true;
	}
	return false;
};

if (hitPaddle(left, "left") || hitPaddle(right, "right")) {
	const p   = ball.v.x < 0 ? left : right;
	const rel = (ball.y - (p.y + p.h / 2)) / (p.h / 2);
	const ang = rel * (Math.PI / 3);
	const spd = BallSpeed * currSpeed;
	const dir = ball.v.x < 0 ? 1 : -1;

	ball.v.x = dir * spd * Math.cos(ang);
	ball.v.y =       spd * Math.sin(ang);
}

if (ball.x + BallSize < 0) {
	RScore++;
	updateScore();
	RScore >= WinScore ? handleWin(false) : pauseAndReset(1);
} else if (ball.x - BallSize > CanvasHtml.width) {
	LScore++;
	updateScore();
	LScore >= WinScore ? handleWin(false) : pauseAndReset(-1);
}
}

/* ------------------------------------------------------------------
* Scoreboard helper
* ----------------------------------------------------------------*/
export function updateScore(): void {
sLeft.textContent  = String(LScore);
sRight.textContent = String(RScore);
}

/* ------------------------------------------------------------------
* Rendering
* ----------------------------------------------------------------*/
export function render(): void {
ctx.clearRect(0, 0, CanvasHtml.width, CanvasHtml.height);
drawNet();
drawPaddle(left,  ColLPad);
drawPaddle(right, ColRPad);
drawBall();
}

function drawNet(): void {
ctx.fillStyle = ColLine;
const w = 4, h = 18, gap = 12, x = CanvasHtml.width / 2 - w / 2;
for (let y = 0; y < CanvasHtml.height; y += h + gap)
	ctx.fillRect(x, y, w, h);
}

function drawPaddle(p: Paddle, col: string): void {
ctx.fillStyle = col;
ctx.fillRect(p.x, p.y, p.w, p.h);
}

function drawBall(): void {
ctx.fillStyle = ColBall;
ctx.beginPath();
ctx.arc(ball.x, ball.y, BallSize, 0, Math.PI * 2);
ctx.fill();
}

/* ------------------------------------------------------------------
* Global helpers exposed on window
* ----------------------------------------------------------------*/
declare global {
interface Window {
	setAIRefresh: (sec: number) => void;
	setGameMode:  (m: "pvp" | "ai") => void;
}
}

/* Implement the AI refresh setter via the new module */
window.setAIRefresh = setAIRefreshAI;

/* setGameMode (unchanged, except no AI vars here) ------------------ */
window.setGameMode = (mode: "pvp" | "ai"): void => {
cleanupRemote();
(window as any).showGameArea?.();
document.getElementById("win-message")?.remove();

playing  = false;
gameMode = mode;

LScore = RScore = 0;
updateScore();

resetObjects();
resizeCanvas();
startCountdown(3, beginPlay);
};

/* WIN MESSAGE, MOBILE CONTROLS, COUNTDOWN, etc. */
/* … (leave your existing implementations here unchanged) … */

function startCountdown(sec: number, callback: () => void): void {
	let remaining = sec;
	const overlay = document.createElement("div");
	overlay.id = "countdown-overlay";
	Object.assign(overlay.style, {
		position: "fixed",
		inset: "0",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		fontSize: "4rem",
		fontWeight: "800",
		color: "#fff",
		backdropFilter: "blur(3px)",
		zIndex: "9999",
		pointerEvents: "none",
	} as Partial<CSSStyleDeclaration>);
	overlay.textContent = String(remaining);
	document.body.appendChild(overlay);
	const tick = () => {
		remaining--;
		if (remaining === 0) {
			overlay.remove();
			callback();
		} else {
			overlay.textContent = String(remaining);
			setTimeout(tick, 1000);
		}
	};
	setTimeout(tick, 1000);
}

/* ═════════════ WIN MESSAGE ═════════════ */
function handleWin(remote: boolean): void {
	playing = false;
	//reshow that shit
	document.body.classList.remove("game-playing");
	(window as any).refreshMobilePads?.(); // hide mobile arrows

	const winner = LScore > RScore ? "Left Player" : "Right Player";

	let overlay = document.getElementById(
		"win-message"
	) as HTMLDivElement | null;
	if (!overlay) {
		overlay = document.createElement("div");
		overlay.id = "win-message";
		CanvasHtml.parentElement!.style.position = "relative";
		CanvasHtml.parentElement!.appendChild(overlay);
	}

	overlay.innerHTML = `
	<div class="msg-box">
	<span class="winner">${winner} Wins!</span>
	<button id="play-again">Play Again</button>
	</div>
`;
	overlay.className = "overlay";

	/* inject style only once */
	if (!document.getElementById("win-style")) {
		const style = document.createElement("style");
		style.id = "win-style";
		style.textContent = `
		#win-message.overlay{
			position:absolute;
			inset:0;
			display:flex;
			align-items:center;
			justify-content:center;
			pointer-events:auto;
			backdrop-filter:blur(4px);
		}
		#win-message .msg-box{
			display:flex;
			flex-direction:column;
			align-items:center;
			gap:1rem;
			background:linear-gradient(145deg,rgba(34,211,238,.25),rgba(251,191,36,.25));
			border:3px solid #fff;
			padding:2rem 2.5rem;
			border-radius:14px;
			box-shadow:0 0 25px rgba(255,255,255,.06),0 0 8px rgba(0,0,0,.4) inset;
			text-align:center;
		}
		#win-message .winner{
			font-size:1.5rem;
			font-weight:800;
			color:#fff;
			text-shadow:0 0 8px #fff;
		}
		#play-again{
			margin-top:1rem;
			padding:.55rem 2rem;
			font-size:1.1rem;
			font-weight:700;
			border:none;
			border-radius:10px;
			background:#f472b6;
			color:#fff;
			cursor:pointer;
			transition:transform .2s,filter .2s;
		}
		#play-again:hover{
			transform:scale(1.05);
			filter:brightness(1.15);
		}

		/* Desktop refinements */
		@media (min-width:640px){
			#win-message .msg-box{
			flex-direction:row;
			gap:2rem;
			}
			#win-message .winner{ font-size:3rem; }
			#play-again{
			margin-top:0;
			padding:.6rem 2.5rem;
			font-size:1.25rem;
			}
		}
		`;
		document.head.appendChild(style);
	}

	/* play-again button logic */
	const againBtn = document.getElementById("play-again") as HTMLButtonElement;
	againBtn.onclick = () => {
		overlay!.remove();
		LScore = RScore = 0;
		updateScore();

		resetObjects();
		resizeCanvas();

		startCountdown(3, beginPlay); // << here!
	};
}

function beginPlay(): void {
playing  = true;
document.body.classList.add("game-playing");
lastTime = performance.now();
requestAnimationFrame(loop);
(window as any).refreshMobilePads?.();
}
/* ═════════════ REMOTE MODE ═════════════ */

const auth = (): HeadersInit => {
const t = localStorage.getItem("token");
return t ? { Authorization: `Bearer ${t}` } : {};
};

function waitForBothPlayers() {
	const waitingOverlay = document.createElement("div");
	waitingOverlay.id = "waiting-overlay";
	Object.assign(waitingOverlay.style, {
		position: "fixed",
		inset: "0",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		fontSize: "4rem",
		fontWeight: "800",
		color: "#fff",
		backdropFilter: "blur(3px)",
		zIndex: "100",
		pointerEvents: "none",
	} as Partial<CSSStyleDeclaration>);
	waitingOverlay.textContent = "Waiting for the other player to join :P";
	document.body.appendChild(waitingOverlay);
}

function startGameRemote() {
	const game = document.getElementById("game-container") as HTMLElement;
	const WSec = document.getElementById("welcome-section") as HTMLElement;
	WSec.classList.add("hidden");
	game.classList.remove("hidden");
	game.classList.add("animate__animated", "animate__zoomIn");
	// startCountdown(3, beginPlay);
	// beginPlay();
}

document.getElementById("nav-home")!.addEventListener("click", () => {
	cleanupRemote();
});

document.getElementById("nav-play")!.addEventListener("click", () => {
	cleanupRemote();
});

document.getElementById("nav-profile")!.addEventListener("click", () => {
	cleanupRemote();
});

document.getElementById("nav-signout")!.addEventListener("click", () => {
	cleanupRemote();
});

function cleanupRemote() {
	if (socket) {
		socket.close();
		socket = null;
	}
	//also restore that shit in remote
	document.body.classList.remove("game-playing");
	remoteMode = false;
	// remove any waiting/countdown overlays left behind
	document.getElementById("waiting-overlay")?.remove();
	document.getElementById("countdown-overlay")?.remove();
	// hide remote modal if it’s still up
	document.getElementById("remote-modal")?.classList.add("hidden");
}

function connectWebSocket() {
	if (socket && socket.readyState === WebSocket.OPEN) return;
	if (ownGameId && gameId === ownGameId && !hasJoined) {
	// the creator should *only* wait for the other player, not re-join themselves
		hasJoined = true;
	} else if (ownGameId && gameId === ownGameId && hasJoined) {
		return;
	}
	
	console.log(`[client] 🎾 connecting to ws://${HOST}:3000/ws/game`);
	socket = new WebSocket(`ws://${HOST}:3000/ws/game?token=${localStorage.getItem('token')}`);
	socket.onopen = () => {
		// 3) send our join message
		// console.log("[client] ⚡ ws open, sending join for", gameId);
		if (!hasJoined) {
			hasJoined = true;
			const join: ClientMsgJoin = { type: "join", gameId };
			socket!.send(JSON.stringify(join));
		}
	};

	socket.onmessage = (ev) => {
	
		const msg = JSON.parse(ev.data) as ServerMsg;

		/* Skip live-state updates while we’re showing the 1-second pause */
		if (msg.type === "state" && ignoreServerState) return;

		// 1) got the “ready” signal from the server?
		if (msg.type === "error") {
			alert("WTF MAN :D");
		}
		if (msg.type === "ready") {
			console.log("[client] 🔔 ready received — starting countdown");
			const waitingOverlay = document.getElementById("waiting-overlay");
			const modal = document.getElementById("remote-modal")!;
			document.getElementById("win-message")?.remove();
			startGameRemote();
			resetObjects();
			resizeCanvas();
			updateScore();
			modal.classList.add("hidden");
			waitingOverlay?.remove();
			startCountdown(3, () => {
				// 2) after the countdown, kick off local loop…
				beginPlay();
				// 3) …and tell the server to actually start its physics
				socket!.send(
					JSON.stringify({ type: "start" } as ClientMsgStart)
				);
			});
			return;
		}
		if (msg.type === "state") {
			if (!playing) return;
			// compute scale factors from server coords → canvas pixels
			const sx = CanvasHtml.width / WORLD_WIDTH;
			const sy = CanvasHtml.height / WORLD_HEIGHT;
			// scale paddles
			const [PL, PR] = msg.paddles;
			left = { x: PL.x * sx, y: PL.y * sy, w: PL.w * sx, h: PL.h * sy };
			right = { x: PR.x * sx, y: PR.y * sy, w: PR.w * sx, h: PR.h * sy };

			// scale ball
			const B = msg.ball;
			ball = {
				x: B.x * sx,
				y: B.y * sy,
				v: { x: B.v.x * sx, y: B.v.y * sy },
				r: B.r * sx,
			};

			if (msg.scores.left !== LScore || msg.scores.right !== RScore) {
const dir: 1 | -1 =          // ← decide who scored first
	msg.scores.left > LScore ? 1 : -1;

LScore = msg.scores.left;    // then update our local copies
RScore = msg.scores.right;
updateScore();

pauseAndReset(dir);          // one-second inter-round pause
}
			// update score and draw
			// LScore = msg.scores.left;
			// RScore = msg.scores.right;
			// updateScore();
			// render();
		} else if ((msg as GameOverMsg).type === "gameOver") {
			// stop listening & close
			socket!.close();
			console.log(`${(msg as GameOverMsg).winner} - SCORES: ${LScore} - ${RScore}`);
			alert(`${(msg as GameOverMsg).winner.toUpperCase()} wins!`);
			// window.location.reload();
		}
	};

	socket.onerror = (err) => console.error("[client] ⚠️ ws error", err);
	socket.onclose = (ev) => console.log("[client] ❌ ws closed", ev);
}

export function initRemoteModal(): void {
	const ov    = document.getElementById("remote-modal")!;          // overlay
	const inner = ov.querySelector("div")! as HTMLElement;           // white card
	/* ➋ Show with the shared helper */
	showOverlay(ov, inner);      // << replaces “classList.remove('hidden') …”

	const modal = document.getElementById("remote-modal")!;
	const btnCreate = document.getElementById("remote-create-btn")! as HTMLButtonElement;
	const btnJoin = document.getElementById("remote-join-btn")! as HTMLButtonElement;
	const sectCreate = document.getElementById("remote-created")!;
	const sectJoin = document.getElementById("remote-join")!;
	const inputId = document.getElementById(
		"remote-created-id"
	) as HTMLInputElement;
	const copyBtn = document.getElementById("remote-copy-btn")!;
	const joinInp = document.getElementById(
		"remote-join-input"
	) as HTMLInputElement;
	const joinConf = document.getElementById("remote-join-confirm")!;
	const closeBtn = document.getElementById("remote-close")!;

	// Show the modal
	showOverlay(ov, inner);
	modal.style.zIndex = "101";

	// Cleanup previous state
	sectCreate.classList.add("hidden");
	sectJoin.classList.add("hidden");

	// Create game
	btnCreate.onclick = async () => {
		btnCreate.disabled = true;
		btnJoin.disabled   = true;
		const res = await fetch(`http://${HOST}:3000/api/game`, {
			method: "POST",
			headers: auth()
		});
		const data = (await res.json()) as { gameId: string };
		gameId = data.gameId;
		remoteMode = true;
		// modal.classList.add('hidden');
		connectWebSocket();
		inputId.value = data.gameId;
		sectCreate.classList.remove("hidden");
		// NEW: reveal the canvas + countdown behind the modal
		(window as any).showGameArea?.();
		resetObjects();
		resizeCanvas();
		render();
		updateScore();
		waitForBothPlayers();
	};

	// Copy button
	copyBtn.onclick = () => {
		inputId.select();
		document.execCommand("copy");
		copyBtn.textContent = "Copied!";
		setTimeout(() => (copyBtn.textContent = "Copy"), 2000);
	};

	// Show join section
	btnJoin.onclick = () => {
		sectJoin.classList.remove("hidden");
	};

	// Confirm join
	joinConf.onclick = () => {
		const id = joinInp.value.trim();
		if (!id) return alert("Please enter a Game ID");
		gameId = id;
		remoteMode = true;
		ownGameId = null;
		hideOverlay(ov, inner);
		connectWebSocket();
	};

	// Close modal
	closeBtn.onclick = () => hideOverlay(ov, inner);
	// Close modal by Esc
	document.addEventListener(
		"keydown",
		(e) => {
		if (e.key === "Escape" && !ov.classList.contains("hidden")) {
			hideOverlay(ov, inner);
		}
		},
		{ once: true },
	);
}

window.addEventListener("beforeunload", () => {
	cleanupRemote();
});

// initial game setup
resetObjects();
resizeCanvas();
render();
updateScore();
