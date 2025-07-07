import 'fastify';
import '@fastify/oauth2';
import "@fastify/multipart";
import WebSocket from 'ws';
import { JWTPayload } from '../utils/jwt';
import { OAuth2Namespace } from '@fastify/oauth2';
import { MultipartFile } from "@fastify/multipart";

declare module 'fastify' {
  interface FastifyRequest {
    user: JWTPayload;

    isMultipart(): boolean;
    file(opts?: any): Promise<MultipartFile>;
    files(opts?: any): AsyncIterableIterator<MultipartFile>
  }

  interface FastifyInstance {
    googleOAuth2: OAuth2Namespace;
	notifConns: Map<number, WebSocket>;
  presence:   Set<number>;
  }
}