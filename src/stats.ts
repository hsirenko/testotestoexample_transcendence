/**
 * stats.ts – all graphs & cards in the Stats tab
 * Strict-mode TypeScript
 */

declare const Chart: any; // Chart.js from CDN

import {
  WinsTotalDTO,
  GoalsTotalDTO,
  MonthlyGoalsRowDTO,
  MonthlyGoalsDTO,
  MonthlyWinRateDTO,
  MonthlyNumsDTO,
  LongestHitDTO,
  TrophyDTO,
} from "./types.js";
import { HOST } from './config.js';

// test();

/* toggle mock data */
const USE_MOCK_DATA = false;

/* base URL */
const API_BASE = `http://${HOST}:3000`;

/* REST endpoints */
const ENDPOINT = {
  winsMonth: `${API_BASE}/api/stats/monthly-wins`,
  winsTotal: `${API_BASE}/api/stats/wins`,
  goalsTotal: `${API_BASE}/api/stats/goals`,
  goalsMonth: `${API_BASE}/api/stats/monthly-goals`,
  longest: `${API_BASE}/api/stats/longest-hit`,
  trophy: `${API_BASE}/api/users/me/trophies`,
};

/* mock payloads (optional offline mode) */
const MOCK = {
  winsMonth: [14, 7, 9, 11, 13, 8, 10, 12, 6, 9, 15, 11] as MonthlyNumsDTO,
  winsTotal: { wins: 69, losses: 31 } as WinsTotalDTO,
  goalsTotal: { scored: 120, conceded: 95 } as GoalsTotalDTO,
  goalsMonth: {
    scored: [10, 9, 8, 12, 11, 10, 13, 12, 9, 8, 15, 13],
    conceded: [7, 8, 6, 9, 8, 7, 9, 10, 7, 6, 11, 10],
  } as MonthlyGoalsDTO,
  longest: { longest: 37, opponent: "Karim" } as LongestHitDTO,
  trophy: { total: 420 } as TrophyDTO,
};

/* one-time init guard */
let loaded = false;
export function initStatsTab(): void {
  if (loaded) return;
  loaded = true;

  drawMonthlyWins();
  drawLifePie();
  drawGoalsPie();
  drawMonthlyGoalsBars();
  renderTrophies();
}

/* ───── helpers ───── */
function last12Labels(d: Date = new Date()): string[] {
  return Array.from({ length: 12 }, (_, i) =>
    new Date(d.getFullYear(), d.getMonth() - 11 + i, 1).toLocaleString(
      "en-US",
      { month: "short", year: "numeric" }
    )
  );
}

function getAuthHeader(): HeadersInit {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
}

// async function fetchJSON<T>(url: string): Promise<T> {
//   const r = await fetch(url, { credentials: "include" });
//   if (!r.ok) throw new Error(String(r.status));
//   return (await r.json()) as T;
// }

async function fetchJSON<T>(url: string): Promise<T> {
  const r = await fetch(url, {
    headers: getAuthHeader(),
  });
  if (!r.ok) throw new Error(String(r.status));
  return (await r.json()) as T;
}

/* 1) Monthly win-rate bar */
async function drawMonthlyWins(): Promise<void> {
  const labels = last12Labels();

  const raw = USE_MOCK_DATA
    ? labels.map((_, i) => ({
        month: labels[i].slice(0, 3),
        winRate: MOCK.winsMonth[i] ?? 0,
      }))
    : await fetchJSON<MonthlyWinRateDTO[]>(ENDPOINT.winsMonth).catch(() => []);

  const dict: Record<string, number> = {};
  for (const r of raw) dict[r.month] = r.winRate;

  const data = labels.map((lbl) => dict[lbl.slice(0, 3)] ?? 0);

  new Chart(document.getElementById("monthly-chart") as HTMLCanvasElement, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Win rate (%)",
          data,
          backgroundColor: "rgba(252,211,77,0.9)",
        },
      ],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { color: "#fff" } },
        x: { ticks: { color: "#fff" } },
      },
    },
  });
}

/* 2) Life-time wins vs losses pie */
async function drawLifePie(): Promise<void> {
  const t = USE_MOCK_DATA
    ? MOCK.winsTotal
    : await fetchJSON<WinsTotalDTO>(ENDPOINT.winsTotal).catch(() => ({
        wins: 0,
        losses: 0,
      }));

  new Chart(document.getElementById("life-chart") as HTMLCanvasElement, {
    type: "pie",
    data: {
      labels: ["Wins", "Losses"],
      datasets: [
        {
          data: [t.wins, t.losses],
          backgroundColor: ["#4ade80", "#f87171"],
        },
      ],
    },
    options: {
      plugins: { legend: { labels: { color: "#fff", boxWidth: 10 } } },
    },
  });
}

/* 3) Total goals pie */
async function drawGoalsPie(): Promise<void> {
  const g = USE_MOCK_DATA
    ? MOCK.goalsTotal
    : await fetchJSON<GoalsTotalDTO>(ENDPOINT.goalsTotal).catch(() => ({
        scored: 0,
        conceded: 0,
      }));

  new Chart(document.getElementById("goals-chart") as HTMLCanvasElement, {
    type: "pie",
    data: {
      labels: ["Scored", "Conceded"],
      datasets: [
        {
          data: [g.scored, g.conceded],
          backgroundColor: ["#38bdf8", "#f87171"],
        },
      ],
    },
    options: {
      plugins: { legend: { labels: { color: "#fff", boxWidth: 10 } } },
    },
  });
}

/* 4) Monthly goals scored vs conceded bars */
async function drawMonthlyGoalsBars(): Promise<void> {
  const labels = last12Labels();

  const raw = USE_MOCK_DATA
    ? labels.map((_, i) => ({
        month: labels[i].slice(0, 3),
        scored: MOCK.goalsMonth.scored[i] ?? 0,
        conceded: MOCK.goalsMonth.conceded[i] ?? 0,
      }))
    : await fetchJSON<MonthlyGoalsRowDTO[]>(ENDPOINT.goalsMonth).catch(
        () => []
      );

  const scoredDict: Record<string, number> = {};
  const concDict: Record<string, number> = {};
  for (const r of raw) {
    scoredDict[r.month] = r.scored;
    concDict[r.month] = r.conceded;
  }

  const scored = labels.map((lbl) => scoredDict[lbl.slice(0, 3)] ?? 0);
  const conceded = labels.map((lbl) => concDict[lbl.slice(0, 3)] ?? 0);

  new Chart(document.getElementById("hits-chart") as HTMLCanvasElement, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Scored",
          data: scored,
          backgroundColor: "rgba(34,211,238,0.9)",
        },
        {
          label: "Conceded",
          data: conceded,
          backgroundColor: "rgba(248,113,113,0.9)",
        },
      ],
    },
    options: {
      plugins: { legend: { labels: { color: "#fff" } } },
      scales: {
        y: { beginAtZero: true, ticks: { color: "#fff" } },
        x: { ticks: { color: "#fff" } },
      },
    },
  });
}

// /* 5) Cards – streak + trophies only */
// function setCardText(sel: string, txt: string): void {
//   const el = document.querySelector<HTMLElement>(sel);
//   if (el) el.textContent = txt;
// }

/* 5-a  current win-streak */
// async function renderStreak(): Promise<void> {
//   const streak = USE_MOCK_DATA
//     ? MOCK.streak.streak
//     : await fetchJSON<StreakDTO>(ENDPOINT.streak)
//         .then((d) => d.streak)
//         .catch(() => 0);

//   setCardText("#streak-card span", String(streak));
// }

/* 5-b  total trophies */
async function renderTrophies(): Promise<void> {
  const total = USE_MOCK_DATA
    ? MOCK.trophy.total
    : await fetchJSON<TrophyDTO>(ENDPOINT.trophy)
        .then((d) => d.total)
        .catch(() => 0);

  (document.getElementById("trophies") as HTMLElement).innerHTML = `
    <div class="flex flex-col items-center justify-center gap-2 p-6
                rounded-2xl bg-white/10 backdrop-blur border border-white/20">
      <span class="text-6xl">🏆</span>
      <span class="text-4xl font-extrabold">${total}</span>
      <p class="text-sm text-white/70">Total trophies</p>
    </div>`;
}

