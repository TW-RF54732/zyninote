import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useLocation } from "wouter";
import { cardRefFor, filterCards, moveCard, type CheatFilter, type CheatMode } from "../../shared/cheats.ts";
import { pageKeyFromPathname } from "../../shared/links.ts";
import type { CheatCardView, NoteSummary, TocItem } from "../../shared/types.ts";
import { goTo } from "../behavior/links.ts";
import { removeCheat, reorderCheats, repointCheat, useCheats, usePageByKey, useTree } from "../data.ts";
import { BlockView } from "./BlockView.tsx";

const OPEN_DELAY = 200;
const CLOSE_DELAY = 250;

type StoredFilter = Omit<CheatFilter, "currentPage">;
const DEFAULT_FILTER: StoredFilter = { mode: "sub", chapters: [], tags: [], tagMode: "any" };

const MODES: { mode: CheatMode; label: string; title: string }[] = [
  { mode: "sub", label: "本科目", title: "sub：本科目所有卡片" },
  { mode: "local", label: "本頁", title: "local：來源是目前頁面的卡片" },
  { mode: "advance", label: "篩選", title: "advance：依章節或 tag 篩選" },
];

type Drop = { before: string } | { after: string };

/** The cheat sheet of the subject being read, docked at the right edge of subject and note pages. */
export function CheatPanel() {
  const [location] = useLocation();
  const page = pageKeyFromPathname(location);
  const subject = page?.split("/")[0];
  // The root page and system pages (`/_problems`) belong to no subject.
  if (page === null || !subject || subject.startsWith("_")) return null;
  return <Dock key={subject} subject={subject} currentPage={page} />;
}

/**
 * Collapsed to a `<` handle at the edge. Hovering the handle opens the panel after a short delay and leaving closes it;
 * clicking pins it open (touch screens only use clicks). While pinned on a wide screen, the page makes room for it.
 */
function Dock({ subject, currentPage }: { subject: string; currentPage: string }) {
  const { data: sheet } = useCheats(subject);
  const [pinned, setPinned] = useStored("zyninote:cheats:pinned", false);
  const [hovering, setHovering] = useState(false);
  const timer = useRef(0);
  const pointer = useRef("");
  const open = pinned || hovering;

  useEffect(() => {
    document.documentElement.toggleAttribute("data-cheats-pinned", pinned);
    return () => document.documentElement.removeAttribute("data-cheats-pinned");
  }, [pinned]);

  useEffect(() => {
    if (!hovering || pinned) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setHovering(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hovering, pinned]);

  useEffect(() => () => clearTimeout(timer.current), []);

  // A subject that does not exist (404) has no cheat sheet.
  if (!sheet) return null;

  const isMouse = (event: ReactPointerEvent) => event.pointerType === "mouse";
  const pin = (next: boolean) => {
    clearTimeout(timer.current);
    // Unpinning with the mouse over the dock keeps the panel open until the pointer leaves.
    setHovering(!next && pointer.current === "mouse");
    setPinned(next);
  };
  const later = (fn: () => void, delay: number) => {
    clearTimeout(timer.current);
    timer.current = window.setTimeout(fn, delay);
  };

  return (
    <div
      className="cheat-dock"
      data-open={open || undefined}
      onPointerEnter={(event) => isMouse(event) && clearTimeout(timer.current)}
      onPointerLeave={(event) => isMouse(event) && later(() => setHovering(false), CLOSE_DELAY)}
      onPointerDownCapture={(event) => (pointer.current = event.pointerType)}
    >
      <button
        type="button"
        className="cheat-handle"
        aria-expanded={open}
        aria-pressed={pinned}
        aria-label={pinned ? "取消固定 cheat sheet" : "固定開啟 cheat sheet"}
        title="Cheat sheet"
        onPointerEnter={(event) => isMouse(event) && !open && later(() => setHovering(true), OPEN_DELAY)}
        onClick={() => pin(!pinned)}
      >
        {open ? "›" : "‹"}
      </button>
      {open && <Panel subject={subject} currentPage={currentPage} cards={sheet.cards} fileError={sheet.error} pinned={pinned} onPin={pin} />}
    </div>
  );
}

type PanelProps = {
  subject: string;
  currentPage: string;
  cards: CheatCardView[];
  fileError: string | null;
  pinned: boolean;
  onPin: (pinned: boolean) => void;
};

function Panel({ subject, currentPage, cards: stored, fileError, pinned, onPin }: PanelProps) {
  const { data: tree } = useTree();
  const notes = tree?.subjects.find((s) => s.name === subject)?.notes ?? [];
  const [filter, setFilter] = useStored<StoredFilter>(`zyninote:cheats:${subject}`, DEFAULT_FILTER);
  const [notice, setNotice] = useState<string | null>(null);
  const fail = (error: Error) => setNotice(error.message);

  // Reordering shows the new order at once; the next sheet from the server replaces it.
  const [order, setOrder] = useState<string[] | null>(null);
  useEffect(() => setOrder(null), [stored]);
  const cards = useMemo(() => {
    if (!order) return stored;
    const byId = new Map(stored.map((card) => [card.id, card]));
    return order.flatMap((id) => byId.get(id) ?? []);
  }, [order, stored]);
  const visible = filterCards(cards, { ...filter, currentPage });

  const reorder = (id: string, drop: Drop) => {
    const ids = cards.map((card) => card.id);
    const next = moveCard(ids, id, drop);
    if (next.join("\n") === ids.join("\n")) return;
    setOrder(next);
    reorderCheats(subject, next).catch((error: Error) => {
      setOrder(null);
      fail(error);
    });
  };

  const chapters = [
    ...(cards.some((card) => card.page === `${subject}/`) ? [{ key: `${subject}/`, title: "科目首頁" }] : []),
    ...notes.map((note) => ({ key: `${subject}/${note.slug}`, title: note.meta.title })),
  ];
  const tags = [...new Set(notes.flatMap((note) => note.meta.tags))];
  const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  return (
    <section className="cheat-panel" aria-label="Cheat sheet">
      <header className="cheat-panel-head">
        <div className="cheat-panel-title">
          <h2>Cheat sheet</h2>
          <span className="card-meta">
            {visible.length === cards.length ? cards.length : `${visible.length} / ${cards.length}`}
          </span>
          <button type="button" className="cheat-pin" aria-pressed={pinned} onClick={() => onPin(!pinned)}>
            {pinned ? "取消固定" : "固定"}
          </button>
        </div>
        <div className="cheat-segmented" role="group" aria-label="顯示模式">
          {MODES.map(({ mode, label, title }) => (
            <button key={mode} type="button" title={title} aria-pressed={filter.mode === mode} onClick={() => setFilter({ ...filter, mode })}>
              {label}
            </button>
          ))}
        </div>
        {filter.mode === "advance" && (
          <div className="cheat-filters">
            <ChipGroup label="章節" options={chapters.map((c) => ({ value: c.key, label: c.title }))} selected={filter.chapters} onToggle={(v) => setFilter({ ...filter, chapters: toggle(filter.chapters, v) })} />
            {tags.length > 0 && (
              <ChipGroup label="Tag" options={tags.map((t) => ({ value: t, label: t }))} selected={filter.tags} onToggle={(v) => setFilter({ ...filter, tags: toggle(filter.tags, v) })}>
                <div className="cheat-segmented cheat-tagmode" role="group" aria-label="多個 tag 的組合方式">
                  <button type="button" aria-pressed={filter.tagMode === "any"} onClick={() => setFilter({ ...filter, tagMode: "any" })}>
                    聯集
                  </button>
                  <button type="button" aria-pressed={filter.tagMode === "all"} onClick={() => setFilter({ ...filter, tagMode: "all" })}>
                    交集
                  </button>
                </div>
              </ChipGroup>
            )}
          </div>
        )}
      </header>

      {fileError && <p className="zn-error cheat-notice">_cheats.json 格式錯誤，修正前無法修改：{fileError}</p>}
      {notice && (
        <p className="zn-error cheat-notice" role="alert">
          {notice}
          <button type="button" onClick={() => setNotice(null)} aria-label="關閉訊息">
            ×
          </button>
        </p>
      )}

      <CardList
        cards={visible}
        subject={subject}
        notes={notes}
        onReorder={reorder}
        onError={fail}
        empty={cards.length ? "沒有符合的卡片。" : "還沒有卡片。按標題旁的 + 把區塊加入 cheat sheet。"}
      />
    </section>
  );
}

type ChipGroupProps = {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
  children?: ReactNode;
};

function ChipGroup({ label, options, selected, onToggle, children }: ChipGroupProps) {
  return (
    <div className="cheat-chip-group" role="group" aria-label={label}>
      <span className="cheat-chip-label">{label}</span>
      {options.map((option) => (
        <button key={option.value} type="button" className="cheat-chip" aria-pressed={selected.includes(option.value)} onClick={() => onToggle(option.value)}>
          {option.label}
        </button>
      ))}
      {children}
    </div>
  );
}

type CardListProps = {
  cards: CheatCardView[];
  subject: string;
  notes: NoteSummary[];
  onReorder: (id: string, drop: Drop) => void;
  onError: (error: Error) => void;
  empty: string;
};

/** The visible cards. Dragging a card's handle (mouse or touch) or Alt+↑/↓ on it moves the card among its visible neighbours. */
function CardList({ cards, subject, notes, onReorder, onError, empty }: CardListProps) {
  const listRef = useRef<HTMLOListElement>(null);
  const [drag, setDrag] = useState<{ id: string; startY: number; dy: number; drop: Drop | null } | null>(null);

  const dropAt = (id: string, y: number): Drop | null => {
    const others = [...(listRef.current?.querySelectorAll<HTMLElement>(":scope > [data-card]") ?? [])].filter((el) => el.dataset.card !== id);
    const index = others.filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.top + rect.height / 2 < y;
    }).length;
    if (index < others.length) return { before: others[index].dataset.card! };
    return others.length ? { after: others[others.length - 1].dataset.card! } : null;
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>, id: string) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ id, startY: event.clientY, dy: 0, drop: null });
  };
  const onPointerMove = (event: ReactPointerEvent) => {
    if (!drag) return;
    const list = listRef.current?.parentElement;
    if (list) {
      // Scroll the panel when dragging near its edges.
      const rect = list.getBoundingClientRect();
      if (event.clientY < rect.top + 48) list.scrollTop -= 14;
      else if (event.clientY > rect.bottom - 48) list.scrollTop += 14;
    }
    setDrag({ ...drag, dy: event.clientY - drag.startY, drop: dropAt(drag.id, event.clientY) });
  };
  const onPointerUp = () => {
    if (drag?.drop) onReorder(drag.id, drag.drop);
    setDrag(null);
  };

  const onKeyDown = (event: ReactKeyboardEvent, index: number) => {
    if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
    event.preventDefault();
    const id = cards[index].id;
    if (event.key === "ArrowUp" && index > 0) onReorder(id, { before: cards[index - 1].id });
    if (event.key === "ArrowDown" && index < cards.length - 1) onReorder(id, { after: cards[index + 1].id });
  };

  if (!cards.length) return <p className="cheat-empty">{empty}</p>;
  return (
    <ol className="cheat-list" ref={listRef} data-dragging={drag ? "" : undefined}>
      {cards.map((card, i) => {
        const dropSide = drag?.drop && ("before" in drag.drop ? drag.drop.before === card.id && "before" : drag.drop.after === card.id && "after");
        return (
          <li
            key={card.id}
            className="cheat-card"
            data-card={card.id}
            data-drop={dropSide || undefined}
            data-dragged={drag?.id === card.id || undefined}
            style={drag?.id === card.id ? { transform: `translateY(${drag.dy}px)` } : undefined}
          >
            <div className="cheat-card-head">
              <button
                type="button"
                className="cheat-drag"
                aria-label="拖動排序（Alt+↑／↓）"
                title="拖動排序（Alt+↑／↓）"
                onPointerDown={(event) => onPointerDown(event, card.id)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={() => setDrag(null)}
                onKeyDown={(event) => onKeyDown(event, i)}
              >
                ⠿
              </button>
              {card.url && !card.problem ? (
                <a
                  className="cheat-card-title"
                  href={card.url}
                  onClick={(event) => {
                    if (event.ctrlKey || event.metaKey || event.shiftKey) return;
                    event.preventDefault();
                    goTo(card.url!);
                  }}
                >
                  <span className="cheat-card-page">{card.pageTitle}</span>
                  <span className="cheat-card-section">{card.sectionTitle}</span>
                </a>
              ) : (
                <span className="cheat-card-title cheat-card-ref">{card.ref}</span>
              )}
              <button type="button" className="cheat-remove" aria-label="移除卡片" title="移除卡片" onClick={() => removeCheat(subject, card.id).catch(onError)}>
                ×
              </button>
            </div>
            {card.problem ? <InvalidCard card={card} subject={subject} notes={notes} onError={onError} /> : <CardBody card={card} />}
          </li>
        );
      })}
    </ol>
  );
}

/** A card's block, rendered from the index (so it follows edits to the source), with folded sub-sections kept folded. */
function CardBody({ card }: { card: CheatCardView }) {
  const { data: page, error } = usePageByKey(card.page!);
  let content;
  if (error) content = <p className="zn-preview-note">{error}</p>;
  else if (!page) content = <p className="zn-preview-note">載入中…</p>;
  else if (!page.sections.some((s) => s.id === card.sectionId)) content = <p className="zn-preview-note">找不到標題 #{card.sectionId}</p>;
  else content = <BlockView key={page.path} page={page} id={card.sectionId!} />;
  return <div className="cheat-card-body">{content}</div>;
}

/** "來源已失效": the stored ref, why it fails, and a picker to point the card at another heading of this subject. */
function InvalidCard({ card, subject, notes, onError }: { card: CheatCardView; subject: string; notes: NoteSummary[]; onError: (error: Error) => void }) {
  const [choice, setChoice] = useState("");
  return (
    <div className="cheat-card-body cheat-invalid">
      <p className="cheat-invalid-title">來源已失效</p>
      <p className="cheat-invalid-reason">{card.problem}</p>
      <div className="cheat-repoint">
        <select value={choice} onChange={(event) => setChoice(event.target.value)} aria-label="新的來源標題">
          <option value="">選擇新的來源標題…</option>
          {notes.map((note) => (
            <optgroup key={note.path} label={note.meta.title}>
              {flatten(note.toc).map((item) => (
                <option key={item.id} value={cardRefFor(note.path, item.id)}>
                  {"　".repeat(Math.max(0, item.level - 2))}
                  {item.title}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <button type="button" disabled={!choice} onClick={() => repointCheat(subject, card.id, choice).catch(onError)}>
          重新指定
        </button>
      </div>
    </div>
  );
}

function flatten(items: TocItem[]): TocItem[] {
  return items.flatMap((item) => [item, ...flatten(item.children)]);
}

/** State remembered in localStorage (a per-browser convenience; it works without storage too). */
function useStored<T>(key: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return initial;
      const parsed = JSON.parse(raw) as T;
      return typeof initial === "object" && initial !== null ? { ...initial, ...parsed } : parsed;
    } catch {
      return initial;
    }
  });
  const set = (next: T) => {
    setValue(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Storage may be unavailable (private mode); the state still works for this visit.
    }
  };
  return [value, set];
}
