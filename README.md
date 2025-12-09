# Enhanced Link Grabber for Firefox

Extract, group, and copy every useful link on a page with filtering, domain toggles, and live highlighting in the tab you are inspecting.

## What it does
- Scans the active tab for anchors plus common media/embed sources (`img`, `video`, `audio`, `iframe`, `script`, `link`, `source`, `track`) and normalizes them to absolute URLs.
- Groups results by domain; click a domain header to focus on just that domain, click again to reset.
- Filters in real time: plain text contains, multi-term (`foo+bar`), or regex (`/pattern/`).
- Copies a single link by clicking the row or copies all filtered links with one button.
- Highlights the hovered link directly in the page so you can see what you are about to copy.
- Dark mode toggle built into the popup.

## Installation (temporary load for development)
1. Open Firefox and go to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on**.
3. Choose `manifest.json` from this folder. The extension will appear in the toolbar; reopen the popup after code changes.

## Usage
- Click the toolbar button to open the popup.
- Use the filter box to narrow results. Examples:
  - `mp4` → plain text contains
  - `1080p+60fps` → must contain both terms
  - `/https?:\\/\\/example\\.com/` → regex (case-insensitive)
- Hover a link row to highlight it in the page; click the row to copy that URL.
- Click **Copy All** to copy all current (and filtered) results. Domain focus is respected when active.
- Click a domain header to toggle domain-only view.
- Use **Toggle Dark** to switch themes.

## How it works
- `js/contentscript.js` collects anchors and common media/embed `src`-like attributes, normalizes them to absolute URLs, and responds to messages for:
  - `getLinks` → returns all collected links
  - `highlight` / `clearHighlight` → draws or removes an outline on the matching anchor
- `js/popup.js` renders and filters the list, handles copy actions, and sends highlight requests.
- `background.js` keeps a simple log on install and stores collected links when notified (currently unused UI-side but available for future features).

## Privacy & data collection
- Declared in `manifest.json` under `browser_specific_settings.gecko.data_collection_permissions` as `required: ["none"]` — the extension does **not** collect or transmit data off the device.
- Permissions requested: `activeTab`, `tabs`, `storage`, and `clipboardWrite` to read the active page, remember state, and copy links.

## Project layout
```
.
├─ manifest.json
├─ background.js
├─ popup.html
├─ js/
│  ├─ contentscript.js
│  └─ popup.js
├─ icon_48.png
├─ icon_96.png
├─ icon_128.png
└─ README.md
```

## Development tips
- Quick reload: after editing files, reopen the popup; for content-script changes, refresh the target tab.
- Optional helper: install `web-ext` globally (`npm install -g web-ext`) and run `web-ext run` from this folder for a dedicated test profile with auto-reload.
- Signing/building for AMO: `web-ext build` produces a ZIP in `web-ext-artifacts/`. Submit that ZIP to AMO.

## Suggested git setup
If starting a fresh repo here:
```
git init
git add .
git commit -m "chore: initial import"
git remote add origin git@github.com:<you>/enhanced-link-grabber-for-firefox.git
git push -u origin main
```

## License
MIT — see `LICENSE`.
