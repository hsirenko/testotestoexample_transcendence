/* profile-info.ts – inline editing + collapsible card */

type FieldKey = "username" | "email" | "password";
interface UserLS { username?: string; email?: string; createdAt?: string; }

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;

/* ––––– helpers to read / write user from localStorage ––––– */
function loadUser(): UserLS {
  try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; }
}
function saveUser(u: UserLS): void { localStorage.setItem("user", JSON.stringify(u)); }

/* ––––– fill the Info tab ––––– */
export function populateInfoTab(): void {
  const u = loadUser();

  $("#field-username").textContent = u.username  ?? "Player";
  $("#field-email").textContent    = u.email     ?? "—";
  $("#field-joined").textContent   = (u.createdAt ??
                                      "2025-06-04").slice(0, 10);          // dummy if not set
}

/* ––––– inline edit ––––– (unchanged apart from one extra call) */

function startEdit(key: FieldKey): void {
  const row   = document.querySelector<HTMLDivElement>(`.field-row button[data-edit='${key}']`)!
                    .parentElement as HTMLDivElement;
  const valueEl = row.querySelector("p.text-lg")!;
  const current = valueEl.textContent ?? "";

  /* build tiny form */
  row.innerHTML = `
    <input id="edit-input" value="${current}"
           class="flex-1 px-3 py-1 rounded bg-white/10 focus:bg-white/20 outline-none"/>
    <button id="save-btn" type="button"  class="text-emerald-400 hover:underline mr-2">Save</button>
    <button id="cancel-btn" type="button" class="text-red-400 hover:underline">Cancel</button>
  `;

  const input  = $("#edit-input")  as HTMLInputElement;
  const save   = $("#save-btn");
  const cancel = $("#cancel-btn");

  cancel.addEventListener("click", populateInfoTab);          // revert
  save.addEventListener("click", () => doSave(key, input.value.trim()));
  input.addEventListener("keydown", e => e.key==="Enter" && save.click());
  input.focus();
}      // unchanged
async function doSave(key: FieldKey, val: string) {
  if (!val) { populateInfoTab(); return; }

  /* TODO: make real PATCH request here… */
  const u = loadUser();
  if (key !== "password") (u as any)[key] = val;
  saveUser(u);

  populateInfoTab();
  (window as any).populateProfileHeader?.();    // ⬅ refresh name/email up top
  showToast();
}
function showToast(): void {
  const t = $("#profile-toast");
  t.classList.remove("opacity-0");
  setTimeout(() => t.classList.add("opacity-0"), 1600);
}
                  // unchanged

/* wire “Edit / Change” */
document.querySelectorAll<HTMLButtonElement>(".edit-btn")
        .forEach(b => b.addEventListener("click", () =>
          startEdit(b.dataset.edit as FieldKey)));

/* expose for nav.ts */
(window as any).populateInfoTab = populateInfoTab;




