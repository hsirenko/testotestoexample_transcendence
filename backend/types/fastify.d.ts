// backend/types/fastify.d.ts

import 'fastify';
import '@fastify/oauth2';
import WebSocket from 'ws';
import { JWTPayload } from '../utils/jwt';
import { OAuth2Namespace } from '@fastify/oauth2';

declare module 'fastify' {
  interface FastifyRequest {
    user: JWTPayload;
  }

  interface FastifyInstance {
    googleOAuth2: OAuth2Namespace;
	notifConns: Map<number, WebSocket>;
  }

  interface FastifyRequest {
    locals: {
      realIpHeader?: string;
    };
  }
}