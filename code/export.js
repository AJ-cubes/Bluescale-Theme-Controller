function exportSettings() {
  chrome.storage.local.get(["custom_colors"], (data) => {
    if (data.custom_colors) {
      const bstcFormat = `${data.custom_colors.background}$${data.custom_colors.text}`;
      const blob = new Blob([bstcFormat], { type: "text/plain" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "Bluescale-Settings.bstc";
      a.click();
    }
  });
}