const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");

ipcMain.on("mob-timer:expiry-open", (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) return;

  window.setAlwaysOnTop(true, "screen-saver");
  window.show();
  window.focus();
  window.moveTop();
});

ipcMain.on("mob-timer:expiry-close", (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || window.isDestroyed()) return;

  window.setAlwaysOnTop(false);
});

function createWindow() {
  const window = new BrowserWindow({
    width: 900,
    height: 760,
    minWidth: 620,
    minHeight: 620,
    backgroundColor: "#111827",
    title: "Mobby",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  window.loadFile(path.join(__dirname, "index.html"));
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
