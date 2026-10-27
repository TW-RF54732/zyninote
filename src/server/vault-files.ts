// Serves the vault's plain files (images, PDFs, ...) at `/content/<path>`, the href that resolveLink gives them.
// Notes and components under /content/ are modules imported through Vite, so those are left to Vite.
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, resolve, sep } from "node:path";
import { safeDecode } from "../shared/links.ts";

const TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".bmp": "image/bmp",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".txt": "text/plain; charset=utf-8",
};

/** Handles the request and returns true when it is a GET/HEAD for an existing plain file in the vault. */
export async function serveVaultFile(contentDir: string, req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = req.url ?? "";
  // A query means a Vite module request (`?t=`, `?import`).
  if ((req.method !== "GET" && req.method !== "HEAD") || !url.startsWith("/content/") || url.includes("?")) return false;
  const file = resolve(contentDir, safeDecode(url.slice("/content/".length)));
  const type = TYPES[extname(file).toLowerCase()];
  if (!type || !file.startsWith(contentDir + sep)) return false;
  let size: number;
  try {
    const info = await stat(file);
    if (!info.isFile()) return false;
    size = info.size;
  } catch {
    return false;
  }
  res.setHeader("Content-Type", type);
  res.setHeader("Content-Length", size);
  res.setHeader("Cache-Control", "no-cache");
  if (req.method === "HEAD") res.end();
  else createReadStream(file).pipe(res);
  return true;
}
