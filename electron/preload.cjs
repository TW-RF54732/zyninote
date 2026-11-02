// Window controls for the frameless shell: the page's top bar draws them (src/client/shell.ts) and calls these.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("zyninoteShell", {
  minimize: () => ipcRenderer.send("shell:minimize"),
  toggleMaximize: () => ipcRenderer.send("shell:maximize"),
  close: () => ipcRenderer.send("shell:close"),
  /** Pops up the app menu (檔案 / 編輯 / 檢視) at a point in the window. */
  menu: (x, y) => ipcRenderer.send("shell:menu", Math.round(x), Math.round(y)),
  onMaximized: (fn) => {
    const listener = (_event, maximized) => fn(maximized);
    ipcRenderer.on("shell:maximized", listener);
    return () => ipcRenderer.off("shell:maximized", listener);
  },
});
