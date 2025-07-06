import { HOST } from "./config.js";
import { loadFriendsSidebar } from "./friends.js";

// Returns auth headers with bearer token if available
const auth = (): HeadersInit => {
  const t = localStorage.getItem("token");
  return t ? { Authorization: `Bearer ${t}` } : {};
};

// Displays a temporary toast message
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
  }, 2000);
}

const input = document.getElementById("addfriend-input") as HTMLInputElement;
const btn = document.getElementById("addfriend-btn") as HTMLButtonElement;

let editMode = false;

// Resets input field and button to initial state
const resetUI = () => {
  editMode = false;
  input.value = "";
  input.classList.add("hidden");
  btn.textContent = "Add +";
};

// Sends a friend request to the server
async function addFriend(username: string) {
  try {
    const res = await fetch(`http://${HOST}:3000/api/users/add-friend`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth() },
      body: JSON.stringify({ username }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || res.statusText);

    toast(`Friend request sent to ${username} 🎉`);
    await loadFriendsSidebar();
  } catch (e: any) {
    toast(e.message ?? "Failed to add friend", true);
  } finally {
    resetUI();
  }
}

// Handles button click for toggling input and sending request
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

// Handles keypresses inside the input field
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const uname = input.value.trim();
    if (uname) addFriend(uname);
  } else if (e.key === "Escape") {
    resetUI();
  }
});
