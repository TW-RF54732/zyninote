import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useLocation } from "wouter";
import { cardRefFor, filterCards, moveCard, type CheatFilter, type CheatMode } from "../../shared/cheats.ts";
import { pageKeyFromPathname } from "../../shared/links.ts";
import type { CheatCardView, NoteSummary, TocItem } from "../../shared/types.ts";
import { goTo } from "../behavior/links.ts";
import { removeCheat, reorderCheats, repointCheat, useCheats, usePageByKey, useTree } from "../data.ts";
import { BlockView } from "./BlockView.tsx";

/** The card's width is the user's (resized by dragging its left edge) and survives reloads. */
const MIN_WIDTH = 300;
const DEFAULT_WIDTH = 420;
const MIN_HEIGHT = 200;
/** A hover-opened card closes only once the mouse is this far outside it, so small overshoots do not close it. */
const CLOSE_MARGIN = 20;

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

/** The screen corner the card is docked to; it slides out of the left or right edge. */
type Corner = { h: "left" | "right"; v: "top" | "bottom" };
const DEFAULT_CORNER: Corner = { h: "right", v: "bottom" };

/** A pointer drag on the card: resizing one of its inner edges, or moving it by its header. */
type Gesture = { kind: "width" | "height" | "move"; startX: number; startY: number; startWidth: number; startHeight: number; rect: DOMRect };

/**
 * A floating card docked to a screen corner. Collapsed, it sits almost entirely off its side edge with only the arrow
 * strip showing; hovering slides it in at once and moving CLOSE_MARGIN away slides it out; clicking pins it in (touch
 * screens only use clicks). Its inner edges resize it (double-click resets), and dragging the header moves it: on release
 * it snaps to the nearest corner. It is purely an overlay and never changes the page layout.
 */
function Dock({ subject, currentPage }: { subject: string; currentPage: string }) {
  const { data: sheet } = useCheats(subject);
  const [pinned, setPinned] = useStored("zyninote:cheats:pinned", false);
  const [savedWidth, setSavedWidth] = useStored("zyninote:cheats:width", DEFAULT_WIDTH);
  // 0 means the default height from the stylesheet.
  const [savedHeight, setSavedHeight] = useStored("zyninote:cheats:height", 0);
  const [corner, setCorner] = useStored<Corner>("zyninote:cheats:corner", DEFAULT_CORNER);
  const [hovering, setHovering] = useState(false);
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const [at, setAt] = useState({ x: 0, y: 0 });
  const pointer = useRef("");
  const dockRef = useRef<HTMLDivElement>(null);
  /** Where the card was dropped, to animate from there to its new corner. */
  const dropRect = useRef<DOMRect | null>(null);
  /** After a move the card has slid away from the pointer; keep it open until the pointer comes back to it. */
  const holdOpen = useRef(false);
  const open = pinned || hovering;
  const right = corner.h === "right";
  const bottom = corner.v === "bottom";

  // Resizing grows the card away from its corner, so the edge being dragged follows the pointer.
  const dx = at.x - (gesture?.startX ?? 0);
  const dy = at.y - (gesture?.startY ?? 0);
  const width = clampWidth(gesture?.kind === "width" ? gesture.startWidth + (right ? -dx : dx) : savedWidth);
  const height = gesture?.kind === "height" ? clampHeight(gesture.startHeight + (bottom ? -dy : dy)) : savedHeight ? clampHeight(savedHeight) : undefined;

  // Cards load on first open, then stay mounted so the card can slide out with its content.
  const [opened, setOpened] = useState(open);
  if (open && !opened) setOpened(true);

  useEffect(() => {
    if (!hovering || pinned || gesture) return;
    const onMove = (event: PointerEvent) => {
      const rect = dockRef.current?.getBoundingClientRect();
      if (event.pointerType !== "mouse" || !rect) return;
      const { clientX: x, clientY: y } = event;
      if (holdOpen.current) {
        // Back over the card (it may never have left after a short move): normal closing resumes.
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) holdOpen.current = false;
        return;
      }
      if (x < rect.left - CLOSE_MARGIN || x > rect.right + CLOSE_MARGIN || y < rect.top - CLOSE_MARGIN || y > rect.bottom + CLOSE_MARGIN) setHovering(false);
    };
    document.addEventListener("pointermove", onMove);
    return () => document.removeEventListener("pointermove", onMove);
  }, [hovering, pinned, gesture]);

  useEffect(() => {
    if (!hovering || pinned) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setHovering(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hovering, pinned]);

  // While a gesture runs, follow the pointer anywhere on the page; on release, commit the size or snap to a corner.
  useEffect(() => {
    if (!gesture) return;
    const onMove = (event: PointerEvent) => setAt({ x: event.clientX, y: event.clientY });
    const onUp = (event: PointerEvent) => {
      const mx = event.clientX - gesture.startX;
      const my = event.clientY - gesture.startY;
      if (gesture.kind === "width") setSavedWidth(clampWidth(gesture.startWidth + (right ? -mx : mx)));
      else if (gesture.kind === "height") setSavedHeight(clampHeight(gesture.startHeight + (bottom ? -my : my)));
      else {
        const { rect } = gesture;
        dropRect.current = new DOMRect(rect.x + mx, rect.y + my, rect.width, rect.height);
        holdOpen.current = true;
        const cx = rect.x + mx + rect.width / 2;
        const cy = rect.y + my + rect.height / 2;
        setCorner({ h: cx < window.innerWidth / 2 ? "left" : "right", v: cy < window.innerHeight / 2 ? "top" : "bottom" });
      }
      setGesture(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [gesture, right, bottom, setSavedWidth, setSavedHeight, setCorner]);

  // After a drop, animate from where the card was let go to its corner (FLIP).
  useLayoutEffect(() => {
    const dock = dockRef.current;
    const from = dropRect.current;
    if (!dock || !from || gesture) return;
    dropRect.current = null;
    // Measure the untransformed position at the new corner. Removing the drag transform has already started a CSS
    // transition, so measuring without first freezing it would include that in-flight offset and the card would jump.
    dock.style.transition = "none";
    dock.style.transform = "none";
    const to = dock.getBoundingClientRect();
    dock.style.transform = `translate(${from.x - to.x}px, ${from.y - to.y}px)`;
    dock.getBoundingClientRect();
    dock.style.transition = "";
    dock.style.transform = "";
  }, [corner, gesture]);

  // A subject that does not exist (404) has no cheat sheet.
  if (!sheet) return null;

  const isMouse = (event: ReactPointerEvent) => event.pointerType === "mouse";
  const pin = (next: boolean) => {
    // Unpinning with the mouse over the dock keeps the panel open until the pointer leaves.
    setHovering(!next && pointer.current === "mouse");
    setPinned(next);
  };

  const startGesture = (kind: Gesture["kind"]) => (event: ReactPointerEvent) => {
    if (event.button !== 0 || !dockRef.current) return;
    // The header's own controls keep working; only its empty area moves the card.
    if (kind === "move" && (event.target as Element).closest("button, input, label, select, a, .cheat-menu")) return;
    event.preventDefault();
    const rect = dockRef.current.getBoundingClientRect();
    setAt({ x: event.clientX, y: event.clientY });
    setGesture({ kind, startX: event.clientX, startY: event.clientY, startWidth: rect.width, startHeight: rect.height, rect });
  };

  // Collapsed, the card hides past its side edge, so the arrow points inward; open, it points back out.
  const arrow = open === right ? "›" : "‹";

  return (
    <div
      ref={dockRef}
      className="cheat-dock"
      data-h={corner.h}
      data-v={corner.v}
      data-open={open || undefined}
      data-gesture={gesture?.kind}
      style={{
        width,
        height,
        ...(gesture?.kind === "move" ? { transform: `translate(${dx}px, ${dy}px)`, transition: "none" } : {}),
      }}
      onPointerEnter={(event) => {
        if (!isMouse(event)) return;
        holdOpen.current = false;
        setHovering(true);
      }}
      onPointerDownCapture={(event) => (pointer.current = event.pointerType)}
    >
      {open && (
        <>
          <div
            className="cheat-resize cheat-resize-x"
            role="separator"
            aria-orientation="vertical"
            aria-label="調整 cheat sheet 寬度"
            onPointerDown={startGesture("width")}
            onDoubleClick={() => setSavedWidth(DEFAULT_WIDTH)}
          />
          <div
            className="cheat-resize cheat-resize-y"
            role="separator"
            aria-orientation="horizontal"
            aria-label="調整 cheat sheet 高度"
            onPointerDown={startGesture("height")}
            onDoubleClick={() => setSavedHeight(0)}
          />
        </>
      )}
      <button
        type="button"
        className="cheat-handle"
        aria-expanded={open}
        aria-pressed={pinned}
        aria-label={pinned ? "取消固定 cheat sheet" : "固定開啟 cheat sheet"}
        title="Cheat sheet"
        onClick={() => pin(!pinned)}
      >
        {arrow}
      </button>
      {opened && (
        <div className="cheat-dock-body" inert={!open}>
          <Panel subject={subject} currentPage={currentPage} cards={sheet.cards} fileError={sheet.error} open={open} onMoveStart={startGesture("move")} />
        </div>
      )}
    </div>
  );
}

/** Keeps the card between MIN_WIDTH and the viewport (minus a gutter). */
function clampWidth(width: number): number {
  return Math.round(Math.max(Math.min(MIN_WIDTH, window.innerWidth - 24), Math.min(width, window.innerWidth - 24)));
}

function clampHeight(height: number): number {
  return Math.round(Math.max(Math.min(MIN_HEIGHT, window.innerHeight - 32), Math.min(height, window.innerHeight - 32)));
}

type PanelProps = {
  subject: string;
  currentPage: string;
  cards: CheatCardView[];
  fileError: string | null;
  /** Whether the dock is open; the filter menu closes with it. */
  open: boolean;
  /** Pointer down on the header: drag the card to another corner. */
  onMoveStart: (event: ReactPointerEvent) => void;
};

function Panel({ subject, currentPage, cards, fileError, open, onMoveStart }: PanelProps) {
  const { data: tree } = useTree();
  const notes = tree?.subjects.find((s) => s.name === subject)?.notes ?? [];
  const [filter, setFilter] = useStored<StoredFilter>(`zyninote:cheats:${subject}`, DEFAULT_FILTER);
  const [notice, setNotice] = useState<string | null>(null);
  const fail = (error: Error) => setNotice(error.message);

  const visible = filterCards(cards, { ...filter, currentPage });

  const reorder = (id: string, drop: Drop) => {
    const ids = cards.map((card) => card.id);
    const next = moveCard(ids, id, drop);
    if (next.join("\n") === ids.join("\n")) return;
    reorderCheats(subject, next).catch(fail);
  };

  const chapters = [
    ...(cards.some((card) => card.page === `${subject}/`) ? [{ key: `${subject}/`, title: "科目首頁" }] : []),
    ...notes.map((note) => ({ key: `${subject}/${note.slug}`, title: note.meta.title })),
  ];
  const tags = [...new Set(notes.flatMap((note) => note.meta.tags))];
  const filterCount = filter.chapters.length + filter.tags.length;

  // The filter menu floats over the cards, so opening it never moves anything. Outside clicks and Esc close it.
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) setMenuOpen(false);
  }, [open]);
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !menuButtonRef.current?.contains(target)) setMenuOpen(false);
    };
    // Captured on the document so Esc closes only the menu, not the hover-opened dock as well.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [menuOpen]);

  const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  return (
    <section className="cheat-panel" aria-label="Cheat sheet">
      <header className="cheat-panel-head" onPointerDown={onMoveStart}>
        <div className="cheat-modes" role="group" aria-label="顯示模式">
          {MODES.map(({ mode, label, title }) =>
            mode === "advance" ? (
              <button
                key={mode}
                ref={menuButtonRef}
                type="button"
                className="cheat-toggle"
                title={title}
                aria-pressed={filter.mode === mode}
                aria-expanded={menuOpen}
                aria-haspopup="true"
                onClick={() => {
                  setFilter({ ...filter, mode });
                  setMenuOpen(filter.mode !== mode || !menuOpen);
                }}
              >
                {label}
                {filterCount > 0 && ` (${filterCount})`} ▾
              </button>
            ) : (
              <button key={mode} type="button" className="cheat-toggle" title={title} aria-pressed={filter.mode === mode} onClick={() => setFilter({ ...filter, mode })}>
                {label}
              </button>
            ),
          )}
          <span className="cheat-count">{visible.length === cards.length ? cards.length : `${visible.length} / ${cards.length}`}</span>
        </div>
        {menuOpen && (
          <div className="cheat-menu" ref={menuRef} role="group" aria-label="篩選條件">
            <CheckGroup label="章節" options={chapters.map((c) => ({ value: c.key, label: c.title }))} selected={filter.chapters} onToggle={(v) => setFilter({ ...filter, chapters: toggle(filter.chapters, v) })} />
            {tags.length > 0 && (
              <CheckGroup label="Tag" inline options={tags.map((t) => ({ value: t, label: t }))} selected={filter.tags} onToggle={(v) => setFilter({ ...filter, tags: toggle(filter.tags, v) })} />
            )}
            <div className="cheat-menu-foot">
              {tags.length > 0 && (
                <span className="cheat-menu-tagmode" role="group" aria-label="多個 tag 的組合方式">
                  <button type="button" className="cheat-toggle" aria-pressed={filter.tagMode === "any"} onClick={() => setFilter({ ...filter, tagMode: "any" })}>
                    聯集
                  </button>
                  <button type="button" className="cheat-toggle" aria-pressed={filter.tagMode === "all"} onClick={() => setFilter({ ...filter, tagMode: "all" })}>
                    交集
                  </button>
                </span>
              )}
              <button type="button" className="cheat-toggle cheat-menu-clear" disabled={!filterCount} onClick={() => setFilter({ ...filter, chapters: [], tags: [] })}>
                清除
              </button>
            </div>
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

type CheckGroupProps = {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
  /** Lay the options out in a wrapping row (tags) rather than one per line (chapters). */
  inline?: boolean;
};

function CheckGroup({ label, options, selected, onToggle, inline }: CheckGroupProps) {
  return (
    <fieldset className="cheat-check-group" data-inline={inline || undefined}>
      <legend>{label}</legend>
      {options.map((option) => (
        <label key={option.value} className="cheat-check">
          <input type="checkbox" checked={selected.includes(option.value)} onChange={() => onToggle(option.value)} />
          {option.label}
        </label>
      ))}
    </fieldset>
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
            {/* The card's own heading row replaces the block's heading: drag handle, title, then the chapter in small type. */}
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
                  {card.sectionTitle}
                </a>
              ) : (
                <span className="cheat-card-title cheat-card-ref">{card.ref}</span>
              )}
              {card.pageTitle && <span className="cheat-card-chapter">{card.pageTitle}</span>}
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
  // Stable, so effects can depend on it.
  const set = useCallback(
    (next: T) => {
      setValue(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Storage may be unavailable (private mode); the state still works for this visit.
      }
    },
    [key],
  );
  return [value, set];
}
