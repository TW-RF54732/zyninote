import { useEffect, useRef, type ReactNode } from "react";

type DialogProps = {
  title: string;
  children: ReactNode;
  /** Label of the confirm button; without it the dialog only informs and has a single close button. */
  confirm?: string;
  onConfirm?: () => void;
  onClose: () => void;
};

/** A small modal built on <dialog>: Esc and the backdrop close it, focus returns to where it was. */
export function Dialog({ title, children, confirm, onConfirm, onClose }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className="zn-dialog"
      aria-labelledby="zn-dialog-title"
      onClose={onClose}
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <h2 id="zn-dialog-title">{title}</h2>
      <div className="zn-dialog-body">{children}</div>
      <div className="zn-dialog-actions">
        <button type="button" onClick={onClose}>
          {confirm ? "取消" : "關閉"}
        </button>
        {confirm && (
          <button type="button" className="zn-dialog-confirm" autoFocus onClick={onConfirm}>
            {confirm}
          </button>
        )}
      </div>
    </dialog>
  );
}
