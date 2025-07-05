/* src/tournament.ts  – remote 4-player bracket */
import { pushOverlay, pushGame , pushHome} from './nav_history.js';

import { createTournament, joinTournament } from './api/tournament.js';
import { HOST }                             from './config.js';
import {
  enableRemoteMode,
  setGameId,
  connectWebSocket,
  set_side
} from './main.js';

export { showOverlay, hideOverlay };

/* cache DOM -----------------------------------------------------------*/
const sharePanel   = document.getElementById('tour-share-panel')  as HTMLDivElement;


/* ───── html refs (same IDs as before) ───── */
const ov          = document.getElementById('tournament-overlay')   as HTMLElement;
const box         = document.getElementById('tournament-container') as HTMLElement;
const closeBtn    = document.getElementById("tour-close")!;

const stepMain    = document.getElementById('tour-step-main')!;
const stepCreated = document.getElementById('tour-step-created')!;
const stepJoin    = document.getElementById('tour-step-join')!;
const stepBracket = document.getElementById('tour-step-bracket')!;

/* grab the <div> that will hold the tournament code */
const createdCode = document.getElementById('tour-created-code') as HTMLDivElement;
const codeInput   = document.getElementById('tour-code-input')  as HTMLInputElement;
const errorEl     = document.getElementById('tour-error')!;
const bracketHint = document.getElementById('bracket-hint')!;

const slotEls = Array.from(document.querySelectorAll<HTMLDivElement>('[data-slot]'));
const YOU     = localStorage.getItem('username') ?? 'you';

//tournament remote play background to hide bracket
const backdrop = document.getElementById('game-backdrop')!;


/* ───── runtime state ───── */
let code       = '';
let socket: WebSocket;

const idToName  = new Map<number, string>();   // id  ➜ username
let   round1    : number[] = [];               // initial four players (slot 0-3)
const semiMap   : Record<string, 4 | 5> = {};  // gameId ➜ 4 or 5
let   finalGameId: string | null = null;

/* ★ helper: write winner names into slots 4, 5, 6 */
function setSlot(idx: 4 | 5 | 6, playerId: number) {
  const name = idToName.get(playerId) ?? String(playerId);
  slotEls.forEach(el => {
    if (Number(el.dataset.slot) === idx) el.textContent = name;
  });
}

function showGameBackdrop()  { backdrop.classList.remove('hidden', 'opacity-0'); }
function hideGameBackdrop()  { backdrop.classList.add   ('hidden', 'opacity-0'); }


/*──────────────────────────────────────────────────────────────*
 *  CREATE  (owner)
 *──────────────────────────────────────────────────────────────*/
document.getElementById('tour-create-btn')?.addEventListener('click', async () => {
  try {
    const { code: c } = await createTournament(
      localStorage.getItem('token')!,
      'Bracket'
    );

    code = c;
    localStorage.setItem('tournamentCode', c);   // ★ persist for reloads
    createdCode.textContent = c;

    sharePanel.classList.remove('hidden');       // show “share” strip
    connectWs();                                 // open socket with valid code
    goto(stepBracket);                           // jump to lobby
  } catch (err: any) {
    alert(err.message || err);
  }
});


/*──────────────────────────────────────────────────────────────*
 *  JOIN  (other players)
 *──────────────────────────────────────────────────────────────*/
document.getElementById('tour-join-btn')?.addEventListener('click', async () => {
  try {
    const input = document.getElementById('tour-code-input') as HTMLInputElement;
    code = input.value.trim().toUpperCase();
    await joinTournament(localStorage.getItem('token')!, code);

    localStorage.setItem('tournamentCode', code); // ★ persist for reloads
    sharePanel.classList.add('hidden');           // hide for joiners
    connectWs();                                  // open socket with valid code
    goto(stepBracket);                            // jump to lobby
  } catch (err: any) {
    alert(err.message || err);
  }
});




/*──────────────────────────────────────────────────────────────*
 *  CREATE / JOIN handlers
 *──────────────────────────────────────────────────────────────*/
document.getElementById('tour-create-btn')?.addEventListener('click', async () => {
  try {
    const { code: c } = await createTournament(localStorage.getItem('token')!, 'Bracket');
    code = c;
    createdCode.textContent = c;

    connectWs();                      // connect early
    goto(stepBracket);                // 👈 show bracket immediately
  } catch (err:any) {
    alert(err.message);
  }
});

/*──────────────────────────────────────────────────────────────*
 *  SHARE-CODE copy helper  (NEW)
 *──────────────────────────────────────────────────────────────*/
const copyBtn = document.getElementById('tour-copy-code') as HTMLButtonElement | null;

function flashCopied(btn: HTMLButtonElement) {
  const saved = btn.textContent;
  btn.textContent = 'Copied!';
  setTimeout(() => (btn.textContent = saved), 1500);
}

copyBtn?.addEventListener('click', () => {
  if (!code) return;                                  // nothing to copy

  // Modern Clipboard API – works only on secure origins (HTTPS or localhost)
  if (navigator.clipboard?.writeText) {
    navigator.clipboard
      .writeText(code)
      .then(() => copyBtn && flashCopied(copyBtn))
      .catch(err => alert(`Clipboard error: ${err.message}`));
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
    await joinTournament(localStorage.getItem('token')!, codeInput.value.trim().toUpperCase());
    code = codeInput.value.trim().toUpperCase();
    connectWs();
    goto(stepBracket);
  } catch {
    errorEl.textContent = 'Invalid or full code';
  }
});


/*──────────────────────────────────────────────────────────────*
 *  Web-socket helper  – now clears stale data when finished
 *──────────────────────────────────────────────────────────────*/
function connectWs() {
  /* after a hard-refresh, resurrect the stored code (if any) */
  if (!code) {
    const stored = localStorage.getItem('tournamentCode');
    if (stored) code = stored;
  }
  if (!code) return;            // nothing to connect to → abort

  socket = new WebSocket(
    `ws://${HOST}:3000/ws/tournament?token=${localStorage.getItem('token')}&code=${code}`
  );

  socket.addEventListener('message', ev => {
    const msg = JSON.parse(ev.data);

    if (msg.type === 'tournamentClosed'){
      socket.close();
      hideOverlay(ov, box);
      alert('The creator cancelled the tournament.');
      pushHome();
    }

    /* live roster refresh --------------------------------------------------*/
    if (msg.type === 'playersUpdate') {
      updateSlots(msg.players);

      const missing = 4 - msg.players.length;
      bracketHint.textContent =
        missing > 0
          ? `Waiting for ${missing} more player${missing > 1 ? 's' : ''}…`
          : 'Bracket ready – pairing players…';
    }

    /* server confirms the bracket begins ----------------------------------*/
    if (msg.type === 'tournamentStart') {
      updateSlots(msg.players);
      bracketHint.textContent = 'Pairing players…';
    }

    /* semi-final or final assignment --------------------------------------*/
    if (msg.type === 'gameAssigned' || msg.type === 'finalAssigned') {
      const stored = localStorage.getItem('user');
      const raw    = stored ? JSON.parse(stored) : null;
      const me     = raw ? Number(raw.id ?? raw.userId) : NaN;

      if (msg.type === 'gameAssigned') {
        const [pA]   = msg.players as number[];
        const first  = round1.slice(0, 2).includes(pA); // belongs to semi-1?
        semiMap[msg.gameId] = first ? 4 : 5;
      } else {
        finalGameId = msg.gameId;                       // keep final ID
      }

      if (msg.players.includes(me)) {
        
        //hideOverlay(ov, box);

        const ov = document.getElementById('tournament-overlay')!;
        ov.style.zIndex        = '0';
        ov.style.pointerEvents = 'none';         
        ov.style.background    = 'transparent';
        set_side(msg.players[0] === me ? "left" : "right");


        showGameBackdrop();

        enableRemoteMode();
        setGameId(msg.gameId);
        pushGame(msg.gameId);
        connectWebSocket();          // hook into /ws/game
      }

      bracketHint.textContent = 'A match is running…';
    }


    if (msg.type === 'matchFinished') {
      if (msg.gameId === finalGameId) {
        setSlot(6, msg.winnerId);                      // champion
      } else if (semiMap[msg.gameId]) {
        setSlot(semiMap[msg.gameId], msg.winnerId);    // semi winner
      }
      bracketHint.textContent = 'Waiting for next match…';
    }

    /* tournament over – tidy up & forget the code -------------------------*/
    if (msg.type === 'tournamentFinished') {
      const ov = document.getElementById('tournament-overlay')!;
      ov.style.zIndex        = '40';
      ov.style.pointerEvents = 'auto';
      ov.style.background    = 'rgba(0,0,0,0.6)';
      hideGameBackdrop();
      setSlot(6, msg.winnerId);
      bracketHint.textContent = `🏆 Winner: ${msg.winnerId}`;

      localStorage.removeItem('tournamentCode');  // ← NEW: prevent stale restores
      code = '';                                  // ← NEW
      pushHome();
    }
  });

  /* if the socket ever drops, also remove the stored code */
  socket.addEventListener('close', () => {
    localStorage.removeItem('tournamentCode');    // ← NEW
    code = '';                                    // ← NEW
  });
}



/*──────────────────────────────────────────────────────────────*
 *  UI helpers – identical animation helpers from original file
 *──────────────────────────────────────────────────────────────*/
/* unified slot updater */
/* ── fill the four bracket slots ──────────────────────────── */
/* ── fill the four first-round slots ─────────────────────────── */
function updateSlots(
  players: Array<number | { id: number; username: string }>
) {
  const stored = localStorage.getItem('user');
  const raw    = stored ? JSON.parse(stored) : null;
  const me     = raw ? Number(raw.id ?? raw.userId) : NaN;

  /* remember the original order (once) */
  if (players.length === 4 && round1.length === 0) {
    round1 = players.map(p => (typeof p === 'number' ? p : p.id));
  }

  slotEls.forEach((el, i) => {
    if (i > 3) return;                         // only slots 0-3 here

    const player = players[i];
    if (!player) {
      el.textContent = '—';
      return;
    }

    const id   = typeof player === 'number' ? player         : player.id;
    const name = typeof player === 'number' ? String(player) : player.username;

    idToName.set(id, name);                    // cache for later rounds
    el.textContent = id === me ? YOU : name;
  });
}




function goto(el: HTMLElement) {
  [stepMain, stepJoin, /* stepCreated, */ stepBracket]  // ← removed stepCreated
    .forEach(s => s.classList.add('hidden'));
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
/* CLOSE via × button */
closeBtn.addEventListener('click', () => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.close(1000, 'left');          // tell server we’re gone
  }
  hideOverlay(ov, box);
  pushHome();
});

/* CLOSE via Esc key */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !ov.classList.contains('hidden')) {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.close(1000, 'left');
    }
    hideOverlay(ov, box);
    pushHome();
  }
});
