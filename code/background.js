chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.url) {
    chrome.storage.sync.get(["excludeDomains"], (data) => {
      const excludedSites = data.excludeDomains ? data.excludeDomains.split("\n") : [];
      const currentURL = tab.url;

      if (!excludedSites.some(domain => currentURL.includes(domain))) {
        chrome.scripting.executeScript({
          target: { tabId },
          files: ["bluescale.js"]
        }).catch(err => console.warn("Execution failed:", err));
      }
    });
  }
});

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  chrome.tabs.get(details.tabId, (tab) => {
    if (tab && tab.url) {
      chrome.storage.sync.get(["excludeDomains"], (data) => {
        const excludedSites = data.excludeDomains ? data.excludeDomains.split("\n") : [];
        const currentURL = tab.url;

        if (!excludedSites.some(domain => currentURL.includes(domain))) {
          chrome.scripting.executeScript({
            target: { tabId: details.tabId },
            files: ["bluescale.js"]
          }).catch(err => console.warn("Execution failed:", err));
        }
      });
    }
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getTabURL") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        sendResponse({ url: tabs[0].url });
      } else {
        sendResponse({ url: null });
      }
    });
    return true;
  }
});
