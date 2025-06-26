// src/api/tournament.ts
import { HOST } from '../config.js';

const API = `https://${HOST}:8443/api`;

export async function createTournament(token: string, name = '4-Player bracket') {
  const res = await fetch(`${API}/tournaments`, {
    method : 'POST',
    headers: {
      'Content-Type' : 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ name })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ code:string; tournamentId:number }>;
}

export async function joinTournament(token: string, code: string) {
  const res = await fetch(`${API}/tournaments/join`, {
    method : 'POST',
    headers: {
      'Content-Type' : 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ code })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ ok:boolean; tournamentId:number }>;
}
