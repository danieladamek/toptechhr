import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import type { Reference, ReferenceMeta, Tier } from '@/types';
import provenance from '@/data/provenance.json';
import { scrollToId, TIER_NOTE } from '@/lib/data';
import { loadAllRefMeta, loadReference, useAsync } from '@/lib/heavy';
import ReferenceCard from '@/components/reader/ReferenceCard';

const TIER_GROUPS: { id: Tier; title: string; order: 'asc' | 'desc' }[] = [
  { id: 'seminal', title: 'Seminal', order: 'asc' },
  { id: 'classic', title: 'Classic', order: 'asc' },
  { id: 'current', title: 'Current', order: 'desc' },
  { id: 'background', title: 'Background', order: 'desc' },
];
const ORDER_NOTE = { asc: 'Oldest first, so the history reads forward.', desc: 'Newest first.' } as const;
const RECHECK_WORD = (r: ReferenceMeta) => (r.recheck ? 'not yet re-read against the live page' : 're-read against the live page');

function Row({ r, open, onToggle }: { r: ReferenceMeta; open: boolean; onToggle: () => void }) {
  const [full, setFull] = useState<Reference | null | undefined>();
  useEffect(() => { if (open && full === undefined) loadReference(r.n).then(setFull); }, [open, r.n, full]);
  return (
    <li id={`ref-${r.n}`} className="scroll-mt-28">
      <button type="button" className="w-full text-left rounded-md px-2 py-1.5 hover:bg-paper-2 dark:hover:bg-night-2 text-sm" aria-expanded={open} onClick={onToggle} data-testid={`ref-row-${r.n}`}>
        <span className="font-semibold">[{r.n}]</span> {r.citation}
        <span className="block text-xs bx-muted mt-0.5">
          {r.year} · {r.source_kind} · {r.study_design} · read {r.read} · {r.publisher.length > 50 ? `${r.publisher.slice(0, 48)}…` : r.publisher} · {RECHECK_WORD(r)}{!r.verified && ' · not verified'}{!r.cited && ' · cited nowhere in this build'}
          {r.anchor && <span className="bx-chip border border-[color:var(--bx-line)] ml-1.5" data-testid="anchor-chip">scope anchor</span>}
        </span>
      </button>
      {open && <div className="bx-foldout mx-2">{full ? <ReferenceCard r={full} /> : full === null ? <span className="bx-todo">not in the pack</span> : <span role="status" className="bx-muted">Loading…</span>}</div>}
    </li>
  );
}

/** `/references` — grouped by tier, sorted by year within tier, filterable by tier, source kind, study design, publisher and recheck state; anchors marked. */
export default function References() {
  const loc = useLocation();
  const index = useAsync(loadAllRefMeta);
  const [params, setParams] = useSearchParams();
  const tier = params.get('tier') ?? '';
  const design = params.get('design') ?? '';
  const kind = params.get('kind') ?? '';
  const publisher = params.get('publisher') ?? '';
  const recheck = params.get('recheck') ?? '';
  const q = params.get('q') ?? '';
  const dq = useDeferredValue(q);
  const set = (k: string, v: string) => { const p = new URLSearchParams(params); if (v) p.set(k, v); else p.delete(k); setParams(p, { replace: true }); };
  const [open, setOpen] = useState<Set<number>>(() => new Set());
  const [limit, setLimit] = useState(120);
  const target = loc.hash.startsWith('#ref-') ? Number(loc.hash.replace('#ref-', '')) : NaN;
  useEffect(() => { if (Number.isInteger(target)) setOpen((o) => new Set(o).add(target)); }, [target]);
  useEffect(() => { if (index && Number.isInteger(target)) scrollToId(`ref-${target}`); }, [index, target]);
  const publishers = useMemo(() => [...new Set((index ?? []).map((r) => r.publisher))].sort(), [index]);
  const designs = useMemo(() => [...new Set((index ?? []).map((r) => r.study_design))].sort(), [index]);
  const shown = useMemo(() => {
    const needle = dq.trim().toLowerCase();
    return (index ?? []).filter((r) => (!tier || r.tier === tier) && (!design || r.study_design === design) && (!kind || r.source_kind === kind) && (!publisher || r.publisher === publisher) &&
      (!recheck || (recheck === 'pending' ? r.recheck : !r.recheck)) &&
      (!needle || `${r.n} ${r.key} ${r.citation}`.toLowerCase().includes(needle)));
  }, [index, tier, design, kind, publisher, recheck, dq]);
  const toggle = (n: number) => setOpen((o) => { const s = new Set(o); if (s.has(n)) s.delete(n); else s.add(n); return s; });
  let budget = Number.isInteger(target) ? Math.max(limit, 5000) : limit;

  return (
    <div className="max-w-[60rem]">
      <h1 className="text-[32px] sm:text-[38px]">Sources</h1>
      <p className="bx-prose mt-2">
        {provenance.references.total.toLocaleString()} sources — published studies and public government sources — grouped by tier and sorted by year within each. Every card says what kind of
        source it is (a secondary source never carries a fact alone in this guide), its study design, the population and effect as the work reports them, how much of it was read and what in the
        guide uses it. Summaries come from the content pack and are never invented. Every reference is marked as not yet re-read against its live page: at this build all{' '}
        {provenance.references.recheck_pending.toLocaleString()} await that recheck. A <span className="bx-chip border border-[color:var(--bx-line)]">scope anchor</span> is one of the works the scope named as the sweep’s starting points.
      </p>
      <div className="bx-card p-3 mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm" role="search" aria-label="Filter references">
        <label className="block"><span className="block text-xs bx-muted mb-1">Tier</span><select className="bx-input" value={tier} onChange={(e) => set('tier', e.target.value)} data-testid="ref-tier"><option value="">All tiers</option>{TIER_GROUPS.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
        <label className="block"><span className="block text-xs bx-muted mb-1">Study design</span><select className="bx-input" value={design} onChange={(e) => set('design', e.target.value)} data-testid="ref-design"><option value="">Any design</option>{designs.map((d) => <option key={d} value={d}>{d}</option>)}</select></label>
        <label className="block"><span className="block text-xs bx-muted mb-1">Source kind</span><select className="bx-input" value={kind} onChange={(e) => set('kind', e.target.value)}><option value="">Both</option><option value="primary">Primary</option><option value="secondary">Secondary</option></select></label>
        <label className="block"><span className="block text-xs bx-muted mb-1">Publisher</span><select className="bx-input" value={publisher} onChange={(e) => set('publisher', e.target.value)}><option value="">All publishers</option>{publishers.map((p) => <option key={p} value={p}>{p.length > 60 ? `${p.slice(0, 58)}…` : p}</option>)}</select></label>
        <label className="block"><span className="block text-xs bx-muted mb-1">Recheck</span><select className="bx-input" value={recheck} onChange={(e) => set('recheck', e.target.value)} data-testid="ref-recheck"><option value="">Any</option><option value="pending">Not yet re-read against the live page</option><option value="done">Re-read</option></select></label>
        <label className="block"><span className="block text-xs bx-muted mb-1">Contains</span><input className="bx-input" value={q} onChange={(e) => set('q', e.target.value)} /></label>
      </div>
      <p className="mt-3 text-sm bx-muted" role="status">{index ? `${shown.length.toLocaleString()} of ${index.length.toLocaleString()} references` : 'Loading…'}</p>
      {index && TIER_GROUPS.map((g) => {
        const list = shown.filter((r) => r.tier === g.id).sort((a, b) => (g.order === 'asc' ? a.year - b.year : b.year - a.year) || a.n - b.n);
        const visible = list.slice(0, Math.max(0, budget));
        budget -= visible.length;
        return (
          <section key={g.id} className="mt-8" aria-labelledby={`tier-${g.id}`} data-testid={`tier-${g.id}`}>
            <h2 id={`tier-${g.id}`} className="text-2xl flex items-baseline gap-2">{g.title} <span className="bx-tier">{list.length}</span></h2>
            <p className="text-sm bx-muted mt-1">{TIER_NOTE[g.id]}. {ORDER_NOTE[g.order]}</p>
            {list.length === 0 ? <p className="text-sm bx-muted mt-2">None with these filters.</p> : (
              <ul className="mt-2 grid gap-0.5">{visible.map((r) => <Row key={r.n} r={r} open={open.has(r.n)} onToggle={() => toggle(r.n)} />)}</ul>
            )}
            {visible.length < list.length && <p className="mt-2"><button type="button" className="bx-btn" onClick={() => setLimit((l) => l + 300)}>Show more ({list.length - visible.length} more in this tier)</button></p>}
          </section>
        );
      })}
    </div>
  );
}
