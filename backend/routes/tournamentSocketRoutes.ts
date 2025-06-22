// backend/routes/tournamentSocketRoutes.ts
import type { FastifyRequest }       from 'fastify';
import type { FastifyInstance }      from 'fastify';
import type { WebSocket }            from 'ws';
import { verifyToken }               from '../utils/jwt';
import {
  attachSocket,
  detachSocket
} from '../tournamentManager';

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
      socket.on('close', () => detachSocket(code.toUpperCase(), socket));
  });
}
