	/* friendstats.ts – standalone overlay showing a friend’s stats           */
	/* ===================================================================== */
	import { HOST } from "./config.js";
	declare const Chart: any;

	/* ------------------------------------------------------------------ */
	/* utilities                                                          */
	type WL            = { wins: number; losses: number };
	type MonthlyWin    = { month: string; winRate: number };
	type GoalsSum      = { scored: number; conceded: number };
	type MonthlyGoals  = { month: string; scored: number; conceded: number };

	const auth = (): HeadersInit => {
	const t = localStorage.getItem("token");
	return t ? { Authorization: `Bearer ${t}` } : {};
	};

	async function get<T>(url: string): Promise<T> {
	const r = await fetch(url, { headers: auth() });
	if (!r.ok) throw new Error(`HTTP ${r.status}`);
	return r.json() as Promise<T>;
	}

	const api = (fid: number) => {
	const root = `http://${HOST}:3000/api/stats/friend/${fid}`;
	return {
		winsLifetime:  `${root}/wins`,
		winsMonthly:   `${root}/monthly-wins`,
		goalsLifetime: `${root}/goals`,
		goalsMonthly:  `${root}/monthly-goals`,
		trophies:      `${root}/trophies`,
		xp:            `${root}/xp`,
	};
	};

	function destroy(canvasId: string) {
	const el = document.getElementById(canvasId) as HTMLCanvasElement | null;
	if (!el) return;
	const chart = Chart.getChart(el);
	if (chart) chart.destroy();
	}

	const last12 = (): string[] => {
	const n = new Date();
	return Array.from({ length: 12 }, (_, i) =>
		new Date(n.getFullYear(), n.getMonth() - 11 + i)
		.toLocaleString("en-US", { month: "short", year: "numeric" }),
	);
	};

	/* ------------------------------------------------------------------ */
	/* charts                                                             */
	async function drawMonthlyWins(url: string) {
	destroy("fs-monthly-chart");
	const labels = last12();
	const rows   = await get<MonthlyWin[]>(url).catch(() => []);
	const map: Record<string, number> = {};
	rows.forEach(r => { map[r.month] = r.winRate; });
	const data = labels.map(l => map[l.slice(0,3)] ?? 0);

	new Chart(document.getElementById("fs-monthly-chart") as HTMLCanvasElement,{
		type:"bar",
		data:{ labels,
			datasets:[{ label:"Win %", data,
						backgroundColor:"rgba(252,211,77,0.9)", borderRadius:4 }]},
		options:{ plugins:{ legend:{ display:false } },
				scales:{ y:{ beginAtZero:true, ticks:{ color:"#fff"} },
						x:{ ticks:{ color:"#fff"} } } },
	});
	}

	async function drawLifePie(url: string) {
	destroy("fs-life-chart");
	const { wins=0, losses=0 } = await get<WL>(url).catch(()=>({wins:0,losses:0}));

	new Chart(document.getElementById("fs-life-chart") as HTMLCanvasElement,{
		type:"pie",
		data:{ labels:["Wins","Losses"],
			datasets:[{ data:[wins,losses],
						backgroundColor:["#4ade80","#f87171"] }]},
		options:{ plugins:{ legend:{ labels:{ color:"#fff", boxWidth:10 } } } },
	});
	}

	async function drawGoalsPie(url: string) {
	destroy("fs-goals-chart");
	const { scored=0, conceded=0 } = await get<GoalsSum>(url).catch(()=>({scored:0, conceded:0}));

	new Chart(document.getElementById("fs-goals-chart") as HTMLCanvasElement,{
		type:"pie",
		data:{ labels:["Scored","Conceded"],
			datasets:[{ data:[scored,conceded],
						backgroundColor:["#38bdf8","#f87171"] }]},
		options:{ plugins:{ legend:{ labels:{ color:"#fff", boxWidth:10 } } } },
	});
	}

	async function drawMonthlyGoals(url: string) {
	destroy("fs-hits-chart");
	const labels = last12();
	const rows   = await get<MonthlyGoals[]>(url).catch(() => []);
	const s: Record<string,number> = {}, c: Record<string,number> = {};
	rows.forEach(r => { s[r.month]=r.scored; c[r.month]=r.conceded; });

	new Chart(document.getElementById("fs-hits-chart") as HTMLCanvasElement,{
		type:"bar",
		data:{ labels,
			datasets:[
				{ label:"Scored",   data:labels.map(l=>s[l.slice(0,3)]??0),
				backgroundColor:"rgba(34,211,238,0.9)", borderRadius:4 },
				{ label:"Conceded", data:labels.map(l=>c[l.slice(0,3)]??0),
				backgroundColor:"rgba(248,113,113,0.9)", borderRadius:4 },
			]},
		options:{ plugins:{ legend:{ labels:{ color:"#fff"} } },
				scales:{ y:{ beginAtZero:true, ticks:{ color:"#fff"} },
						x:{ ticks:{ color:"#fff"} } } },
	});
	}


	type TrophySum = { total: number };

	async function drawTrophies(url: string) {
	const container = document.getElementById("fs-trophies") as HTMLElement | null;
	if (!container) return;                           // silently skip if markup missing

	const total = await get<TrophySum>(url)
					.then(d => d.total)
					.catch(() => 0);                  // fallback

	container.innerHTML = `
		<div class="flex flex-col items-center justify-center gap-2 p-6
					rounded-2xl bg-white/10 backdrop-blur border border-white/20">
		<span class="text-6xl">🏆</span>
		<span class="text-4xl font-extrabold">${total}</span>
		<p class="text-sm text-white/70">Total trophies</p>
		</div>`;
	}


	/* ------------------------------------------------------------------ */
	/* public API                                                         */
	async function buildAll(fid: number) {
	const { winsLifetime, winsMonthly, goalsLifetime, goalsMonthly, trophies} = api(fid);
	await Promise.all([
		drawMonthlyWins(winsMonthly),
		drawLifePie   (winsLifetime),
		drawGoalsPie  (goalsLifetime),
		drawMonthlyGoals(goalsMonthly),
		drawTrophies     (trophies),
	]);
	}

	/* ------------------------------------------------------------------ */
	/* overlay controls                                                   */
	export function openFriendStats(
	friendId: number,
	friend: { username: string; email?: string; avatar_url?: string }
	) {
	/* header visuals */
	(document.getElementById("friendstats-avatar") as HTMLImageElement).src =
		friend.avatar_url ?? "https://i.pravatar.cc/150?u=placeholder";
	(document.getElementById("friendstats-name")  as HTMLElement).textContent = friend.username;
	(document.getElementById("friendstats-email") as HTMLElement).textContent = friend.email ?? "";

	/* level badge */
	const lvlEl = document.getElementById("friendstats-level") as HTMLElement | null;
	if (lvlEl) {
		lvlEl.textContent = "Lvl. —";                      // placeholder
		get<{ total: number }>(api(friendId).xp)
		.then(({ total }) => { lvlEl.textContent = `Lvl. ${total}`; })
		.catch(() => { /* ignore – keeps ‘—’ */ });
	}

	/* draw charts */
	buildAll(friendId).catch(console.error);

	/* show overlay */
	const ov = document.getElementById("friendstats-overlay")!;
	ov.classList.remove("hidden","opacity-0");
	}

	/* close button */
	document.getElementById("friendstats-close")?.addEventListener("click", () => {
	document.getElementById("friendstats-overlay")!
			.classList.add("opacity-0");
	/* give opacity anim 300 ms before hiding */
	setTimeout(() => {
		document.getElementById("friendstats-overlay")!.classList.add("hidden");
	}, 300);
	});

	/* expose for friends.ts */
	declare global { interface Window { openFriendStats?: typeof openFriendStats; } }
	window.openFriendStats = openFriendStats;
