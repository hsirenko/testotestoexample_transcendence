const GSpeed = 1.25; //all game speed
const BallSpeed = 330; //ball speed b px/s
const MobileWidth = 640;
const PadSpeed = window.innerWidth <= MobileWidth ? 0.75 : 0.45; //paddle speed height / s
let BallSize = window.innerWidth <= MobileWidth ? 5 : 10; //bal size
const PadW = window.innerWidth <= MobileWidth ? 10 : 12; //paddle width
const PadH = window.innerWidth <= MobileWidth ? 60 : 80; //oaddle height
const PadGap = 24; //distance between l paddle w edge
const LpadCol = "#22d3ee"; //left paddle
const RpadCol = "#fbbf24"; //rght paddle
const BallCol = "#f472b6";
const LineCol = "#f3f4f6";
const TimeToIncSpeed = 12; //needed time to increment speed
const IncRate = 0.1; //speed added
const WinScrore = 3; //win score
const CanvasHtml = document.getElementById("pong-canvas"); //get the canvas so we can add shapes
const ctx = CanvasHtml.getContext("2d");
const sLeft = document.getElementById("score-left"); //left scorte
const sRight = document.getElementById("score-right"); //right score
const startBtn = document.getElementById("start-btn"); //start
let left;
let right;
let ball;
let LScore = 0;
let RScore = 0;
let playing = false;
let gameMode = "pvp"; //mhmd ali
let lastTime = performance.now();
//mhmd ali
const AI_MAX_SPEED = 0.9;
let AI_REFRESH = 0.05; // NEW: seconds between AI recalculations
let aiAccumulator = 0;
let roundElapsed = 0; // NEW: elapsed time in current round
let prevSpeed = GSpeed; // NEW: last applied speed multiplier
//initialisation for the game
resetObjects();
resizeCanvas();
render();
updateScore();
//start the game with 3 days counter at start
startBtn.addEventListener("click", () => {
    var _a;
    (_a = document.getElementById("win-message")) === null || _a === void 0 ? void 0 : _a.remove(); //clear old overlay
    startBtn.classList.add("hidden");
    resetObjects();
    resizeCanvas();
    startCountdown(3, beginPlay);
});
window.addEventListener("resize", resizeCanvas);
const keys = {}; //store key states
/* key listeners for W/S and ArrowUp/ArrowDown */
for (const type of ["keydown", "keyup"]) {
    window.addEventListener(type, (evt) => {
        const e = evt;
        if (!["w", "s", "ArrowUp", "ArrowDown"].includes(e.key))
            return;
        //skip typing if input box is active
        const active = document.activeElement;
        if (active &&
            (["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName) ||
                active.isContentEditable)) {
            return; //let forms use keys
        }
        e.preventDefault(); //block default action
        keys[e.key] = type === "keydown"; //update key state
    });
}
const clamp = (v, lo, hi) => {
    if (v < lo)
        return lo;
    if (v > hi)
        return hi;
    return v;
}; //limit number between min n max
function resetObjects() {
    //set default sizes n positions for paddles n ball
    const scale = window.innerWidth <= MobileWidth ? 0.7 : 1;
    BallSize = window.innerWidth <= MobileWidth ? 7 : 10;
    left = { x: PadGap, y: 0, w: PadW * scale, h: PadH * scale };
    right = { x: 0, y: 0, w: PadW * scale, h: PadH * scale };
    ball = { x: 0, y: 0, v: { x: 0, y: 0 }, r: BallSize };
    roundElapsed = 0; //restart round time
    prevSpeed = GSpeed; //reset speed factor
}
function resetPositions(dir) {
    //center paddles and ball, shoot ball in dir
    left.y = (CanvasHtml.height - left.h) / 2;
    right.y = (CanvasHtml.height - right.h) / 2;
    ball.x = CanvasHtml.width / 2;
    ball.y = CanvasHtml.height / 2;
    const speed = BallSpeed * GSpeed;
    const angle = (Math.random() - 0.5) * (Math.PI / 3);
    ball.v.x = dir * speed * Math.cos(angle);
    ball.v.y = speed * Math.sin(angle);
    roundElapsed = 0; //restart round clock
    prevSpeed = GSpeed; //restore base speed
}
function resizeCanvas() {
    //resize canvas to match screen, fix right paddle, relaunch ball
    CanvasHtml.width = CanvasHtml.clientWidth;
    CanvasHtml.height = CanvasHtml.clientHeight;
    right.x = CanvasHtml.width - PadGap - right.w; //align to right
    resetPositions(Math.random() < 0.5 ? 1 : -1);
    render(); //redraw scene
}
function loop(now) {
    //main game loop, runs every frame
    const dt = (now - lastTime) / 1000;
    lastTime = now;
    if (playing) {
        update(dt); //update logic
        render(); //draw everything
    }
    requestAnimationFrame(loop); //keep looping
}
function update(dt) {
    //update game state using delta time
    roundElapsed += dt;
    //increase ball speed over time
    const currSpeed = GSpeed + Math.max(0, roundElapsed - TimeToIncSpeed) * IncRate;
    if (currSpeed !== prevSpeed) {
        const scale = currSpeed / prevSpeed;
        ball.v.x *= scale;
        ball.v.y *= scale;
        prevSpeed = currSpeed;
    }
    const paddleV = CanvasHtml.height * PadSpeed * currSpeed;
    //move left paddle (W/S)
    if (keys["w"])
        left.y -= paddleV * dt;
    if (keys["s"])
        left.y += paddleV * dt;
    left.y = clamp(left.y, 0, CanvasHtml.height - left.h);
    //move right paddle (arrows or AI)
    if (gameMode === "pvp") {
        if (keys["ArrowUp"])
            right.y -= paddleV * dt;
        if (keys["ArrowDown"])
            right.y += paddleV * dt;
        right.y = clamp(right.y, 0, CanvasHtml.height - right.h);
    }
    else {
        aiAccumulator += dt;
        if (aiAccumulator >= AI_REFRESH) {
            aiAccumulator -= AI_REFRESH;
            computeAIDecision(); //decide AI move
        }
        if (keys["ArrowUp"])
            right.y -= paddleV * AI_MAX_SPEED * dt;
        if (keys["ArrowDown"])
            right.y += paddleV * AI_MAX_SPEED * dt;
        right.y = clamp(right.y, 0, CanvasHtml.height - right.h);
    }
    //move ball by velocity
    ball.x += ball.v.x * dt;
    ball.y += ball.v.y * dt;
    //bounce off top/bottom
    if (ball.y - BallSize < 0 || ball.y + BallSize > CanvasHtml.height) {
        ball.v.y *= -1;
        ball.y = clamp(ball.y, BallSize, CanvasHtml.height - BallSize);
    }
    //check paddle hit
    const hitPaddle = (p, side) => {
        const inY = ball.y >= p.y && ball.y <= p.y + p.h;
        if (!inY)
            return false;
        if (side === "left" && ball.v.x < 0 && ball.x - BallSize <= p.x + p.w) {
            ball.x = p.x + p.w + BallSize;
            return true;
        }
        if (side === "right" && ball.v.x > 0 && ball.x + BallSize >= p.x) {
            ball.x = p.x - BallSize;
            return true;
        }
        return false;
    };
    if (hitPaddle(left, "left") || hitPaddle(right, "right")) {
        //reflect ball and adjust angle
        const p = ball.v.x < 0 ? left : right;
        const rel = (ball.y - (p.y + p.h / 2)) / (p.h / 2);
        const ang = rel * (Math.PI / 3);
        const spd = BallSpeed * currSpeed;
        const dir = ball.v.x < 0 ? 1 : -1;
        ball.v.x = dir * spd * Math.cos(ang);
        ball.v.y = spd * Math.sin(ang);
    }
    //check score and reset after 1s
    const pauseAndReset = (dir) => {
        playing = false;
        ball.v.x = ball.v.y = 0;
        resetPositions(dir);
        setTimeout(() => {
            lastTime = performance.now();
            playing = true;
        }, 1000);
    };
    if (ball.x + BallSize < 0) {
        RScore++;
        updateScore();
        RScore >= WinScrore ? handleWin() : pauseAndReset(1);
    }
    else if (ball.x - BallSize > CanvasHtml.width) {
        LScore++;
        updateScore();
        LScore >= WinScrore ? handleWin() : pauseAndReset(-1);
    }
}
/* Update the score DOM elements so player see current points. */
function updateScore() {
    sLeft.textContent = String(LScore);
    sRight.textContent = String(RScore);
}
//mhmd ali
function computeAIDecision() {
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
        if (nextY >= BallSize && nextY <= CanvasHtml.height - BallSize) {
            by = nextY;
            break;
        }
        if (vy > 0) {
            const dtW = (CanvasHtml.height - BallSize - by) / vy;
            bx += vx * dtW;
            by = CanvasHtml.height - BallSize;
            vy = -vy;
        }
        else {
            const dtW = (BallSize - by) / vy;
            bx += vx * dtW;
            by = BallSize;
            vy = -vy;
        }
    }
    const paddleCenter = right.y + right.h / 2;
    if (by < paddleCenter - 5) {
        keys["ArrowUp"] = true;
        keys["ArrowDown"] = false;
    }
    else if (by > paddleCenter + 5) {
        keys["ArrowUp"] = false;
        keys["ArrowDown"] = true;
    }
    else {
        keys["ArrowUp"] = false;
        keys["ArrowDown"] = false;
    }
}
function render() {
    //draw everything on screen
    ctx.clearRect(0, 0, CanvasHtml.width, CanvasHtml.height);
    drawNet(); //draw center line
    drawPaddle(left, LpadCol); //draw left paddle
    drawPaddle(right, RpadCol); //draw right paddle
    drawBall(); //draw the ball
}
function drawNet() {
    //draw dashed center net line
    ctx.fillStyle = LineCol;
    const w = 4, h = 18, gap = 12, x = CanvasHtml.width / 2 - w / 2;
    for (let y = 0; y < CanvasHtml.height; y += h + gap) {
        ctx.fillRect(x, y, w, h);
    }
}
function drawPaddle(p, col) {
    //draw a single paddle
    ctx.fillStyle = col;
    ctx.fillRect(p.x, p.y, p.w, p.h);
}
function drawBall() {
    //draw the ball as circle
    ctx.fillStyle = BallCol;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BallSize, 0, Math.PI * 2);
    ctx.fill();
}
//mhmd ali
window.setAIRefresh = (sec) => {
    AI_REFRESH = sec;
    aiAccumulator = 0; // reset timer
};
//mhmd ali
window.setGameMode = (mode) => {
    var _a;
    (_a = document.getElementById("win-message")) === null || _a === void 0 ? void 0 : _a.remove();
    gameMode = mode;
    LScore = RScore = 0;
    updateScore();
    startBtn.classList.add("hidden");
    resetObjects();
    resizeCanvas();
    startCountdown(3, beginPlay); // << here!
};
/* ═════════════ WIN MESSAGE ═════════════ */
function handleWin() {
    var _a, _b;
    playing = false;
    (_b = (_a = window).refreshMobilePads) === null || _b === void 0 ? void 0 : _b.call(_a); // hide mobile arrows
    const winner = LScore > RScore ? "Left Player" : "Right Player";
    let overlay = document.getElementById("win-message");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "win-message";
        CanvasHtml.parentElement.style.position = "relative";
        CanvasHtml.parentElement.appendChild(overlay);
    }
    overlay.innerHTML = `
    <div class="msg-box">
      <span class="winner">${winner} Wins!</span>
      <button id="play-again">Play Again</button>
    </div>
  `;
    overlay.className = "overlay";
    /* inject style only once */
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
    /* play-again button logic */
    const againBtn = document.getElementById("play-again");
    againBtn.onclick = () => {
        overlay.remove();
        LScore = RScore = 0;
        updateScore();
        startBtn.classList.add("hidden");
        resetObjects();
        resizeCanvas();
        startCountdown(3, beginPlay); // << here!
    };
}
/* ═════════════ MOBILE TOUCH CONTROLS (single-init) ═════════════ */
(() => {
    /* guard against the older duplicate blocks */
    if (window.mobilePadsInit)
        return;
    window.mobilePadsInit = true;
    const isMobile = () => innerWidth <= MobileWidth;
    /* build / rebuild on–screen arrow pads */
    const buildControls = () => {
        document.querySelectorAll(".mobile-pad").forEach((el) => el.remove());
        /* show only while *playing* on a mobile viewport */
        if (!isMobile() || !playing)
            return;
        const pads = [
            { side: "left", up: "w", down: "s", show: true },
            {
                side: "right",
                up: "ArrowUp",
                down: "ArrowDown",
                show: gameMode === "pvp",
            },
        ];
        pads.filter((p) => p.show).forEach((p) => {
            const wrap = document.createElement("div");
            const btnUp = document.createElement("button");
            const btnDown = document.createElement("button");
            wrap.className = `mobile-pad ${p.side}`;
            btnUp.className = "arrow-btn up";
            btnUp.textContent = "▲";
            btnDown.className = "arrow-btn down";
            btnDown.textContent = "▼";
            wrap.append(btnUp, btnDown);
            document.body.appendChild(wrap);
            const press = (k) => () => (keys[k] = true);
            const release = (k) => () => (keys[k] = false);
            ["touchstart", "mousedown"].forEach((e) => [btnUp, btnDown].forEach((b, i) => b.addEventListener(e, press(i ? p.down : p.up))));
            ["touchend", "touchcancel", "mouseup", "mouseleave"].forEach((e) => [btnUp, btnDown].forEach((b, i) => b.addEventListener(e, release(i ? p.down : p.up))));
        });
    };
    /* expose so other parts (start / win handlers) can trigger a rebuild */
    window.refreshMobilePads = buildControls;
    /* inject styling once */
    if (!document.getElementById("mobile-pad-style")) {
        const css = document.createElement("style");
        css.id = "mobile-pad-style";
        css.textContent = `
  .mobile-pad{
    position:fixed;
    bottom:2.5rem;
    display:flex;
    flex-direction:column;
    gap:.75rem;
    z-index:50;
  }
  .mobile-pad.left  { left:2rem; }
  .mobile-pad.right { right:2rem; }
  .arrow-btn{
    width:3.5rem;
    height:3.5rem;
    border:none;
    border-radius:50%;
    background:#1f2937cc;
    color:#fff;
    font-size:1.5rem;
    font-weight:700;
    touch-action:none;
    box-shadow:0 0 6px rgba(0,0,0,.4);
  }
  .arrow-btn:active{
    transform:scale(.9);
    background:#1f2937;
  }`;
        document.head.appendChild(css);
    }
    /* rebuild controls when game mode switches */
    const origSetGameMode = window.setGameMode;
    window.setGameMode = (mode) => {
        origSetGameMode(mode);
        buildControls();
    };
    /* rebuild on viewport change */
    addEventListener("resize", () => buildControls());
    /* initial attempt (does nothing until a match starts) */
    buildControls();
})();
/* ═════════════ COUNTDOWN HELPER (NEW) ═════════════ */
function startCountdown(sec, callback) {
    let remaining = sec;
    const overlay = document.createElement("div");
    overlay.id = "countdown-overlay";
    Object.assign(overlay.style, {
        position: "fixed", // full viewport, immune to layout quirks
        inset: "0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "4rem",
        fontWeight: "800",
        color: "#fff",
        backdropFilter: "blur(3px)",
        zIndex: "9999",
        pointerEvents: "none", // clicks fall through
    });
    overlay.textContent = String(remaining);
    document.body.appendChild(overlay);
    const tick = () => {
        remaining--;
        if (remaining === 0) {
            overlay.remove();
            callback(); // hand control back
        }
        else {
            overlay.textContent = String(remaining);
            setTimeout(tick, 1000);
        }
    };
    setTimeout(tick, 1000);
}
/* ── helper: begin the game loop after the countdown ── */
function beginPlay() {
    var _a, _b;
    playing = true;
    lastTime = performance.now();
    aiAccumulator = 0;
    requestAnimationFrame(loop);
    (_b = (_a = window).refreshMobilePads) === null || _b === void 0 ? void 0 : _b.call(_a); // show on-screen arrows when needed
}
export { resetObjects, resizeCanvas, render, updateScore };
