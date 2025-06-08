/* profile-info.ts – inline editing + collapsible card */
const $ = (s) => document.querySelector(s);
/* ––––– helpers to read / write user from localStorage ––––– */
function loadUser() {
    try {
        return JSON.parse(localStorage.getItem("user") || "{}");
    }
    catch (_a) {
        return {};
    }
}
function saveUser(u) { localStorage.setItem("user", JSON.stringify(u)); }
/* ––––– fill the Info tab ––––– */
export function populateInfoTab() {
    var _a, _b, _c;
    const u = loadUser();
    $("#field-username").textContent = (_a = u.username) !== null && _a !== void 0 ? _a : "Player";
    $("#field-email").textContent = (_b = u.email) !== null && _b !== void 0 ? _b : "—";
    $("#field-joined").textContent = ((_c = u.createdAt) !== null && _c !== void 0 ? _c : "2025-06-04").slice(0, 10); // dummy if not set
}
/* ––––– inline edit ––––– (unchanged apart from one extra call) */
function startEdit(key) {
    var _a;
    const row = document.querySelector(`.field-row button[data-edit='${key}']`)
        .parentElement;
    const valueEl = row.querySelector("p.text-lg");
    const current = (_a = valueEl.textContent) !== null && _a !== void 0 ? _a : "";
    /* build tiny form */
    row.innerHTML = `
    <input id="edit-input" value="${current}"
           class="flex-1 px-3 py-1 rounded bg-white/10 focus:bg-white/20 outline-none"/>
    <button id="save-btn" type="button"  class="text-emerald-400 hover:underline mr-2">Save</button>
    <button id="cancel-btn" type="button" class="text-red-400 hover:underline">Cancel</button>
  `;
    const input = $("#edit-input");
    const save = $("#save-btn");
    const cancel = $("#cancel-btn");
    cancel.addEventListener("click", populateInfoTab); // revert
    save.addEventListener("click", () => doSave(key, input.value.trim()));
    input.addEventListener("keydown", e => e.key === "Enter" && save.click());
    input.focus();
} // unchanged
async function doSave(key, val) {
    var _a, _b;
    if (!val) {
        populateInfoTab();
        return;
    }
    /* TODO: make real PATCH request here… */
    const u = loadUser();
    if (key !== "password")
        u[key] = val;
    saveUser(u);
    populateInfoTab();
    (_b = (_a = window).populateProfileHeader) === null || _b === void 0 ? void 0 : _b.call(_a); // ⬅ refresh name/email up top
    showToast();
}
function showToast() {
    const t = $("#profile-toast");
    t.classList.remove("opacity-0");
    setTimeout(() => t.classList.add("opacity-0"), 1600);
}
// unchanged
/* wire “Edit / Change” */
document.querySelectorAll(".edit-btn")
    .forEach(b => b.addEventListener("click", () => startEdit(b.dataset.edit)));
/* expose for nav.ts */
window.populateInfoTab = populateInfoTab;
