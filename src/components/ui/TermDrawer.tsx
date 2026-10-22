import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { getConcept, getFigure, getTerm, sectionTitle } from '@/lib/data';
import { loadGlossary } from '@/lib/heavy';
import KindChip from './KindChip';
// markdown rides in its own chunk; the provider is on every page, the drawer opens rarely
const Prose = lazy(() => import('@/components/records/Prose'));

interface DrawerCtx { openTerm: (id: string) => void; close: () => void }
const Ctx = createContext<DrawerCtx>({ openTerm: () => {}, close: () => {} });
export const useTermDrawer = () => useContext(Ctx);

/** Slide-over (CompoundDrawer pattern) for glossary entries opened from figures, so the figure stays visible. */
export function TermDrawerProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState<string | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const openTerm = useCallback((t: string) => { openerRef.current = document.activeElement as HTMLElement; setId(t); }, []);
  const close = useCallback(() => { setId(null); openerRef.current?.focus?.(); }, []);
  const value = useMemo(() => ({ openTerm, close }), [openTerm, close]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <TermDrawer id={id} onClose={close} />
    </Ctx.Provider>
  );
}

function TermDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  // the full glossary is a separate chunk; fetch it only once a term is actually opened
  const [full, setFull] = useState<Awaited<ReturnType<typeof loadGlossary>>>();
  useEffect(() => { if (id && !full) { let live = true; loadGlossary().then((g) => { if (live) setFull(g); }); return () => { live = false; }; } }, [id, full]);
  const t = id ? full?.find((x) => x.id === id) : undefined;
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!id) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [id, t, onClose]);
  if (!id) return null;
  if (!t) {
    return (
      <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
        <button type="button" className="flex-1 bg-black/30" aria-label="Close glossary panel" onClick={onClose} />
        <aside role="dialog" aria-modal="true" aria-label="Glossary" className="h-full w-full max-w-md bg-paper dark:bg-night p-5">
          <button ref={closeRef} type="button" className="bx-btn" onClick={onClose} aria-label="Close">×</button>
          <p className="mt-4 bx-muted" role="status">{full ? `Term ${id} not found` : 'Loading…'}</p>
        </aside>
      </div>
    );
  }
  const concept = getConcept(t.concept ?? t.in_concepts[0]);
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
      <button type="button" className="flex-1 bg-black/30" aria-label="Close glossary panel" onClick={onClose} />
      <aside role="dialog" aria-modal="true" aria-labelledby="term-drawer-title" className="h-full w-full max-w-md overflow-y-auto bg-paper dark:bg-night p-5 shadow-2xl" data-testid="term-drawer">
        <div className="flex items-start justify-between gap-3">
          <h2 id="term-drawer-title" className="text-2xl">{t.term}</h2>
          <button ref={closeRef} type="button" className="bx-btn" onClick={onClose} aria-label="Close">×</button>
        </div>
        <p className="mt-2"><KindChip kind={t.domain} /></p>
        <p className="mt-3 font-semibold">{t.short}</p>
        <div className="bx-prose mt-2"><Suspense fallback={null}><Prose md={t.definition} /></Suspense></div>
        {concept && <p className="mt-3 text-sm"><Link className="underline" to={`/library/primers/${concept.id}`} onClick={onClose}>Learn the concept → {concept.title}</Link></p>}
        {t.see.length > 0 && <p className="mt-3 text-sm">See also: {t.see.map((s) => <Link key={s} className="underline mr-2" to={`/library/glossary#${s}`} onClick={onClose}>{getTerm(s)?.term ?? s}</Link>)}</p>}
        {t.appears_in.length > 0 && <p className="mt-3 text-sm bx-muted">Appears in: {t.appears_in.map((s) => <Link key={s} className="underline mr-2" to={`/library/guide#${s}`} onClick={onClose}>{sectionTitle(s)}</Link>)}</p>}
        {t.figures.length > 0 && <p className="mt-2 text-sm bx-muted">In figures: {t.figures.map((f) => <Link key={f} className="underline mr-2" to={`/library/guide#figure-${f}`} onClick={onClose}>{getFigure(f)?.label ?? f}</Link>)}</p>}
        <div className="mt-4"><Link to={`/library/glossary#${t.id}`} className="bx-btn-primary" onClick={onClose}>Open in glossary</Link></div>
      </aside>
    </div>
  );
}
