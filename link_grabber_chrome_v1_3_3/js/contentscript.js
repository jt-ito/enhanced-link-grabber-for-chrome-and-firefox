
function highlightLink(href) {
    document.querySelectorAll('a').forEach(a => {
        if (a.href === href) {
            a.setAttribute('data-link-grabber-highlighted', 'true');
            a.style.outline = '2px solid orange';
        }
    });
}

function clearHighlights() {
    document.querySelectorAll('[data-link-grabber-highlighted]').forEach(a => {
        a.removeAttribute('data-link-grabber-highlighted');
        a.style.outline = '';
    });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "highlight") {
        clearHighlights();
        highlightLink(message.href);
    } else if (message.action === "clearHighlight") {
        clearHighlights();
    } else if (message.action === "getLinks") {
            const hrefs = new Set();

            // anchors
            document.querySelectorAll("a[href]").forEach(a => {
                if (a.href) hrefs.add(a.href);
            });

            const srcSelectors = [
                "img",
                "source",
                "video",
                "audio",
                "track",
                "iframe",
                "script",
                "link[href]"
            ];

            // collect src/data-src from common media/embed elements
            srcSelectors.forEach(sel => {
                document.querySelectorAll(sel).forEach(el => {
                    const addAttr = (attr) => {
                        const val = el.getAttribute(attr);
                        if (!val) return;
                        try {
                            const abs = new URL(val, document.baseURI).href;
                            hrefs.add(abs);
                        } catch {}
                    };
                    addAttr("src");
                    addAttr("data-src");
                    addAttr("data-srcset");
                });
            });

            const links = Array.from(hrefs).map(href => ({ href }));
            sendResponse(links);
            return true;
    }
});
