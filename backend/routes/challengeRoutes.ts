import { FastifyInstance } from "fastify";
import db from "../utils/db";
import { authMiddleware } from "../middleware/auth";
import { JWTPayload } from "../utils/jwt";

export default async function challengeRoutes(fastify: FastifyInstance) {
  // POST /api/challenge
  // { toUserId: number }
  fastify.post(
    "/api/challenge",
    { preHandler: authMiddleware },
    async (req, reply) => {
      const { userId: fromUserId } = (req as any).user as JWTPayload;
      const { toUserId, gameId } = req.body as {
        toUserId: number;
        gameId: string;
      };

      /* Store a row so the bell badge works even if the user is offline */
      const info = db
        .prepare(
          `INSERT INTO notifications
            (user_id, type, reference_id, text)
          VALUES (?, 'challenge', ?, ?)`
        )
        .run(
          toUserId,
          fromUserId,
          `Player ${fromUserId} has challenged you!`
        );

      const notifId = info.lastInsertRowid;

      /* Push the notification live if the target is online */
      const conn = fastify.notifConns.get(toUserId);
      if (conn) {
        conn.send(
          JSON.stringify({
            id: notifId,
            type: "challenge",
            reference_id: fromUserId,
            gameId,                        // key part: share the room ID
            text: `Player ${fromUserId} has challenged you!`,
            date: new Date().toISOString(),
            read: false,
          })
        );
      }

      return reply.send({ success: true });
    }
  );
}
