// background.js (MV3 service worker)

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "links-found") {
    chrome.storage.local.set({ links: message.links });
  }
});

chrome.runtime.onInstalled.addListener(() => {
  console.log("Link Grabber extension installed.");
});
