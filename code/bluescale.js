chrome.storage.sync.get(["bgColor", "textColor", "themeEnabled", "excludeDomains"], (data) => {
  const bg = data.bgColor || "#141e32";
  const text = data.textColor || "#d2e6ff";
  const isEnabled = data.themeEnabled !== false;
  const excludedSites = data.excludeDomains ? data.excludeDomains.split("\n") : [];
  const currentDomain = window.location.hostname;

  if (!excludedSites.some(domain => currentDomain.includes(domain))) {
    const style = document.createElement("style");
    style.id = "bluescale-style";
    style.innerHTML = `
      :root {
        --bg-color: ${bg};
        --text-color: ${text};
      }

      html.blue-mode, body.blue-mode {
        background-color: var(--bg-color) !important;
        color: var(--text-color) !important;
      }

      .blue-mode * {
        background-color: var(--bg-color) !important;
        color: var(--text-color) !important;
      }

      .blue-mode *::before,
      .blue-mode *::after {
        color: var(--text-color) !important;
      }
    `;

    document.head.appendChild(style);

    if (isEnabled) {
      document.documentElement.classList.add("blue-mode");
    }
  }
});
