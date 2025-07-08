import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken } from '../utils/jwt';

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
    try {
        request.log.info({ headers: request.headers }, 'incoming headers');
        const authHeader = request.headers.authorization;
        if (!authHeader) {
            return reply.status(401).send({ error: 'No authorization header' });
        }

        const token = authHeader.split(' ')[1];
        if (!token) {
            return reply.status(401).send({ error: 'No token provided' });
        }

        const decoded = verifyToken(token);
        (request as any).user = decoded;
    } catch (error) {
        return reply.status(401).send({ error: 'Unauthorized' });
    }
}
