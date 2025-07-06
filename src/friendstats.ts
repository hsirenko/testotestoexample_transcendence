	//friendstats.ts – standalone overlay showing a friend’s stats
	import { resolveAvatar } from "./friends.js";
	declare const Chart: any;

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
	if (!r.ok) throw new Error("Failed to load stats.");
	return r.json() as Promise<T>;
	}

	const api = (fid: number) => {
	const root = `/api/stats/friend/${fid}`;
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

	//overlay error helper
	function showFsError(canvasId: string): void {
	const el = document.getElementById(canvasId);
	if (!el) return;
	const p = document.createElement("p");
	p.textContent = "Failed to load stats.";
	p.className = "py-4 text-center text-red-400";
	el.replaceWith(p);
	}

	async function drawMonthlyWins(url: string) {
	destroy("fs-monthly-chart");
	const labels = last12();
	try {
		const rows = await get<MonthlyWin[]>(url);
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
	} catch(err)
	{
		console.error(err);
		showFsError("fs-monthly-chart");
	}
	}

	async function drawLifePie(url: string) {
	destroy("fs-life-chart");

	try {
		const { wins, losses } = await get<WL>(url);
		new Chart(document.getElementById("fs-life-chart") as HTMLCanvasElement,{
		type:"pie",
		data:{ labels:["Wins","Losses"],
			datasets:[{ data:[wins,losses],
						backgroundColor:["#4ade80","#f87171"] }]},
		options:{ plugins:{ legend:{ labels:{ color:"#fff", boxWidth:10 } } } },
	});
	} catch(err)
	{
		console.error(err);
		showFsError("fs-life-chart");
	}
	}

	async function drawGoalsPie(url: string) {
	destroy("fs-goals-chart");

	try {
		const { scored, conceded } = await get<GoalsSum>(url);
		new Chart(document.getElementById("fs-goals-chart") as HTMLCanvasElement,{
		type:"pie",
		data:{ labels:["Scored","Conceded"],
			datasets:[{ data:[scored,conceded],
						backgroundColor:["#38bdf8","#f87171"] }]},
		options:{ plugins:{ legend:{ labels:{ color:"#fff", boxWidth:10 } } } },
	});
	} catch(err)
	{
		console.error(err);
		showFsError("fs-goals-chart");
	}
	}

	async function drawMonthlyGoals(url: string) {
	destroy("fs-hits-chart");
	const labels = last12();
	try {
		const rows   = await get<MonthlyGoals[]>(url);
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
	} catch(err)
	{
		console.error(err);
		showFsError("fs-hits-chart");
	}
	}


	type TrophySum = { total: number };

	async function drawTrophies(url: string): Promise<void> {
	const container = document.getElementById("fs-trophies") as HTMLElement | null;
	if (!container) return;

	try {
		//fetch real data
		const { total } = await get<TrophySum>(url);

		//render card
		container.innerHTML = `
		<div class="flex flex-col items-center justify-center gap-2 p-6
					rounded-2xl bg-white/10 backdrop-blur border border-white/20">
			<span class="text-6xl">🏆</span>
			<span class="text-4xl font-extrabold">${total}</span>
			<p class="text-sm text-white/70">Total trophies</p>
		</div>`;
	} catch (err) {
		console.error(err);
		//show user-friendly error
		container.innerHTML =
		`<p class="py-4 text-center text-red-400">Failed to load stats.</p>`;
	}
	}

function closeFriendStats(): void {
  const ov = document.getElementById("friendstats-overlay")!;
  if (ov.classList.contains("hidden")) return;

  //fade-out animation
  ov.classList.add("opacity-0");
  setTimeout(() => ov.classList.add("hidden"), 300);

  //free Chart.js instances so next open renders fresh data
  ["fs-monthly-chart", "fs-life-chart",
   "fs-goals-chart",   "fs-hits-chart"].forEach(destroy);
}

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

	const CIRC = 2 * Math.PI * 45;
	function setFriendRing(lvl: number | null): void {
	const bar  = document.getElementById("friend-level-bar")  as SVGCircleElement | null;
	const text = document.getElementById("friend-level-text") as HTMLElement      | null;
	if (!bar || !text || lvl === null) return;

	const int = Math.floor(lvl), frac = lvl - int;
	text.textContent            = String(int);
	bar.style.strokeDashoffset  = String(CIRC * (1 - frac));
	}

	const ASTRONAUT =
	"https://img.freepik.com/free-vector/" +
	"cute-astronaut-playing-vr-game-with-controller-cartoon-vector-icon-" +
	"illustration-science-technology_138676-13977.jpg?semt=ais_hybrid&w=740";

	//overlay control
	export function openFriendStats(
	friendId: number,
	friend: { username: string; email?: string; avatar_url?: string }
	) {
	//header visuals
	(document.getElementById("friendstats-avatar") as HTMLImageElement).src =
	resolveAvatar(friend.avatar_url);

	(document.getElementById("friendstats-name")  as HTMLElement).textContent = friend.username;
	(document.getElementById("friendstats-email") as HTMLElement).textContent = friend.email ?? "";

	//level ring
	setFriendRing(null);
	get<{ total: number }>(api(friendId).xp)
	.then(({ total }) => setFriendRing(total))
	.catch(err => {
		console.error(err);
	});


	//draw charts
	buildAll(friendId).catch(console.error);

	//show overlay *
	const ov = document.getElementById("friendstats-overlay")!;
	ov.classList.remove("hidden","opacity-0");
	}
	
	//Esc key closes the friend-stats panel
	document.addEventListener("keydown", (e) => {
	if (e.key === "Escape") closeFriendStats();
	});

	//close button
	document.getElementById("friendstats-close")
        ?.addEventListener("click", closeFriendStats);

	//expose for friends.ts
	declare global { interface Window { openFriendStats?: typeof openFriendStats; } }
	window.openFriendStats = openFriendStats;
