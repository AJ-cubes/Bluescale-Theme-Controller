function importSettings(file) {
  const reader = new FileReader();
  reader.onload = function (event) {
    const importedData = event.target.result.split("$");
    const newSettings = {
      custom_colors: {
        background: importedData[0],
        text: importedData[1]
      }
    };
    chrome.storage.local.set(newSettings, () => {
      console.log("Colors imported successfully!");
    });
  };
  reader.readAsText(file);
}