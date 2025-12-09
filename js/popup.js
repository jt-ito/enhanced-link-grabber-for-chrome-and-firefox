
let darkMode = true;
let selectedDomain = null; // in-memory only, resets when popup closes
let latestLinks = [];

function applyDarkMode() {
  document.body.style.backgroundColor = darkMode ? "#1e1e1e" : "white";
  document.body.style.color = darkMode ? "white" : "black";
  const inputs = document.querySelectorAll("input, button");
  inputs.forEach(el => {
    el.style.backgroundColor = darkMode ? "#575757" : "";
    el.style.color = darkMode ? "white" : "";
  });
}

function toggleDarkMode() {
  darkMode = !darkMode;
  applyDarkMode();
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
        browser.runtime.sendMessage({ action: "highlight", href: link });
      });
      div.addEventListener("mouseout", () => {
        browser.runtime.sendMessage({ action: "clearHighlight" });
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
  browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
    browser.tabs.sendMessage(tabs[0].id, { action: "getLinks" }).then(links => {
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
  browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
    browser.tabs.sendMessage(tabs[0].id, { action: "getLinks" }).then(links => {
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
applyDarkMode();
filterLinks();
