import { Link } from 'react-router-dom';
import type { Reference } from '@/types';
import { recordsIndexById } from '@/lib/records';
import { CONCEPT_WORD, getConcept, getFigure, getTerm, sectionTitle, TIER_NOTE } from '@/lib/data';
import Todo from '@/components/ui/Todo';
import Prose from '@/components/records/Prose';

const READ: Record<string, string> = { full: 'read in full', partial: 'read in part', 'not-fetched': 'not fetched' };
const ROLE_WORD: Record<string, string> = { support: 'support', 'data-source': 'data source', background: 'background', 'prior-result': 'prior result', method: 'method source', contrast: 'contrast' };
const Label = ({ children }: { children: React.ReactNode }) => <span className="block text-[11px] font-semibold tracking-[0.15em] bx-muted">{children}</span>;

/** A `used_by` key ("constraints/c-x", "glossary/k-and-n", "concepts/…") as a link where it resolves; ledger entries are counted, never shown. */
function UsedBy({ k }: { k: string }) {
  const [file, ...rest] = k.split('/');
  const id = rest.join('/');
  const m = recordsIndexById.get(k);
  if (m) return <Link className="underline mr-2" to={m.to}>{m.title.length > 60 ? `${m.title.slice(0, 58)}…` : m.title}</Link>;
  if (file === 'glossary') return <Link className="underline mr-2" to={`/library/glossary#${id}`}>glossary: {getTerm(id)?.term ?? id}</Link>;
  if (file === 'concepts') return <Link className="underline mr-2" to={`/library/primers/${id}`}>{CONCEPT_WORD}: {getConcept(id)?.title ?? id}</Link>;
  if (file === 'figures') return <Link className="underline mr-2" to={`/library/guide#figure-${id}`}>{getFigure(id)?.label ?? id}</Link>;
  return <span className="mr-2">{k}</span>;
}

/**
 * The reference card used everywhere — reader fold-outs, record pages, /references (KICKOFF §4). Everything on it
 * comes from the pack and renders as written: tier, tier_note, why_it_mattered on the seminal, source_kind,
 * study_design, population and effect as the work reports them, how much was read, the recheck state, and what in
 * the guide uses it.
 */
export default function ReferenceCard({ r, compact = false }: { r: Reference; compact?: boolean }) {
  const usedBy = (r.used_by ?? []).filter((k) => !k.startsWith('hypotheses/'));
  return (
    <div data-testid={`ref-card-${r.n}`} className="grid gap-2.5 min-w-0 [overflow-wrap:anywhere]">
      <p className="text-sm"><span className="font-semibold">[{r.n}]</span> {r.citation}</p>

      <p className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="bx-tier" title={TIER_NOTE[r.tier]}>{r.tier}</span>
        <span className="bx-chip border border-[color:var(--bx-line)] bx-muted" title={r.source_kind === 'secondary' ? 'A secondary source never carries a fact alone in this guide' : 'A primary source'}>{r.source_kind}</span>
        <span className="bx-chip bg-paper-2 dark:bg-night-2" data-testid="study-design">{r.study_design}</span>
        <span className="bx-chip bg-paper-2 dark:bg-night-2">{r.peer_reviewed ? 'peer reviewed' : 'not peer reviewed'}</span>
        <span className="bx-chip bg-paper-2 dark:bg-night-2">{READ[r.read] ?? r.read}</span>
        <span className="bx-chip bg-paper-2 dark:bg-night-2">{r.year}</span>
        <span className="bx-chip bg-paper-2 dark:bg-night-2" title={r.role_note}>{ROLE_WORD[r.role_here] ?? r.role_here}</span>
        {!r.verified && <span className="bx-todo">not verified — summary from abstract/metadata only</span>}
      </p>
      {r.recheck && <p className="text-xs" data-testid="recheck-line"><span className="bx-chip border border-dashed border-[color:var(--bx-line)] bx-muted">not yet re-read against the live page</span></p>}
      <p className="text-xs bx-muted">
        {r.publisher}{r.journal ? ` · ${r.journal}` : ''} · published {r.published} · accessed {r.accessed}
        {r.doi && <> · DOI <a className="underline" href={`https://doi.org/${r.doi}`} target="_blank" rel="noreferrer">{r.doi}</a></>}
        {' · '}<a className="underline" href={r.url} target="_blank" rel="noreferrer">open the source ↗</a>
      </p>
      {r.date_note && !compact && <p className="text-xs bx-muted">Date note: {r.date_note}</p>}
      {r.tier_note && <p className="text-xs bx-muted" data-testid="tier-note">Tier note: {r.tier_note}</p>}
      {r.anchor && <p className="text-xs"><span className="bx-chip border border-[color:var(--bx-line)]">scope anchor</span> <span className="bx-muted">named in the scope as a starting point of the sweep</span></p>}

      {(r.population || r.effect) && (
        <dl className="text-sm grid gap-1 sm:grid-cols-[auto_1fr] sm:gap-x-3" data-testid="ref-effect">
          {r.effect && <><dt className="text-xs font-semibold bx-muted">Effect, as reported</dt><dd><Prose md={r.effect} /></dd></>}
          {r.population && <><dt className="text-xs font-semibold bx-muted">Population</dt><dd><Prose md={r.population} /></dd></>}
        </dl>
      )}

      <div className="text-sm">
        <Label>WHAT THE SOURCE SAYS</Label>
        {r.summary.trim() ? <div className={`mt-1 ${compact ? 'leading-6' : 'bx-prose'}`}><Prose md={r.summary} /></div> : <p className="mt-1"><Todo>summary pending — not in the content pack</Todo></p>}
      </div>
      {r.why_it_mattered && <p className="text-sm" data-testid="why-it-mattered"><span className="font-semibold">Why it mattered: </span>{r.why_it_mattered}</p>}
      {r.role_note && !compact && <p className="text-xs bx-muted">Role here: {r.role_note}</p>}

      {r.key_facts.length > 0 && (
        <div className="text-sm border-l-2 border-[color:var(--bx-line)] pl-3">
          <Label>KEY FACTS AS RECORDED</Label>
          <ul className="mt-1.5 grid gap-1 list-disc pl-4" data-testid="key-facts">
            {r.key_facts.slice(0, compact ? 5 : undefined).map((k, i) => <li key={i}><Prose md={k} /></li>)}
            {compact && r.key_facts.length > 5 && <li className="text-xs bx-muted list-none">… {r.key_facts.length - 5} more on the full card</li>}
          </ul>
        </div>
      )}

      {r.quotes.length > 0 && (
        <details className="text-sm" open={!compact && r.quotes.length <= 2}>
          <summary className="cursor-pointer bx-muted">{r.quotes.length} quotation{r.quotes.length === 1 ? '' : 's'} (≤ 25 words, as on the page)</summary>
          <ul className="mt-1 grid gap-1">{r.quotes.map((q, i) => <li key={i} className="border-l-2 border-[color:var(--bx-line)] pl-2">“{q.replace(/^["“]|["”]$/g, '')}”</li>)}</ul>
        </details>
      )}

      <p className="text-xs bx-muted">
        {r.cited_sections.length > 0 && <>Cited in the guide: {r.cited_sections.map((s) => <Link key={s} className="underline mr-2" to={`/library/guide#${s}`}>{sectionTitle(s)}</Link>)}</>}
        {usedBy.length > 0 && <span data-testid="used-by">{r.cited_sections.length > 0 && ' · '}Used by {usedBy.length}: {usedBy.slice(0, compact ? 5 : 60).map((k) => <UsedBy key={k} k={k} />)}{usedBy.length > (compact ? 5 : 60) && '…'}</span>}
        {r.cited_ledger > 0 && <> · and {r.cited_ledger} entr{r.cited_ledger === 1 ? 'y' : 'ies'} of the <Link className="underline" to="/methods#ledger">hypothesis ledger</Link></>}
        {r.cited_sections.length === 0 && usedBy.length === 0 && !r.cited_ledger && <>Cited nowhere in this build.</>}
      </p>

      <div className="flex flex-wrap items-center gap-2 no-print">
        {compact && <Link className="underline text-xs font-semibold" to={`/library/sources#ref-${r.n}`}>Open in references →</Link>}
      </div>
    </div>
  );
}
