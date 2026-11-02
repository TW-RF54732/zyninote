// Temporary desktop shell (self-use): runs the dev server from this repo in the background and shows it in a window.
// No packaging; see README. The server is the unchanged `src/server/main.ts`, run with Electron's own Node.
import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from "electron";

const repo = dirname(dirname(fileURLToPath(import.meta.url)));
const PORT = 5181;
const ORIGIN = `http://localhost:${PORT}`;

/** @type {BrowserWindow | undefined} */
let win;
/** @type {import("node:child_process").ChildProcess | undefined} */
let server;
let vault = "";
let quitting = false;

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });
  app.whenReady().then(() => {
    buildMenu();
    createWindow();
    startServer([]);
  });
}

function log() {
  const dir = app.getPath("logs");
  mkdirSync(dir, { recursive: true });
  return createWriteStream(join(dir, "server.log"), { flags: "a" });
}

/** Starts the server; resolves nothing, loads the window once the server says it is listening. */
function startServer(extraArgs) {
  const out = log();
  out.write(`\n--- ${new Date().toISOString()} ${extraArgs.join(" ")}\n`);
  let ready = false;
  let tail = "";
  const child = spawn(process.execPath, ["--import", "tsx", "src/server/main.ts", ...extraArgs], {
    cwd: repo,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", PORT: String(PORT) },
    windowsHide: true,
  });
  server = child;
  const onData = (chunk) => {
    const text = chunk.toString();
    out.write(text);
    tail = (tail + text).slice(-3000);
    // Match on the tail: a line can be split across chunks.
    const v = tail.match(/\[zyninote\] vault：(.+)\r?\n/);
    if (v) vault = v[1].trim();
    if (!ready && tail.includes(`[zyninote] http://localhost:`)) {
      ready = true;
      win?.loadURL(`${ORIGIN}/`);
    }
  };
  child.stdout.on("data", onData);
  child.stderr.on("data", onData);
  child.on("exit", (code) => {
    out.end();
    if (server !== child || quitting) return;
    server = undefined;
    dialog.showErrorBox(ready ? "Zyninote server 已停止" : "Zyninote 啟動失敗", `exit code ${code}\n\n${tail}`);
    app.quit();
  });
}

function stopServer() {
  const child = server;
  server = undefined;
  if (!child || child.exitCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    child.once("exit", resolve);
    child.kill();
  });
}

function createWindow() {
  // No native title bar or menu bar: the page's top bar slides in when the mouse reaches the top edge (Zen-style) and
  // carries the window buttons and the menu (src/client/shell.ts). Menu accelerators still work.
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    backgroundColor: "#141414",
    show: false,
    title: "Zyninote",
    titleBarStyle: "hidden",
    autoHideMenuBar: true,
    webPreferences: { preload: join(repo, "electron", "preload.cjs") },
  });
  win.setMenuBarVisibility(false);
  win.on("maximize", () => win?.webContents.send("shell:maximized", true));
  win.on("unmaximize", () => win?.webContents.send("shell:maximized", false));
  win.once("ready-to-show", () => win?.show());
  // Show the window right away anyway; the first index can take a while.
  setTimeout(() => win?.show(), 300);
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(
    `<body style="background:#141414;color:#888;font:16px system-ui;display:grid;place-items:center;height:90vh;-webkit-app-region:drag">索引中…</body>`,
  )}`);
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith(ORIGIN)) return;
    event.preventDefault();
    shell.openExternal(url);
  });
  win.on("closed", () => (win = undefined));
}

ipcMain.on("shell:minimize", () => win?.minimize());
ipcMain.on("shell:maximize", () => (win?.isMaximized() ? win.unmaximize() : win?.maximize()));
ipcMain.on("shell:close", () => win?.close());
ipcMain.on("shell:menu", (_event, x, y) => win && Menu.getApplicationMenu()?.popup({ window: win, x, y }));

async function openVault() {
  if (!win) return;
  const result = await dialog.showOpenDialog(win, { title: "開啟 vault", properties: ["openDirectory"], defaultPath: vault || undefined });
  if (result.canceled || !result.filePaths[0]) return;
  await stopServer();
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(
    `<body style="background:#141414;color:#888;font:16px system-ui;display:grid;place-items:center;height:90vh;-webkit-app-region:drag">索引中…</body>`,
  )}`);
  startServer(["--vault", result.filePaths[0]]);
}

function buildMenu() {
  // No Ctrl+B or "/" accelerators: the app uses those itself.
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "檔案",
        submenu: [
          { label: "開啟 vault…", accelerator: "CmdOrCtrl+O", click: openVault },
          { label: "在檔案總管開啟 vault", click: () => vault && shell.openPath(vault) },
          { type: "separator" },
          { label: "結束", role: "quit" },
        ],
      },
      {
        label: "編輯",
        submenu: [{ role: "undo" }, { role: "redo" }, { type: "separator" }, { role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" }],
      },
      {
        label: "檢視",
        submenu: [
          { role: "reload" },
          { role: "forceReload" },
          { role: "toggleDevTools" },
          { type: "separator" },
          { role: "resetZoom" },
          { role: "zoomIn" },
          { role: "zoomOut" },
          { type: "separator" },
          { role: "togglefullscreen" },
        ],
      },
    ]),
  );
}

app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => {
  quitting = true;
  server?.kill();
});
