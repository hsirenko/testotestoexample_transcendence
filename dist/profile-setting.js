/* profile-setting.ts – Info panel & inline-editor
 * ------------------------------------------------
 *  – validators
 *  – populateProfileViews / setActiveTab / refreshProfileHeader (exported)
 *  – edit / save / cancel logic with password rules
 *  – toast + error helpers
 */
export function $(sel) {
    return document.querySelector(sel);
}
/* ───────── validators ───────── */
function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ? null
        : "Please enter a valid email address.";
}
function validatePassword(pw) {
    if (pw.length < 8)
        return "Password must be at least 8 characters.";
    if (!/[A-Z]/.test(pw))
        return "Password needs at least one capital letter.";
    if (!/\d/.test(pw))
        return "Password needs at least one number.";
    return null;
}
/* basic DOM refs -------------------------------------------------- */
const tabBtns = document.querySelectorAll("#profile-tabs .tab-btn");
/* EXPORT 1: refresh spans + inputs with the current user ---------- */
export function populateProfileViews() {
    var _a;
    try {
        const user = JSON.parse((_a = localStorage.getItem("user")) !== null && _a !== void 0 ? _a : "{}");
        const vUser = $("#view-username");
        const vMail = $("#view-email");
        const vJoin = $("#view-joined");
        const inUser = $("#edit-username");
        const inMail = $("#edit-email");
        if (user.username) {
            if (vUser)
                vUser.textContent = user.username;
            if (inUser)
                inUser.value = user.username;
        }
        if (user.email) {
            if (vMail)
                vMail.textContent = user.email;
            if (inMail)
                inMail.value = user.email;
        }
        if (user.joined && vJoin)
            vJoin.textContent = user.joined;
    }
    catch ( /* ignore */_b) { /* ignore */ }
}
/* EXPORT 2: force-select a profile tab ---------------------------- */
export function setActiveTab(key) {
    const btn = Array.from(tabBtns).find(b => b.dataset.tab === key);
    btn === null || btn === void 0 ? void 0 : btn.click(); // triggers underline & panel logic in nav.ts
}
/* EXPORT 3: update big header (name + mail beside avatar) --------- */
function refreshProfileHeader() {
    var _a;
    try {
        const user = JSON.parse((_a = localStorage.getItem("user")) !== null && _a !== void 0 ? _a : "{}");
        const nameEl = document.getElementById("profile-name");
        const mailEl = document.getElementById("profile-mail");
        const avatar = $("#avatar-img");
        if (nameEl && user.username)
            nameEl.textContent = user.username;
        if (mailEl && user.email)
            mailEl.textContent = user.email;
        if (avatar && user.avatar_url)
            avatar.src = user.avatar_url;
        else if (avatar && !user.avatar_url)
            avatar.src = "https://img.freepik.com/free-vector/cute-astronaut-playing-vr-game-with-controller-cartoon-vector-icon-illustration-science-technology_138676-13977.jpg?semt=ais_hybrid&w=740";
    }
    catch ( /* ignore */_b) { /* ignore */ }
}
/* ========== INLINE-EDITOR LOGIC (unchanged from previous build) ========== */
const editBtn = $("#settings-edit");
const saveBtn = $("#settings-save");
const cancelBtn = $("#settings-cancel");
const actions = $("#settings-actions");
const viewUsername = $("#view-username");
const viewEmail = $("#view-email");
const inUsername = $("#edit-username");
const inEmail = $("#edit-email");
const inOldPass = $("#edit-oldpass");
const inNewPass = $("#edit-newpass");
const inConfirmPass = $("#edit-confpass");
const DUMMY_OLD_PASS = "OldPass123";
let editing = false;
/* helpers --------------------------------------------------------- */
function toggleEdit(on) {
    editing = on;
    document.querySelectorAll(".edit-input")
        .forEach(el => el.classList.toggle("hidden", !on));
    document.querySelectorAll("#profile-fields span[id^='view-']")
        .forEach(el => el.classList.toggle("hidden", on));
    actions === null || actions === void 0 ? void 0 : actions.classList.toggle("hidden", !on);
    editBtn === null || editBtn === void 0 ? void 0 : editBtn.classList.toggle("hidden", on);
}
function showToast() {
    const t = $("#profile-toast");
    t.style.opacity = "1";
    setTimeout(() => (t.style.opacity = "0"), 2000);
}
function showError(msg) {
    var _a;
    const infoPanel = (_a = document.querySelector('#tab-panels .panel[data-panel="info"]')) !== null && _a !== void 0 ? _a : document.body;
    let box = infoPanel.querySelector("#info-error");
    if (!box) {
        box = document.createElement("div");
        box.id = "info-error";
        box.className =
            "mb-4 rounded bg-red-600/90 px-3 py-2 text-sm text-white shadow animate__animated";
        infoPanel.prepend(box);
    }
    box.textContent = msg;
    box.classList.remove("animate__fadeOut");
    box.classList.add("animate__fadeIn");
    setTimeout(() => {
        box.classList.replace("animate__fadeIn", "animate__fadeOut");
    }, 2500);
}
/* handlers -------------------------------------------------------- */
editBtn === null || editBtn === void 0 ? void 0 : editBtn.addEventListener("click", () => toggleEdit(true));
cancelBtn === null || cancelBtn === void 0 ? void 0 : cancelBtn.addEventListener("click", () => {
    var _a, _b;
    if (viewUsername && inUsername)
        inUsername.value = (_a = viewUsername.textContent) !== null && _a !== void 0 ? _a : "";
    if (viewEmail && inEmail)
        inEmail.value = (_b = viewEmail.textContent) !== null && _b !== void 0 ? _b : "";
    [inOldPass, inNewPass, inConfirmPass].forEach(i => i && (i.value = ""));
    toggleEdit(false);
});
saveBtn === null || saveBtn === void 0 ? void 0 : saveBtn.addEventListener("click", () => {
    var _a, _b, _c, _d;
    if (!inUsername || !inEmail)
        return;
    const u = inUsername.value.trim();
    const e = inEmail.value.trim();
    if (!u) {
        showError("Username cannot be empty.");
        return;
    }
    const eErr = validateEmail(e);
    if (eErr) {
        showError(eErr);
        return;
    }
    const oldP = (_a = inOldPass === null || inOldPass === void 0 ? void 0 : inOldPass.value) !== null && _a !== void 0 ? _a : "";
    const newP = (_b = inNewPass === null || inNewPass === void 0 ? void 0 : inNewPass.value) !== null && _b !== void 0 ? _b : "";
    const conP = (_c = inConfirmPass === null || inConfirmPass === void 0 ? void 0 : inConfirmPass.value) !== null && _c !== void 0 ? _c : "";
    if (oldP || newP || conP) {
        if (!oldP || !newP || !conP) {
            showError("Please fill current, new, and confirm password.");
            return;
        }
        if (oldP !== DUMMY_OLD_PASS) {
            showError("Current password is incorrect.");
            return;
        }
        const pErr = validatePassword(newP);
        if (pErr) {
            showError(pErr);
            return;
        }
        if (newP !== conP) {
            showError("New and confirm password do not match.");
            return;
        }
        /* TODO: call backend to update password */
        [inOldPass, inNewPass, inConfirmPass]
            .forEach(i => i && (i.value = ""));
    }
    localStorage.setItem("user", JSON.stringify(Object.assign(Object.assign({}, (JSON.parse((_d = localStorage.getItem("user")) !== null && _d !== void 0 ? _d : "{}"))), { username: u, email: e })));
    if (viewUsername)
        viewUsername.textContent = u;
    if (viewEmail)
        viewEmail.textContent = e;
    toggleEdit(false);
    showToast();
    refreshProfileHeader();
});
/* initial hydrate once ------------------------------------------- */
populateProfileViews();
