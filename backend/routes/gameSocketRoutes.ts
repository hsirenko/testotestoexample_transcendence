// backend/routes/gameSocketRoutes.ts
import type { FastifyRequest } from 'fastify';
import type { WebSocket }       from 'ws';
import { FastifyInstance }      from 'fastify';
import db                       from '../utils/db';
import { games }                from '../gameManager';
import { verifyToken }          from '../utils/jwt';
import { Game, ClientMsgJoin, ClientMsgMove, ClientMsgStart } from '../game';
import { handleGameResult } from '../tournamentManager';

export default async function gameSocketRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/ws/game',
    { websocket: true },
    (socket: WebSocket, request: FastifyRequest) => {
      // authenticate
      const token = (request.query as any).token;
      let user;
      try {
        user = verifyToken(token);
      } catch {
        socket.send(JSON.stringify({ type: 'error', message: 'Invalid token.' }));
        return socket.close();
      }

      let currentGame: Game;
      let side: 'left' | 'right';
      console.log('[server] new WS connection');

      socket.on('message', async raw => {
        const msg = JSON.parse(raw.toString()) as ClientMsgJoin|ClientMsgStart|ClientMsgMove;

        // ───────────── JOIN ─────────────────────────────────────────
        if (msg.type === 'join') {
          currentGame = games.get(msg.gameId)!;
          if (!currentGame || currentGame.players.size >= 2) {
            socket.send(JSON.stringify({ type: 'error', message: 'Cannot join.' }));
            return socket.close();
          }

          side = currentGame.players.size === 0 ? 'left' : 'right';
          currentGame.players.set(side, { ws: socket, userId: user.userId });
          console.log(`[server] ${user.userId} joined as ${side}`);

          // once both here, broadcast ready *and* create the DB match row:
          if (currentGame.players.size === 2) {
            const leftInfo  = currentGame.players.get('left')!;
            const rightInfo = currentGame.players.get('right')!;
            // 1) notify clients to start
            leftInfo.ws.send(JSON.stringify({
              type:       'ready',
              opponentId: rightInfo.userId
            }));
            rightInfo.ws.send(JSON.stringify({
              type:       'ready',
              opponentId: leftInfo.userId
            }));

            // 2) create a new match row in SQLite
			let row = db
			.prepare(`SELECT id FROM matches WHERE game_id = ?`)
			.get(currentGame.id) as { id: number } | undefined;

			if (!row) {
			// stand-alone 1-vs-1 game → create a fresh row
			const insert = db.prepare(`
				INSERT INTO matches (game_id, tournament_id, player1_id, player2_id)
				VALUES (?, NULL, ?, ?)
			`).run(currentGame.id, leftInfo.userId, rightInfo.userId);

			currentGame.dbMatchId = Number(insert.lastInsertRowid);
			} else {
			// tournament match → row already exists, just keep its id
			currentGame.dbMatchId = row.id;
			}
          }
          return;
        }

        // ───────────── START ────────────────────────────────────────
        if (msg.type === 'start') {
          currentGame.start();
          return;
        }

        // ───────────── MOVE ─────────────────────────────────────────
        if (msg.type === 'move') {
          currentGame.handleInput(side, msg.dir);
        }
      });

      // ───────────── CLEANUP / END ─────────────────────────────────
      socket.on('close', () => {
        if (!currentGame || !side) return;

        // 1) if the other side is still connected, force-end the game
        const opponentSide = side === 'left' ? 'right' : 'left';
        if (currentGame.players.has(opponentSide)) {
          // this triggers your in-memory physics to decide final scores
          currentGame.end(opponentSide);
        }

        // 2) extract DB info
        if (currentGame.dbMatchId == null) {
		  console.error("No dbMatchId on game:", currentGame.id);
		  return;
		}
		const matchId = currentGame.dbMatchId;
        const leftScore  = currentGame.scores.left;
        const rightScore = currentGame.scores.right;

        // compute winner & loser IDs
        const winnerSide = leftScore > rightScore ? 'left' : 'right';
        const winnerId   = currentGame.players.get(winnerSide)!.userId;
        const loserId    = currentGame.players.get(
          winnerSide === 'left' ? 'right' : 'left'
        )!.userId;

		handleGameResult(currentGame.id,
                 winnerId,
                 loserId,
                 leftScore,
                 rightScore);

        // 3) perform the same UPDATE + XP/trophy logic
        const tx = db.transaction(() => {
          db.prepare(`
            UPDATE matches
            SET winner_id = ?, score_p1 = ?, score_p2 = ?, played_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(
            winnerId,
            leftScore,
            rightScore,
            matchId
          );

          db.prepare(`
            UPDATE users
            SET xp_level = xp_level + 0.3, trophies = trophies + 30
            WHERE id = ?
          `).run(winnerId);

          const loser = db.prepare(`SELECT trophies FROM users WHERE id = ?`)
                          .get(loserId);
          const newTrophies = Math.max(0, loser.trophies - 15);

          db.prepare(`
            UPDATE users
            SET xp_level = xp_level + 0.1, trophies = ?
            WHERE id = ?
          `).run(newTrophies, loserId);
        });
        tx();

        // 4) finally, remove the game from memory
        games.delete(currentGame.id);
        console.log(`[server] match ${matchId} closed, winner=${winnerId}`);
      });
    }
  );
}
