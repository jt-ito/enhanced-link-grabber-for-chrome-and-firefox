// background.js

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "links-found") {
    browser.storage.local.set({ links: message.links });
  }
});

browser.runtime.onInstalled.addListener(() => {
  console.log("Link Grabber extension installed.");
});
