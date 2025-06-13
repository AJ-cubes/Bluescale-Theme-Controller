document.addEventListener("DOMContentLoaded", () => {
  const bgPicker = document.getElementById("bgColorPicker");
  const textPicker = document.getElementById("textColorPicker");
  const excludeDomainsInput = document.getElementById("excludeDomains");
  const themeToggle = document.getElementById("themeToggle");
  const currTab = document.getElementById("currTab");
  const resetBtn = document.getElementById("reset");
  const exportBtn = document.getElementById("exportBtn");
  const importBtn = document.getElementById("importBtn");
  const importFile = document.getElementById("importFile");

  const fallbackBg = "#141e32";
  const fallbackText = "#d2e6ff";

  chrome.storage.sync.get(["bgColor", "textColor", "themeEnabled", "excludeDomains"], (data) => {
    const bgColor = data.bgColor || fallbackBg;
    const textColor = data.textColor || fallbackText;
    const themeEnabled = data.themeEnabled !== false;

    bgPicker.value = bgColor;
    textPicker.value = textColor;
    themeToggle.checked = themeEnabled;
    excludeDomainsInput.value = data.excludeDomains || "";

    updatePopupTheme(bgColor, textColor, themeEnabled);
    applyColorsToAllTabs(bgColor, textColor, themeEnabled);
    updateCurrTabButton();
  });

  function applyColorsToAllTabs(bg, text, themeEnabled) {
    chrome.storage.sync.get(["excludeDomains"], (data) => {
      const excludedSites = data.excludeDomains ? data.excludeDomains.split("\n").filter(Boolean) : [];

      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          const currentDomain = new URL(tab.url).hostname;

          if (!excludedSites.some(domain => currentDomain.includes(domain))) {
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: (bg, text, themeEnabled) => {
                document.documentElement.style.setProperty("--bg-color", bg);
                document.documentElement.style.setProperty("--text-color", text);
                document.documentElement.classList.toggle("blue-mode", themeEnabled);
              },
              args: [bg, text, themeEnabled]
            });
          }
        });
      });
    });
  }

  function updatePopupTheme(bg, text, themeEnabled) {
    chrome.runtime.sendMessage({ action: "getTabURL" }, (response) => {
      if (response.url) {
        const currentDomain = new URL(response.url).hostname;

        chrome.storage.sync.get(["excludeDomains"], (data) => {
          const excludedSites = data.excludeDomains ? data.excludeDomains.split("\n").filter(Boolean) : [];
          const isExcluded = excludedSites.includes(currentDomain);

          if (!isExcluded) {
            document.body.style.backgroundColor = themeEnabled ? bg : fallbackBg;
            document.body.style.color = themeEnabled ? text : fallbackText;

            document.querySelector(".header h1").style.color = themeEnabled ? text : fallbackText;
            document.querySelector(".header .version").style.color = themeEnabled ? text : fallbackText;
          }
        });
      }
    });
  }

  function updateCurrTabButton() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs.length || tabs[0].url.startsWith("chrome://")) {
        currTab.textContent = "➕ Add Current Tab";
        return;
      }

      const currentDomain = new URL(tabs[0].url).hostname;
      chrome.storage.sync.get(["excludeDomains"], (data) => {
        const excludedSites = data.excludeDomains ? data.excludeDomains.split("\n").filter(Boolean) : [];
        currTab.textContent = excludedSites.includes(currentDomain) ? "❌ Remove Current Tab" : "➕ Add Current Tab";
      });
    });
  }

  currTab.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs.length || tabs[0].url.startsWith("chrome://")) {
        console.warn("Cannot exclude a chrome:// URL.");
        return;
      }

      const currentTab = tabs[0];
      const currentDomain = new URL(currentTab.url).hostname;

      chrome.storage.sync.get(["excludeDomains"], (data) => {
        let excludedSites = data.excludeDomains ? data.excludeDomains.split("\n").filter(Boolean) : [];

        if (excludedSites.includes(currentDomain)) {
          excludedSites = excludedSites.filter(domain => domain !== currentDomain);
          excludeDomainsInput.value = excludedSites.join("\n");

          chrome.storage.sync.set({ excludeDomains: excludeDomainsInput.value }, () => {
            chrome.scripting.executeScript({
              target: { tabId: currentTab.id },
              func: (currentDomain) => {
                document.documentElement.classList.add("blue-mode");
              },
              args: [currentDomain]
            }).catch(err => console.warn("Failed to re-enable Blue Mode:", err));

            currTab.textContent = "➕ Add Current Tab";
          });
        } else {
          excludedSites.push(currentDomain);
          excludeDomainsInput.value = excludedSites.join("\n");

          chrome.storage.sync.set({ excludeDomains: excludeDomainsInput.value }, () => {
            chrome.scripting.executeScript({
              target: { tabId: currentTab.id },
              func: (currentDomain) => {
                document.documentElement.classList.remove("blue-mode");
              },
              args: [currentDomain]
            }).catch(err => console.warn("Failed to apply exclusions:", err));

            currTab.textContent = "❌ Remove Current Tab";
          });
        }
      });
    });
  });

  excludeDomainsInput.addEventListener("input", () => {
    chrome.storage.sync.get(["excludeDomains"], (prevData) => {
      const previousExclusions = prevData.excludeDomains ? prevData.excludeDomains.split("\n").filter(Boolean) : [];

      chrome.storage.sync.set({ excludeDomains: excludeDomainsInput.value }, () => {
        const newExclusions = excludeDomainsInput.value.split("\n").filter(Boolean);

        chrome.tabs.query({}, (tabs) => {
          tabs.forEach((tab) => {
            const currentDomain = new URL(tab.url).hostname;
            const wasExcluded = previousExclusions.includes(currentDomain);
            const isExcludedNow = newExclusions.includes(currentDomain);

            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: (wasExcluded, isExcludedNow) => {
                if (!wasExcluded && isExcludedNow) {
                  document.documentElement.classList.remove("blue-mode");
                } else if (wasExcluded && !isExcludedNow) {
                  document.documentElement.classList.add("blue-mode");
                }
              },
              args: [wasExcluded, isExcludedNow]
            }).catch(err => console.warn("Failed to apply exclusions:", err));
          });
        });
      });
    });
  });

  themeToggle.addEventListener("change", () => {
    const newThemeEnabled = themeToggle.checked;
    chrome.storage.sync.set({ themeEnabled: newThemeEnabled }, () => {
      updatePopupTheme(bgPicker.value, textPicker.value, newThemeEnabled);
      applyColorsToAllTabs(bgPicker.value, textPicker.value, newThemeEnabled);
    });
  });

  bgPicker.addEventListener("input", () => {
    const newBgColor = bgPicker.value;
    chrome.storage.sync.set({ bgColor: newBgColor }, () => {
      updatePopupTheme(newBgColor, textPicker.value, themeToggle.checked);
      applyColorsToAllTabs(newBgColor, textPicker.value, themeToggle.checked);
    });
  });

  textPicker.addEventListener("input", () => {
    const newTextColor = textPicker.value;
    chrome.storage.sync.set({ textColor: newTextColor }, () => {
      updatePopupTheme(bgPicker.value, newTextColor, themeToggle.checked);
      applyColorsToAllTabs(bgPicker.value, newTextColor, themeToggle.checked);
    });
  });

  resetBtn.addEventListener("click", () => {
    chrome.storage.sync.set({ bgColor: fallbackBg, textColor: fallbackText });
    bgPicker.value = fallbackBg;
    textPicker.value = fallbackText;
    updatePopupTheme(fallbackBg, fallbackText, themeToggle.checked);
    applyColorsToAllTabs(fallbackBg, fallbackText, themeToggle.checked);
  });

  exportBtn.addEventListener("click", () => {
    const bstcFormat = `${bgPicker.value}$${textPicker.value}`;
    const blob = new Blob([bstcFormat], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "Bluescale-Settings.bstc";
    a.click();
  });

  importBtn.addEventListener("click", () => {
    importFile.click();
  });

  importFile.setAttribute("title", "Bluescale Theme Controller file *.bstc");

  importFile.addEventListener("change", (event) => {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = function (e) {
      let [background, text] = e.target.result.split("$");
      background = background.trim();
      text = text.trim();
      chrome.storage.sync.set({ bgColor: background, textColor: text });
      bgPicker.value = background;
      textPicker.value = text;
      updatePopupTheme(background, text, themeToggle.checked);
      applyColorsToAllTabs(background, text, themeToggle.checked);
    };
    reader.readAsText(file);
  });

});
