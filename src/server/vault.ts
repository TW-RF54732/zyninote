// Where the notes live. The app (src/, node_modules/) and the vault (subjects, cheat sheets, cache) are separate:
// the vault is any folder, picked at startup.
//
// Priority: `--vault <path>` > ZYNINOTE_VAULT > last vault opened > ./content (the bundled test data).
import { existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const APP_DIR = join(homedir(), ".zyninote");
const LAST_FILE = join(APP_DIR, "last.json");

function argVault(): string | undefined {
  const args = process.argv.slice(2);
  const i = args.indexOf("--vault");
  if (i >= 0) return args[i + 1];
  return args.find((a) => a.startsWith("--vault="))?.slice("--vault=".length);
}

function lastVault(): string | undefined {
  try {
    return (JSON.parse(readFileSync(LAST_FILE, "utf8")) as { vault?: string }).vault;
  } catch {
    return undefined;
  }
}

function isDir(path: string) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/** `npm run` switches to the package folder; relative paths are meant from where the command was typed. */
function fromCwd(path: string) {
  return resolve(process.env.INIT_CWD ?? process.cwd(), path);
}

/** Resolves the vault folder. `root` is the app folder, whose content/ is the fallback. */
export function resolveVault(root: string): string {
  const explicit = argVault() ?? process.env.ZYNINOTE_VAULT;
  if (explicit) {
    const path = fromCwd(explicit);
    if (!isDir(path)) throw new Error(`[zyninote] 找不到 vault 資料夾：${path}`);
    return realpathSync(path);
  }
  const last = lastVault();
  if (last && isDir(last)) return realpathSync(last);
  const fallback = join(root, "content");
  if (isDir(fallback)) return realpathSync(fallback);
  throw new Error("[zyninote] 沒有指定 vault，請用 --vault <資料夾> 或 ZYNINOTE_VAULT 指定");
}

/**
 * Remembers the vault for the next start without --vault. Failure only costs the convenience.
 * Also records the app folder, so an agent working inside the vault can find the skill, runtime and checker.
 */
export function rememberVault(vault: string, app: string) {
  try {
    mkdirSync(APP_DIR, { recursive: true });
    writeFileSync(LAST_FILE, `${JSON.stringify({ vault, app }, null, 2)}\n`);
  } catch {}
}

/** The vault's own state folder (cache now; settings later). */
export function vaultStateDir(vault: string): string {
  const dir = join(vault, ".zyninote");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}
