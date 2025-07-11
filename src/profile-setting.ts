// profile-setting.ts – Info panel & inline-editor

import { resolveAvatar } from './friends.js';
import { getAuthHeader } from './utils/auth.js';

export function $(sel: string): HTMLElement | null {
    return document.querySelector(sel);
}

//validators
function validateEmail(email: string): string | null {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? null : 'Please enter a valid email address.';
}
function validatePassword(pw: string): string | null {
    if (pw.length < 8) return 'Password must be at least 8 characters.';
    if (!/[A-Z]/.test(pw)) return 'Password needs at least one capital letter.';
    if (!/\d/.test(pw)) return 'Password needs at least one number.';
    return null;
}


async function fetchMe(): Promise<any | null> {
    try {
        const r = await fetch(`/api/users/me`, {
            headers: getAuthHeader(),
        });
        if (!r.ok) return null;
        return await r.json();
    } catch {
        return null;
    }
}

const enable2FABtn = document.getElementById('enable-2fa-btn')!;
const status2FA = document.getElementById('2fa-status')!;
const modal2FA = document.getElementById('2fa-modal')!;
const qrImg = document.getElementById('2fa-qr') as HTMLImageElement;
const manualKeyEl = document.getElementById('2fa-manual')!;
const tokenInput = document.getElementById('2fa-token-input') as HTMLInputElement;
const secretInput = document.getElementById('2fa-manual') as HTMLInputElement;
const verifyBtn = document.getElementById('2fa-verify-btn')!;
const cancelBtn2fa = document.getElementById('2fa-cancel-btn')!;
const error2FA = document.getElementById('2fa-error')!;
const modalContent = modal2FA.querySelector('div')!;

// helper to get auth header
function authHeader() {
    return { Authorization: `Bearer ${localStorage.getItem('token')}` };
}

modalContent.addEventListener('click', (e) => {
    e.stopPropagation();
});

enable2FABtn.addEventListener('click', async (e) => {
    try {
        e.preventDefault();
        e.stopPropagation();
        const res = await fetch(`/api/2fa/setup`, {
            headers: { ...authHeader(), 'Content-Type': 'application/json' },
        });
        const { qrDataUrl, manualKey } = await res.json();
        qrImg.src = qrDataUrl;
        manualKeyEl.textContent = manualKey;
        tokenInput.value = '';
        error2FA.textContent = '';
        modal2FA.classList.remove('hidden');
    } catch (err) {
        status2FA.textContent = 'Failed to start 2FA setup.';
    }
});

cancelBtn2fa.addEventListener('click', (e) => {
    e.preventDefault();
    modal2FA.classList.add('hidden');
});

verifyBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const token = tokenInput.value.trim();
    const secretFromReq = secretInput.innerHTML.trim().toString();
    if (!token) {
        error2FA.textContent = 'Enter the code from your app';
        return;
    }
    try {
        const res = await fetch(`/api/2fa/verify`, {
            method: 'POST',
            headers: { ...authHeader(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, secretFromReq }),
        });
        if (!res.ok) throw await res.json();
        
        // Update localStorage user object to reflect 2FA enabled status
        const user = JSON.parse(localStorage.getItem('user') ?? '{}');
        user.twofa_enabled = true;
        localStorage.setItem('user', JSON.stringify(user));
        
        modal2FA.classList.add('hidden');
        refreshProfileHeader();
    } catch (e: any) {
        error2FA.textContent = e.error || 'Invalid code, try again';
    }
});

const tabBtns = document.querySelectorAll<HTMLButtonElement>('#profile-tabs .tab-btn');

export async function populateProfileViews(): Promise<void> {
    try {
        const user = JSON.parse(localStorage.getItem('user') ?? '{}');
        const vUser = $('#view-username') as HTMLElement | null;
        const vMail = $('#view-email') as HTMLElement | null;
        const vJoin = $('#view-joined') as HTMLElement | null;
        const inUser = $('#edit-username') as HTMLInputElement | null;
        const inMail = $('#edit-email') as HTMLInputElement | null;
        const vXP = $('#view-xp') as HTMLElement | null;

        if (user.username) {
            if (vUser) vUser.textContent = user.username;
            if (inUser) inUser.value = user.username;
        }
        if (user.email) {
            if (vMail) vMail.textContent = user.email;
            if (inMail) inMail.value = user.email;
        }
    } catch {}
}

export function setActiveTab(key: string): void {
    const btn = Array.from(tabBtns).find((b) => b.dataset.tab === key);
    btn?.click();
}

export async function refreshProfileHeader(): Promise<void> {
    try {
        const user = JSON.parse(localStorage.getItem('user') ?? '{}');
        const nameEl = document.getElementById('profile-name');
        const mailEl = document.getElementById('profile-mail');
        const avatar = $('#avatar-img') as HTMLImageElement | null;
        const token = localStorage.getItem('token');
        const status2FA = document.getElementById('2fa-status')!;
        const enable2FABtn = document.getElementById('enable-2fa-btn')!;
        const remove2FABtn = document.getElementById('remove-2fa-btn')!;
        if (nameEl && user.username) nameEl.textContent = user.username;
        if (mailEl && user.email) mailEl.textContent = user.email;
        if (avatar) avatar.src = resolveAvatar(user.avatar_url);
        const me = await fetchMe();
        if (me.twofa_enabled) {
            status2FA.textContent = '2FA Enabled ✅';
            enable2FABtn.innerHTML = 'Reset 2FA';
            remove2FABtn.classList.remove('hidden');
        } else {
            status2FA.textContent = 'Not enabled';
            enable2FABtn.innerHTML = 'Enable Two-Factor Authentication';
            remove2FABtn.classList.add('hidden');
        }
        const joinEl = document.getElementById('profile-joined');
        if (joinEl) {
            joinEl.textContent = me?.created_at
                ? `Player since — ${me.created_at.slice(0, 10)}`
                : 'Player since —';
        }
        setRing('profile-level-bar', 'profile-level-text', me?.xp_level ?? null);
    } catch {}
}

const CIRC = 2 * Math.PI * 45;

export function setRing(barId: string, textId: string, lvl: number | null): void {
    const bar = document.getElementById(barId) as SVGCircleElement | null;
    const text = document.getElementById(textId) as HTMLElement | null;
    if (!bar || !text || lvl === null) return;

    const int = Math.floor(lvl);
    const frac = lvl - int;

    text.textContent = String(int);
    bar.style.strokeDashoffset = String(CIRC * (1 - frac));
}

const editBtn = $('#settings-edit') as HTMLButtonElement | null;
const saveBtn = $('#settings-save') as HTMLButtonElement | null;
const cancelBtn = $('#settings-cancel') as HTMLButtonElement | null;
const actions = $('#settings-actions') as HTMLElement | null;

const viewUsername = $('#view-username') as HTMLElement | null;
const viewEmail = $('#view-email') as HTMLElement | null;

const inUsername = $('#edit-username') as HTMLInputElement | null;
const inEmail = $('#edit-email') as HTMLInputElement | null;
const inOldPass = $('#edit-oldpass') as HTMLInputElement | null;
const inNewPass = $('#edit-newpass') as HTMLInputElement | null;
const inConfirmPass = $('#edit-confpass') as HTMLInputElement | null;

const DUMMY_OLD_PASS = 'OldPass123';
let editing = true;

function toggleEdit(on: boolean) {
    editing = on;
    document
        .querySelectorAll<HTMLElement>('.edit-input')
        .forEach((el) => el.classList.toggle('hidden', !on));
    document
        .querySelectorAll<HTMLElement>("#profile-fields span[id^='view-']")
        .forEach((el) => el.classList.toggle('hidden', on));
    actions?.classList.toggle('hidden', !on);
    editBtn?.classList.toggle('hidden', on);
}
function showToast() {
    const t = $('#profile-toast') as HTMLElement;
    t.style.opacity = '1';
    setTimeout(() => (t.style.opacity = '0'), 2000);
}
function showError(msg: string) {
    const infoPanel =
        document.querySelector<HTMLElement>('#tab-panels .panel[data-panel="info"]') ??
        document.body;
    let box = infoPanel.querySelector<HTMLElement>('#info-error');
    if (!box) {
        box = document.createElement('div');
        box.id = 'info-error';
        box.className =
            'mb-4 rounded bg-red-600/90 px-3 py-2 text-sm text-white shadow animate__animated';
        infoPanel.prepend(box);
    }
    box.textContent = msg;
    box.classList.remove('animate__fadeOut');
    box.classList.add('animate__fadeIn');
    setTimeout(() => {
        box!.classList.replace('animate__fadeIn', 'animate__fadeOut');
    }, 2500);
}

editBtn?.addEventListener('click', () => toggleEdit(true));

cancelBtn?.addEventListener('click', () => {
    if (viewUsername && inUsername) inUsername.value = viewUsername.textContent ?? '';
    if (viewEmail && inEmail) inEmail.value = viewEmail.textContent ?? '';
    [inOldPass, inNewPass, inConfirmPass].forEach((i) => i && (i.value = ''));
    toggleEdit(false);
});

saveBtn?.addEventListener('click', async () => {
    if (!inUsername || !inEmail) return;

    const u = inUsername.value.trim();
    const e = inEmail.value.trim();
    if (!u) {
        showError('Username cannot be empty.');
        return;
    }

    const eErr = validateEmail(e);
    if (eErr) {
        showError(eErr);
        return;
    }

    const oldP = inOldPass?.value ?? '';
    const newP = inNewPass?.value ?? '';
    const conP = inConfirmPass?.value ?? '';

    if (oldP || newP || conP) {
        if (!oldP || !newP || !conP) {
            showError('Please fill current, new, and confirm password.');
            return;
        }
        const pErr = validatePassword(newP);
        if (pErr) {
            showError(pErr);
            return;
        }
        if (newP !== conP) {
            showError('New and confirm password do not match.');
            return;
        }
    }

    try {
        const payload: Record<string, string> = {};
        if (u !== (viewUsername?.textContent ?? '')) payload.username = u;
        if (e !== (viewEmail?.textContent ?? '')) payload.email = e;
        if (newP) {
            payload.newPassword = newP;
            payload.oldPassword = oldP;
        }

        if (Object.keys(payload).length) {
            const res = await fetch(`/api/users/edit-profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader(),
                },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) {
                showError(data.error || 'Update failed');
                return;
            }
        } else {
            showError('Nothing changed');
            return;
        }
    } catch {
        showError('Network error – please try again');
        return;
    }

    localStorage.setItem(
        'user',
        JSON.stringify({
            ...JSON.parse(localStorage.getItem('user') ?? '{}'),
            username: u,
            email: e,
        })
    );
    if (viewUsername) viewUsername.textContent = u;
    if (viewEmail) viewEmail.textContent = e;

    [inOldPass, inNewPass, inConfirmPass].forEach((i) => i && (i.value = ''));

    toggleEdit(false);
    showToast();
    refreshProfileHeader();
});

(async () => {
    if (await (window as any).isValidToken?.()) {
        populateProfileViews();
        refreshProfileHeader();
    }
})();
