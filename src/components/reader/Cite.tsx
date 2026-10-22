import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Reference } from '@/types';
// the card pulls in the reference and record indexes; keep it out of the first chunk
const ReferenceCard = lazy(() => import('./ReferenceCard'));
import { loadReference } from '@/lib/heavy';

interface ParagraphCtx { active: number | null; toggle: (n: number) => void; id: string }
const Ctx = createContext<ParagraphCtx | null>(null);

/** Paragraph wrapper: owns one fold-out, inserted directly after the paragraph (one open per paragraph). */
export function Paragraph({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<number | null>(null);
  const [id] = useState(() => `fo-${Math.random().toString(36).slice(2, 8)}`);
  const toggle = useCallback((n: number) => setActive((a) => (a === n ? null : n)), []);
  return (
    <Ctx.Provider value={{ active, toggle, id }}>
      <p>{children}</p>
      {active !== null && <CitationFoldout n={active} id={id} onClose={() => setActive(null)} />}
    </Ctx.Provider>
  );
}

export function CitationFoldout({ n, id, onClose }: { n: number; id: string; onClose: () => void }) {
  const [ref, setRef] = useState<Reference | null | undefined>(undefined);
  useEffect(() => { let live = true; setRef(undefined); loadReference(n).then((r) => { if (live) setRef(r); }); return () => { live = false; }; }, [n]);
  return (
    <div id={id} className="bx-foldout" role="region" aria-label={`Reference ${n}`} data-testid="citation-foldout">
      <div className="flex justify-between gap-2">
        <span className="text-[11px] font-semibold tracking-[0.15em] bx-muted">REFERENCE {n}</span>
        <button type="button" className="bx-btn !py-0.5 !px-2 text-xs" onClick={onClose} aria-label={`Close reference ${n}`}>Close</button>
      </div>
      {ref === undefined && <p className="mt-2 text-sm bx-muted" role="status">Loading…</p>}
      {ref === null && <p className="mt-2 text-sm"><span className="bx-todo">reference [{n}] not in the content pack</span></p>}
      {ref && <div className="mt-2"><Suspense fallback={<p className="text-sm bx-muted" role="status">Loading…</p>}><ReferenceCard r={ref} compact /></Suspense></div>}
    </div>
  );
}

/** Clickable citation token, e.g. [1,2] or [3–5]; each number opens the paragraph's fold-out. */
export default function Cite({ ns, label }: { ns: number[]; label: string }) {
  const ctx = useContext(Ctx);
  if (!ctx) return <span className="bx-cite">[{label}]</span>;
  const parts = label.split(/(,|–|-)/);
  let i = 0;
  return (
    <span className="whitespace-nowrap">
      <span className="bx-cite" aria-hidden="true">[</span>
      {parts.map((p, k) => {
        if (/^\d+$/.test(p)) {
          const n = Number(p);
          const isRange = k > 0 && /[–-]/.test(parts[k - 1]);
          i++;
          return (
            <button key={k} type="button" className="bx-cite" onClick={() => ctx.toggle(n)} aria-expanded={ctx.active === n} aria-controls={ctx.active === n ? ctx.id : undefined} aria-label={`Reference ${n}${isRange ? ' (end of range)' : ''}`} data-testid={`cite-${n}`}>
              {p}
            </button>
          );
        }
        return <span key={k} className="bx-cite" aria-hidden="true">{p}</span>;
      })}
      <span className="bx-cite" aria-hidden="true">]</span>
      {ns.length > i && (
        <span className="sr-only">{ns.filter((n) => !label.includes(String(n))).map((n) => <button key={n} type="button" onClick={() => ctx.toggle(n)}>Reference {n}</button>)}</span>
      )}
    </span>
  );
}
