// backend/tournamentManager.ts
import { randomBytes } from "crypto";
import db from "./utils/db";
import { Game } from "./game";
import { games } from "./gameManager";
import type { WebSocket } from "ws";

export interface LiveTournament {
  id: number;
  code: string;
  playerIds: number[];
  sockets: Set<WebSocket>;
  semiGames: string[]; // 2× gameId
  finalGame?: string;
  winnerId?: number;
}

const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const genCode = (): string => {
  const bytes = randomBytes(8);
  let code = "";
  for (let i = 0; i < 8; i++) code += ALPHA[bytes[i] % ALPHA.length];
  return code;
};
export const tours = new Map<string, LiveTournament>(); // key = code
const gameToTourCode = new Map<string, string>(); // reverse lookup

/**
 * Remove a single player that leaves before the bracket starts.
 * If that player is the creator (first entry in playerIds), the whole
 * tournament is cancelled and every other player is kicked out.
 */
export function leaveTournament(code: string, userId: number): void {
  const tour = tours.get(code);
  if (!tour) return;

  /* creator leaves → cancel everything (only if not started) */
  const isCreator = userId === tour.playerIds[0];
  if (isCreator && tour.semiGames.length === 0) {
    cancelTournament(code);
    return;
  }

  /* normal player leaves (and tour not started) */
  const idx = tour.playerIds.indexOf(userId);
  if (idx === -1) return;
  if (tour.semiGames.length > 0) return; // already running

  tour.playerIds.splice(idx, 1);

  db.prepare(
    `
      DELETE FROM tournament_players
       WHERE tournament_id = ? AND user_id = ?
  `
  ).run(tour.id, userId);

  const roster = tour.playerIds.map((id) => {
    const { username } = db
      .prepare("SELECT username FROM users WHERE id = ?")
      .get(id) as { username: string };
    return { id, username };
  });
  broadcast(tour, { type: "playersUpdate", players: roster });
}

/*──────────── public helpers ─────────────────────────────────────*/
export function createTournament(
  name: string,
  creatorId: number
): LiveTournament {
  const code = genCode();
  const insert = db
    .prepare(`INSERT INTO tournaments (name, code, created_by) VALUES (?,?,?)`)
    .run(name, code, creatorId);

  const tour: LiveTournament = {
    id: Number(insert.lastInsertRowid),
    code,
    playerIds: [creatorId],
    sockets: new Set(),
    semiGames: [],
  };
  tours.set(code, tour);
  db.prepare(
    `INSERT INTO tournament_players (tournament_id, user_id) VALUES (?,?)`
  ).run(tour.id, creatorId);
  return tour;
}

export function cancelTournament(code: string): void {
  const tour = tours.get(code);
  if (!tour) return;

  /* 1 – tell every client the tour is gone */
  broadcast(tour, { type: "tournamentClosed" });

  /* 2 – close all sockets gracefully */
  for (const sock of tour.sockets) {
    try {
      sock.close(1000, "tournament cancelled");
    } catch (_) {
      /* ignore */
    }
  }

  /* 3 – remove from DB */
  db.prepare("DELETE FROM tournament_players WHERE tournament_id = ?").run(
    tour.id
  );
  db.prepare("DELETE FROM tournaments WHERE id = ?").run(tour.id);

  /* 4 – purge from RAM */
  tours.delete(code);
}

/* ── join a tournament ────────────────────────────────────── */
export function joinTournament(code: string, userId: number): LiveTournament {
  const tour = tours.get(code);
  if (!tour) throw new Error("NOT_FOUND");
  if (tour.playerIds.includes(userId)) return tour;
  if (tour.playerIds.length >= 4) throw new Error("FULL");

  /* 1 – persist & keep in-memory */
  tour.playerIds.push(userId);
  db.prepare(
    `
      INSERT INTO tournament_players (tournament_id, user_id)
      VALUES (?,?)
  `
  ).run(tour.id, userId);

  /* 2 – broadcast the updated roster */
  const roster = tour.playerIds.map((id) => {
    const { username } = db
      .prepare("SELECT username FROM users WHERE id = ?")
      .get(id) as { username: string };
    return { id, username };
  });
  broadcast(tour, { type: "playersUpdate", players: roster });

  /* 3 – start automatically when the 4th player arrives */
  if (tour.playerIds.length === 4) startTournament(tour);

  return tour;
}

export function attachSocket(code: string, ws: WebSocket) {
  const tour = tours.get(code);
  if (!tour) return;

  tour.sockets.add(ws);

  /* send the current roster immediately */
  const roster = tour.playerIds.map((id) => {
    const { username } = db
      .prepare("SELECT username FROM users WHERE id = ?")
      .get(id) as { username: string };
    return { id, username };
  });

  try {
    ws.send(JSON.stringify({ type: "playersUpdate", players: roster }));
  } catch {
    /* ignore broken pipe */
  }
}

export function detachSocket(code: string, ws: WebSocket) {
  const tour = tours.get(code);
  if (tour) tour.sockets.delete(ws);
}

export function handleGameResult(
  gameId: string,
  winnerId: number,
  loserId: number,
  scoreP1: number,
  scoreP2: number
) {
  const code = gameToTourCode.get(gameId);
  if (!code) return;

  const tour = tours.get(code)!;
  const match = db
    .prepare(`SELECT id FROM matches WHERE game_id = ?`)
    .get(gameId) as { id: number };

  db.prepare(
    `
    UPDATE matches
       SET winner_id = ?, score_p1 = ?, score_p2 = ?, played_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(winnerId, scoreP1, scoreP2, match.id);

  broadcast(tour, {
    type: "matchFinished",
    winnerId, // numeric id
    gameId, // so clients can ignore if it’s not their match
  });
  /* If a semi just ended we may have to start the final */
  if (
    tour.semiGames.includes(gameId) &&
    !tour.finalGame &&
    tour.semiGames.every((g) => isFinished(g))
  ) {
    const [g1, g2] = tour.semiGames;
    const w1 = fetchWinner(g1),
      w2 = fetchWinner(g2);
    startFinal(tour, w1, w2);
    return;
  }

  /* If the final ended the tournament is over */
  if (tour.finalGame === gameId) {
    tour.winnerId = winnerId;
    db.prepare(
      `UPDATE tournaments SET status='finished', winner_id=? WHERE id=?`
    ).run(winnerId, tour.id);
    broadcast(tour, { type: "tournamentFinished", winnerId });
  }
}

/*──────────── internal helpers ───────────────────────────────────*/
function startTournament(tour: LiveTournament) {
  db.prepare(`UPDATE tournaments SET status = 'running' WHERE id = ?`).run(
    tour.id
  );

  /* create & announce the two semi-finals */
  for (let i = 0; i < 2; ++i) {
    const p1 = tour.playerIds[i * 2];
    const p2 = tour.playerIds[i * 2 + 1];

    const gameId = createGameRowAndInstance(tour, p1, p2);
    tour.semiGames.push(gameId);

    broadcast(tour, {
      type: "gameAssigned",
      gameId,
      players: [p1, p2],
    });
  }

  /* final “ready” notification with usernames */
  const playersPayload = tour.playerIds.map((id) => {
    const { username } = db
      .prepare("SELECT username FROM users WHERE id = ?")
      .get(id) as { username: string };
    return { id, username };
  });
  broadcast(tour, { type: "tournamentStart", players: playersPayload });
}

function startFinal(tour: LiveTournament, p1: number, p2: number) {
  const gameId = createGameRowAndInstance(tour, p1, p2);
  tour.finalGame = gameId;
  broadcast(tour, { type: "finalAssigned", gameId, players: [p1, p2] });
}

function createGameRowAndInstance(
  tour: LiveTournament,
  p1: number,
  p2: number
) {
  const gameId = genCode(); // reuse same alphabet/length
  const game = new Game(gameId);
  games.set(gameId, game);
  gameToTourCode.set(gameId, tour.code);

  db.prepare(
    `INSERT INTO matches (tournament_id, game_id, player1_id, player2_id)
    VALUES (?,?,?,?)`
  ).run(tour.id, gameId, p1, p2);

  return gameId;
}

function broadcast(tour: LiveTournament, payload: unknown) {
  tour.sockets.forEach((ws) => {
    try {
      ws.send(JSON.stringify(payload));
    } catch {
      /* ignore broken sockets */
    }
  });
}

function isFinished(gameId: string) {
  const row = db
    .prepare(`SELECT winner_id FROM matches WHERE game_id=?`)
    .get(gameId) as { winner_id: number | null };
  return row.winner_id != null;
}

function fetchWinner(gameId: string) {
  const row = db
    .prepare(`SELECT winner_id FROM matches WHERE game_id=?`)
    .get(gameId) as { winner_id: number };
  return row.winner_id;
}
