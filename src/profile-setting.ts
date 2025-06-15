/* profile-setting.ts – Info panel & inline-editor
 * ------------------------------------------------
 *  – validators
 *  – populateProfileViews / setActiveTab / refreshProfileHeader (exported)
 *  – edit / save / cancel logic with password rules
 *  – toast + error helpers
 */

import { HOST } from './config.js';

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

/* — auth header & joined-date fetch — */
function getAuthHeader(): HeadersInit {
  const t = localStorage.getItem("token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/* profile-setting.ts  … */

/* ---------- fetchCreatedAt (lazy + memoised) ------------------- */
let cachedCreatedAt: string | null | undefined = undefined;   // ➊ NEW

async function fetchCreatedAt(): Promise<string | null> {
  /* ➋ Return cached value if we already fetched once */
  if (cachedCreatedAt !== undefined) return cachedCreatedAt;

  try {
    const r = await fetch(`http://${HOST}:3000/api/users/created-at`, {
      headers: getAuthHeader(),                // unchanged helper
    });
    if (!r.ok) { cachedCreatedAt = null; return null; }

    const { created_at } = (await r.json()) as { created_at?: string };
    cachedCreatedAt = created_at ?? null;     // ➌ store for next time
    return cachedCreatedAt;
  } catch {
    cachedCreatedAt = null;                   // ➍ remember failure, skip retry
    return null;
  }
}



const enable2FABtn = document.getElementById('enable-2fa-btn')!;
const status2FA    = document.getElementById('2fa-status')!;
const modal2FA     = document.getElementById('2fa-modal')!;
const qrImg        = document.getElementById('2fa-qr') as HTMLImageElement;
const manualKeyEl  = document.getElementById('2fa-manual')!;
const tokenInput   = document.getElementById('2fa-token-input') as HTMLInputElement;
const secretInput   = document.getElementById('2fa-manual') as HTMLInputElement;
const verifyBtn    = document.getElementById('2fa-verify-btn')!;
const cancelBtn2fa    = document.getElementById('2fa-cancel-btn')!;
const error2FA     = document.getElementById('2fa-error')!;
const modalContent = modal2FA.querySelector('div')!;

// helper to get auth header
function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` };
}

modalContent.addEventListener('click', (e) => {
  e.stopPropagation();
});

// 2) open setup modal

enable2FABtn.addEventListener('click', async (e) => {
	try {
		e.preventDefault();
		e.stopPropagation();
		const res = await fetch(`http://${HOST}:3000/api/2fa/setup`, {
		headers: { ...authHeader(), 'Content-Type': 'application/json' },
		});
		const { qrDataUrl, manualKey } = await res.json();
		qrImg.src       = qrDataUrl;
		manualKeyEl.textContent = manualKey;
		tokenInput.value        = '';
		error2FA.textContent    = '';
		modal2FA.classList.remove('hidden');
	} catch (err) {
		status2FA.textContent = 'Failed to start 2FA setup.';
	}
});

// 3) cancel
cancelBtn2fa.addEventListener('click', (e) => {
	e.preventDefault();
	modal2FA.classList.add('hidden')
});

// 4) verify the TOTP
verifyBtn.addEventListener('click', async (e) => {
	e.preventDefault();
	const token = tokenInput.value.trim();
	const secretFromReq = secretInput.innerHTML.trim().toString();
	if (!token) {
		error2FA.textContent = 'Enter the code from your app';
		return;
	}
	try {
		const res = await fetch(`http://${HOST}:3000/api/2fa/verify`, {
		method: 'POST',
		headers: { ...authHeader(), 'Content-Type': 'application/json' },
		body: JSON.stringify({ token, secretFromReq }),
		});
		if (!res.ok) throw await res.json();
		modal2FA.classList.add('hidden');
		refreshProfileHeader();
	} catch (e: any) {
		error2FA.textContent = e.error || 'Invalid code, try again';
	}
});

/* basic DOM refs -------------------------------------------------- */
const tabBtns = document.querySelectorAll<HTMLButtonElement>("#profile-tabs .tab-btn");

/* EXPORT 1: refresh spans + inputs with the current user ---------- */
export async function populateProfileViews(): Promise<void> {
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
    /* joined date (authoritative backend value) */
    const iso       = await fetchCreatedAt();              // e.g. "2025-06-04T11:27:00Z"
    const joinText  = iso ? `Player since — ${iso.slice(0, 10)}` : "Player since —";
    if (vJoin)  vJoin.textContent = joinText;              // Info-tab line
    const headerJoin = document.getElementById("profile-joined");
    if (headerJoin) headerJoin.textContent = joinText;     // big header line

  } catch { /* ignore */ }
}

/* EXPORT 2: force-select a profile tab ---------------------------- */
export function setActiveTab(key: string): void {
  const btn = Array.from(tabBtns).find(b => b.dataset.tab === key);
  btn?.click();   // triggers underline & panel logic in nav.ts
}

/* EXPORT 3: update big header (name + mail beside avatar) --------- */
export async function refreshProfileHeader(): Promise<void> {
  try {
    const user = JSON.parse(localStorage.getItem("user") ?? "{}");
    const nameEl = document.getElementById("profile-name");
    const mailEl = document.getElementById("profile-mail");
	const avatar = $("#avatar-img")   as HTMLInputElement;
	const token = localStorage.getItem('token');
	const status2FA    = document.getElementById('2fa-status')!;
	const enable2FABtn    = document.getElementById('enable-2fa-btn')!;
	const remove2FABtn = document.getElementById('remove-2fa-btn')!;
    if (nameEl && user.username) nameEl.textContent = user.username;
    if (mailEl && user.email   ) mailEl.textContent = user.email;
	if (avatar && user.avatar_url) avatar.src = user.avatar_url;
	else if (avatar && !user.avatar_url) avatar.src = "https://img.freepik.com/free-vector/cute-astronaut-playing-vr-game-with-controller-cartoon-vector-icon-illustration-science-technology_138676-13977.jpg?semt=ais_hybrid&w=740";
	fetch(`http://${HOST}:3000/api/users/me`, {
	headers: { 'Authorization': `Bearer ${token}` }
	})
    .then((r) => r.json())
    .then((user) => {
    if (user.twofa_enabled)
	  {
      status2FA.textContent = '2FA Enabled ✅';
      enable2FABtn.innerHTML = "Reset 2FA";
      remove2FABtn.classList.remove('hidden');
	  }
	  else
	  {
	  	status2FA.textContent = 'Not enabled';
      enable2FABtn.innerHTML = "Enable Two-Factor Authentication";
      remove2FABtn.classList.add('hidden');
	  }
    });
	/* joined date */
	const iso = await fetchCreatedAt();
	const joinEl = document.getElementById("profile-joined");
	if (joinEl) {
		joinEl.textContent = iso
		? `Player since — ${iso.slice(0, 10)}`
		: "Player since —";
	}
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
let   editing        = true;

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

saveBtn?.addEventListener("click", async () => {
  if (!inUsername || !inEmail) return;

  /* ─── 1. front-end validation ─── */
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
    const pErr = validatePassword(newP);
    if (pErr) { showError(pErr); return; }
    if (newP !== conP) {
      showError("New and confirm password do not match."); return;
    }
  }

  /* ─── 2. build payload & call backend ─── */
  try {
    const payload: Record<string, string> = {};
    if (u !== (viewUsername?.textContent ?? "")) payload.username = u;
    if (e !== (viewEmail?.textContent ?? ""))    payload.email    = e;
    if (newP)                                    {payload.newPassword = newP;payload.oldPassword = oldP;}

    if (Object.keys(payload).length) {
      const res  = await fetch(`http://${HOST}:3000/api/users/edit-profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),              // helper defined near top
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {                       // backend validation failed
        showError(data.error || "Update failed");
        return;
      }
    } else {
      showError("Nothing changed");        // user hit Save without edits
      return;
    }
  } catch {
    showError("Network error – please try again");
    return;
  }

  /* ─── 3. reflect success locally ─── */
  localStorage.setItem("user", JSON.stringify({
    ...(JSON.parse(localStorage.getItem("user") ?? "{}")),
    username: u,
    email:    e,
  }));
  if (viewUsername) viewUsername.textContent = u;
  if (viewEmail)    viewEmail.textContent    = e;

  [inOldPass, inNewPass, inConfirmPass]      // clear pwd boxes
    .forEach(i => i && (i.value = ""));

  toggleEdit(false);
  showToast();
  refreshProfileHeader();
});


 /* initial hydrate once ------------------------------------------- */
if (localStorage.getItem("token")) {
  populateProfileViews();
  refreshProfileHeader();
}