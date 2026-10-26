import { useEffect } from "react";
import { Link } from "wouter";
import type { Diagnostic, Tree } from "../../shared/types.ts";
import { useTree } from "../data.ts";

/** Every diagnostic from the last sync (layout, rendering, duplicate ids, links), grouped by file. */
export function ProblemsPage() {
  const { data: tree, error } = useTree();

  useEffect(() => {
    document.title = "問題列表 — Zyninote";
  }, []);

  if (error) return <p className="zn-error">{error}</p>;
  if (!tree) return null;

  const groups = new Map<string, Diagnostic[]>();
  for (const d of tree.diagnostics) groups.set(d.path, [...(groups.get(d.path) ?? []), d]);
  const errors = tree.diagnostics.filter((d) => d.level === "error").length;

  return (
    <>
      <div className="page-intro">
        <p className="eyebrow">檢查</p>
        <h1>問題列表</h1>
        <p className="lead">{tree.diagnostics.length ? `${errors} 個錯誤，${tree.diagnostics.length - errors} 個警告` : "沒有問題。"}</p>
      </div>
      <ul className="problem-list">
        {[...groups].map(([path, diagnostics]) => {
          const url = urlOf(tree, path);
          return (
            <li key={path}>
              {url ? (
                <Link href={url} className="problem-path">
                  {path}
                </Link>
              ) : (
                <span className="problem-path">{path}</span>
              )}
              <ul>
                {diagnostics.map((d, i) => (
                  <li key={i} className="problem" data-level={d.level}>
                    <span className="problem-level">{d.level === "error" ? "錯誤" : "警告"}</span>
                    <span>{d.message}</span>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function urlOf(tree: Tree, path: string): string | null {
  for (const subject of tree.subjects) {
    if (path === subject.name || path === `${subject.name}/_subject.md`) return subject.url;
    const note = subject.notes.find((n) => n.path === path);
    if (note) return note.url;
  }
  return null;
}
