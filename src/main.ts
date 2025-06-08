//export {}; //this will treat this file as a module and not global script
const GAME_SPEED = 1.25; //all game speed
const BALL_SPEED_PX = 330; //ball speed b px/s
const MOBILE_BREAK = 640;
const PADDLE_FR = window.innerWidth <= MOBILE_BREAK ? 0.75 : 0.45; //paddle speed height / s
let BALL_R = window.innerWidth <= MOBILE_BREAK ? 5 : 10; //bal radius
const PAD_W = window.innerWidth <= MOBILE_BREAK ? 10 : 12; //paddle width
const PAD_H = window.innerWidth <= MOBILE_BREAK ? 60 : 80; //oaddle height
const PAD_GAP = 24; //distance between l paddle w edge

/* ═════════════ COLORS ═════════════ */
const COL_LEFT = "#22d3ee";
const COL_RIGHT = "#fbbf24";
const COL_BALL = "#f472b6";
const COL_LINE = "#f3f4f6";

/* ═════════════ NEW CONSTANTS ═════════════ */
const SPEED_INC_DELAY = 12; // NEW: seconds after which speed starts to ramp
const SPEED_INC_RATE = 0.1; // NEW: extra speed added per second after delay
const MAX_SCORE = 3; // NEW: score needed to win the game

/* ═════════════ TYPES ═════════════ */
interface Vec {
  x: number;
  y: number;
} //vector interface
interface Paddle extends Vec {
  w: number;
  h: number;
} //paddle with width and height
interface Ball extends Vec {
  v: Vec;
  r: number;
} //ball with speed and radius

/* ═════════════ DOM GRAB ═════════════ */
const cvs = document.getElementById("pong-canvas") as HTMLCanvasElement; //get the canvas so we can add shapes
const ctx = cvs.getContext("2d")!;
const sLeft = document.getElementById("score-left")!; //left scorte
const sRight = document.getElementById("score-right")!; //right score
const startBtn = document.getElementById("start-btn") as HTMLButtonElement; //start

/* ═════════════ STATE ═════════════ */
let left: Paddle;
let right: Paddle;
let ball: Ball;
let scoreL = 0;
let scoreR = 0;
let playing = false;
let gameMode: "pvp" | "ai" = "pvp";
let lastTime = performance.now();

//mhmd ali
const AI_MAX_SPEED = 0.9;
let AI_REFRESH = 0.05; // NEW: seconds between AI recalculations

let aiAccumulator = 0;
let roundElapsed = 0; // NEW: elapsed time in current round
let prevSpeed = GAME_SPEED; // NEW: last applied speed multiplier

//initialisation for the game
resetObjects();
resizeCanvas();
render();
updateScore();

//on click aal play we hide it and start the game
startBtn.addEventListener("click", () => {
  const overlay = document.getElementById("win-message"); // NEW: remove win overlay if present
  if (overlay) overlay.remove(); // NEW
  startBtn.classList.add("hidden");
  playing = true;
  lastTime = performance.now();
  requestAnimationFrame(loop);
});
window.addEventListener("resize", resizeCanvas);

//handling input (w, s, arrow up and arrow down)
const keys: Record<string, boolean> = {};

/* key listeners for W/S and ArrowUp/ArrowDown */
for (const type of ["keydown", "keyup"] as const) {
  window.addEventListener(type, (evt: Event) => {
    const e = evt as KeyboardEvent;
    if (!["w", "s", "ArrowUp", "ArrowDown"].includes(e.key)) return;

    // ✨ Allow typing in login / sign-up forms: skip if an editable element has focus
    const active = document.activeElement as HTMLElement | null;
    if (
      active &&
      (["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName) ||
        active.isContentEditable)
    ) {
      return; // let the form handle the keystroke
    }

    e.preventDefault(); // only preventDefault for gameplay
    keys[e.key] = type === "keydown"; // store the key state
  });
}

/* ---------- REST OF THE GAME ENGINE  (unchanged) ---------------------- */

const clamp = (v: number, lo: number, hi: number) => {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
};

/* This func reset all game objects to start coordinates n speeds.
   It put paddles back to their place and ball to 0,0 with zero velocity
   so next code start from clean state. */
function resetObjects(): void {
  const scale = window.innerWidth <= MOBILE_BREAK ? 0.7 : 1;
  BALL_R = window.innerWidth <= MOBILE_BREAK ? 7 : 10;

  left = { x: PAD_GAP, y: 0, w: PAD_W * scale, h: PAD_H * scale };
  right = { x: 0, y: 0, w: PAD_W * scale, h: PAD_H * scale };
  ball = { x: 0, y: 0, v: { x: 0, y: 0 }, r: BALL_R };
  roundElapsed = 0; // NEW
  prevSpeed = GAME_SPEED; // NEW
}

/* This one recenters paddles & ball in middle of canvas
   and then launch the ball toward dir (1 to right, -1 to left)
   using random angle for little variety, speed multiplied by GAME_SPEED. */
function resetPositions(dir: 1 | -1): void {
  left.y = (cvs.height - left.h) / 2;
  right.y = (cvs.height - right.h) / 2;
  ball.x = cvs.width / 2;
  ball.y = cvs.height / 2;

  const speed = BALL_SPEED_PX * GAME_SPEED;
  const angle = (Math.random() - 0.5) * (Math.PI / 3);
  ball.v.x = dir * speed * Math.cos(angle);
  ball.v.y = speed * Math.sin(angle);

  roundElapsed = 0; // NEW: restart round timer
  prevSpeed = GAME_SPEED; // NEW: reset speed multiplier
}

/* When window grow or shrink we call this.
   It match canvas size to css size, move right paddle to new edge,
   reset ball direction random and redraw so no weird stretch. */
function resizeCanvas(): void {
  cvs.width = cvs.clientWidth;
  cvs.height = cvs.clientHeight;
  right.x = cvs.width - PAD_GAP - right.w; // far right
  resetPositions(Math.random() < 0.5 ? 1 : -1);
  render();
}

/* Main loop. Executed every animation frame.
   Compute time delta, if game is active we update physics n render,
   then schedule itself again. */
function loop(now: number): void {
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  if (playing) {
    update(dt);
    render();
  }
  requestAnimationFrame(loop);
}

/* This does all heavy lifting each frame:
   - read keyboard for human
   - move paddles
   - run AI moves when in vs AI
   - move ball, bounce on walls, detect paddle hit, change velocity
   - check scoring and reset when ball exit
   Whole thing uses dt to stay smooth even if FPS change. */
function update(dt: number): void {
  roundElapsed += dt; // NEW: accumulate time since last score

  /* ––––– Dynamic speed ramp ––––– */
  const currSpeed =
    GAME_SPEED + Math.max(0, roundElapsed - SPEED_INC_DELAY) * SPEED_INC_RATE; // NEW

  if (currSpeed !== prevSpeed) {
    const scale = currSpeed / prevSpeed; // NEW
    ball.v.x *= scale; // NEW: boost current ball velocity
    ball.v.y *= scale; // NEW
    prevSpeed = currSpeed; // NEW
  }

  const paddleV = cvs.height * PADDLE_FR * currSpeed; // CHANGED: use dynamic speed

  /* ––––– Left paddle (human) ––––– */
  if (keys["w"]) left.y -= paddleV * dt;
  if (keys["s"]) left.y += paddleV * dt;
  left.y = clamp(left.y, 0, cvs.height - left.h);

  /* ––––– Right paddle ––––– */
  if (gameMode === "pvp") {
    if (keys["ArrowUp"]) right.y -= paddleV * dt;
    if (keys["ArrowDown"]) right.y += paddleV * dt;
    right.y = clamp(right.y, 0, cvs.height - right.h);
  } else {
    //mhmd ali (ERROR!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!)
    aiAccumulator += dt;
    if (aiAccumulator >= AI_REFRESH) {
      aiAccumulator -= AI_REFRESH;
      computeAIDecision();
    }
    //till here !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    if (keys["ArrowUp"]) right.y -= paddleV * AI_MAX_SPEED * dt;
    if (keys["ArrowDown"]) right.y += paddleV * AI_MAX_SPEED * dt;
    right.y = clamp(right.y, 0, cvs.height - right.h);
  }

  /* ––––– Ball physics ––––– */
  ball.x += ball.v.x * dt;
  ball.y += ball.v.y * dt;

  // bounce off top/bottom
  if (ball.y - BALL_R < 0 || ball.y + BALL_R > cvs.height) {
    ball.v.y *= -1;
    ball.y = clamp(ball.y, BALL_R, cvs.height - BALL_R);
  }

  // paddle collisions
  const hitPaddle = (p: Paddle, side: "left" | "right"): boolean => {
    const inY = ball.y >= p.y && ball.y <= p.y + p.h;
    if (!inY) return false;
    if (side === "left" && ball.v.x < 0 && ball.x - BALL_R <= p.x + p.w) {
      ball.x = p.x + p.w + BALL_R;
      return true;
    }
    if (side === "right" && ball.v.x > 0 && ball.x + BALL_R >= p.x) {
      ball.x = p.x - BALL_R;
      return true;
    }
    return false;
  };

  if (hitPaddle(left, "left") || hitPaddle(right, "right")) {
    const p = ball.v.x < 0 ? left : right;
    const rel = (ball.y - (p.y + p.h / 2)) / (p.h / 2);
    const ang = rel * (Math.PI / 3);
    const spd = BALL_SPEED_PX * currSpeed; // CHANGED: use dynamic speed
    const dir = ball.v.x < 0 ? 1 : -1;
    ball.v.x = dir * spd * Math.cos(ang);
    ball.v.y = spd * Math.sin(ang);
  }

  /* ––––– Scoring ––––– */
  if (ball.x + BALL_R < 0) {
    scoreR++;
    updateScore();
    if (scoreR >= MAX_SCORE) handleWin(); // NEW: check for winner
    else resetPositions(1);
  } else if (ball.x - BALL_R > cvs.width) {
    scoreL++;
    updateScore();
    if (scoreL >= MAX_SCORE) handleWin(); // NEW: check for winner
    else resetPositions(-1);
  }
}

/* Update the score DOM elements so player see current points. */
function updateScore(): void {
  sLeft.textContent = String(scoreL);
  sRight.textContent = String(scoreR);
}

//mhmd ali
function computeAIDecision(): void {
  if (ball.v.x <= 0) {
    keys["ArrowUp"] = false;
    keys["ArrowDown"] = false;
    return;
  }

  let bx = ball.x;
  let by = ball.y;
  let vx = ball.v.x;
  let vy = ball.v.y;

  while (true) {
    const dtX = (right.x - bx) / vx;
    const nextY = by + vy * dtX;

    if (nextY >= BALL_R && nextY <= cvs.height - BALL_R) {
      by = nextY;
      break;
    }

    if (vy > 0) {
      const dtW = (cvs.height - BALL_R - by) / vy;
      bx += vx * dtW;
      by = cvs.height - BALL_R;
      vy = -vy;
    } else {
      const dtW = (BALL_R - by) / vy;
      bx += vx * dtW;
      by = BALL_R;
      vy = -vy;
    }
  }

  const paddleCenter = right.y + right.h / 2;
  if (by < paddleCenter - 5) {
    keys["ArrowUp"] = true;
    keys["ArrowDown"] = false;
  } else if (by > paddleCenter + 5) {
    keys["ArrowUp"] = false;
    keys["ArrowDown"] = true;
  } else {
    keys["ArrowUp"] = false;
    keys["ArrowDown"] = false;
  }
}

/* Draw everything for the current frame:
   clear screen, net, paddles, ball */
function render(): void {
  ctx.clearRect(0, 0, cvs.width, cvs.height);
  drawNet();
  drawPaddle(left, COL_LEFT);
  drawPaddle(right, COL_RIGHT);
  drawBall();
}

/* Paint the vertical dashed net in centre by many small rectangles. */
function drawNet(): void {
  ctx.fillStyle = COL_LINE;
  const w = 4,
    h = 18,
    gap = 12,
    x = cvs.width / 2 - w / 2;
  for (let y = 0; y < cvs.height; y += h + gap) {
    ctx.fillRect(x, y, w, h);
  }
}

/* draw a paddle rectangle using its x,y,w,h and chosen color. */
function drawPaddle(p: Paddle, col: string): void {
  ctx.fillStyle = col;
  ctx.fillRect(p.x, p.y, p.w, p.h);
}

/* draw the ball as filled circle at current position. */
function drawBall(): void {
  ctx.fillStyle = COL_BALL;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
  ctx.fill();
}

/* ═════════════ GLOBAL FUNCTIONS ═════════════ */
declare global {
  interface Window {
    setAIRefresh: (sec: number) => void;
    setGameMode: (m: "pvp" | "ai") => void;
  }
}

//mhmd ali
window.setAIRefresh = (sec: number): void => {
  AI_REFRESH = sec;
  aiAccumulator = 0; // reset timer
};

/* Switch between PvP and vs-AI, reset scores, hide play button and kick off game instantly. */
window.setGameMode = (mode: "pvp" | "ai"): void => {
  const overlay = document.getElementById("win-message"); // NEW: remove win overlay when switching mode
  if (overlay) overlay.remove(); // NEW

  gameMode = mode;
  scoreL = scoreR = 0;
  updateScore();

  playing = true;
  startBtn.classList.add("hidden");
  startBtn.textContent =
    mode === "ai" ? "▶ PLAY VS AI" : "▶ LET THE GAME BEGIN";

  resetObjects();
  resizeCanvas();

  lastTime = performance.now();
  aiAccumulator = 0;
  requestAnimationFrame(loop);
};

/* ═════════════ WIN MESSAGE ═════════════ */
function handleWin(): void {
  playing = false;
  const winner = scoreL > scoreR ? "Left Player" : "Right Player";

  let overlay = document.getElementById("win-message") as HTMLDivElement | null;
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "win-message";
    cvs.parentElement!.style.position = "relative";
    cvs.parentElement!.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="msg-box">
      <span class="winner">${winner} Wins!</span>
      <button id="play-again">Play Again</button>
    </div>
  `;

  overlay.className = "overlay";

  if (!document.getElementById("win-style")) {
    const style = document.createElement("style");
    style.id = "win-style";
    style.textContent = `
  #win-message.overlay{
    position:absolute;
    inset:0;
    display:flex;
    align-items:center;
    justify-content:center;
    pointer-events:auto;
    backdrop-filter:blur(4px);
  }
  #win-message .msg-box{
    display:flex;
    flex-direction:column;
    align-items:center;
    gap:1rem;
    background:linear-gradient(145deg,rgba(34,211,238,.25),rgba(251,191,36,.25));
    border:3px solid #fff;
    padding:2rem 2.5rem;
    border-radius:14px;
    box-shadow:0 0 25px rgba(255,255,255,.06),0 0 8px rgba(0,0,0,.4) inset;
    text-align:center;
  }
  #win-message .winner{
    font-size:1.5rem;
    font-weight:800;
    color:#fff;
    text-shadow:0 0 8px #fff;
  }
  #play-again{
    margin-top:1rem;
    padding:.55rem 2rem;
    font-size:1.1rem;
    font-weight:700;
    border:none;
    border-radius:10px;
    background:#f472b6;
    color:#fff;
    cursor:pointer;
    transition:transform .2s,filter .2s;
  }
  #play-again:hover{
    transform:scale(1.05);
    filter:brightness(1.15);
  }

  /* Desktop refinements */
  @media (min-width:640px){
    #win-message .msg-box{
      flex-direction:row;
      gap:2rem;
    }
    #win-message .winner{ font-size:3rem; }
    #play-again{
      margin-top:0;
      padding:.6rem 2.5rem;
      font-size:1.25rem;
    }
  }
`;
    document.head.appendChild(style);
  }

  const againBtn = document.getElementById("play-again") as HTMLButtonElement;
  againBtn.onclick = () => {
    overlay!.remove();
    scoreL = scoreR = 0;
    updateScore();
    playing = true;
    startBtn.classList.add("hidden");
    resetObjects();
    resizeCanvas();
    lastTime = performance.now();
    aiAccumulator = 0;
    requestAnimationFrame(loop);
  };
}

export { resetObjects, resizeCanvas, render, updateScore };
