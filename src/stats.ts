//stats.ts

declare const Chart: any;

import {
  GoalsTotalDTO,
  MonthlyGoalsRowDTO,
  MonthlyWinRateDTO,
  WinsTotalDTO,
} from "./types.js";

const API_BASE = ``;

//REST endpoints
const ENDPOINT = {
  winsMonth: `${API_BASE}/api/stats/monthly-wins`,
  winsTotal: `${API_BASE}/api/stats/wins`,
  goalsTotal: `${API_BASE}/api/stats/goals`,
  goalsMonth: `${API_BASE}/api/stats/monthly-goals`,
  longest: `${API_BASE}/api/stats/longest-hit`,
  me        : `${API_BASE}/api/users/me`,
};

//destroy any existing Chart.js instance on a canvas
function zap(id: string): void {
  const el = document.getElementById(id) as HTMLCanvasElement | null;
  if (!el) return;
  const chart = Chart.getChart(el);
  if (chart) chart.destroy();
}

//error ghandling helper
function showStatsError(canvasId: string): void {
  const el = document.getElementById(canvasId);
  if (!el) return;

  const msg = document.createElement("p");
  msg.textContent = "Failed to load stats.";
  msg.className   = "py-4 text-center text-red-400";

  el.replaceWith(msg);
}

export function initStatsTab(): void {
  ["monthly-chart","life-chart","goals-chart","hits-chart"].forEach(zap);
  drawMonthlyWins();
  drawLifePie();
  drawGoalsPie();
  drawMonthlyGoalsBars();
  renderTrophies();
}


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

async function fetchJSON<T>(url: string): Promise<T> {
  const r = await fetch(url, { headers: getAuthHeader() });
  if (!r.ok) throw new Error("Failed to load stats.");
  return (await r.json()) as T;
}

async function drawMonthlyWins(): Promise<void> {
  zap("monthly-chart");
  const labels = last12Labels();
  try{
      const raw = await fetchJSON<MonthlyWinRateDTO[]>(ENDPOINT.winsMonth);
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
  } catch(err) {
    console.error(err);
    showStatsError("monthly-chart");
  }

  
}

async function drawLifePie(): Promise<void> {
  zap("monthly-chart");
  try {
    const t = await fetchJSON<WinsTotalDTO>(ENDPOINT.winsTotal);

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
  catch(err) {
    console.error(err);
    showStatsError("life-chart");
  }
}

async function drawGoalsPie(): Promise<void> {
  zap("monthly-chart");
  try {
    const g = await fetchJSON<GoalsTotalDTO>(ENDPOINT.goalsTotal);

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
  }catch(err) {
    console.error(err);
    showStatsError("goals-chart");
  }
}

async function drawMonthlyGoalsBars(): Promise<void> {
  zap("monthly-chart");
  const labels = last12Labels();
  try {
    const raw = await fetchJSON<MonthlyGoalsRowDTO[]>(ENDPOINT.goalsMonth);

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
  }catch(err) {
      console.error(err);
      showStatsError("hits-chart");
    }
}

async function renderTrophies(): Promise<void> {
  zap("monthly-chart");
  try {
    const { trophies: total } = await fetchJSON<{ trophies: number }>(ENDPOINT.me);

  (document.getElementById("trophies") as HTMLElement).innerHTML = `
    <div class="flex flex-col items-center justify-center gap-2 p-6
                rounded-2xl bg-white/10 backdrop-blur border border-white/20">
      <span class="text-6xl">🏆</span>
      <span class="text-4xl font-extrabold">${total}</span>
      <p class="text-sm text-white/70">Total trophies</p>
    </div>`;
  } catch (err) {
    console.error(err);
    const t = document.getElementById("trophies");
    if (t) t.innerHTML =
      `<p class="py-4 text-center text-red-400">Failed to load stats.</p>`;
  }
}
