import { useId, useRef, useState, type KeyboardEvent } from "react";
import { setNoteTags } from "../data.ts";
import { Dialog } from "./Dialog.tsx";
import { Tags } from "./Tags.tsx";

type Props = {
  subject: string;
  slug: string;
  tags: string[];
  /** Tags registered in the subject's _subject.md, offered as completions. */
  registered: string[];
};

/** A note's tags with an edit mode: remove, add with completion from the subject's registry, then save once. */
export function TagEditor({ subject, slug, tags, registered }: Props) {
  const [draft, setDraft] = useState<string[] | null>(null);
  // Unregistered tags the user already agreed to register.
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [asking, setAsking] = useState<{ tags: string[]; then: () => void } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!draft) {
    return (
      <div className="tag-line">
        <Tags tags={tags} />
        <button type="button" className="tag-edit-toggle" onClick={() => (setDraft(tags), setConfirmed(new Set()), setError(null))}>
          {tags.length ? "編輯 tag" : "加入 tag"}
        </button>
      </div>
    );
  }

  const isNew = (tag: string) => !registered.includes(tag) && !confirmed.has(tag);
  const add = (tag: string) => {
    if (draft.includes(tag)) return;
    const accept = () => {
      setConfirmed((set) => new Set(set).add(tag));
      setDraft((list) => (list && !list.includes(tag) ? [...list, tag] : list));
    };
    if (isNew(tag)) setAsking({ tags: [tag], then: accept });
    else accept();
  };

  const save = async () => {
    if (draft.length === tags.length && draft.every((t, i) => t === tags[i])) {
      setDraft(null);
      return;
    }
    // Tags the note already had without being registered also need a yes before they are registered.
    const unasked = draft.filter(isNew);
    if (unasked.length) {
      setAsking({ tags: unasked, then: () => void write(draft) });
      return;
    }
    await write(draft);
  };

  const write = async (list: string[]) => {
    setSaving(true);
    setError(null);
    try {
      await setNoteTags(subject, slug, list, list.some((t) => !registered.includes(t)));
      setDraft(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="tag-editor" onKeyDown={(event) => event.key === "Escape" && !asking && !saving && setDraft(null)}>
      <ul className="tags" aria-label="標籤">
        {draft.map((tag) => (
          <li key={tag} className={registered.includes(tag) ? undefined : "tag-unregistered"} title={registered.includes(tag) ? undefined : "尚未註冊"}>
            {tag}
            <button type="button" className="tag-remove" aria-label={`移除 ${tag}`} onClick={() => setDraft(draft.filter((t) => t !== tag))}>
              ×
            </button>
          </li>
        ))}
        <li className="tag-input-item">
          <TagInput options={registered.filter((t) => !draft.includes(t))} onAdd={add} onRemoveLast={() => setDraft(draft.slice(0, -1))} />
        </li>
      </ul>
      <div className="tag-editor-actions">
        <button type="button" className="tag-save" disabled={saving} onClick={() => void save()}>
          {saving ? "儲存中…" : "儲存"}
        </button>
        <button type="button" disabled={saving} onClick={() => setDraft(null)}>
          取消
        </button>
        {error && <span className="tag-error">{error}</span>}
      </div>
      {asking && (
        <Dialog
          title="註冊新 tag"
          confirm="註冊並使用"
          onConfirm={() => {
            asking.then();
            setAsking(null);
          }}
          onClose={() => setAsking(null)}
        >
          <p>以下 tag 還沒有在本科目註冊，儲存時會一併加入 _subject.md：</p>
          <ul>
            {asking.tags.map((tag) => (
              <li key={tag}>{tag}</li>
            ))}
          </ul>
          {registered.length > 0 && <p className="tag-dialog-hint">已註冊：{registered.join("、")}</p>}
        </Dialog>
      )}
    </div>
  );
}

/** Text input completing from `options`; Enter or a comma adds what is typed or the highlighted completion. */
function TagInput({ options, onAdd, onRemoveLast }: { options: string[]; onAdd: (tag: string) => void; onRemoveLast: () => void }) {
  const [text, setText] = useState("");
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const typed = text.trim().toLowerCase();
  const matches = options.filter((t) => t.toLowerCase().includes(typed)).sort((a, b) => Number(!a.toLowerCase().startsWith(typed)) - Number(!b.toLowerCase().startsWith(typed)));
  const showList = open && matches.length > 0;

  const commit = (tag: string) => {
    const value = tag.trim();
    if (!value) return;
    onAdd(value);
    setText("");
    setActive(-1);
    inputRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      if (matches.length) setActive((i) => (event.key === "ArrowDown" ? (i + 1) % matches.length : i <= 0 ? matches.length - 1 : i - 1));
    } else if (event.key === "Enter" || event.key === "," || event.key === "，") {
      event.preventDefault();
      commit(showList && active >= 0 ? matches[active] : text);
    } else if (event.key === "Backspace" && !text) {
      onRemoveLast();
    } else if (event.key === "Escape" && showList) {
      event.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <span className="tag-input">
      <input
        ref={inputRef}
        autoFocus
        value={text}
        placeholder="新增 tag"
        aria-label="新增 tag"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        onChange={(event) => {
          setText(event.target.value);
          setActive(-1);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <ul className="tag-suggestions" id={listId} role="listbox" aria-label="已註冊的 tag">
          {matches.map((tag, i) => (
            <li
              key={tag}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // Keep focus in the input so the list does not close before the click lands.
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => commit(tag)}
              onMouseMove={() => setActive(i)}
            >
              {tag}
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}
