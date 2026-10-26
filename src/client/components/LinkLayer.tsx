import { useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { goTo, linkTarget, MOD_KEY, modHeld, NOTE_LINK, type LinkTarget } from "../behavior/links.ts";
import { usePageByKey } from "../data.ts";
import { BlockView } from "./BlockView.tsx";

type Preview = {
  target: LinkTarget;
  /** Hover card (Ctrl/Cmd + hover) or the floating page opened by tapping a link on touch screens. */
  mode: "hover" | "sheet";
  anchor: HTMLAnchorElement;
  rect: DOMRect;
};

const SHOW_DELAY = 120;
const HIDE_DELAY = 300;

/**
 * Document-wide behaviour of note links (`a.zn-link`), wherever they are rendered:
 * - holding Ctrl/Cmd adds `zn-mod` to <html>, which reveals quiet links;
 * - Ctrl/Cmd + hover shows a preview card of the target block;
 * - tapping a link on a touch screen opens it as a floating page instead of navigating;
 * - plain clicks navigate inside the app.
 */
export function LinkLayer() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const previewRef = useRef(preview);
  previewRef.current = preview;
  const popupRef = useRef<HTMLDivElement>(null);
  const showTimer = useRef(0);
  const hideTimer = useRef(0);
  const [location] = useLocation();

  const cancelHide = () => clearTimeout(hideTimer.current);
  const scheduleHide = () => {
    clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setPreview((p) => (p?.mode === "hover" ? null : p)), HIDE_DELAY);
  };

  useEffect(() => setPreview(null), [location]);

  useEffect(() => {
    let hovered: HTMLAnchorElement | null = null;
    let lastPointer = "";
    const setMod = (on: boolean) => document.documentElement.classList.toggle("zn-mod", on);
    const linkAt = (node: EventTarget | null) => (node instanceof Element ? node.closest<HTMLAnchorElement>(NOTE_LINK) : null);

    const show = (anchor: HTMLAnchorElement) => {
      const target = linkTarget(anchor);
      // Previews inside the hover card itself would replace the card under the pointer.
      if (!target || anchor.hasAttribute("data-zn-broken") || popupRef.current?.contains(anchor)) return;
      cancelHide();
      setPreview((p) => (p?.mode === "sheet" || p?.anchor === anchor ? p : { target, mode: "hover", anchor, rect: anchor.getBoundingClientRect() }));
    };

    const onKeyDown = (event: KeyboardEvent) => {
      lastPointer = "";
      if (event.key === "Escape") {
        setPreview(null);
      } else if (event.key === MOD_KEY) {
        setMod(true);
        if (hovered) show(hovered);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === MOD_KEY) setMod(false);
    };
    const onBlur = () => setMod(false);

    const onOver = (event: MouseEvent) => {
      const anchor = linkAt(event.target);
      // Keeps the class right when the key was pressed while another window had focus.
      setMod(modHeld(event));
      if (anchor === hovered) return;
      hovered = anchor;
      clearTimeout(showTimer.current);
      if (anchor && modHeld(event)) showTimer.current = window.setTimeout(() => show(anchor), SHOW_DELAY);
    };
    const onOut = (event: MouseEvent) => {
      const anchor = linkAt(event.target);
      if (!anchor || anchor.contains(event.relatedTarget as Node | null)) return;
      hovered = null;
      clearTimeout(showTimer.current);
      if (previewRef.current?.anchor === anchor) scheduleHide();
    };

    const onPointerDown = (event: PointerEvent) => {
      lastPointer = event.pointerType;
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const anchor = linkAt(event.target);
      const target = anchor && linkTarget(anchor);
      if (!anchor || !target) return;
      event.preventDefault();
      if (lastPointer === "touch" && !anchor.hasAttribute("data-zn-broken")) {
        setPreview({ target, mode: "sheet", anchor, rect: anchor.getBoundingClientRect() });
        return;
      }
      setPreview(null);
      goTo(target.href);
    };

    // A hover card is positioned against the link, so it closes when the page moves under it.
    const onScroll = (event: Event) => {
      if (previewRef.current?.mode !== "hover") return;
      if (event.target instanceof Node && popupRef.current?.contains(event.target)) return;
      setPreview(null);
    };
    const onResize = () => setPreview((p) => (p?.mode === "hover" ? null : p));

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    window.addEventListener("resize", onResize);
    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("click", onClick);
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      clearTimeout(showTimer.current);
      clearTimeout(hideTimer.current);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("click", onClick);
      document.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, []);

  if (!preview) return null;
  const close = () => setPreview(null);
  return createPortal(
    preview.mode === "hover" ? (
      <HoverCard preview={preview} popupRef={popupRef} onEnter={cancelHide} onLeave={scheduleHide} onClose={close} />
    ) : (
      <Sheet preview={preview} onClose={close} />
    ),
    document.body,
  );
}

function usePreviewPage(target: LinkTarget) {
  const { data: page, error } = usePageByKey(target.page);
  const section = target.id ? page?.sections.find((s) => s.id === target.id) : undefined;
  const title = page ? (section ? `${page.meta.title} › ${section.title}` : page.meta.title) : "";
  let content;
  if (error) content = <p className="zn-preview-note">{error}</p>;
  else if (!page) content = <p className="zn-preview-note">載入中…</p>;
  else if (target.id && !section) content = <p className="zn-preview-note">找不到標題 #{target.id}</p>;
  else content = <BlockView key={page.path} page={page} id={target.id} />;
  return { title, content };
}

type HoverCardProps = {
  preview: Preview;
  popupRef: RefObject<HTMLDivElement | null>;
  onEnter: () => void;
  onLeave: () => void;
  onClose: () => void;
};

function HoverCard({ preview, popupRef, onEnter, onLeave, onClose }: HoverCardProps) {
  const { title, content } = usePreviewPage(preview.target);
  const open = (event: ReactMouseEvent) => {
    event.preventDefault();
    onClose();
    goTo(preview.target.href);
  };
  return (
    <div ref={popupRef} className="zn-popup" role="dialog" aria-label={`預覽：${title}`} style={popupPosition(preview.rect)} onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <a className="zn-popup-title" href={preview.target.href} onClick={open}>
        {title || " "}
      </a>
      <div className="zn-popup-body">{content}</div>
    </div>
  );
}

/** Below the link when there is room, otherwise above it; never wider than the viewport. */
function popupPosition(rect: DOMRect): CSSProperties {
  const margin = 16;
  const width = Math.min(520, window.innerWidth - margin * 2);
  const left = Math.min(Math.max(rect.left, margin), window.innerWidth - width - margin);
  const below = window.innerHeight - rect.bottom;
  const above = rect.top;
  if (below >= 320 || below >= above) return { left, width, top: rect.bottom + 8, maxHeight: Math.min(440, below - margin - 8) };
  return { left, width, bottom: window.innerHeight - rect.top + 8, maxHeight: Math.min(440, above - margin - 8) };
}

function Sheet({ preview, onClose }: { preview: Preview; onClose: () => void }) {
  const { title, content } = usePreviewPage(preview.target);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const anchor = preview.anchor;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      if (anchor.isConnected) anchor.focus({ preventScroll: true });
    };
  }, [preview.anchor]);

  const fullscreen = () => {
    onClose();
    goTo(preview.target.href);
  };

  return (
    <div className="zn-sheet-backdrop" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="zn-sheet" role="dialog" aria-modal="true" aria-labelledby="zn-sheet-title">
        <div className="zn-sheet-header">
          <h2 id="zn-sheet-title" className="zn-sheet-title">
            {title}
          </h2>
          <button type="button" onClick={fullscreen}>
            全螢幕
          </button>
          <button type="button" ref={closeRef} onClick={onClose}>
            關閉
          </button>
        </div>
        <div className="zn-sheet-body">{content}</div>
      </div>
    </div>
  );
}
