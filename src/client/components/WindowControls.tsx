import { useEffect, useState } from "react";
import { shell } from "../shell.ts";

/** Menu and minimize / maximize / close buttons for the frameless desktop shell; renders nothing in a browser. */
export function WindowControls() {
  const [maximized, setMaximized] = useState(false);
  useEffect(() => shell?.onMaximized(setMaximized), []);
  const s = shell;
  if (!s) return null;
  return (
    <div className="window-controls">
      <button
        type="button"
        aria-label="選單"
        onClick={(event) => {
          const r = event.currentTarget.getBoundingClientRect();
          s.menu(r.left, r.bottom);
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M3 4.5h10M3 8h10M3 11.5h10" />
        </svg>
      </button>
      <button type="button" aria-label="最小化" onClick={() => s.minimize()}>
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M3.5 8.5h9" />
        </svg>
      </button>
      <button type="button" aria-label={maximized ? "還原" : "最大化"} onClick={() => s.toggleMaximize()}>
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          {maximized ? <path d="M5.5 3.5h7v7M3.5 5.5h7v7h-7z" /> : <path d="M3.5 3.5h9v9h-9z" />}
        </svg>
      </button>
      <button type="button" aria-label="關閉" className="window-close" onClick={() => s.close()}>
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>
    </div>
  );
}
