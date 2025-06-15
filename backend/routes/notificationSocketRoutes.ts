// backend/routes/notificationSocketRoutes.ts
import fp from 'fastify-plugin';
import { FastifyInstance, FastifyRequest } from 'fastify';
import type { WebSocket } from 'ws';
import { verifyToken } from '../utils/jwt';

export default fp(async function notifSocketRoutes (fastify: FastifyInstance) {
  // the Map sits on the *root* instance now
  fastify.decorate('notifConns', new Map<number, WebSocket>());

  fastify.get('/ws/notifications', { websocket: true }, (socket: WebSocket, req: FastifyRequest) => {
    const token = (req.query as any).token as string;
    if (!token) return socket.close();

    let user;
    try { user = verifyToken(token); }
    catch { return socket.close(); }

    fastify.log.debug(`notif-ws: user ${user.userId} connected`);
    fastify.notifConns.set(user.userId, socket);

    socket.on('close', () => {
      fastify.log.debug(`notif-ws: user ${user.userId} disconnected`);
      fastify.notifConns.delete(user.userId);
    });
  });
});