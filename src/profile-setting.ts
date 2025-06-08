/* profile-setting.ts – Info panel & inline-editor
 * ------------------------------------------------
 *  – validators
 *  – populateProfileViews / setActiveTab / refreshProfileHeader (exported)
 *  – edit / save / cancel logic with password rules
 *  – toast + error helpers
 */

export function $(sel: string): HTMLElement | null {
  return document.querySelector(sel);
}

/* ───────── validators ───────── */
function validateEmail(email: string): string | null {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? null
    : "Please enter a valid email address.";
}
function validatePassword(pw: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(pw)) return "Password needs at least one capital letter.";
  if (!/\d/.test(pw)) return "Password needs at least one number.";
  return null;
}

/* basic DOM refs -------------------------------------------------- */
const tabBtns = document.querySelectorAll<HTMLButtonElement>("#profile-tabs .tab-btn");

/* EXPORT 1: refresh spans + inputs with the current user ---------- */
export function populateProfileViews(): void {
  try {
    const user = JSON.parse(localStorage.getItem("user") ?? "{}");
    const vUser = $("#view-username") as HTMLElement | null;
    const vMail = $("#view-email")    as HTMLElement | null;
    const vJoin = $("#view-joined")   as HTMLElement | null;
    const inUser= $("#edit-username") as HTMLInputElement | null;
    const inMail= $("#edit-email")    as HTMLInputElement | null;

    if (user.username) {
      if (vUser) vUser.textContent = user.username;
      if (inUser) inUser.value     = user.username;
    }
    if (user.email) {
      if (vMail) vMail.textContent = user.email;
      if (inMail) inMail.value     = user.email;
    }
    if (user.joined && vJoin) vJoin.textContent = user.joined;
  } catch { /* ignore */ }
}

/* EXPORT 2: force-select a profile tab ---------------------------- */
export function setActiveTab(key: string): void {
  const btn = Array.from(tabBtns).find(b => b.dataset.tab === key);
  btn?.click();   // triggers underline & panel logic in nav.ts
}

/* EXPORT 3: update big header (name + mail beside avatar) --------- */
function refreshProfileHeader(): void {
  try {
    const user = JSON.parse(localStorage.getItem("user") ?? "{}");
    const nameEl = document.getElementById("profile-name");
    const mailEl = document.getElementById("profile-mail");
	const avatar = $("#avatar-img")   as HTMLInputElement;
    if (nameEl && user.username) nameEl.textContent = user.username;
    if (mailEl && user.email   ) mailEl.textContent = user.email;
	if (avatar && user.avatar_url) avatar.src = user.avatar_url;
	else if (avatar && !user.avatar_url) avatar.src = "https://img.freepik.com/free-vector/cute-astronaut-playing-vr-game-with-controller-cartoon-vector-icon-illustration-science-technology_138676-13977.jpg?semt=ais_hybrid&w=740";
  } catch { /* ignore */ }
}

/* ========== INLINE-EDITOR LOGIC (unchanged from previous build) ========== */
const editBtn   = $("#settings-edit")   as HTMLButtonElement | null;
const saveBtn   = $("#settings-save")   as HTMLButtonElement | null;
const cancelBtn = $("#settings-cancel") as HTMLButtonElement | null;
const actions   = $("#settings-actions") as HTMLElement | null;

const viewUsername = $("#view-username") as HTMLElement | null;
const viewEmail    = $("#view-email")    as HTMLElement | null;

const inUsername    = $("#edit-username")   as HTMLInputElement | null;
const inEmail       = $("#edit-email")      as HTMLInputElement | null;
const inOldPass     = $("#edit-oldpass")    as HTMLInputElement | null;
const inNewPass     = $("#edit-newpass")    as HTMLInputElement | null;
const inConfirmPass = $("#edit-confpass")   as HTMLInputElement | null;

const DUMMY_OLD_PASS = "OldPass123";
let   editing        = false;

/* helpers --------------------------------------------------------- */
function toggleEdit(on: boolean) {
  editing = on;
  document.querySelectorAll<HTMLElement>(".edit-input")
    .forEach(el => el.classList.toggle("hidden", !on));
  document.querySelectorAll<HTMLElement>("#profile-fields span[id^='view-']")
    .forEach(el => el.classList.toggle("hidden", on));
  actions?.classList.toggle("hidden", !on);
  editBtn?.classList.toggle("hidden", on);
}
function showToast() {
  const t = $("#profile-toast") as HTMLElement;
  t.style.opacity = "1";
  setTimeout(() => (t.style.opacity = "0"), 2000);
}
function showError(msg: string) {
  const infoPanel =
    document.querySelector<HTMLElement>('#tab-panels .panel[data-panel="info"]')
    ?? document.body;
  let box = infoPanel.querySelector<HTMLElement>("#info-error");
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
    box!.classList.replace("animate__fadeIn", "animate__fadeOut");
  }, 2500);
}

/* handlers -------------------------------------------------------- */
editBtn?.addEventListener("click", () => toggleEdit(true));

cancelBtn?.addEventListener("click", () => {
  if (viewUsername && inUsername) inUsername.value = viewUsername.textContent ?? "";
  if (viewEmail    && inEmail   ) inEmail.value    = viewEmail.textContent ?? "";
  [inOldPass, inNewPass, inConfirmPass].forEach(i => i && (i.value = ""));
  toggleEdit(false);
});

saveBtn?.addEventListener("click", () => {
  if (!inUsername || !inEmail) return;

  const u = inUsername.value.trim();
  const e = inEmail.value.trim();
  if (!u) { showError("Username cannot be empty."); return; }
  const eErr = validateEmail(e);
  if (eErr) { showError(eErr); return; }

  const oldP = inOldPass?.value ?? "";
  const newP = inNewPass?.value ?? "";
  const conP = inConfirmPass?.value ?? "";

  if (oldP || newP || conP) {
    if (!oldP || !newP || !conP) {
      showError("Please fill current, new, and confirm password."); return;
    }
    if (oldP !== DUMMY_OLD_PASS) {
      showError("Current password is incorrect."); return;
    }
    const pErr = validatePassword(newP);
    if (pErr) { showError(pErr); return; }
    if (newP !== conP) {
      showError("New and confirm password do not match."); return;
    }
    /* TODO: call backend to update password */
    [inOldPass, inNewPass, inConfirmPass]
      .forEach(i => i && (i.value = ""));
  }

  localStorage.setItem("user", JSON.stringify({
    ...(JSON.parse(localStorage.getItem("user") ?? "{}")),
    username: u, email: e,
  }));
  if (viewUsername) viewUsername.textContent = u;
  if (viewEmail)    viewEmail.textContent    = e;

  toggleEdit(false);
  showToast();
  refreshProfileHeader();
});

/* initial hydrate once ------------------------------------------- */
populateProfileViews();
