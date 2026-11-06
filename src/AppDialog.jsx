import { useId, useLayoutEffect, useRef } from "react";
import "./AppDialog.css";

export default function AppDialog({ title, description, children, actions, onClose, busy = false, wide = false, role = "dialog" }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return (
    <dialog ref={dialogRef} className={`app-dialog${wide ? " app-dialog-wide" : ""}`}
      role={role} aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}
      aria-busy={busy || undefined}
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
      onClick={(event) => {
        if (event.target !== dialogRef.current || busy) return;
        const rect = dialogRef.current.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
      }}>
      <div className="app-dialog-heading">
        <span className="app-dialog-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none">
          <path d="M5 9v11h14V9M3 4h18v5H3V4Zm6 9h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg></span>
        <button className="app-dialog-close" type="button" aria-label="Close dialog" disabled={busy} onClick={onClose}>
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </button>
      </div>
      <h2 id={titleId}>{title}</h2>
      {description && <p className="app-dialog-description" id={descriptionId}>{description}</p>}
      {children}
      {actions && <div className="app-dialog-actions">{actions}</div>}
    </dialog>
  );
}
