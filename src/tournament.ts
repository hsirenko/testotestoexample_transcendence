/* src/tournament.ts  – remote 4-player bracket */
import { pushGame, pushHome, pushOverlay } from './nav_history.js';

import { createTournament, joinTournament } from './api/tournament.js';
import { connectWebSocket, enableRemoteMode, set_side, setGameId } from './main.js';
import { WS_BASE } from './config.js';

export { hideOverlay, showOverlay };

const sharePanel = document.getElementById('tour-share-panel') as HTMLDivElement;

const tourErr = document.getElementById('tour-error') as HTMLParagraphElement | null;

const ov = document.getElementById('tournament-overlay') as HTMLElement;
const box = document.getElementById('tournament-container') as HTMLElement;
const closeBtn = document.getElementById('tour-close')!;

const stepMain = document.getElementById('tour-step-main')!;
const stepCreated = document.getElementById('tour-step-created')!;
const stepJoin = document.getElementById('tour-step-join')!;
const stepBracket = document.getElementById('tour-step-bracket')!;

const createdCode = document.getElementById('tour-created-code') as HTMLDivElement;
const codeInput = document.getElementById('tour-code-input') as HTMLInputElement;
const errorEl = document.getElementById('tour-error')!;
const bracketHint = document.getElementById('bracket-hint')!;

const slotEls = Array.from(document.querySelectorAll<HTMLDivElement>('[data-slot]'));
const YOU = localStorage.getItem('username') ?? 'you';

//tournament remote play background to hide bracket
const backdrop = document.getElementById('game-backdrop')!;

let code = '';
let socket: WebSocket;

const idToName = new Map<number, string>(); // id  ➜ username
let round1: number[] = []; // initial four players (slot 0-3)
const semiMap: Record<string, 4 | 5> = {}; // gameId ➜ 4 or 5
let finalGameId: string | null = null;

function setSlot(idx: 4 | 5 | 6, playerId: number) {
    const name = idToName.get(playerId) ?? String(playerId);
    slotEls.forEach((el) => {
        if (Number(el.dataset.slot) === idx) el.textContent = name;
    });
}
function showGameBackdrop() {
    backdrop?.classList.remove('hidden', 'opacity-0');
}
function hideGameBackdrop() {
    backdrop?.classList.add('hidden', 'opacity-0');
}
document.getElementById('tour-create-btn')?.addEventListener('click', async () => {
    try {
        const { code: c } = await createTournament(localStorage.getItem('token')!, 'Bracket');

        code = c;
        localStorage.setItem('tournamentCode', c);
        createdCode.textContent = c;

        sharePanel.classList.remove('hidden'); // show “share” strip
        connectWs(); // open socket with valid code
        goto(stepBracket); // jump to lobby
    } catch (err: any) {
        alert(err.message || err);
    }
});

document.getElementById('tour-confirm-join-btn')?.addEventListener('click', async () => {
    if (tourErr) tourErr.textContent = '';

    try {
        const input = document.getElementById('tour-code-input') as HTMLInputElement;
        code = input.value.trim().toUpperCase();

        await joinTournament(localStorage.getItem('token')!, code);

        localStorage.setItem('tournamentCode', code);
        sharePanel.classList.add('hidden');
        connectWs();
        goto(stepBracket);
    } catch (err: any) {
        if (tourErr) tourErr.textContent = err.message || 'Invalid or closed tournament code.';
        code = '';
    }
});

document.getElementById('tour-create-btn')?.addEventListener('click', async () => {
    try {
        resetBracket(); // clear winners from last tour
        const { code: c } = await createTournament(localStorage.getItem('token')!, 'Bracket');
        code = c;
        createdCode.textContent = c;

        connectWs();
        goto(stepBracket);
    } catch (err: any) {
        alert(err.message);
    }
});

const copyBtn = document.getElementById('tour-copy-code') as HTMLButtonElement | null;

function flashCopied(btn: HTMLButtonElement) {
    const saved = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => (btn.textContent = saved), 1500);
}

copyBtn?.addEventListener('click', () => {
    if (!code) return;

    // Modern Clipboard API – works only on secure origins (HTTPS or localhost)
    if (navigator.clipboard?.writeText) {
        navigator.clipboard
            .writeText(code)
            .then(() => copyBtn && flashCopied(copyBtn))
            .catch((err) => alert(`Clipboard error: ${err.message}`));
        return;
    }

    // Fallback for plain HTTP or very old browsers
    const tmp = document.createElement('input');
    tmp.value = code;
    document.body.appendChild(tmp);
    tmp.select();
    document.execCommand('copy');
    document.body.removeChild(tmp);
    if (copyBtn) flashCopied(copyBtn);
});

document.getElementById('tour-confirm-join-btn')?.addEventListener('click', async () => {
    try {
        resetBracket();
        await joinTournament(localStorage.getItem('token')!, codeInput.value.trim().toUpperCase());
        code = codeInput.value.trim().toUpperCase();
        connectWs();
        goto(stepBracket);
    } catch {
        errorEl.textContent = 'Invalid or full code';
    }
});

function resetBracket() {
    round1 = [];
    for (const k in semiMap) delete semiMap[k];
    finalGameId = null;

    slotEls.forEach((el) => {
        switch (+el.dataset.slot!) {
            case 0:
            case 1:
            case 2:
            case 3:
                el.textContent = '—';
                break;
            case 4:
                el.textContent = 'Winner Game 1';
                break;
            case 5:
                el.textContent = 'Winner Game 2';
                break;
            case 6:
                el.textContent = 'champion';
                break;
        }
    });

    hideGameBackdrop();
}

function connectWs() {
    if (!code) {
        const stored = localStorage.getItem('tournamentCode');
        if (stored) code = stored;
    }
    if (!code) return;

    socket = new WebSocket(
        `${WS_BASE}/tournament?token=${localStorage.getItem('token')}&code=${code}`
    );
    socket.addEventListener('message', (ev) => {
        const msg = JSON.parse(ev.data);

        if (msg.type === 'tournamentClosed') {
            socket.close();
            hideOverlay(ov, box);
            alert('The creator cancelled the tournament.');
            pushHome();
        }

        if (msg.type === 'playersUpdate') {
            updateSlots(msg.players);

            const missing = 4 - msg.players.length;
            bracketHint.textContent =
                missing > 0
                    ? `Waiting for ${missing} more player${missing > 1 ? 's' : ''}…`
                    : 'Bracket ready – pairing players…';
        }

        if (msg.type === 'tournamentStart') {
            updateSlots(msg.players);
            bracketHint.textContent = 'Pairing players…';
        }

        if (msg.type === 'gameAssigned' || msg.type === 'finalAssigned') {
            const stored = localStorage.getItem('user');
            const raw = stored ? JSON.parse(stored) : null;
            const me = raw ? Number(raw.id ?? raw.userId) : NaN;

            if (msg.type === 'gameAssigned') {
                const [pA] = msg.players as number[];
                const first = round1.slice(0, 2).includes(pA);
                semiMap[msg.gameId] = first ? 4 : 5;
            } else {
                finalGameId = msg.gameId;
            }

            if (msg.players.includes(me)) {
                const ov = document.getElementById('tournament-overlay')!;
                ov.style.zIndex = '0';
                ov.style.pointerEvents = 'none';
                ov.style.background = 'transparent';
                showGameBackdrop();
                set_side(msg.players[0] === me ? 'left' : 'right');
                enableRemoteMode();
                setGameId(msg.gameId);
                pushGame(msg.gameId);
                connectWebSocket();
            }

            bracketHint.textContent = 'A match is running…';
        }

        if (msg.type === 'matchFinished') {
            if (msg.gameId === finalGameId) {
                setSlot(6, msg.winnerId);
            } else if (semiMap[msg.gameId]) {
                const isTopHalf = round1.slice(0, 2).includes(msg.winnerId);
                setSlot((isTopHalf ? 4 : 5) as 4 | 5, msg.winnerId);
            }
            bracketHint.textContent = 'Waiting for next match…';
        }
        if (msg.type === 'tournamentFinished') {
            const ov = document.getElementById('tournament-overlay')!;
            ov.style.zIndex = '40';
            ov.style.pointerEvents = 'auto';
            ov.style.background = 'rgba(0,0,0,0.6)';
            hideGameBackdrop();
            setSlot(6, msg.winnerId);
            bracketHint.textContent = `🏆 Winner: ${msg.winnerId}`;

            localStorage.removeItem('tournamentCode');
            code = '';
            pushHome();
        }
    });

    socket.addEventListener('close', () => {
        localStorage.removeItem('tournamentCode');
        code = '';
    });
}

function updateSlots(players: Array<number | { id: number; username: string }>) {
    const stored = localStorage.getItem('user');
    const raw = stored ? JSON.parse(stored) : null;
    const me = raw ? Number(raw.id ?? raw.userId) : NaN;

    if (players.length === 4 && round1.length === 0) {
        round1 = players.map((p) => (typeof p === 'number' ? p : p.id));
    }

    slotEls.forEach((el, i) => {
        if (i > 3) return;

        const player = players[i];
        if (!player) {
            el.textContent = '—';
            return;
        }

        const id = typeof player === 'number' ? player : player.id;
        const name = typeof player === 'number' ? String(player) : player.username;

        idToName.set(id, name);
        el.textContent = id === me ? YOU : name;
    });
}

function goto(el: HTMLElement) {
    [stepMain, stepJoin, stepBracket].forEach((s) => s.classList.add('hidden'));
    el.classList.remove('hidden');
}

function showOverlay(overlay: HTMLElement, inner?: HTMLElement) {
    overlay.classList.remove('hidden', 'opacity-0');
    if (inner) inner.classList.remove('scale-95', 'opacity-0');
}

function hideOverlay(overlay: HTMLElement, inner?: HTMLElement) {
    if (inner) inner.classList.add('scale-95', 'opacity-0');
    overlay.classList.add('hidden');
}

export function initTournamentModal(): void {
    showOverlay(ov, box);
    pushOverlay('tournament-overlay', 'tour-step-main');
    // 1. make sure the first panel is shown
    goto(stepMain);

    // 2. clear previous input / errors
    codeInput.value = '';
    errorEl.textContent = '';

    // 3. actually show the overlay with a nice pop-animation
    showOverlay(ov, stepMain); // ‘ov’ = overlay, ‘stepMain’ = inner content
}

document.getElementById('tour-join-btn')?.addEventListener('click', () => {
    goto(stepJoin); // show the “Enter Code” panel
    codeInput.focus(); // put cursor in the input for convenience
});

document.getElementById('tour-back-btn')?.addEventListener('click', () => {
    goto(stepMain); // back to Create / Join choice
});

/* CLOSE via × or Esc */
/* CLOSE via × button */
closeBtn.addEventListener('click', () => {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close(1000, 'left'); // tell server we’re gone
    }
    hideOverlay(ov, box);
    pushHome();
});

/* CLOSE via Esc key */
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !ov.classList.contains('hidden')) {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.close(1000, 'left');
        }
        hideOverlay(ov, box);
        pushHome();
    }
});
