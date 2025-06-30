/* src/tournament.ts  – remote 4-player bracket */
import { pushOverlay, pushGame , pushHome} from './nav_history.js';

import { createTournament, joinTournament } from './api/tournament.js';
import { HOST }                             from './config.js';
import {
  enableRemoteMode,
  setGameId,
  connectWebSocket
} from './main.js';

export { showOverlay, hideOverlay };

/* ───── html refs (same IDs as before) ───── */
const ov          = document.getElementById('tournament-overlay')   as HTMLElement;
const box         = document.getElementById('tournament-container') as HTMLElement;
const closeBtn    = document.getElementById("tour-close")!;

const stepMain    = document.getElementById('tour-step-main')!;
const stepCreated = document.getElementById('tour-step-created')!;
const stepJoin    = document.getElementById('tour-step-join')!;
const stepBracket = document.getElementById('tour-step-bracket')!;

const createdCode = document.getElementById('tour-created-code')!;
const codeInput   = document.getElementById('tour-code-input')  as HTMLInputElement;
const errorEl     = document.getElementById('tour-error')!;
const bracketHint = document.getElementById('bracket-hint')!;

const slotEls = Array.from(document.querySelectorAll<HTMLDivElement>('[data-slot]'));
const YOU     = localStorage.getItem('username') ?? 'you';

/* ───── runtime state ───── */
let code       = '';
let socket: WebSocket;

/*──────────────────────────────────────────────────────────────*
 *  CREATE / JOIN handlers
 *──────────────────────────────────────────────────────────────*/
document.getElementById('tour-create-btn')?.addEventListener('click', async () => {
  try {
    const { code: c } = await createTournament(localStorage.getItem('token')!, 'Bracket');
    code = c;
    createdCode.textContent = c;
    goto(stepCreated);

    connectWs();                      // connect early
  } catch (err:any) {
    alert(err.message);
  }
});

document.getElementById('tour-confirm-join-btn')?.addEventListener('click', async () => {
  try {
    await joinTournament(localStorage.getItem('token')!, codeInput.value.trim().toUpperCase());
    code = codeInput.value.trim().toUpperCase();
    connectWs();
    goto(stepBracket);
  } catch {
    errorEl.textContent = 'Invalid or full code';
  }
});

/*──────────────────────────────────────────────────────────────*
 *  Web-socket helper
 *──────────────────────────────────────────────────────────────*/
function connectWs() {
  socket = new WebSocket(
    `ws://${HOST}:3000/ws/tournament?token=${localStorage.getItem('token')}&code=${code}`
  );

  socket.addEventListener('message', ev => {
    const msg = JSON.parse(ev.data);

    /* live roster refresh */
    if (msg.type === 'playersUpdate') {
      updateSlots(msg.players);

      const missing = 4 - msg.players.length;
      bracketHint.textContent =
        missing > 0
          ? `Waiting for ${missing} more player${missing > 1 ? 's' : ''}…`
          : 'Bracket ready – pairing players…';
    }

    /* server confirms the bracket begins */
    if (msg.type === 'tournamentStart') {
      updateSlots(msg.players);
      bracketHint.textContent = 'Pairing players…';
    }

    /* semi-final or final assignment */
    if (msg.type === 'gameAssigned' || msg.type === 'finalAssigned') {
      const stored = localStorage.getItem('user');
      const raw    = stored ? JSON.parse(stored) : null;
      const me     = raw ? Number(raw.id ?? raw.userId) : NaN;

      if (msg.players.includes(me)) {
        hideOverlay(ov, box);          // leave the bracket modal
        enableRemoteMode();
        setGameId(msg.gameId);
        pushGame(msg.gameId);
        connectWebSocket();            // hook into /ws/game
      }

      bracketHint.textContent = 'A match is running…';
    }

    if (msg.type === 'tournamentFinished') {
      bracketHint.textContent = `🏆 Winner: ${msg.winnerId}`;
      pushHome();
    }
  });
}

/*──────────────────────────────────────────────────────────────*
 *  UI helpers – identical animation helpers from original file
 *──────────────────────────────────────────────────────────────*/
/* unified slot updater */
/* ── fill the four bracket slots ──────────────────────────── */
function updateSlots(
  players: Array<number | { id: number; username: string }>
) {
  const stored = localStorage.getItem('user');
  const raw    = stored ? JSON.parse(stored) : null;
  const me     = raw ? Number(raw.id ?? raw.userId) : NaN;

  slotEls.forEach((el, i) => {
    const player = players[i];

    if (!player) {
      el.textContent = '—';
      return;
    }

    const id   = typeof player === 'number' ? player         : player.id;
    const name = typeof player === 'number' ? String(player) : player.username;

    el.textContent = id === me ? YOU : name;
  });
}



function goto(el:HTMLElement) {
  [stepMain, stepCreated, stepJoin, stepBracket].forEach(s => s.classList.add('hidden'));
  el.classList.remove('hidden');
}

/*──── exported overlay helpers (unchanged) ────*/
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
  showOverlay(ov, stepMain);      // ‘ov’ = overlay, ‘stepMain’ = inner content
}

document.getElementById('tour-join-btn')?.addEventListener('click', () => {
  goto(stepJoin);          // show the “Enter Code” panel
  codeInput.focus();       // put cursor in the input for convenience
});

document.getElementById('tour-back-btn')?.addEventListener('click', () => {
  goto(stepMain);          // back to Create / Join choice
});

/* CLOSE via × or Esc */
closeBtn.addEventListener('click', () => {
  hideOverlay(ov, box);
  pushHome();                                            // NEW
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !ov.classList.contains('hidden')) {
    hideOverlay(ov, box);
    pushHome();                                          // NEW
  }
});