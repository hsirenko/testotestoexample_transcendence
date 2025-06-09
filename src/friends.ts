/* friends.ts – always-visible sidebar with optional mock data */

/* ── 1. toggle for mock mode ───────────────────────────────────── */
const USE_MOCK_DATA = false;           // ← set true for demo without backend

/* dummy friends */
const MOCK_FRIENDS = [
    { id: "u01", username: "Aya",   email: "aya@example.com",
     avatar_url: "https://i.pravatar.cc/40?u=aya" },
    { id: "u02", username: "Karim", email: "karim@example.com",
     avatar_url: "https://i.pravatar.cc/40?u=karim" },
    { id: "u03", username: "Maya",  email: "maya@example.com",
     avatar_url: "https://i.pravatar.cc/40?u=maya" },
];

/* ── 2. helpers ────────────────────────────────────────────────── */
function getAuthHeader(): HeadersInit {
  const t = localStorage.getItem("token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function fetchFriends(): Promise<any[]> {
  if (USE_MOCK_DATA) return MOCK_FRIENDS;

  try {
    const r = await fetch("http://localhost:3000/api/users/me/friends", {
      headers: getAuthHeader(),
    });
    if (!r.ok) throw await r.json();             // 4xx / 5xx with JSON body
    return (await r.json()) as any[];
  } catch {
    /* fallback to mock when backend unreachable */
    return MOCK_FRIENDS;
  }
}

/* ── 3. render list ────────────────────────────────────────────── */
function render(friends: any[]): void {
  const list = document.getElementById("friends-list")!;
  list.innerHTML = "";

  if (!friends.length) {
    list.innerHTML = `<p class="text-white/70">You have no friends yet.</p>`;
    return;
  }

  friends.forEach(f => {
  /* container row */
  const row = document.createElement("div");
  row.className =
    "bg-white/10 rounded-lg overflow-hidden" +          // keep nice corners
    " transition-[max-height] duration-300";            // slide animation
  row.style.maxHeight = "56px";                         // 56 = 14 × 4  (closed)

  /* visible header */
  row.innerHTML = `
    <div class="flex items-center gap-3 p-2">
      <img src="${f.avatar_url ?? 'https://i.pravatar.cc/40?u=placeholder'}" class="w-8 h-8 rounded-full"/>
      <div class="flex-1">
        <p class="text-sm font-semibold">${f.username}</p>
        <p class="text-[10px] text-white/60">${f.email}</p>
      </div>
      <button class="more-btn text-[10px] px-2 py-1 rounded-full
                     bg-amber-500 hover:bg-amber-600">
        more ▾
      </button>
    </div>

    <!-- hidden panel -->
    <div class="submenu px-2 pb-3 space-x-2 hidden">
      <button class="sub px-2 py-1 text-[10px] bg-emerald-500 rounded-full">
        Challenge
      </button>
      <button class="sub px-2 py-1 text-[10px] bg-cyan-500 rounded-full">
        Stats
      </button>
      <button class="sub px-2 py-1 text-[10px] bg-red-500 rounded-full">
        Remove
      </button>
    </div>
  `;

  /* toggle handler */
  const btn   = row.querySelector<HTMLButtonElement>(".more-btn")!;
  const panel = row.querySelector<HTMLDivElement>(".submenu")!;
  let open    = false;

  btn.addEventListener("click", () => {
    open = !open;
    panel.classList.toggle("hidden", !open);
    row.style.maxHeight = open ? panel.scrollHeight + 56 + "px" : "56px";
    btn.textContent = open ? "less ▲" : "more ▾";
  });

  list.appendChild(row);
});

}

export async function loadFriendsSidebar(): Promise<void> {
  const list = document.getElementById("friends-list")!;
  list.innerHTML = `<p class="text-white/70">Loading…</p>`;

  try {
    const friends = await fetchFriends();
    render(friends);
  } catch (e: any) {
    list.innerHTML =
      `<p class="text-red-400">${e?.error ?? "Failed to load friends."}</p>`;
  }
}

(async () => {
    const t = localStorage.getItem("token");
    if (t)
    {
        loadFriendsSidebar();
    }
})();
