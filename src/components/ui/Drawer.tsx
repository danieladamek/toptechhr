import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Slide-over from the right (CompoundDrawer pattern) so the page stays visible. Esc closes; focus returns.
 * Focus moves to Close once, when the drawer opens, and back to the opener once, when it closes. Callers pass an
 * inline onClose, so it is read through a ref: depending on it would re-run the effect on every parent render
 * (every keystroke in the notebook) and pull focus out of whatever the reader is typing in.
 */
export default function Drawer({ open, onClose, label, children, testId, wide = false }: { open: boolean; onClose: () => void; label: string; children: ReactNode; testId?: string; wide?: boolean }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement as HTMLElement;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); opener.current?.focus?.(); };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end no-print" role="presentation">
      <button type="button" className="flex-1 bg-black/30 cursor-default" aria-label={`Close ${label}`} tabIndex={-1} onClick={onClose} />
      <aside role="dialog" aria-modal="true" aria-label={label} className={`h-full w-full ${wide ? 'max-w-xl' : 'max-w-md'} overflow-y-auto bg-paper dark:bg-night p-5 shadow-2xl`} data-testid={testId}>
        <div className="flex justify-end"><button ref={closeRef} type="button" className="bx-btn" onClick={onClose} aria-label={`Close ${label}`}>Close ×</button></div>
        {children}
      </aside>
    </div>
  );
}
