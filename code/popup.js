document.addEventListener("DOMContentLoaded", () => {
  const bgPicker = document.getElementById("bgColorPicker");
  const textPicker = document.getElementById("textColorPicker");
  const themeToggle = document.getElementById("themeToggle");
  const resetBtn = document.getElementById("reset");
  const exportBtn = document.getElementById("exportBtn");
  const importBtn = document.getElementById("importBtn");
  const importFile = document.getElementById("importFile");
  const domainToggle = document.getElementById("domainToggle");
  const currentDomainLabel = document.getElementById("currentDomainLabel");
  const headerIcon = document.querySelector(".header img");

  const fallbackBg = "#141e32";
  const fallbackText = "#d2e6ff";
  let currentDomain = "";
  let currentSettings = { bgColor: fallbackBg, textColor: fallbackText, themeEnabled: true, excludeDomains: "" };

  function updateExtensionIcon(isEnabled, isDomainEnabled = true) {
    const iconPrefix = isEnabled
      ? (isDomainEnabled ? "favicon" : "favicon-off")
      : "favicon-disabled";

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length) {
        chrome.runtime.sendMessage({
          type: "updateIcon",
          isEnabled: isEnabled,
          isDomainEnabled: isDomainEnabled,
          tabId: tabs[0].id
        });
      }
    });

    if (headerIcon) {
      headerIcon.src = chrome.runtime.getURL(`icons/${iconPrefix}-48.png`);
    }
  }

  function updateDomainToggleState(themeEnabled) {
    domainToggle.disabled = !themeEnabled;
    domainToggle.parentElement.style.opacity = themeEnabled ? "1" : "0.5";
    domainToggle.parentElement.style.cursor = themeEnabled ? "pointer" : "not-allowed";
  }

  function updatePopupTheme(bg, text, themeEnabled) {
    document.body.style.backgroundColor = themeEnabled ? bg : fallbackBg;
    document.body.style.color = themeEnabled ? text : fallbackText;
    document.querySelector(".header h1").style.color = themeEnabled ? text : fallbackText;
    document.querySelector(".header .version").style.color = themeEnabled ? text : fallbackText;
  }

  function updateCurrentTab() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length && !tabs[0].url.startsWith("chrome://")) {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: (bg, text, themeEnabled) => {
            if (themeEnabled) {
              document.documentElement.style.setProperty("--bg-color", bg);
              document.documentElement.style.setProperty("--text-color", text);
              document.documentElement.classList.add("blue-mode");
            } else {
              document.documentElement.style.removeProperty("--bg-color");
              document.documentElement.style.removeProperty("--text-color");
              document.documentElement.classList.remove("blue-mode");
            }
          },
          args: [currentSettings.bgColor, currentSettings.textColor, currentSettings.themeEnabled]
        }).catch(() => {});
      }
    });
  }

  function initializePopup() {
    chrome.storage.sync.get(["bgColor", "textColor", "themeEnabled", "excludeDomains"], (data) => {
      currentSettings = {
        bgColor: data.bgColor || fallbackBg,
        textColor: data.textColor || fallbackText,
        themeEnabled: data.themeEnabled !== false,
        excludeDomains: data.excludeDomains || ""
      };

      bgPicker.value = currentSettings.bgColor;
      textPicker.value = currentSettings.textColor;
      themeToggle.checked = currentSettings.themeEnabled;
      updateDomainToggleState(currentSettings.themeEnabled);
      updatePopupTheme(currentSettings.bgColor, currentSettings.textColor, currentSettings.themeEnabled);

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length && !tabs[0].url.startsWith("chrome://")) {
          currentDomain = new URL(tabs[0].url).hostname;
          currentDomainLabel.textContent = currentDomain;
          const excludedSites = currentSettings.excludeDomains.split("\n").filter(Boolean);
          const isDomainExcluded = excludedSites.includes(currentDomain);
          domainToggle.checked = !isDomainExcluded;
          updateExtensionIcon(currentSettings.themeEnabled, !isDomainExcluded);
        }
      });
    });
  }

  domainToggle.addEventListener("change", () => {
    if (!currentDomain) return;
    let excludedSites = currentSettings.excludeDomains.split("\n").filter(Boolean);

    if (domainToggle.checked) {
      excludedSites = excludedSites.filter(domain => domain !== currentDomain);
    } else if (!excludedSites.includes(currentDomain)) {
      excludedSites.push(currentDomain);
    }

    currentSettings.excludeDomains = excludedSites.join("\n");
    chrome.storage.sync.set({ excludeDomains: currentSettings.excludeDomains }, () => {
      updateExtensionIcon(currentSettings.themeEnabled, domainToggle.checked);

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length && !tabs[0].url.startsWith("chrome://")) {
          if (domainToggle.checked) {
            chrome.scripting.executeScript({
              target: { tabId: tabs[0].id },
              func: (bg, text) => {
                document.documentElement.style.setProperty("--bg-color", bg);
                document.documentElement.style.setProperty("--text-color", text);
                document.documentElement.classList.add("blue-mode");
              },
              args: [currentSettings.bgColor, currentSettings.textColor]
            }).catch(() => {});
          } else {
            chrome.scripting.executeScript({
              target: { tabId: tabs[0].id },
              func: () => {
                document.documentElement.style.removeProperty("--bg-color");
                document.documentElement.style.removeProperty("--text-color");
                document.documentElement.classList.remove("blue-mode");
              }
            }).catch(() => {});
          }
        }
      });
    });
  });

  themeToggle.addEventListener("change", () => {
    currentSettings.themeEnabled = themeToggle.checked;
    chrome.storage.sync.set({ themeEnabled: currentSettings.themeEnabled }, () => {
      updatePopupTheme(currentSettings.bgColor, currentSettings.textColor, currentSettings.themeEnabled);
      updateDomainToggleState(currentSettings.themeEnabled);
      const excludedSites = currentSettings.excludeDomains.split("\n").filter(Boolean);
      const isDomainEnabled = !excludedSites.includes(currentDomain);
      updateExtensionIcon(currentSettings.themeEnabled, isDomainEnabled);

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length && !tabs[0].url.startsWith("chrome://")) {
          if (currentSettings.themeEnabled && !excludedSites.includes(currentDomain)) {
            chrome.scripting.executeScript({
              target: { tabId: tabs[0].id },
              func: (bg, text) => {
                document.documentElement.style.setProperty("--bg-color", bg);
                document.documentElement.style.setProperty("--text-color", text);
                document.documentElement.classList.add("blue-mode");
              },
              args: [currentSettings.bgColor, currentSettings.textColor]
            }).catch(() => {});
          } else {
            chrome.scripting.executeScript({
              target: { tabId: tabs[0].id },
              func: () => {
                document.documentElement.style.removeProperty("--bg-color");
                document.documentElement.style.removeProperty("--text-color");
                document.documentElement.classList.remove("blue-mode");
              }
            }).catch(() => {});
          }
        }
      });
    });
  });

  bgPicker.addEventListener("input", () => {
    currentSettings.bgColor = bgPicker.value;
    chrome.storage.sync.set({ bgColor: currentSettings.bgColor }, () => {
      updatePopupTheme(currentSettings.bgColor, currentSettings.textColor, currentSettings.themeEnabled);
      updateCurrentTab();
    });
  });

  textPicker.addEventListener("input", () => {
    currentSettings.textColor = textPicker.value;
    chrome.storage.sync.set({ textColor: currentSettings.textColor }, () => {
      updatePopupTheme(currentSettings.bgColor, currentSettings.textColor, currentSettings.themeEnabled);
      updateCurrentTab();
    });
  });

  resetBtn.addEventListener("click", () => {
    currentSettings.bgColor = fallbackBg;
    currentSettings.textColor = fallbackText;
    chrome.storage.sync.set({ bgColor: fallbackBg, textColor: fallbackText }, () => {
      bgPicker.value = fallbackBg;
      textPicker.value = fallbackText;
      updatePopupTheme(fallbackBg, fallbackText, currentSettings.themeEnabled);
      updateCurrentTab();
    });
  });

  exportBtn.addEventListener("click", () => {
    const blob = new Blob([`${currentSettings.bgColor}$${currentSettings.textColor}`], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "Bluescale-Settings.bstc";
    a.click();
  });

  importBtn.addEventListener("click", () => importFile.click());

  importFile.addEventListener("change", (event) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      let [background, text] = e.target.result.split("$");
      currentSettings.bgColor = background.trim();
      currentSettings.textColor = text.trim();
      chrome.storage.sync.set({ bgColor: currentSettings.bgColor, textColor: currentSettings.textColor }, () => {
        bgPicker.value = currentSettings.bgColor;
        textPicker.value = currentSettings.textColor;
        updatePopupTheme(currentSettings.bgColor, currentSettings.textColor, currentSettings.themeEnabled);
        updateCurrentTab();
      });
    };
    reader.readAsText(event.target.files[0]);
  });

  initializePopup();
});