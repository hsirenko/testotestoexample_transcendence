//frontend/src/auth.ts
import './friends.js';
import { loadFriendsSidebar } from './friends.js';
import './history.js';
import { render, resetObjects, resizeCanvas, updateScore } from './main.js';
import { initNotifications, stopNotifications } from './notifications.js';
import './stats.js';
import { API_BASE } from './config.js';

const overlay = document.getElementById('login-overlay') as HTMLElement;
const appShell = document.getElementById('app') as HTMLElement;
const form = document.getElementById('login-form') as HTMLFormElement;
const loginError = document.getElementById('login-error') as HTMLElement;

const signupOverlay = document.getElementById('signup-overlay') as HTMLElement;
const signupForm = document.getElementById('signup-form') as HTMLFormElement;
const signupError = document.getElementById('signup-error') as HTMLElement;

let resetMode = false;
let resetEmail = '';
let resetCode = '';

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel);

const GOOGLE_LOGIN_URL = `/auth/google`;

// Token validation function
async function isValidToken(): Promise<boolean> {
    const token = localStorage.getItem('token');
    if (!token) return false;

    try {
        const response = await fetch(`${API_BASE}/users/me`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
            localStorage.removeItem('token');
            return false;
        }
        return true;
    } catch {
        localStorage.removeItem('token');
        return false;
    }
}

// Make it globally available
(window as any).isValidToken = isValidToken;

const originalSubmit = form.querySelector(
    "button[type='submit'],input[type='submit']"
) as HTMLElement | null;

(async () => {
    const params = new URLSearchParams(window.location.search);
    const googleToken = params.get('token');
    const twofaPending = params.get('twofaPending') === 'true';
    const twofaInput = document.getElementById('twofa-token') as HTMLInputElement;

    if (!googleToken) return;

    if (twofaPending) {
        const twofaWrapper = document.getElementById('twofa-wrapper') as HTMLElement;
        twofaWrapper.classList.remove('hidden');
        twofaInput.focus();
        loginError.textContent = 'Enter your 2FA code and press Login.';

        const emailEl = document.getElementById('email') as HTMLInputElement;
        const passwordEl = document.getElementById('password') as HTMLInputElement;

        emailEl.classList.add('hidden');
        passwordEl.classList.add('hidden');
        emailEl.removeAttribute('required');
        passwordEl.removeAttribute('required');

        localStorage.setItem('pending_google_token', googleToken);

        window.history.replaceState({}, '', window.location.pathname);
        return;
    }

    localStorage.setItem('token', googleToken);
    try {
        const res = await fetch(`${API_BASE}/users/me`, {
            headers: { Authorization: `Bearer ${googleToken}` },
        });
        const user = await res.json();
        localStorage.setItem('user', JSON.stringify(user));
    } catch {
        loginError.textContent = 'Failed to fetch user data.';
        return;
    }

    window.history.replaceState({}, '', window.location.pathname);
    hideLogin();
    resetObjects();
    resizeCanvas();
    render();
    updateScore();
    loadFriendsSidebar();
    initNotifications();
})();

//new part related to the reset password form, code validation and password change
const resetOverlay = document.getElementById('reset-overlay') as HTMLElement;
const resetForm = document.getElementById('reset-form') as HTMLFormElement;
const resetError = document.getElementById('reset-error') as HTMLElement;

const codeOverlay = document.getElementById('code-overlay') as HTMLElement;
const codeForm = document.getElementById('code-form') as HTMLFormElement;
const codeError = document.getElementById('code-error') as HTMLElement;

const newpassOverlay = document.getElementById('newpass-overlay') as HTMLElement;
const newpassForm = document.getElementById('newpass-form') as HTMLFormElement;
const newpassError = document.getElementById('newpass-error') as HTMLElement;

//on clicking the forget password button remove the old layer and show the new one
document.getElementById('forgot-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    overlay.classList.add('hidden');
    resetOverlay.classList.remove('hidden');
});

//hide the reset overlay and show the login again
document.getElementById('reset-show-login')?.addEventListener('click', (e) => {
    e.preventDefault();
    resetOverlay.classList.add('hidden');
    overlay.classList.remove('hidden');
});

//forget password functionality, validate the email that's already registered, if true sned
//the code and continue
resetForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    resetError.textContent = '';

    const email = (document.getElementById('reset-email') as HTMLInputElement).value.trim();
    const emErr = validateEmail(email);
    //validate that the email is already registered to prevent sending emails to unregistered emails
    try {
        const checkRes = await fetch(`/auth/email-exists`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });

        const { exists } = await checkRes.json();
        if (!exists) {
            //  404 or { exists:false }
            resetError.textContent = 'This e-mail is not registered.';
            return; //  stop right here
        }
    } catch (_) {
        resetError.textContent = 'Network error — try again.';
        return;
    }

    if (!email) {
        resetError.textContent = 'Email is required.';
        return;
    }
    if (emErr) {
        resetError.textContent = emErr;
        return;
    }

    resetOverlay.classList.add('hidden');
    codeOverlay.classList.remove('hidden');
    try {
        const res = await fetch(`/password/forgot`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });
        //send the code and decode it from json to get the value
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to send code.');

        resetEmail = email;
        (document.getElementById('reset-code') as HTMLInputElement).focus();
    } catch (err: any) {
        resetError.textContent = err.message || 'Network error — try again.';
    }
});

/* 2️⃣  Verify the six-digit code ------------------------------------------ */
codeForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    codeError.textContent = '';

    const code = (document.getElementById('reset-code') as HTMLInputElement).value.trim();
    if (!/^\d{6}$/.test(code)) {
        codeError.textContent = 'Code must be 6 digits.';
        return;
    }

    try {
        const res = await fetch(`/password/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: resetEmail, code }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Invalid or expired code.');

        resetCode = code;
        codeOverlay.classList.add('hidden');
        newpassOverlay.classList.remove('hidden');
        (document.getElementById('new-pass') as HTMLInputElement).focus();
    } catch (err: any) {
        codeError.textContent = err.message || 'Network error — try again.';
    }
});

/* 3️⃣  Change the password ------------------------------------------------- */
newpassForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    newpassError.textContent = '';

    const pass1 = (document.getElementById('new-pass') as HTMLInputElement).value;
    const pass2 = (document.getElementById('new-pass-confirm') as HTMLInputElement).value;

    const pwErr = validatePassword(pass1);
    if (pwErr) {
        newpassError.textContent = pwErr;
        return;
    }
    if (pass1 !== pass2) {
        newpassError.textContent = 'Passwords do not match.';
        return;
    }

    try {
        const res = await fetch(`/password/reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: resetEmail, code: resetCode, newPassword: pass1 }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Password change failed.');

        alert('Password changed! Please sign in.');
        newpassOverlay.classList.add('hidden');
        overlay.classList.remove('hidden');
    } catch (err: any) {
        newpassError.textContent = err.message || 'Network error — try again.';
    }
});

//here it ends

document.getElementById('reset-show-signup')?.addEventListener('click', (e) => {
    e.preventDefault();
    resetOverlay.classList.add('hidden');
    showSignup();
});

document.getElementById('reset-google-btn')?.addEventListener('click', () => {
    window.location.href = GOOGLE_LOGIN_URL;
});

function animateIn(el: HTMLElement, cls: string) {
    el.classList.add('animate__animated', cls);
    el.addEventListener('animationend', () => el.classList.remove('animate__animated', cls), {
        once: true,
    });
}

function showLogin() {
    overlay.classList.remove('hidden');
    appShell.classList.add('hidden');
    document.body.style.overflow = 'hidden';
    animateIn(overlay, 'animate__fadeIn');
}
function hideLogin() {
    overlay.classList.add('hidden');
    appShell.classList.remove('hidden');
    document.body.style.overflow = '';
}
function showSignup() {
    signupOverlay.classList.remove('hidden');
    overlay.classList.add('hidden');
    animateIn(signupOverlay, 'animate__fadeIn');
}
function hideSignup() {
    signupOverlay.classList.add('hidden');
    overlay.classList.remove('hidden');
}
function isAuthed(): boolean {
    return !!localStorage.getItem('user');
}

function validateEmail(email: string): string | null {
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    return ok ? null : 'Please enter a valid email address.';
}
function validatePassword(pw: string): string | null {
    if (pw.length < 8) return 'Password must be at least 8 characters.';
    if (!/[A-Z]/.test(pw)) return 'Password needs at least one capital letter.';
    if (!/[a-z]/.test(pw)) return 'Password needs at least one lowercase letter.';
    if (!/\d/.test(pw)) return 'Password needs at least one number.';
    if (!/[^\w\s]/.test(pw)) return 'Password needs at least one symbol.';
    return null;
}

isAuthed() ? hideLogin() : showLogin();

form.addEventListener('submit', async (e) => {
    if (resetMode) {
        e.preventDefault();
        return;
    }
    e.preventDefault();
    loginError.textContent = '';

    const email = (document.getElementById('email') as HTMLInputElement).value.trim().toLowerCase();
    const password = (document.getElementById('password') as HTMLInputElement).value;
    const twofaInput = document.getElementById('twofa-token') as HTMLInputElement;
    const twofaWrapper = document.getElementById('twofa-wrapper') as HTMLElement;
    const twofaToken = twofaInput.value.trim();
    const pendingGoogleToken = localStorage.getItem('pending_google_token');

    if (pendingGoogleToken) {
        if (!twofaToken) {
            loginError.textContent = '2FA code is required.';
            return;
        }

        try {
            const res = await fetch(`/api/2fa/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${pendingGoogleToken}`,
                },
                body: JSON.stringify({ token: twofaToken }),
            });

            const result = await res.json();

            if (!res.ok) {
                loginError.textContent = result.error || '2FA verification failed.';
                return;
            }

            const userRes = await fetch(`${API_BASE}/users/me`, {
                headers: { Authorization: `Bearer ${pendingGoogleToken}` },
            });
            const user = await userRes.json();

            localStorage.setItem('token', pendingGoogleToken);
            localStorage.setItem('user', JSON.stringify(user));
            localStorage.removeItem('pending_google_token');

            const emailEl = document.getElementById('email') as HTMLInputElement;
            const passwordEl = document.getElementById('password') as HTMLInputElement;

            emailEl.classList.remove('hidden');
            passwordEl.classList.remove('hidden');

            emailEl.setAttribute('required', 'true');
            passwordEl.setAttribute('required', 'true');
            twofaWrapper.classList.add('hidden');
            twofaInput.value = '';

            hideLogin();
            resetObjects();
            resizeCanvas();
            render();
            updateScore();
            loadFriendsSidebar();
            initNotifications();
            return;
        } catch {
            loginError.textContent = 'Network error during Google 2FA login.';
            return;
        }
    }

    const pwErr = validatePassword(password);
    if (!email) {
        loginError.textContent = 'Email is required.';
        return;
    } else if (pwErr) {
        loginError.textContent = pwErr;
        return;
    }

    const loginUrl = location.port === '5500' ? 'http://localhost:3000/login' : '/login';
    const res = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (data.twofaRequired) {
        if (twofaWrapper.classList.contains('hidden')) {
            twofaWrapper.classList.remove('hidden');
            twofaInput.focus();
            loginError.textContent = 'Enter your 2FA code and press Login.';
            return;
        }

        if (!twofaToken) {
            loginError.textContent = '2FA code required.';
            return;
        }

        const retry = await fetch(loginUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, twofaToken }),
        });

        const result = await retry.json();
        if (!retry.ok) {
            loginError.textContent = result.error || '2FA validation failed.';
            return;
        }

        data.token = result.token;
        data.user = result.user;
    }

    if (!res.ok && !data.twofaRequired) {
        loginError.textContent = data.error || 'Login failed.';
        return;
    }

    localStorage.setItem('token', data.token);
    let fullUser = data.user;
    try {
        const resMe = await fetch(`${API_BASE}/users/me`, {
            headers: { Authorization: `Bearer ${data.token}` },
        });
        if (resMe.ok) {
            const me = await resMe.json();
            fullUser = { ...fullUser, avatar_url: me.avatar_url };
        }
    } catch {}
    localStorage.setItem('user', JSON.stringify(data.user));
    twofaWrapper.classList.add('hidden');
    twofaInput.value = '';

    hideLogin();
    resetObjects();
    resizeCanvas();
    render();
    updateScore();
    loadFriendsSidebar();
    initNotifications();
});

document.getElementById('show-signup')?.addEventListener('click', (e) => {
    e.preventDefault();
    showSignup();
});
document.getElementById('show-login')?.addEventListener('click', (e) => {
    e.preventDefault();
    hideSignup();
});

//Google OAuth
$('#google-login-btn')?.addEventListener('click', () => {
    window.location.href = GOOGLE_LOGIN_URL;
});
$('#google-signup-btn')?.addEventListener('click', () => {
    window.location.href = GOOGLE_LOGIN_URL;
});

signupForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    signupError.textContent = '';

    const un = (document.getElementById('su-username') as HTMLInputElement).value.trim();
    const em = (document.getElementById('su-email') as HTMLInputElement).value.trim();
    const pw = (document.getElementById('su-password') as HTMLInputElement).value;
    const pw2 = (document.getElementById('su-password2') as HTMLInputElement).value;

    const emErr = validateEmail(em);
    const pwErr = validatePassword(pw);

    if (!un) signupError.textContent = 'Username is required.';
    else if (emErr) signupError.textContent = emErr;
    else if (pwErr) signupError.textContent = pwErr;
    else if (pw !== pw2) signupError.textContent = 'Passwords don’t match.';
    else {
        fetch(`/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: un, email: em, password: pw }),
        })
            .then(async (res) => {
                const data = await res.json();
                if (!res.ok) {
                    signupError.textContent = data.error || 'Signup failed.';
                } else {
                    hideSignup();
                    loginError.textContent = 'Account created! Please sign in.';
                }
            })
            .catch(() => {
                signupError.textContent = 'Network error. Please try again.';
            });
    }
});

document.getElementById('nav-signout')?.addEventListener('click', () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    stopNotifications();
    showLogin();
});
