import { FastifyInstance } from 'fastify';
import db from '../utils/db';
import { hashPassword } from '../utils/hash';

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidPassword(password: string): boolean {
  const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
  return passwordRegex.test(password);
}

export default async function signupRoutes(fastify: FastifyInstance) {
  fastify.post('/signup', async (req, reply) => {
  const { username, email, password } = req.body as {
    username: string;
    email: string;
    password: string;
  };

  if (!username || !email || !password) {
    return reply.status(400).send({ error: 'All fields are required' });
  }

  if (username.length < 2) {
    return reply.status(400).send({ error: 'Username must be at least 2 characters long' });
  }

  if (!isValidEmail(email)) {
    return reply.status(400).send({ error: 'Invalid email format' });
  }

  if (!isValidPassword(password)) {
    return reply.status(400).send({
      error: 'Password must be at least 8 characters long and include a lowercase, uppercase, number, and special character'
    });
  }

  const existing = db
    .prepare('SELECT * FROM users WHERE username = ? OR email = ?')
    .get(username, email);

  if (existing) {
    return reply.status(400).send({ error: 'Username or email already taken' });
  }

  const password_hash = hashPassword(password);

  const stmt = db.prepare(`
    INSERT INTO users (username, email, password_hash)
    VALUES (?, ?, ?)
  `);
  const result = stmt.run(username, email, password_hash);

  return reply.send({ message: 'User created', user_id: result.lastInsertRowid });
});

}
