function updateExtensionIcon(request) {
  const sizes = [16, 48, 128];
  const iconData = {};

  for (const size of sizes) {
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');
    const baseName = request.isEnabled
        ? (request.isDomainEnabled ? "favicon" : "favicon-off")
        : "favicon-disabled";

    fetch(chrome.runtime.getURL(`icons/${baseName}-${size}.png`))
        .then(response => response.blob())
        .then(blob => createImageBitmap(blob))
        .then(bitmap => {
          ctx.clearRect(0, 0, size, size);
          ctx.drawImage(bitmap, 0, 0, size, size);
          iconData[size] = ctx.getImageData(0, 0, size, size);

          if (Object.keys(iconData).length === sizes.length) {
            chrome.action.setIcon({
              tabId: request.tabId,
              imageData: iconData
            });
          }
        });
  }
}

function updateIconForTab(tabId, url) {
  if (!url || url.startsWith('chrome://')) return;

  chrome.storage.sync.get(['excludeDomains', 'themeEnabled'], (data) => {
    const excludedSites = data.excludeDomains ? data.excludeDomains.split('\n').filter(Boolean) : [];
    const isDomainExcluded = excludedSites.some(domain => url.includes(domain));

    updateExtensionIcon({
      tabId: tabId,
      isEnabled: data.themeEnabled !== false,
      isDomainEnabled: !isDomainExcluded
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(["bgColor", "textColor", "themeEnabled", "excludeDomains"], (data) => {
    if (!data.bgColor) chrome.storage.sync.set({ bgColor: "#141e32" });
    if (!data.textColor) chrome.storage.sync.set({ textColor: "#d2e6ff" });
    if (data.themeEnabled === undefined) chrome.storage.sync.set({ themeEnabled: true });
    chrome.storage.sync.set({ excludeDomains: "" })
  });
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') {
    if (changes.excludeDomains || changes.themeEnabled) {
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          if (tab && !tab.url.startsWith('chrome://')) {
            const currentDomain = new URL(tab.url).hostname;
            const newExcludedSites = changes.excludeDomains?.newValue ? changes.excludeDomains.newValue.split('\n').filter(Boolean) : [];
            const isExcluded = newExcludedSites.includes(currentDomain);

            if (!isExcluded) {
              chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['bluescale.js']
              }).catch(err => console.warn('Script injection failed for tab:', tab.id, err));
            } else {
              chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                  document.documentElement.classList.remove('blue-mode');
                  document.documentElement.style.removeProperty('--bg-color');
                  document.documentElement.style.removeProperty('--text-color');
                }
              }).catch(err => console.warn('Script injection failed for tab:', tab.id, err));
            }

            updateIconForTab(tab.id, tab.url);
          }
        });
      });
    }
  }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab) {
      chrome.storage.sync.get(['themeEnabled', 'bgColor', 'textColor', 'excludeDomains'], (data) => {
        const excludedSites = data.excludeDomains ? data.excludeDomains.split('\n').filter(Boolean) : [];
        const isDomainExcluded = excludedSites.some(domain => tab.url.includes(domain));

        if (!isDomainExcluded && data.themeEnabled) {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['bluescale.js']
          }).catch(err => console.warn('Script injection failed for tab:', tab.id, err));
        } else {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              document.documentElement.classList.remove('blue-mode');
              document.documentElement.style.removeProperty('--bg-color');
              document.documentElement.style.removeProperty('--text-color');
            }
          }).catch(err => console.warn('Script injection failed for tab:', tab.id, err));
        }
      });
      updateIconForTab(tab.id, tab.url);
    }
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
    chrome.storage.sync.get(['excludeDomains', 'themeEnabled'], (data) => {
      const excludedSites = data.excludeDomains ? data.excludeDomains.split('\n').filter(Boolean) : [];
      const isDomainExcluded = excludedSites.some(domain => tab.url.includes(domain));

      if (!isDomainExcluded) {
        chrome.scripting.executeScript({
          target: { tabId },
          files: ['bluescale.js']
        }).catch(err => console.warn('Execution failed:', err));
      }

      updateIconForTab(tabId, tab.url);
    });
  }
});

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  chrome.tabs.get(details.tabId, (tab) => {
    if (tab && tab.url && !tab.url.startsWith('chrome://')) {
      chrome.storage.sync.get(['excludeDomains', 'themeEnabled'], (data) => {
        const excludedSites = data.excludeDomains ? data.excludeDomains.split('\n').filter(Boolean) : [];
        const isDomainExcluded = excludedSites.some(domain => tab.url.includes(domain));

        if (!isDomainExcluded) {
          chrome.scripting.executeScript({
            target: { tabId: details.tabId },
            files: ['bluescale.js']
          }).catch(err => console.warn('Execution failed:', err));
        }

        updateIconForTab(details.tabId, tab.url);
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

  if (request.type === "updateIcon") {
    updateExtensionIcon(request);
  }
});

chrome.tabs.onCreated.addListener((tab) => {
  if (tab.url) {
    updateIconForTab(tab.id, tab.url);
  }
});