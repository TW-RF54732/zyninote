// Link resolution shared by the Markdown/MDX pipeline, the TSX <Link> component, the segmenter and the link checker.
// Pure string logic (no node:path) so it runs in the browser too.

export const NOTE_EXT = /\.(md|mdx|tsx)$/;

export type ResolvedLink =
  | {
      kind: "page";
      /** "subject/slug" for a note, "subject/" for a subject page, "" for the root page. */
      page: string;
      /** Heading id after `#`, if any. */
      id?: string;
      href: string;
    }
  | {
      kind: "file";
      /** Content-relative path of a non-note file (image, PDF...). */
      file: string;
      href: string;
    }
  | { kind: "error"; error: "outside" | "absolute" };

/** True for links that leave the notes entirely (`https:`, `mailto:`, protocol-relative `//`). These are never resolved. */
export function isExternal(href: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//");
}

/**
 * Resolves `ref` (as written in a note, e.g. `ch2-tcp.mdx#tcp-flags` or `../calculus/`) relative to the note at
 * content-relative path `from`. Paths must be relative and must stay inside content/.
 */
export function resolveLink(from: string, ref: string): ResolvedLink {
  const hash = ref.indexOf("#");
  const pathPart = hash < 0 ? ref : ref.slice(0, hash);
  const id = hash < 0 ? undefined : ref.slice(hash + 1) || undefined;

  if (pathPart.startsWith("/") || pathPart.startsWith("\\")) return { kind: "error", error: "absolute" };

  let segments: string[];
  if (pathPart === "") {
    segments = from.split("/");
  } else {
    segments = from.split("/").slice(0, -1);
    for (const part of pathPart.split("/")) {
      if (part === "" || part === ".") continue;
      if (part === "..") {
        if (!segments.length) return { kind: "error", error: "outside" };
        segments.pop();
      } else {
        segments.push(part);
      }
    }
  }

  const page = pageKey(segments);
  if (page === null) {
    const file = segments.join("/");
    return { kind: "file", file, href: `/content/${encodePath(file)}` };
  }
  return { kind: "page", page, ...(id ? { id } : {}), href: pageUrl(page, id) };
}

/** Page key of a content-relative note path, e.g. "cn/ch1-intro.md" → "cn/ch1-intro", "cn/_subject.md" → "cn/". */
export function pageKeyOf(path: string): string {
  return pageKey(path.split("/")) ?? path;
}

export function pageUrl(page: string, id?: string): string {
  return `/${encodePath(page)}${id ? `#${encodeURIComponent(id)}` : ""}`;
}

/** Inverse of pageUrl for a same-origin pathname; null when the pathname is not a page (e.g. /content/ files). */
export function pageKeyFromPathname(pathname: string): string | null {
  if (pathname.startsWith("/content/")) return null;
  const segments = pathname.slice(1).split("/").map(safeDecode);
  if (segments.length > 2 || (segments.length === 2 && segments[0] === "")) return null;
  // "/subject" and "/subject/" are the same page.
  return segments.length === 1 && segments[0] ? `${segments[0]}/` : segments.join("/");
}

/** Decodes percent-escapes, leaving malformed input as is. */
export function safeDecode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

function pageKey(segments: string[]): string | null {
  if (segments.length === 0) return "";
  if (segments.length === 1) return segments[0].includes(".") ? null : `${segments[0]}/`;
  if (segments.length !== 2) return null;
  const [subject, name] = segments;
  if (name === "_subject.md") return `${subject}/`;
  const match = NOTE_EXT.exec(name);
  if (match) return `${subject}/${name.slice(0, match.index)}`;
  // Extension-less names refer to a note by its URL slug.
  return name.includes(".") ? null : `${subject}/${name}`;
}

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}
