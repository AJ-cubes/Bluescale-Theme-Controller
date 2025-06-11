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
    bgPicker.value = data.bgColor || fallbackBg;
    textPicker.value = data.textColor || fallbackText;
    themeToggle.checked = data.themeEnabled !== false;
    excludeDomainsInput.value = data.excludeDomains || "";

    updatePopupTheme(bgPicker.value, textPicker.value, themeToggle.checked);
    applyColorsToAllTabs(bgPicker.value, textPicker.value, themeToggle.checked);
  });

  function applyColorsToAllTabs(bg, text, themeEnabled) {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (bg, text, themeEnabled) => {
            document.documentElement.style.setProperty("--bg-color", bg);
            document.documentElement.style.setProperty("--text-color", text);
            document.documentElement.classList.toggle("blue-mode", themeEnabled);
          },
          args: [bg, text, themeEnabled]
        });
      });
    });
  }

  function updatePopupTheme(bg, text, themeEnabled) {
    document.body.style.backgroundColor = themeEnabled ? bg : fallbackBg;
    document.body.style.color = themeEnabled ? text : fallbackText;
  }

  bgPicker.addEventListener("input", () => {
    chrome.storage.sync.set({ bgColor: bgPicker.value });
    updatePopupTheme(bgPicker.value, textPicker.value, themeToggle.checked);
    applyColorsToAllTabs(bgPicker.value, textPicker.value, themeToggle.checked);
  });

  textPicker.addEventListener("input", () => {
    chrome.storage.sync.set({ textColor: textPicker.value });
    updatePopupTheme(bgPicker.value, textPicker.value, themeToggle.checked);
    applyColorsToAllTabs(bgPicker.value, textPicker.value, themeToggle.checked);
  });

  themeToggle.addEventListener("change", () => {
    chrome.storage.sync.set({ themeEnabled: themeToggle.checked });
    updatePopupTheme(bgPicker.value, textPicker.value, themeToggle.checked);
    applyColorsToAllTabs(bgPicker.value, textPicker.value, themeToggle.checked);
  });

  excludeDomainsInput.addEventListener("input", () => {
    chrome.storage.sync.set({ excludeDomains: excludeDomainsInput.value });
  });

  currTab.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "getTabURL" }, (response) => {
      if (response.url) {
        const urlObj = new URL(response.url);
        excludeDomainsInput.value += "\n" + urlObj.hostname;
      }
    });
  });

  resetBtn.addEventListener("click", () => {
    chrome.storage.sync.set({ bgColor: fallbackBg, textColor: fallbackText });
    bgPicker.value = fallbackBg;
    textPicker.value = fallbackText;
    updatePopupTheme(fallbackBg, fallbackText, themeToggle.checked);
    applyColorsToAllTabs(fallbackBg, fallbackText, themeToggle.checked);
  });

  // 🔹 Export Colors
  exportBtn.addEventListener("click", () => {
    const bstcFormat = `${bgPicker.value}$${textPicker.value}`;
    const blob = new Blob([bstcFormat], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "Bluescale-Settings.bstc";
    a.click();
  });

  // 🔹 Import Colors (Trigger File Picker)
  importBtn.addEventListener("click", () => {
    importFile.click();
  });

  importFile.setAttribute("title", "Bluescale Theme Controller file *.bstc");

  importFile.addEventListener("change", (event) => {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = function (e) {
      const [background, text] = e.target.result.split("$");
      chrome.storage.sync.set({ bgColor: background, textColor: text });
      bgPicker.value = background;
      textPicker.value = text;
      updatePopupTheme(background, text, themeToggle.checked);
      applyColorsToAllTabs(background, text, themeToggle.checked);
    };
    reader.readAsText(file);
  });
});