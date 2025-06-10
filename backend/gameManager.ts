// backend/gameManager.ts
import { Game } from './game';

// Active games by their IDs
export const games = new Map<string, Game>();