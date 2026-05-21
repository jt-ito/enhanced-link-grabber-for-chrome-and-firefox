const STORAGE_KEY = "defaultQueries";
const THEME_KEY = "lgTheme";

const siteInput = document.getElementById("site");
const queryInput = document.getElementById("query");
const addBtn = document.getElementById("add");
const statusEl = document.getElementById("status");
const entriesEl = document.getElementById("entries");

function normalizeSite(site) {
  const trimmed = site.trim();
  if (!trimmed) return "";
  try {
    const url = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
    const host = new URL(url).hostname;
    return host.toLowerCase();
  } catch {
    return trimmed.toLowerCase();
  }
}

function showStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.style.color = isError ? "#842029" : "#0f5132";
  if (msg) {
    setTimeout(() => { statusEl.textContent = ""; }, 2500);
  }
}

async function loadEntries() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const entries = Array.isArray(stored[STORAGE_KEY]) ? stored[STORAGE_KEY] : [];
  return entries
    .filter(e => e && e.site && e.query)
    .map(e => ({ site: normalizeSite(e.site), query: e.query }));
}

async function saveEntries(entries) {
  await chrome.storage.local.set({ [STORAGE_KEY]: entries });
}

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.body.dataset.theme = isDark ? "dark" : "light";
}

async function loadTheme() {
  try {
    const stored = await chrome.storage.local.get(THEME_KEY);
    const theme = stored && stored[THEME_KEY] ? stored[THEME_KEY] : "dark";
    applyTheme(theme);
  } catch (err) {
    console.error(err);
  }
}

function toggleTheme() {
  const next = document.body.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next);
  chrome.storage.local.set({ [THEME_KEY]: next }).catch(() => {});
}

function render(entries) {
  entriesEl.innerHTML = "";
  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No defaults saved yet.";
    entriesEl.appendChild(empty);
    return;
  }

  entries
    .sort((a, b) => a.site.localeCompare(b.site))
    .forEach(entry => {
      const row = document.createElement("div");
      row.className = "entry";

      const text = document.createElement("div");
      text.className = "text";
      const siteEl = document.createElement("span");
      siteEl.className = "site";
      siteEl.textContent = entry.site;
      const arrow = document.createTextNode(" → ");
      const queryEl = document.createElement("span");
      queryEl.textContent = entry.query;
      text.appendChild(siteEl);
      text.appendChild(arrow);
      text.appendChild(queryEl);
      row.appendChild(text);

      const del = document.createElement("button");
      del.className = "secondary";
      del.textContent = "Delete";
      del.addEventListener("click", async () => {
        const updated = entries.filter(e => e.site !== entry.site);
        await saveEntries(updated);
        render(updated);
        showStatus("Deleted");
      });
      row.appendChild(del);

      entriesEl.appendChild(row);
    });
}

async function upsertEntry() {
  const site = normalizeSite(siteInput.value);
  const query = queryInput.value.trim();

  if (!site) {
    showStatus("Enter a site (e.g. example.com)", true);
    return;
  }
  if (!query) {
    showStatus("Enter a default search", true);
    return;
  }

  const entries = await loadEntries();
  const filtered = entries.filter(e => e.site !== site);
  filtered.push({ site, query });
  await saveEntries(filtered);
  render(filtered);
  showStatus("Saved");
}

addBtn.addEventListener("click", () => {
  upsertEntry();
});

[siteInput, queryInput].forEach(input => {
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      upsertEntry();
    }
  });
});

document.getElementById("themeToggle").addEventListener("click", toggleTheme);

(async function init() {
  try {
    await loadTheme();
    const entries = await loadEntries();
    render(entries);
  } catch (err) {
    console.error(err);
    showStatus("Could not load settings", true);
  }
})();
