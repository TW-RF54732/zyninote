import { createContext } from "react";

/**
 * Content-relative path of the note being rendered (e.g. "computer-network/ch3-routing.tsx").
 * Provided by both the server renderer and the client, so relative `<Link to>` paths resolve identically.
 */
export const NoteContext = createContext<string | null>(null);
