const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mobTimerWindow", Object.freeze({
  bringExpiryToFront: () => ipcRenderer.send("mob-timer:expiry-open"),
  releaseExpiryToFront: () => ipcRenderer.send("mob-timer:expiry-close")
}));
