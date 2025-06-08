var _a, _b, _c, _d, _e, _f;
import { resetObjects, resizeCanvas, render, updateScore } from "./main.js";
const overlay = document.getElementById("login-overlay");
const appShell = document.getElementById("app");
const form = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const signupOverlay = document.getElementById("signup-overlay");
const signupForm = document.getElementById("signup-form");
const signupError = document.getElementById("signup-error");
let resetMode = false;
const $ = (sel) => document.querySelector(sel);
const GOOGLE_LOGIN_URL = 'http://localhost:3000/auth/google';
const originalSubmit = form.querySelector("button[type='submit'],input[type='submit']");
const sendCodeBtn = document.createElement("button");
sendCodeBtn.id = "send-code-btn";
sendCodeBtn.type = "button";
sendCodeBtn.textContent = "Send code";
sendCodeBtn.className =
    (originalSubmit ? originalSubmit.className : "btn") + " hidden";
if (originalSubmit) {
    originalSubmit.insertAdjacentElement("afterend", sendCodeBtn);
}
else {
    form.appendChild(sendCodeBtn);
}
const backToLoginLink = document.createElement("a");
backToLoginLink.id = "back-to-login";
backToLoginLink.href = "#";
backToLoginLink.textContent = "Already have an account? Sign in";
backToLoginLink.className = "hidden";
sendCodeBtn.insertAdjacentElement("afterend", backToLoginLink);
// On page load, check for ?token=… in the URL
(async () => {
    const params = new URLSearchParams(window.location.search);
    const googleToken = params.get('token');
    const twofaPending = params.get('twofaPending') === 'true';
    const twofaInput = document.getElementById("twofa-token");
    if (!googleToken)
        return;
    if (twofaPending) {
        twofaInput.classList.remove("hidden");
        twofaInput.focus();
        loginError.textContent = "Enter your 2FA code and press Login.";
        // 🚫 Hide email and password fields
        const emailEl = document.getElementById("email");
        const passwordEl = document.getElementById("password");
        emailEl.classList.add("hidden");
        passwordEl.classList.add("hidden");
        emailEl.removeAttribute("required");
        passwordEl.removeAttribute("required");
        // 💾 Save Google token
        localStorage.setItem("pending_google_token", googleToken);
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname);
        return;
    }
    // No 2FA required
    localStorage.setItem('token', googleToken);
    try {
        const res = await fetch('http://localhost:3000/api/users/me', {
            headers: { 'Authorization': `Bearer ${googleToken}` }
        });
        const user = await res.json();
        localStorage.setItem('user', JSON.stringify(user));
    }
    catch (_a) {
        loginError.textContent = "Failed to fetch user data.";
        return;
    }
    window.history.replaceState({}, '', window.location.pathname);
    hideLogin();
    resetObjects();
    resizeCanvas();
    render();
    updateScore();
})();
// function show2FALoginModal(): Promise<string | null> {
//   return new Promise((resolve) => {
//     const modal = document.getElementById("2fa-login-modal")!;
//     const input = document.getElementById("2fa-login-token-input") as HTMLInputElement;
//     const confirm = document.getElementById("2fa-login-confirm-btn")!;
//     const cancel = document.getElementById("2fa-login-cancel-btn")!;
//     const errorEl = document.getElementById("2fa-login-error")!;
//     modal.classList.remove("hidden");
//     modal.style.display = "flex";     // ← force it to flex
//     modal.style.zIndex = "9999";      // just in case
//     modal.style.opacity = "1";        // in case Tailwind transitions affect it
//     modal.style.visibility = "visible";
//     modal.classList.remove("hidden");
//     input.value = "";
//     errorEl.textContent = "";
//     confirm.onclick = () => {
//       const code = input.value.trim();
//       if (!code) {
//         errorEl.textContent = "2FA code is required.";
//         return;
//       }
//       modal.classList.add("hidden");
//       resolve(code);
//     };
//     cancel.onclick = () => {
//       modal.classList.add("hidden");
//       resolve(null);
//     };
//   });
// }
function animateIn(el, cls) {
    el.classList.add("animate__animated", cls);
    el.addEventListener("animationend", () => el.classList.remove("animate__animated", cls), { once: true });
}
function showLogin() {
    overlay.classList.remove("hidden");
    appShell.classList.add("hidden");
    document.body.style.overflow = "hidden";
    animateIn(overlay, "animate__fadeIn");
}
function hideLogin() {
    overlay.classList.add("hidden");
    appShell.classList.remove("hidden");
    document.body.style.overflow = "";
}
function showSignup() {
    signupOverlay.classList.remove("hidden");
    overlay.classList.add("hidden");
    animateIn(signupOverlay, "animate__fadeIn");
}
function hideSignup() {
    signupOverlay.classList.add("hidden");
    overlay.classList.remove("hidden");
}
function isAuthed() {
    return !!localStorage.getItem("user");
}
function validateEmail(email) {
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    return ok ? null : "Please enter a valid email address.";
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
isAuthed() ? hideLogin() : showLogin();
form.addEventListener("submit", async (e) => {
    if (resetMode) {
        e.preventDefault();
        return;
    }
    e.preventDefault();
    loginError.textContent = "";
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const twofaInput = document.getElementById("twofa-token");
    const twofaToken = twofaInput.value.trim();
    const pendingGoogleToken = localStorage.getItem("pending_google_token");
    // ✅ HANDLE GOOGLE 2FA CASE FIRST
    if (pendingGoogleToken) {
        if (!twofaToken) {
            loginError.textContent = "2FA code is required.";
            return;
        }
        // Send token only to /api/2fa/verify
        try {
            const res = await fetch("http://localhost:3000/api/2fa/verify", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${pendingGoogleToken}`,
                },
                body: JSON.stringify({ token: twofaToken }),
            });
            const result = await res.json();
            if (!res.ok) {
                loginError.textContent = result.error || "2FA verification failed.";
                return;
            }
            // ✅ Verified: fetch user and continue
            const userRes = await fetch('http://localhost:3000/api/users/me', {
                headers: { 'Authorization': `Bearer ${pendingGoogleToken}` },
            });
            const user = await userRes.json();
            localStorage.setItem('token', pendingGoogleToken);
            localStorage.setItem('user', JSON.stringify(user));
            localStorage.removeItem("pending_google_token");
            const emailEl = document.getElementById("email");
            const passwordEl = document.getElementById("password");
            emailEl.classList.remove("hidden");
            passwordEl.classList.remove("hidden");
            emailEl.setAttribute("required", "true");
            passwordEl.setAttribute("required", "true");
            twofaInput.classList.add("hidden");
            twofaInput.value = "";
            hideLogin();
            resetObjects();
            resizeCanvas();
            render();
            updateScore();
            return;
        }
        catch (_a) {
            loginError.textContent = "Network error during Google 2FA login.";
            return;
        }
    }
    // ✅ NORMAL EMAIL/PASSWORD FLOW
    const pwErr = validatePassword(password);
    if (!email) {
        loginError.textContent = "Email is required.";
        return;
    }
    else if (pwErr) {
        loginError.textContent = pwErr;
        return;
    }
    const res = await fetch("http://localhost:3000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (data.twofaRequired) {
        if (twofaInput.classList.contains("hidden")) {
            twofaInput.classList.remove("hidden");
            twofaInput.focus();
            loginError.textContent = "Enter your 2FA code and press Login.";
            return;
        }
        if (!twofaToken) {
            loginError.textContent = "2FA code required.";
            return;
        }
        const retry = await fetch("http://localhost:3000/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, twofaToken }),
        });
        const result = await retry.json();
        if (!retry.ok) {
            loginError.textContent = result.error || "2FA validation failed.";
            return;
        }
        data.token = result.token;
        data.user = result.user;
    }
    if (!res.ok && !data.twofaRequired) {
        loginError.textContent = data.error || "Login failed.";
        return;
    }
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    twofaInput.classList.add("hidden");
    twofaInput.value = "";
    hideLogin();
    resetObjects();
    resizeCanvas();
    render();
    updateScore();
});
function enterResetMode() {
    var _a, _b, _c;
    resetMode = true;
    loginError.textContent = "";
    (_a = document.getElementById("password")) === null || _a === void 0 ? void 0 : _a.classList.add("hidden");
    originalSubmit === null || originalSubmit === void 0 ? void 0 : originalSubmit.classList.add("hidden");
    (_b = document.getElementById("forgot-btn")) === null || _b === void 0 ? void 0 : _b.classList.add("hidden");
    (_c = document.getElementById("show-signup")) === null || _c === void 0 ? void 0 : _c.classList.add("hidden");
    sendCodeBtn.classList.remove("hidden");
    backToLoginLink.classList.remove("hidden");
}
function exitResetMode() {
    var _a, _b, _c;
    resetMode = false;
    (_a = document.getElementById("password")) === null || _a === void 0 ? void 0 : _a.classList.remove("hidden");
    originalSubmit === null || originalSubmit === void 0 ? void 0 : originalSubmit.classList.remove("hidden");
    (_b = document.getElementById("forgot-btn")) === null || _b === void 0 ? void 0 : _b.classList.remove("hidden");
    (_c = document.getElementById("show-signup")) === null || _c === void 0 ? void 0 : _c.classList.remove("hidden");
    sendCodeBtn.classList.add("hidden");
    backToLoginLink.classList.add("hidden");
}
(_a = document.getElementById("forgot-btn")) === null || _a === void 0 ? void 0 : _a.addEventListener("click", (e) => {
    e.preventDefault();
    enterResetMode();
});
backToLoginLink.addEventListener("click", (e) => {
    e.preventDefault();
    exitResetMode();
});
sendCodeBtn.addEventListener("click", () => {
    loginError.textContent = "";
    const email = document.getElementById("email").value.trim();
    const emErr = validateEmail(email);
    if (!email)
        loginError.textContent = "Email is required.";
    else if (emErr)
        loginError.textContent = emErr;
    else {
        loginError.textContent =
            "If the address is registered, a reset code has been sent.";
        exitResetMode();
    }
});
(_b = document.getElementById("show-signup")) === null || _b === void 0 ? void 0 : _b.addEventListener("click", (e) => {
    e.preventDefault();
    showSignup();
});
(_c = document.getElementById("show-login")) === null || _c === void 0 ? void 0 : _c.addEventListener("click", (e) => {
    e.preventDefault();
    hideSignup();
});
//Google OAuth
(_d = $('#google-login-btn')) === null || _d === void 0 ? void 0 : _d.addEventListener('click', () => {
    window.location.href = GOOGLE_LOGIN_URL;
});
(_e = $('#google-signup-btn')) === null || _e === void 0 ? void 0 : _e.addEventListener('click', () => {
    window.location.href = GOOGLE_LOGIN_URL;
});
signupForm === null || signupForm === void 0 ? void 0 : signupForm.addEventListener("submit", (e) => {
    e.preventDefault();
    signupError.textContent = "";
    const un = document.getElementById("su-username").value.trim();
    const em = document.getElementById("su-email").value.trim();
    const pw = document.getElementById("su-password").value;
    const pw2 = document.getElementById("su-password2")
        .value;
    const emErr = validateEmail(em);
    const pwErr = validatePassword(pw);
    if (!un)
        signupError.textContent = "Username is required.";
    else if (emErr)
        signupError.textContent = emErr;
    else if (pwErr)
        signupError.textContent = pwErr;
    else if (pw !== pw2)
        signupError.textContent = "Passwords don’t match.";
    else {
        fetch("http://localhost:3000/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: un, email: em, password: pw }),
        })
            .then(async (res) => {
            const data = await res.json();
            if (!res.ok) {
                signupError.textContent = data.error || "Signup failed.";
            }
            else {
                hideSignup();
                loginError.textContent = "Account created! Please sign in.";
            }
        })
            .catch(() => {
            signupError.textContent = "Network error. Please try again.";
        });
    }
});
(_f = document.getElementById("nav-signout")) === null || _f === void 0 ? void 0 : _f.addEventListener("click", () => {
    localStorage.removeItem("user");
    localStorage.removeItem('token');
    showLogin();
});
