import { createContext, createElement, useContext, type ReactNode } from "react";

const LevelContext = createContext(1);

type SectionProps = {
  id: string;
  title: string;
  /** Collapsed by default, like `{.fold}` in Markdown. */
  fold?: boolean;
  children?: ReactNode;
};

/**
 * A heading block for .tsx notes. Emits the same `<section data-*>` markup as Markdown headings,
 * so it shows up in the TOC, search and cheat sheet. The heading level follows nesting: the outermost is h2.
 */
export function Section({ id, title, fold = false, children }: SectionProps) {
  const level = Math.min(useContext(LevelContext) + 1, 6);
  return (
    <section className="zn-section" data-id={id} data-level={level} data-title={title} data-fold={fold ? "true" : undefined}>
      {createElement(`h${level}`, { id }, title)}
      <LevelContext.Provider value={level}>{children}</LevelContext.Provider>
    </section>
  );
}
