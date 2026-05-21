
let darkMode = true;
let selectedDomain = null; // in-memory only, resets when popup closes
let latestLinks = [];
const STORAGE_KEY = "defaultQueries";
const THEME_KEY = "lgTheme";

function applyDarkMode() {
  const bg = darkMode ? "#1e1e1e" : "#ffffff";
  const fg = darkMode ? "#f5f5f5" : "#111111";
  const card = darkMode ? "#2a2a2a" : "#ffffff";
  document.body.style.backgroundColor = bg;
  document.body.style.color = fg;
  document.body.style.transition = "background 0.2s ease, color 0.2s ease";
  const inputs = document.querySelectorAll("input, button");
  inputs.forEach(el => {
    el.style.backgroundColor = darkMode ? card : "";
    el.style.color = fg;
    el.style.borderColor = darkMode ? "#4a4a4a" : "#cccccc";
  });
}

async function loadTheme() {
  try {
    const stored = await chrome.storage.local.get(THEME_KEY);
    if (stored && stored[THEME_KEY]) {
      darkMode = stored[THEME_KEY] === "dark";
    }
  } catch (err) {
    console.error(err);
  }
}

function saveTheme() {
  chrome.storage.local.set({ [THEME_KEY]: darkMode ? "dark" : "light" }).catch(() => {});
}

function toggleDarkMode() {
  darkMode = !darkMode;
  applyDarkMode();
  saveTheme();
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function groupLinksByDomain(links) {
  const groups = {};
  links.forEach(link => {
    try {
      const url = new URL(link.href);
      const domain = url.hostname;
      if (!groups[domain]) groups[domain] = [];
      groups[domain].push(link.href);
    } catch {}
  });
  return groups;
}

function showMessage(msg, type = "info") {
  let msgDiv = document.getElementById("lg-message");
  if (!msgDiv) {
    msgDiv = document.createElement("div");
    msgDiv.id = "lg-message";
    msgDiv.style.position = "fixed";
    msgDiv.style.top = "10px";
    msgDiv.style.left = "50%";
    msgDiv.style.transform = "translateX(-50%)";
    msgDiv.style.zIndex = 9999;
    msgDiv.style.padding = "8px 16px";
    msgDiv.style.borderRadius = "8px";
    msgDiv.style.background = type === "error" ? "#b00020" : "#222";
    msgDiv.style.color = "#fff";
    msgDiv.style.fontSize = "15px";
    msgDiv.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
    document.body.appendChild(msgDiv);
  }
  msgDiv.textContent = msg;
  msgDiv.style.display = "block";
  setTimeout(() => { msgDiv.style.display = "none"; }, 1800);
}

function pickDefaultQuery(host, entries) {
  if (!host || !Array.isArray(entries)) return null;
  const lowerHost = host.toLowerCase();
  let best = null;
  entries.forEach(entry => {
    if (!entry || !entry.site || !entry.query) return;
    const site = entry.site.toLowerCase();
    if (!site) return;
    const match = lowerHost === site || lowerHost.endsWith(`.${site}`);
    if (match) {
      if (!best || site.length > best.site.length) {
        best = { site, query: entry.query };
      }
    }
  });
  return best;
}

async function applyDefaultFilterIfEmpty() {
  const filterInput = document.getElementById("filter");
  if (filterInput.value.trim()) return;
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab || !tab.url) return;
    const host = new URL(tab.url).hostname;
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    const entries = Array.isArray(stored[STORAGE_KEY]) ? stored[STORAGE_KEY] : [];
    const match = pickDefaultQuery(host, entries);
    if (match && match.query) {
      filterInput.value = match.query;
      showMessage(`Applied default for ${match.site}`);
    }
  } catch (err) {
    console.error(err);
  }
}

function renderLinks(links, filterValue) {
  // keep the freshest links available for domain toggling without requery
  latestLinks = links || [];
  const container = document.getElementById("links");
  container.innerHTML = "";
  let regex = null;
  let useRegex = false;
  let filterTerms = [];
  let useMultiTerm = false;
  let regexError = false;

  if (filterValue.startsWith("/") && filterValue.endsWith("/")) {
    try {
      regex = new RegExp(filterValue.slice(1, -1), "i");
      useRegex = true;
    } catch {
      regexError = true;
    }
  } else if (filterValue.includes("+")) {
    filterTerms = filterValue.split("+").map(t => t.trim().toLowerCase()).filter(Boolean);
    useMultiTerm = filterTerms.length > 1;
  }

  if (regexError) {
    showMessage("Invalid regex", "error");
    return;
  }

  const grouped = groupLinksByDomain(links);
  let anyLink = false;
  for (const domain in grouped) {
    if (selectedDomain && domain !== selectedDomain) continue;
    const domainDiv = document.createElement("div");
    domainDiv.className = "domain-group";
    const domainTitle = document.createElement("div");
    domainTitle.className = "domain-title";
    domainTitle.textContent = domain;
    if (selectedDomain === domain) {
      domainTitle.classList.add("active");
      domainTitle.title = "Showing only this domain. Click to show all.";
    } else {
      domainTitle.title = "Click to show only this domain";
    }
    domainTitle.addEventListener("click", () => {
      selectedDomain = selectedDomain === domain ? null : domain;
      renderLinks(latestLinks, document.getElementById("filter").value);
    });
    domainDiv.appendChild(domainTitle);

    grouped[domain].forEach(link => {
      if (filterValue) {
        if (useRegex && !regex.test(link)) return;
        if (useMultiTerm && !filterTerms.every(term => link.toLowerCase().includes(term))) return;
        if (!useRegex && !useMultiTerm && !link.toLowerCase().includes(filterValue.toLowerCase())) return;
      }
      anyLink = true;
      const div = document.createElement("div");
      div.className = "link-item";
      // Make the link a clickable anchor
      const a = document.createElement("a");
      a.href = link;
      a.textContent = link;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.style.textDecoration = "underline";
      a.style.color = "inherit";
      a.title = "Click to open. Click the row to copy.";
      div.appendChild(a);
      div.addEventListener("click", (e) => {
        e.preventDefault();
        navigator.clipboard.writeText(link).then(() => {
          showMessage("Copied!", "info");
        }).catch(() => {
          showMessage("Copy failed", "error");
        });
      });
      div.addEventListener("mouseover", () => {
        chrome.runtime.sendMessage({ action: "highlight", href: link });
      });
      div.addEventListener("mouseout", () => {
        chrome.runtime.sendMessage({ action: "clearHighlight" });
      });
      domainDiv.appendChild(div);
    });

    if (domainDiv.children.length > 1) {
      container.appendChild(domainDiv);
    }
  }
  if (!anyLink) {
    container.innerHTML = '<div style="color:#888;padding:12px 0;">No links found.</div>';
  }
}

function filterLinks() {
  const filterValue = document.getElementById("filter").value;
  chrome.tabs.query({ active: true, currentWindow: true }).then(tabs => {
    chrome.tabs.sendMessage(tabs[0].id, { action: "getLinks" }).then(links => {
      renderLinks(links || [], filterValue);
    }).catch(() => {
      showMessage("Could not extract links from this page", "error");
      renderLinks([], filterValue);
    });
  }).catch(() => {
    showMessage("Could not access tab", "error");
    renderLinks([], filterValue);
  });
}

document.getElementById("filter").addEventListener("input", filterLinks);
document.getElementById("clear-filter").addEventListener("click", () => {
  document.getElementById("filter").value = "";
  filterLinks();
});

document.getElementById("copyAll").addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }).then(tabs => {
    chrome.tabs.sendMessage(tabs[0].id, { action: "getLinks" }).then(links => {
      latestLinks = links || [];
      const filterValue = document.getElementById("filter").value;
      let hrefs = latestLinks.map(l => l.href);
      if (selectedDomain) {
        hrefs = hrefs.filter(h => {
          try {
            return new URL(h).hostname === selectedDomain;
          } catch {
            return false;
          }
        });
      }
      let filtered = hrefs;
      let regex = null;
      let useRegex = false;
      let filterTerms = [];
      let useMultiTerm = false;
      let regexError = false;
      if (filterValue) {
        if (filterValue.startsWith("/") && filterValue.endsWith("/")) {
          try {
            regex = new RegExp(filterValue.slice(1, -1), "i");
            useRegex = true;
          } catch {
            regexError = true;
          }
        } else if (filterValue.includes("+")) {
          filterTerms = filterValue.split("+").map(t => t.trim().toLowerCase()).filter(Boolean);
          useMultiTerm = filterTerms.length > 1;
        }
        if (regexError) {
          showMessage("Invalid regex", "error");
          return;
        }
        if (useRegex) {
          filtered = hrefs.filter(h => regex.test(h));
        } else if (useMultiTerm) {
          filtered = hrefs.filter(h => filterTerms.every(term => h.toLowerCase().includes(term)));
        } else {
          filtered = hrefs.filter(h => h.toLowerCase().includes(filterValue.toLowerCase()));
        }
      }
      navigator.clipboard.writeText(filtered.join("\n")).then(() => {
        showMessage("Copied all!", "info");
      }).catch(() => {
        showMessage("Copy failed", "error");
      });
    }).catch(() => {
      showMessage("Could not extract links from this page", "error");
    });
  }).catch(() => {
    showMessage("Could not access tab", "error");
  });
});

document.getElementById("toggleDark").addEventListener("click", toggleDarkMode);
document.getElementById("openSettings").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

(async function init() {
  await loadTheme();
  applyDarkMode();
  await applyDefaultFilterIfEmpty();
  filterLinks();
})();
