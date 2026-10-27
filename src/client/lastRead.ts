/** Where the reader last was in a subject: the note and the section at the top of the screen. */
export type LastRead = { slug: string; section: string | null; /** ms since epoch; 0 for records written before it existed. */ at: number };

const key = (subject: string) => `zyninote:last-read:${subject}`;

// A per-browser convenience: without storage the subject page just shows no resume button.
export function readLastRead(subject: string): LastRead | null {
  try {
    const raw = localStorage.getItem(key(subject));
    const parsed = raw ? (JSON.parse(raw) as Partial<LastRead>) : null;
    return typeof parsed?.slug === "string"
      ? { slug: parsed.slug, section: typeof parsed.section === "string" ? parsed.section : null, at: typeof parsed.at === "number" ? parsed.at : 0 }
      : null;
  } catch {
    return null;
  }
}

export function writeLastRead(subject: string, value: Omit<LastRead, "at">) {
  try {
    localStorage.setItem(key(subject), JSON.stringify({ ...value, at: Date.now() }));
  } catch {
    // Storage may be unavailable (private mode).
  }
}
