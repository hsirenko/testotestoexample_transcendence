//frontend/src/welcome.ts
const game = document.getElementById("game-container") as HTMLElement;
const main = game?.parentElement as HTMLElement; // the <main> element

/* WSec = welcome section */
function createWSec(): HTMLElement {
  const WSec = document.createElement("section");
  WSec.id = "welcome-section";
  WSec.className =
    "flex flex-col items-center justify-center w-full h-full px-4 gap-8 text-center    animate__animated animate__fadeInUp";

  WSec.innerHTML = `
    <h1 class="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-wide leading-tight">
      Welcome to
      <span class="bg-clip-text text-transparent bg-gradient-to-r from-amber-400 via-fuchsia-500 to-cyan-400">
        ft_transcendence
      </span>
    </h1>

    <p class="max-w-xl text-white/80 text-lg sm:text-xl">
      Sharpen your reflexes, challenge friends and climb the leaderboard in the most dazzling&nbsp;Pong&nbsp;remake ever.
    </p>

    <div class="flex flex-wrap gap-4 justify-center">
      <button id="WSec-play"
        class="px-6 py-3 rounded-full bg-amber-500 hover:bg-amber-600 font-semibold text-lg shadow-lg transition">
        Play&nbsp;Now
      </button>

      <button id="WSec-profile"
        class="px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 font-semibold text-lg transition">
        Profile
      </button>
    </div>
  `;
  return WSec;
}

/* ---------- initialise ---------- */
if (game && main) {
  const WSec = createWSec();
  main.insertBefore(WSec, game); // put WSec above the canvas
  game.classList.add("hidden"); // hide game until later

  /* Home → show WSec */
  const homeBtn = document.querySelector<HTMLButtonElement>(
    'button[data-nav="home"]'
  );
  homeBtn?.addEventListener("click", () => {
    WSec.classList.remove("hidden");
    game.classList.add("hidden");
  });

  /* Hook the WSec buttons to existing nav actions */
  document.getElementById("WSec-play")?.addEventListener("click", () => {
    (document.getElementById("nav-play") as HTMLButtonElement)?.click();
  });
  document.getElementById("WSec-profile")?.addEventListener("click", () => {
    (document.getElementById("nav-profile") as HTMLButtonElement)?.click();
  });

  /* Show game whenever a match is actually launched */
  function showGame(): void {
    WSec.classList.add("hidden");
    game.classList.remove("hidden");
    game.classList.add("animate__animated", "animate__zoomIn");
  }

  /* Patch the global setGameMode so the canvas re-appears automatically */
  if (window.setGameMode) {
    const original = window.setGameMode;
    window.setGameMode = (mode: "pvp" | "ai") => {
      showGame();
      original(mode);
    };
  }

  /* Expose helper in case you need it elsewhere */
  (window as any).showGameArea = showGame;
}
