// backend/routes/tournamentSocketRoutes.ts
import type { FastifyRequest }       from 'fastify';
import type { FastifyInstance }      from 'fastify';
import type { WebSocket }            from 'ws';
import { verifyToken }               from '../utils/jwt';
import {
  attachSocket,
  detachSocket,
  tours,
  leaveTournament
} from '../tournamentManager';
import db from '../utils/db'; 

export default async function tournamentSocketRoutes (fastify: FastifyInstance) {

  fastify.get('/ws/tournament', { websocket:true },
    (socket: WebSocket, request: FastifyRequest) => {

      const { token, code } = request.query as any;
      if (!token || !code)  return socket.close();

      let user;
      try { user = verifyToken(token); }
      catch { return socket.close(); }

      /* attach & immediately detach on close */
      attachSocket(code.toUpperCase(), socket);

      const tour = tours.get(code.toUpperCase());
      if (tour) {
        const pending = db.prepare(`
          SELECT game_id, player1_id AS p1, player2_id AS p2
            FROM matches
           WHERE tournament_id = ?
             AND winner_id IS NULL
        `).all(tour.id) as { game_id:string; p1:number; p2:number }[];

        for (const row of pending) {
          if (row.p1 === user.userId || row.p2 === user.userId) {
            socket.send(JSON.stringify({
              type:    'gameAssigned',
              gameId:  row.game_id,
              players: [ row.p1, row.p2 ]
            }));
          }
        }
      }

      socket.on('close', () => {
  detachSocket(code.toUpperCase(), socket);
  leaveTournament(code.toUpperCase(), user.userId);   // ← remove the leaver
});
  });
}
