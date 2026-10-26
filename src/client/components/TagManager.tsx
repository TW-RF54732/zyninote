import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import type { NoteSummary, SubjectSummary } from "../../shared/types.ts";
import { registerTag, removeTag, renameTag } from "../data.ts";
import { Dialog } from "./Dialog.tsx";

type Row = { tag: string; registered: boolean; notes: NoteSummary[] };
type Confirm = { title: string; body: string; action: string; run: () => Promise<unknown> };

/** A subject's tags: the registry from _subject.md plus tags notes use without registering, with rename, merge and removal. */
export function TagManager({ subject }: { subject: SubjectSummary }) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const registry = subject.meta.tags;
  const used = [...new Set(subject.notes.flatMap((n) => n.meta.tags))].filter((t) => !registry.includes(t));
  const rows: Row[] = [...registry, ...used].map((tag) => ({ tag, registered: registry.includes(tag), notes: subject.notes.filter((n) => n.meta.tags.includes(tag)) }));

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const rename = (row: Row, raw: string) => {
    const to = raw.trim();
    if (!to || to === row.tag) return setRenaming(null);
    const target = rows.find((r) => r.tag === to);
    const go = () => run(() => renameTag(subject.name, row.tag, to)).then((ok) => ok && setRenaming(null));
    if (!target) return void go();
    // Merging cannot be undone by renaming back, so it asks first.
    setConfirm({
      title: "合併 tag",
      body: `「${row.tag}」（${row.notes.length} 篇）會併入既有的「${to}」（${target.notes.length} 篇），之後無法再分開。`,
      action: "合併",
      run: go,
    });
  };

  const remove = (row: Row) =>
    setConfirm({
      title: "移除 tag",
      body: row.notes.length ? `會從 ${row.notes.length} 篇筆記${row.registered ? "與 _subject.md " : ""}移除「${row.tag}」。` : `會從 _subject.md 移除「${row.tag}」。`,
      action: "移除",
      run: () => run(() => removeTag(subject.name, row.tag)),
    });

  const register = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const tag = String(new FormData(form).get("tag") ?? "").trim();
    if (tag && (await run(() => registerTag(subject.name, tag)))) form.reset();
  };

  return (
    <section className="tag-manager" aria-labelledby="tag-manager-title">
      <div className="directory-heading">
        <h2 id="tag-manager-title">Tag</h2>
        <span className="card-meta">{registry.length} 個已註冊</span>
      </div>
      <ul className="tag-rows">
        {rows.map((row) => (
          <li key={row.tag} className="tag-row">
            <div className="tag-row-name">
              {renaming === row.tag ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    rename(row, String(new FormData(event.currentTarget).get("name") ?? ""));
                  }}
                >
                  <input
                    name="name"
                    defaultValue={row.tag}
                    autoFocus
                    aria-label={`「${row.tag}」的新名稱（輸入既有 tag 會合併）`}
                    onFocus={(event) => event.currentTarget.select()}
                    onKeyDown={(event) => event.key === "Escape" && setRenaming(null)}
                    disabled={busy}
                  />
                </form>
              ) : (
                <span className="tag-row-tag">{row.tag}</span>
              )}
              {!row.registered && <span className="tag-row-flag">未註冊</span>}
              <span className="card-meta">{row.notes.length} 篇</span>
              <span className="tag-row-actions">
                {!row.registered && (
                  <button type="button" disabled={busy} onClick={() => void run(() => registerTag(subject.name, row.tag))}>
                    註冊
                  </button>
                )}
                <button type="button" disabled={busy} onClick={() => setRenaming(renaming === row.tag ? null : row.tag)}>
                  {renaming === row.tag ? "取消" : "改名"}
                </button>
                <button type="button" disabled={busy} onClick={() => remove(row)}>
                  移除
                </button>
              </span>
            </div>
            {row.notes.length > 0 && (
              <ul className="tag-row-notes">
                {row.notes.map((note) => (
                  <li key={note.slug}>
                    <Link href={note.url}>{note.meta.title}</Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      <form className="tag-register" onSubmit={(event) => void register(event)}>
        <input name="tag" placeholder="註冊新 tag" aria-label="註冊新 tag" disabled={busy} />
      </form>
      {renaming && <p className="tag-hint">輸入既有的 tag 名稱會把兩個 tag 合併。</p>}
      {error && <p className="tag-error">{error}</p>}
      {confirm && (
        <Dialog
          title={confirm.title}
          confirm={confirm.action}
          onConfirm={() => {
            void confirm.run();
            setConfirm(null);
          }}
          onClose={() => setConfirm(null)}
        >
          <p>{confirm.body}</p>
        </Dialog>
      )}
    </section>
  );
}
