import { createElement, useEffect, useRef, useState, type ReactNode } from 'react';
import { selectionToQuote, type AnchorInfo } from '@/lib/quote';
import { useNotebook } from '@/lib/notebook-context';
import { actionRow } from '@/lib/rows';
import { S } from '@/strings';

/**
 * Marks pack-rendered content as quotable (KICKOFF §4c): the nearest such container is the quote's provenance — its
 * route, record type and id, optional section id, title, as_of and declared citations.
 */
export function QA({ route, type, id, section, title, asOf, cites, children, as = 'div', className, testId }: {
  route: string; type: string; id: string; section?: string; title: string; asOf?: string | null; cites?: number[];
  children: ReactNode; as?: 'div' | 'section' | 'article' | 'li' | 'span'; className?: string; testId?: string;
}) {
  return createElement(as, {
    'data-q-anchor': '', 'data-q-route': route, 'data-q-type': type, 'data-q-id': id, 'data-q-section': section ?? '', 'data-q-title': title,
    'data-q-asof': asOf ?? '', 'data-q-cites': (cites ?? []).join(','), className, 'data-testid': testId,
  }, children);
}

interface Pending { left: number; top: number; result: { ok: true; text: string; anchor: AnchorInfo; citations: number[] } | null; message: string | null }

/**
 * The floating control: on mouseup/selectionchange with a non-empty selection inside pack-rendered content it offers
 * "Quote" (and, on a lever card, "Add action"). A selection that spans two records is refused with a message.
 */
export default function QuoteControl() {
  const nb = useNotebook();
  const [p, setP] = useState<Pending | null>(null);
  const timer = useRef<number>();
  useEffect(() => {
    const check = () => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        const sel = window.getSelection();
        const active = document.activeElement;
        if (active && (active.closest('.tt-editor') || /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName))) { setP(null); return; }
        const r = selectionToQuote(sel);
        if (!r.rect || (!r.ok && r.reason !== 'two-records')) { setP(null); return; }
        const left = Math.min(Math.max(8, r.rect.left + r.rect.width / 2 - 80), window.innerWidth - 220);
        const top = r.rect.top > 56 ? r.rect.top - 48 : r.rect.bottom + 8;
        setP({ left, top, result: r.ok ? { ok: true, text: r.text, anchor: r.anchor, citations: r.citations } : null, message: r.ok ? null : S.quoteRefused });
      }, 120);
    };
    const hide = () => setP(null);
    document.addEventListener('mouseup', check);
    document.addEventListener('keyup', check);
    document.addEventListener('selectionchange', check);
    window.addEventListener('scroll', hide, { passive: true });
    return () => { document.removeEventListener('mouseup', check); document.removeEventListener('keyup', check); document.removeEventListener('selectionchange', check); window.removeEventListener('scroll', hide); window.clearTimeout(timer.current); };
  }, []);
  if (!p) return null;
  const done = () => { window.getSelection()?.removeAllRanges(); setP(null); };
  return (
    <div className="tt-quote-control no-print" style={{ left: p.left, top: p.top }} role="toolbar" aria-label="Quote the selection" data-testid="quote-control" onMouseDown={(e) => e.preventDefault()}>
      {p.result ? (
        <>
          <button type="button" data-testid="quote-button" onClick={async () => { const r = p.result!; done(); await nb.addQuote(r); }}>{S.quote}</button>
          {p.result.anchor.recordType === 'levers' && (
            <button type="button" data-testid="add-action-button" onClick={async () => { const id = p.result!.anchor.recordId; done(); const row = await actionRow(id); if (row) { await nb.addRows([row]); nb.setOpen(true); } }}>{S.addAction}</button>
          )}
        </>
      ) : (
        <span role="status" className="px-2 py-1 text-[13px] text-white" data-testid="quote-refused">{p.message}</span>
      )}
    </div>
  );
}
