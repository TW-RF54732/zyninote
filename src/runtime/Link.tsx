import { useContext, type ReactNode } from "react";
import { isExternal, resolveLink } from "../shared/links.ts";
import { NoteContext } from "./NoteContext.ts";

type LinkProps = {
  /** Relative path like Markdown links: "ch2-tcp.mdx#tcp-flags", "../calculus/ch1-limits.md". */
  to: string;
  /** Render like a wikilink (link styling only while Ctrl/Cmd is held). */
  quiet?: boolean;
  children?: ReactNode;
};

/**
 * Links in .tsx notes. Emits the same markup as Markdown links and wikilinks, so the link is
 * resolved, checked, previewable and counted in backlinks. Paths are relative to the note.
 */
export function Link({ to, quiet = false, children }: LinkProps) {
  const from = useContext(NoteContext) ?? "";
  if (isExternal(to)) return <a href={to}>{children ?? to}</a>;
  const target = resolveLink(from, to);
  return (
    <a className="zn-link" data-zn-link={quiet ? "quiet" : "visible"} data-zn-ref={to} href={target.kind === "error" ? undefined : target.href}>
      {children ?? to}
    </a>
  );
}
