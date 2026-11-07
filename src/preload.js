const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mobTimerWindow", Object.freeze({
  bringExpiryToFront: () => ipcRenderer.send("mob-timer:expiry-open"),
  releaseExpiryToFront: () => ipcRenderer.send("mob-timer:expiry-close"),
  setFullScreen: (shouldFullScreen) => ipcRenderer.send("mob-timer:set-fullscreen", shouldFullScreen),
  minimizeWindow: () => ipcRenderer.send("mob-timer:minimize-window"),
  minimizeSessionWindow: () => ipcRenderer.send("mob-timer:minimize-window"),
  fullScreen: (shouldFullScreen) => ipcRenderer.send("mob-timer:set-fullscreen", shouldFullScreen)
}));
