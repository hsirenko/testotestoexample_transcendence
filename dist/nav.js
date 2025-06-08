/* nav.ts – navbar, overlays, tabs, play-flow
 * ------------------------------------------
 *  Inline-profile editor code was moved to profile-setting.ts
 */
var _a, _b, _c, _d, _e, _f, _g, _h, _j;
import { initStatsTab } from "./stats.js";
import { initHistoryTab } from "./history.js";
import { populateProfileViews, setActiveTab } from "./profile-setting.js";
import "./welcome.js";
/* ───── shorthand ───── */
const $ = (sel) => document.querySelector(sel);
/* =========================================================================
 *  NAVBAR  (burger, mobile dropdown)
 * =======================================================================*/
const navMenu = $("#nav-menu");
const BURGER = $("#burger");
const MOBILE_BP = 640;
const DROP = [
    "flex", "flex-col", "absolute", "left-0", "right-0", "top-16",
    "w-screen", "space-y-4", "items-center", "py-4", "bg-violet-950/95"
];
function applyMobile(on) {
    if (!navMenu)
        return;
    DROP.forEach(c => navMenu.classList[on ? "add" : "remove"](c));
}
function openMenu() { if (navMenu) {
    navMenu.classList.remove("hidden");
    applyMobile(true);
} }
function closeMenu() { if (navMenu) {
    applyMobile(false);
    navMenu.classList.add("hidden");
} }
BURGER === null || BURGER === void 0 ? void 0 : BURGER.addEventListener("click", () => (navMenu && navMenu.classList.contains("hidden") ? openMenu() : closeMenu()));
navMenu === null || navMenu === void 0 ? void 0 : navMenu.querySelectorAll("button").forEach(btn => btn.addEventListener("click", () => innerWidth < MOBILE_BP && closeMenu()));
addEventListener("resize", () => {
    if (!navMenu)
        return;
    if (innerWidth >= MOBILE_BP) {
        navMenu.classList.remove("hidden");
        applyMobile(false);
    }
    else if (navMenu.classList.contains("hidden"))
        applyMobile(false);
    else
        applyMobile(true);
});
/* =========================================================================
 *  PROFILE OVERLAY  (tabs, avatar, etc.)
 * =======================================================================*/
const profileOv = $("#profile-overlay");
(_a = $("#avatar-input")) === null || _a === void 0 ? void 0 : _a.addEventListener("change", ev => {
    var _a;
    const f = (_a = ev.currentTarget.files) === null || _a === void 0 ? void 0 : _a[0];
    if (f)
        $("#avatar-img").src = URL.createObjectURL(f);
});
/* tabs */
const tabBtns = document.querySelectorAll("#profile-tabs .tab-btn");
const panels = document.querySelectorAll("#tab-panels .panel");
const underline = $("#tab-underline");
function updateUnderline() {
    const active = document.querySelector("#profile-tabs .tab-btn.text-white");
    if (active) {
        underline.style.width = `${active.offsetWidth}px`;
        underline.style.transform = `translateX(${active.offsetLeft}px)`;
    }
}
tabBtns.forEach(btn => btn.addEventListener("click", () => {
    tabBtns.forEach(b => {
        b.classList.toggle("text-white", b === btn);
        b.classList.toggle("text-white/70", b !== btn);
    });
    underline.style.width = `${btn.offsetWidth}px`;
    underline.style.transform = `translateX(${btn.offsetLeft}px)`;
    panels.forEach(p => p.classList.toggle("hidden", p.dataset.panel !== btn.dataset.tab));
    if (btn.dataset.tab === "stats")
        initStatsTab();
    if (btn.dataset.tab === "history")
        initHistoryTab();
}));
addEventListener("resize", updateUnderline);
function refreshProfileHeader() {
    var _a;
    try {
        const user = JSON.parse((_a = localStorage.getItem("user")) !== null && _a !== void 0 ? _a : "{}");
        const nameEl = document.getElementById("profile-name");
        const mailEl = document.getElementById("profile-mail");
        const avatar = document.getElementById("avatar-img");
        const token = localStorage.getItem('token');
        const status2FA = document.getElementById('2fa-status');
        const enable2FABtn = document.getElementById('enable-2fa-btn');
        const remove2FABtn = document.getElementById('remove-2fa-btn');
        if (nameEl && user.username)
            nameEl.textContent = user.username;
        if (mailEl && user.email)
            mailEl.textContent = user.email;
        if (avatar && user.avatar_url)
            avatar.src = user.avatar_url;
        else if (avatar && !user.avatar_url)
            avatar.src = "https://img.freepik.com/free-vector/cute-astronaut-playing-vr-game-with-controller-cartoon-vector-icon-illustration-science-technology_138676-13977.jpg?semt=ais_hybrid&w=740";
        fetch('http://localhost:3000/api/users/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then((r) => r.json())
            .then((user) => {
            if (user.twofa_enabled) {
                status2FA.textContent = '2FA Enabled ✅';
                enable2FABtn.innerHTML = "Reset 2FA";
                remove2FABtn.classList.remove('hidden');
            }
            else {
                status2FA.textContent = 'Not enabled';
                enable2FABtn.innerHTML = "Enable Two-Factor Authentication";
                remove2FABtn.classList.add('hidden');
            }
        });
    }
    catch ( /* ignore */_b) { /* ignore */ }
}
/* open / close overlay */
(_b = $("#nav-profile")) === null || _b === void 0 ? void 0 : _b.addEventListener("click", () => {
    populateProfileViews(); // fresh user data
    setActiveTab("info"); // always start on Info
    show(profileOv);
    updateUnderline();
    refreshProfileHeader();
});
(_c = $("#profile-close")) === null || _c === void 0 ? void 0 : _c.addEventListener("click", () => hide(profileOv));
addEventListener("keydown", e => e.key === "Escape" && hide(profileOv));
/* =========================================================================
 *  GENERIC OVERLAY HELPERS
 * =======================================================================*/
function show(ov, inner) {
    ov.classList.remove("hidden", "opacity-0", "animate__fadeOut", "animate__animated");
    if (inner)
        inner.classList.remove("scale-90");
    ov.classList.add("opacity-0");
    requestAnimationFrame(() => {
        ov.classList.add("animate__animated", "animate__fadeIn");
        ov.classList.remove("opacity-0");
    });
}
function hide(ov, inner) {
    if (ov.classList.contains("hidden"))
        return;
    ov.classList.remove("animate__fadeIn");
    ov.classList.add("animate__fadeOut");
    if (inner)
        inner.classList.add("scale-90");
    ov.addEventListener("animationend", () => {
        ov.classList.add("hidden", "opacity-0");
        ov.classList.remove("animate__animated", "animate__fadeOut");
    }, { once: true });
}
/* =========================================================================
 *  PLAY → DIFFICULTY FLOW   (unchanged)
 * =======================================================================*/
const playOv = $("#play-overlay");
(_d = $("#nav-play")) === null || _d === void 0 ? void 0 : _d.addEventListener("click", () => show(playOv));
(_e = $("#play-close")) === null || _e === void 0 ? void 0 : _e.addEventListener("click", () => hide(playOv));
addEventListener("keydown", e => e.key === "Escape" && hide(playOv));
document.querySelectorAll(".mode-card").forEach(card => card.addEventListener("click", () => {
    const mode = card.dataset.mode;
    hide(playOv);
    if (mode === "ai")
        show($("#difficulty-overlay"), $("#difficulty-container"));
    else if (mode === "offline")
        window.setGameMode("pvp");
    else
        alert(`Mode “${mode}” coming soon!`);
}));
const diffOv = $("#difficulty-overlay");
const diffBox = $("#difficulty-container");
(_f = $("#difficulty-close")) === null || _f === void 0 ? void 0 : _f.addEventListener("click", () => hide(diffOv, diffBox));
addEventListener("keydown", e => e.key === "Escape" && hide(diffOv, diffBox));
document.querySelectorAll(".diff-btn").forEach(btn => btn.addEventListener("click", () => {
    const diff = btn.dataset.diff;
    hide(diffOv, diffBox);
    const rate = diff === "easy" ? 1.0 : diff === "medium" ? 0.5 : 0.01;
    window.setAIRefresh(rate);
    window.setGameMode("ai");
}));
//TWO FACTOR AUTHENTICATION
(_g = document.getElementById('remove-2fa-btn')) === null || _g === void 0 ? void 0 : _g.addEventListener('click', () => {
    document.getElementById('remove-2fa-modal').classList.remove('hidden');
    document.getElementById('remove-2fa-token-input').value = '';
    document.getElementById('remove-2fa-error').textContent = '';
});
(_h = document.getElementById('remove-2fa-cancel-btn')) === null || _h === void 0 ? void 0 : _h.addEventListener('click', () => {
    document.getElementById('remove-2fa-modal').classList.add('hidden');
});
(_j = document.getElementById('remove-2fa-confirm-btn')) === null || _j === void 0 ? void 0 : _j.addEventListener('click', async () => {
    const token = document.getElementById('remove-2fa-token-input').value;
    const errorEl = document.getElementById('remove-2fa-error');
    const tokenStorage = localStorage.getItem('token');
    try {
        const res = await fetch('http://localhost:3000/api/2fa/remove', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tokenStorage}`
            },
            body: JSON.stringify({ token })
        });
        const result = await res.json();
        if (!res.ok) {
            errorEl.textContent = result.error || 'Something went wrong.';
            return;
        }
        // Success
        document.getElementById('remove-2fa-modal').classList.add('hidden');
        refreshProfileHeader(); // Refresh UI
    }
    catch (err) {
        errorEl.textContent = 'Network error';
    }
});
