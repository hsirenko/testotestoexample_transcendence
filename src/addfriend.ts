/* addfriend.ts – quick add-a-friend widget inside the sidebar
 * ----------------------------------------------------------- */
import { HOST }                from "./config.js";
import { loadFriendsSidebar }  from "./friends.js";

/* helpers from friends.ts re-used here ---------------------- */
const auth = (): HeadersInit => {
  const t = localStorage.getItem("token");
  return t ? { Authorization: `Bearer ${t}` } : {};
};

function toast(msg: string, isError = false) {
  const t = document.getElementById("friends-toast")!;
  t.textContent = msg;
  t.classList.toggle("bg-red-500", isError);
  t.classList.toggle("bg-emerald-500", !isError);
  t.classList.add("opacity-100");
  t.classList.remove("pointer-events-none");
  setTimeout(() => {
    t.classList.remove("opacity-100");
    t.classList.add("pointer-events-none");
  }, 2_000);
}

/* DOM refs -------------------------------------------------- */
const input = document.getElementById("addfriend-input") as HTMLInputElement;
const btn   = document.getElementById("addfriend-btn")   as HTMLButtonElement;

let editMode = false;          // false = show button, true = show input

const resetUI = () => {
  editMode = false;
  input.value = "";
  input.classList.add("hidden");
  btn.textContent = "Add +";
};

/* send POST /add-friend ------------------------------------- */
async function addFriend(username: string) {
  try {
    const res = await fetch(`https://${HOST}:8443/api/users/add-friend`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth() },
      body: JSON.stringify({ username }), // see backend change below
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || res.statusText);

    toast(`Friend request sent to ${username} 🎉`);
    await loadFriendsSidebar();      // refresh list
  } catch (e: any) {
    toast(e.message ?? "Failed to add friend", true);
  } finally {
    resetUI();
  }
}

/* interactions ---------------------------------------------- */
btn.addEventListener("click", () => {
  if (!editMode) {
    editMode = true;
    input.classList.remove("hidden");
    input.focus();
    btn.textContent = "Send";
    return;
  }

  const uname = input.value.trim();
  if (!uname) {
    toast("Type a username first", true);
    return;
  }
  addFriend(uname);
});

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const uname = input.value.trim();
    if (uname) addFriend(uname);
  } else if (e.key === "Escape") {
    resetUI();
  }
});
