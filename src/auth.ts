import { resetObjects, resizeCanvas, render, updateScore } from "./main.js";

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

const GOOGLE_LOGIN_URL = 'http://localhost:3000/auth/google';

const originalSubmit = form.querySelector(
  "button[type='submit'],input[type='submit']"
) as HTMLElement | null;

const sendCodeBtn = document.createElement("button");
sendCodeBtn.id = "send-code-btn";
sendCodeBtn.type = "button";
sendCodeBtn.textContent = "Send code";
sendCodeBtn.className =
  (originalSubmit ? originalSubmit.className : "btn") + " hidden";
if (originalSubmit) {
  originalSubmit.insertAdjacentElement("afterend", sendCodeBtn);
} else {
  form.appendChild(sendCodeBtn);
}

const backToLoginLink = document.createElement("a");
backToLoginLink.id = "back-to-login";
backToLoginLink.href = "#";
backToLoginLink.textContent = "Already have an account? Sign in";
backToLoginLink.className = "hidden";
sendCodeBtn.insertAdjacentElement("afterend", backToLoginLink);

// On page load, check for ?token=… in the URL
const params = new URLSearchParams(window.location.search);
const googleToken = params.get('token');
if (googleToken) {
  localStorage.setItem('token', googleToken);
  // optionally fetch user profile from /users/me
  fetch('http://localhost:3000/api/users/me', {
    headers: { 'Authorization': `Bearer ${googleToken}` }
  })
    .then((r) => r.json())
    .then((user) => {
      localStorage.setItem('user', JSON.stringify(user));
      // clean up the URL
      window.history.replaceState({}, '', window.location.pathname);
	  hideLogin();
      resetObjects();
      resizeCanvas();
      render();
      updateScore();
    });
}

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

form.addEventListener("submit", (e) => {
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

  const pwErr = validatePassword(password);
  if (!email) loginError.textContent = "Email is required.";
  else if (pwErr) loginError.textContent = pwErr;
  else {
    fetch("http://localhost:3000/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          loginError.textContent = data.error || "Login failed.";
        } else {
		  localStorage.setItem('token', data.token);
          localStorage.setItem("user", JSON.stringify(data.user));
          hideLogin();
          resetObjects();
          resizeCanvas();
          render();
          updateScore();
        }
      })
      .catch(() => {
        loginError.textContent = "Network error. Please try again.";
      });
  }
});

function enterResetMode() {
  resetMode = true;
  loginError.textContent = "";
  (document.getElementById("password") as HTMLElement)?.classList.add("hidden");
  originalSubmit?.classList.add("hidden");
  (document.getElementById("forgot-btn") as HTMLElement)?.classList.add(
    "hidden"
  );
  document.getElementById("show-signup")?.classList.add("hidden");
  sendCodeBtn.classList.remove("hidden");
  backToLoginLink.classList.remove("hidden");
}
function exitResetMode() {
  resetMode = false;
  (document.getElementById("password") as HTMLElement)?.classList.remove(
    "hidden"
  );
  originalSubmit?.classList.remove("hidden");
  (document.getElementById("forgot-btn") as HTMLElement)?.classList.remove(
    "hidden"
  );
  document.getElementById("show-signup")?.classList.remove("hidden");
  sendCodeBtn.classList.add("hidden");
  backToLoginLink.classList.add("hidden");
}

document.getElementById("forgot-btn")?.addEventListener("click", (e) => {
  e.preventDefault();
  enterResetMode();
});

backToLoginLink.addEventListener("click", (e) => {
  e.preventDefault();
  exitResetMode();
});

sendCodeBtn.addEventListener("click", () => {
  loginError.textContent = "";
  const email = (
    document.getElementById("email") as HTMLInputElement
  ).value.trim();
  const emErr = validateEmail(email);

  if (!email) loginError.textContent = "Email is required.";
  else if (emErr) loginError.textContent = emErr;
  else {
    loginError.textContent =
      "If the address is registered, a reset code has been sent.";
    exitResetMode();
  }
});

document.getElementById("show-signup")?.addEventListener("click", (e) => {
  e.preventDefault();
  showSignup();
});
document.getElementById("show-login")?.addEventListener("click", (e) => {
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


signupForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  signupError.textContent = "";

  const un = (
    document.getElementById("su-username") as HTMLInputElement
  ).value.trim();
  const em = (
    document.getElementById("su-email") as HTMLInputElement
  ).value.trim();
  const pw = (document.getElementById("su-password") as HTMLInputElement).value;
  const pw2 = (document.getElementById("su-password2") as HTMLInputElement)
    .value;

  const emErr = validateEmail(em);
  const pwErr = validatePassword(pw);

  if (!un) signupError.textContent = "Username is required.";
  else if (emErr) signupError.textContent = emErr;
  else if (pwErr) signupError.textContent = pwErr;
  else if (pw !== pw2) signupError.textContent = "Passwords don’t match.";
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
  localStorage.removeItem('token');
  showLogin();
});
