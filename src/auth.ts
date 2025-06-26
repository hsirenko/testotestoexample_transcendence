//frontend/src/auth.ts
//CHANGE THIS TO YOUR IP ADDRESS
import { HOST } from "./config.js";
import { resetObjects, resizeCanvas, render, updateScore } from "./main.js";
import { loadFriendsSidebar } from "./friends.js";
import "./friends.js"; // this file already auto-fetches & renders the sidebar
import "./stats.js"; // likewise for stats tab if you want to warm it up
import "./history.js";
import { initNotifications } from "./notifications.js";
import { stopNotifications } from "./notifications.js";

const overlay = document.getElementById("login-overlay") as HTMLElement;
const appShell = document.getElementById("app") as HTMLElement;
const form = document.getElementById("login-form") as HTMLFormElement;
const loginError = document.getElementById("login-error") as HTMLElement;

const signupOverlay = document.getElementById("signup-overlay") as HTMLElement;
const signupForm = document.getElementById("signup-form") as HTMLFormElement;
const signupError = document.getElementById("signup-error") as HTMLElement;

let resetMode = false;

const $ = <T extends HTMLElement = HTMLElement>(sel: string) =>
    document.querySelector<T>(sel);

const GOOGLE_LOGIN_URL = `https://${HOST}:8443/auth/google`;

const originalSubmit = form.querySelector(
    "button[type='submit'],input[type='submit']"
) as HTMLElement | null;

// const sendCodeBtn = document.createElement("button");
// sendCodeBtn.id = "send-code-btn";
// sendCodeBtn.type = "button";
// sendCodeBtn.textContent = "Send code";
// sendCodeBtn.className =
//     (originalSubmit ? originalSubmit.className : "btn") + " hidden";
// if (originalSubmit) {
//     originalSubmit.insertAdjacentElement("afterend", sendCodeBtn);
// } else {
//     form.appendChild(sendCodeBtn);
// }

// const backToLoginLink = document.createElement("a");
// backToLoginLink.id = "back-to-login";
// backToLoginLink.href = "#";
// backToLoginLink.textContent = "Already have an account? Sign in";
// backToLoginLink.className = "hidden";
// sendCodeBtn.insertAdjacentElement("afterend", backToLoginLink);

// On page load, check for ?token=… in the URL
(async () => {
    const params = new URLSearchParams(window.location.search);
    const googleToken = params.get("token");
    const twofaPending = params.get("twofaPending") === "true";
    const twofaInput = document.getElementById(
        "twofa-token"
    ) as HTMLInputElement;

    if (!googleToken) return;

    if (twofaPending) {
        twofaInput.classList.remove("hidden");
        twofaInput.focus();
        loginError.textContent = "Enter your 2FA code and press Login.";

        // 🚫 Hide email and password fields
        const emailEl = document.getElementById("email") as HTMLInputElement;
        const passwordEl = document.getElementById(
            "password"
        ) as HTMLInputElement;

        emailEl.classList.add("hidden");
        passwordEl.classList.add("hidden");
        emailEl.removeAttribute("required");
        passwordEl.removeAttribute("required");

        // 💾 Save Google token
        localStorage.setItem("pending_google_token", googleToken);

        // Clean up URL
        window.history.replaceState({}, "", window.location.pathname);
        return;
    }

    // No 2FA required
    localStorage.setItem("token", googleToken);
    try {
        const res = await fetch(`https://${HOST}:8443/api/users/me`, {
            headers: { Authorization: `Bearer ${googleToken}` },
        });
        const user = await res.json();
        localStorage.setItem("user", JSON.stringify(user));
    } catch {
        loginError.textContent = "Failed to fetch user data.";
        return;
    }

    window.history.replaceState({}, "", window.location.pathname);
    hideLogin();
    resetObjects();
    resizeCanvas();
    render();
    updateScore();
    loadFriendsSidebar();
	initNotifications();
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


//new part related to the reset password form, code validation and password change
const resetOverlay = document.getElementById("reset-overlay") as HTMLElement;
const resetForm     = document.getElementById("reset-form")   as HTMLFormElement;
const resetError    = document.getElementById("reset-error")  as HTMLElement;

const codeOverlay     = document.getElementById("code-overlay")      as HTMLElement;
const codeForm        = document.getElementById("code-form")         as HTMLFormElement;
const codeError       = document.getElementById("code-error")        as HTMLElement;

const newpassOverlay  = document.getElementById("newpass-overlay")   as HTMLElement;
const newpassForm     = document.getElementById("newpass-form")      as HTMLFormElement;
const newpassError    = document.getElementById("newpass-error")     as HTMLElement;


document.getElementById("forgot-btn")?.addEventListener("click", (e) => {
    e.preventDefault();
    overlay.classList.add("hidden");
    resetOverlay.classList.remove("hidden");
});

document.getElementById("reset-show-login")?.addEventListener("click", (e) => {
    e.preventDefault();
    resetOverlay.classList.add("hidden");
    overlay.classList.remove("hidden");
});

resetForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    resetError.textContent = "";

    const email = (document.getElementById("reset-email") as HTMLInputElement).value.trim();
    const emErr = validateEmail(email);

    if (!email)          resetError.textContent = "Email is required.";
    else if (emErr)      resetError.textContent = emErr;
    else {
        // No backend change – we just give user feedback
        resetError.textContent = "If the address is registered, a reset code has been sent.";
        alert("Code sent");
        resetOverlay.classList.add("hidden");
        codeOverlay.classList.remove("hidden");
    }
    

});

codeForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    codeError.textContent = "";

    const codeInput = (document.getElementById("reset-code") as HTMLInputElement).value.trim();

    if (!/^\d{6}$/.test(codeInput)) {
        codeError.textContent = "Code must be 6 digits.";
        return;
    }

    // here you should implement the backend of verification

    codeOverlay.classList.add("hidden");
    newpassOverlay.classList.remove("hidden");
});


newpassForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    newpassError.textContent = "";

    const pass1 = (document.getElementById("new-pass") as HTMLInputElement).value;
    const pass2 = (document.getElementById("new-pass-confirm") as HTMLInputElement).value;

    const pwdErr = validatePassword(pass1);   // same helper used in sign-up

    if (pwdErr)               { newpassError.textContent = pwdErr; return; }
    if (pass1 !== pass2)      { newpassError.textContent = "Passwords do not match."; return; }

    // here you should implement the backend password change logic

    alert("Password changed without backend");
    newpassOverlay.classList.add("hidden");
    overlay.classList.remove("hidden");       // back to normal sign-in
});



//here it ends

document.getElementById("reset-show-signup")?.addEventListener("click", (e) => {
    e.preventDefault();
    resetOverlay.classList.add("hidden");
    showSignup();                           // existing helper
});

document.getElementById("reset-google-btn")?.addEventListener("click", () => {
    window.location.href = GOOGLE_LOGIN_URL;
});


function animateIn(el: HTMLElement, cls: string) {
    el.classList.add("animate__animated", cls);
    el.addEventListener(
        "animationend",
        () => el.classList.remove("animate__animated", cls),
        { once: true }
    );
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
function isAuthed(): boolean {
    return !!localStorage.getItem("user");
}

function validateEmail(email: string): string | null {
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    return ok ? null : "Please enter a valid email address.";
}
function validatePassword(pw: string): string | null {
    if (pw.length < 8) return "Password must be at least 8 characters.";
    if (!/[A-Z]/.test(pw)) return "Password needs at least one capital letter.";
    if (!/\d/.test(pw)) return "Password needs at least one number.";
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

    const email = (
        document.getElementById("email") as HTMLInputElement
    ).value.trim();
    const password = (document.getElementById("password") as HTMLInputElement)
        .value;
    const twofaInput = document.getElementById(
        "twofa-token"
    ) as HTMLInputElement;
    const twofaWrapper = document.getElementById(
        "twofa-wrapper"
    ) as HTMLElement;
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
            const res = await fetch(`https://${HOST}:8443/api/2fa/verify`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${pendingGoogleToken}`,
                },
                body: JSON.stringify({ token: twofaToken }),
            });

            const result = await res.json();

            if (!res.ok) {
                loginError.textContent =
                    result.error || "2FA verification failed.";
                return;
            }

            // ✅ Verified: fetch user and continue
            const userRes = await fetch(`https://${HOST}:8443/api/users/me`, {
                headers: { Authorization: `Bearer ${pendingGoogleToken}` },
            });
            const user = await userRes.json();

            localStorage.setItem("token", pendingGoogleToken);
            localStorage.setItem("user", JSON.stringify(user));
            localStorage.removeItem("pending_google_token");

            const emailEl = document.getElementById(
                "email"
            ) as HTMLInputElement;
            const passwordEl = document.getElementById(
                "password"
            ) as HTMLInputElement;

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
            loadFriendsSidebar();
			initNotifications();
            return;
        } catch {
            loginError.textContent = "Network error during Google 2FA login.";
            return;
        }
    }

    // ✅ NORMAL EMAIL/PASSWORD FLOW
    const pwErr = validatePassword(password);
    if (!email) {
        loginError.textContent = "Email is required.";
        return;
    } else if (pwErr) {
        loginError.textContent = pwErr;
        return;
    }

    const res = await fetch(`https://${HOST}:8443/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (data.twofaRequired) {
        if (twofaWrapper.classList.contains("hidden")) {
            // ← CHANGE
            twofaWrapper.classList.remove("hidden");
            twofaInput.focus();
            loginError.textContent = "Enter your 2FA code and press Login.";
            return;
        }

        if (!twofaToken) {
            loginError.textContent = "2FA code required.";
            return;
        }

        const retry = await fetch(`https://${HOST}:8443/login`, {
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
    twofaWrapper.classList.add("hidden");
    twofaInput.value = "";

    hideLogin();
    resetObjects();
    resizeCanvas();
    render();
    updateScore();
    loadFriendsSidebar();
	initNotifications();
});

// function enterResetMode() {
//     resetMode = true;
//     loginError.textContent = "";
//     (document.getElementById("password") as HTMLElement)?.classList.add(
//         "hidden"
//     );
//     originalSubmit?.classList.add("hidden");
//     (document.getElementById("forgot-btn") as HTMLElement)?.classList.add(
//         "hidden"
//     );
//     document.getElementById("show-signup")?.classList.add("hidden");
//     sendCodeBtn.classList.remove("hidden");
//     backToLoginLink.classList.remove("hidden");
// }
// function exitResetMode() {
//     resetMode = false;
//     (document.getElementById("password") as HTMLElement)?.classList.remove(
//         "hidden"
//     );
//     originalSubmit?.classList.remove("hidden");
//     (document.getElementById("forgot-btn") as HTMLElement)?.classList.remove(
//         "hidden"
//     );
//     document.getElementById("show-signup")?.classList.remove("hidden");
//     sendCodeBtn.classList.add("hidden");
//     backToLoginLink.classList.add("hidden");
// }

// document.getElementById("forgot-btn")?.addEventListener("click", (e) => {
//     e.preventDefault();
//     enterResetMode();
// });

// backToLoginLink.addEventListener("click", (e) => {
//     e.preventDefault();
//     exitResetMode();
// });

// sendCodeBtn.addEventListener("click", () => {
//     loginError.textContent = "";
//     const email = (
//         document.getElementById("email") as HTMLInputElement
//     ).value.trim();
//     const emErr = validateEmail(email);

//     if (!email) loginError.textContent = "Email is required.";
//     else if (emErr) loginError.textContent = emErr;
//     else {
//         loginError.textContent =
//             "If the address is registered, a reset code has been sent.";
//         exitResetMode();
//     }
// });

document.getElementById("show-signup")?.addEventListener("click", (e) => {
    e.preventDefault();
    showSignup();
});
document.getElementById("show-login")?.addEventListener("click", (e) => {
    e.preventDefault();
    hideSignup();
});

//Google OAuth
$("#google-login-btn")?.addEventListener("click", () => {
    window.location.href = GOOGLE_LOGIN_URL;
});
$("#google-signup-btn")?.addEventListener("click", () => {
    window.location.href = GOOGLE_LOGIN_URL;
});

signupForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    signupError.textContent = "";

    const un = (
        document.getElementById("su-username") as HTMLInputElement
    ).value.trim();
    const em = (
        document.getElementById("su-email") as HTMLInputElement
    ).value.trim();
    const pw = (document.getElementById("su-password") as HTMLInputElement)
        .value;
    const pw2 = (document.getElementById("su-password2") as HTMLInputElement)
        .value;

    const emErr = validateEmail(em);
    const pwErr = validatePassword(pw);

    if (!un) signupError.textContent = "Username is required.";
    else if (emErr) signupError.textContent = emErr;
    else if (pwErr) signupError.textContent = pwErr;
    else if (pw !== pw2) signupError.textContent = "Passwords don’t match.";
    else {
        fetch(`https://${HOST}:8443/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: un, email: em, password: pw }),
        })
            .then(async (res) => {
                const data = await res.json();
                if (!res.ok) {
                    signupError.textContent = data.error || "Signup failed.";
                } else {
                    hideSignup();
                    loginError.textContent = "Account created! Please sign in.";
                }
            })
            .catch(() => {
                signupError.textContent = "Network error. Please try again.";
            });
    }
});

document.getElementById("nav-signout")?.addEventListener("click", () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
	stopNotifications();
    showLogin();
});
