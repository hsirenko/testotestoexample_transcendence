import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment variables');
}

const secret: string = JWT_SECRET;

const TOKEN_EXPIRY = '1h';

export interface JWTPayload {
    userId: number;
    username: string;
    email: string;
    twofaPending?: boolean;
}

export function generateToken(payload: JWTPayload): string {
    return jwt.sign(payload, secret, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token: string): JWTPayload {
    try {
        const decoded = jwt.verify(token, secret);
        if (!decoded || typeof decoded !== 'object') {
            throw new Error('Invalid token payload');
        }
        return decoded as JWTPayload;
    } catch (error) {
        throw new Error('Invalid token');
    }
}
