import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getConcept, getFigure, getTerm, sectionTitle, terms, scrollToId } from '@/lib/data';
import { loadGlossary, loadHr, useAsync } from '@/lib/heavy';
import { QA } from '@/components/notebook/QuoteControl';
import { S } from '@/strings';
import type { GlossaryEntry } from '@/types';
import KindChip from '@/components/ui/KindChip';
import { CONCEPT_WORD, CONCEPTS_LABEL } from '@/lib/data';
import Prose from '@/components/records/Prose';
import { recordsIndexById } from '@/lib/records';

const EMPTY: GlossaryEntry[] = [];
/** The pack's own `domain` vocabulary (KICKOFF §3.3), in the order the guide groups it. */
const DOMAINS = ['all', 'evidence', 'selection', 'attraction', 'pay', 'clearance', 'contract', 'law', 'people', 'planning', 'guide'] as const;
const DOMAIN_LABEL: Record<string, string> = { evidence: 'evidence', selection: 'selection', attraction: 'attraction', pay: 'pay', clearance: 'clearance', contract: 'contract', law: 'law', people: 'people', planning: 'planning', guide: 'guide' };
const letterOf = (s: string) => { const c = s.replace(/^[^A-Za-z0-9]+/, '').charAt(0).toUpperCase(); return /[A-Z]/.test(c) ? c : '#'; };

export default function Glossary() {
  const loc = useLocation();
  const [q, setQ] = useState('');
  const [domain, setDomain] = useState<(typeof DOMAINS)[number]>('all');
  const [group, setGroup] = useState<'domain' | 'letter'>('domain');
  const glossary = useAsync<GlossaryEntry[]>(loadGlossary) ?? EMPTY;
  const hr = useAsync(loadHr);
  const aliasesOf = (id: string) => (hr?.aliases ?? []).filter((a) => a.term === id).map((a) => a.alias);
  useEffect(() => { if (loc.hash && glossary.length) scrollToId(loc.hash.slice(1)); }, [loc.hash, glossary.length]);
  const sorted = useMemo(() => [...glossary].sort((a, b) => a.term.localeCompare(b.term, 'en', { sensitivity: 'base' })), [glossary]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return sorted.filter((t) => (domain === 'all' || t.domain === domain) && (!needle || `${t.term} ${t.variants.join(' ')} ${t.short} ${t.definition}`.toLowerCase().includes(needle)));
  }, [sorted, q, domain]);
  const groupKey = (t: GlossaryEntry) => (group === 'domain' ? t.domain : letterOf(t.term));
  const ordered = useMemo(() => (group === 'domain' ? DOMAINS.slice(1).flatMap((d) => shown.filter((t) => t.domain === d)) : shown), [shown, group]);
  const letters = [...new Set(ordered.map(groupKey))];
  return (
    <div className="max-w-[52rem]">
      <h1 className="text-[32px] sm:text-[38px]">Glossary</h1>
      <p className="bx-prose mt-2">
        {terms.length} terms — methodological and statistical as well as legal and contractual — grouped by the guide’s own domains: evidence, selection, attraction, pay, clearance, contract,
        law, people, planning and the guide itself. HR vocabulary the pack does not use is listed as “also called” beside the pack’s term; the definition is always the pack’s. Every entry is linkable (<code className="font-mono text-xs">/library/glossary#term-id</code>) and links back to the guide sections, records and
        {' '}{CONCEPTS_LABEL} where it appears. Definitions were written by the guide’s builder from the pack’s records and carry their citations. See <Link className="underline" to="/library/methods">Methods</Link>.
      </p>
      <div className="mt-4 flex flex-wrap gap-2 no-print">
        <label className="sr-only" htmlFor="glossary-q">Search the glossary</label>
        <input id="glossary-q" className="bx-input max-w-xs" placeholder="Search terms…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div role="group" aria-label="Filter by domain" className="inline-flex flex-wrap gap-1">
          {DOMAINS.map((k) => <button key={k} type="button" className={`bx-btn !py-1 ${domain === k ? 'bx-btn-on' : ''}`} aria-pressed={domain === k} onClick={() => setDomain(k)} data-testid={`domain-${k}`}>{k === 'all' ? 'all' : DOMAIN_LABEL[k]}</button>)}
        </div>
        <div role="group" aria-label="Group by" className="inline-flex gap-1 text-sm items-center"><span className="bx-muted text-xs">Group by</span>
          <button type="button" className={`bx-btn !py-1 ${group === 'domain' ? 'bx-btn-on' : ''}`} aria-pressed={group === 'domain'} onClick={() => setGroup('domain')}>domain</button>
          <button type="button" className={`bx-btn !py-1 ${group === 'letter' ? 'bx-btn-on' : ''}`} aria-pressed={group === 'letter'} onClick={() => setGroup('letter')}>letter</button>
        </div>
      </div>
      <nav aria-label="Jump to letter" className="mt-3 flex flex-wrap gap-1 text-sm no-print">
        {letters.map((l) => <a key={l} href={`#letter-${l}`} className="bx-btn !px-2 !py-0.5">{group === 'domain' ? DOMAIN_LABEL[l] ?? l : l}</a>)}
      </nav>
      <p className="mt-2 text-xs bx-muted" role="status">{glossary.length ? `${shown.length} of ${glossary.length} terms` : 'Loading…'}</p>
      <dl className="mt-6 grid gap-6">
        {ordered.map((t, i) => {
          const letter = groupKey(t);
          const first = i === 0 || groupKey(ordered[i - 1]) !== letter;
          const concept = getConcept(t.concept ?? t.in_concepts[0]);
          return (
            <div key={t.id}>
              {first && <h2 id={`letter-${letter}`} className="text-xl bx-muted border-b border-[color:var(--bx-line)] mb-3 scroll-mt-24">{group === 'domain' ? DOMAIN_LABEL[letter] ?? letter : letter}</h2>}
              <div id={t.id} className="scroll-mt-24 rounded-md -mx-2 px-2 py-1">
                <dt className="text-xl font-display flex flex-wrap items-baseline gap-2">{t.term} <KindChip kind={t.domain} /> <a href={`#${t.id}`} className="bx-muted text-sm font-body no-underline" aria-label={`Link to ${t.term}`}>#</a></dt>
                <dd>
                  <p className="mt-1 font-semibold text-[15px]">{t.short}</p>
                  <QA route={`/library/glossary#${t.id}`} type="glossary" id={t.id} title={`Glossary: ${t.term}`}><div className="bx-prose mt-1"><Prose md={t.definition} /></div></QA>
                  {aliasesOf(t.id).length > 0 && <p className="mt-1 text-[14px]" data-testid="also-called"><span className="font-semibold">{S.alsoCalled}:</span> {aliasesOf(t.id).join(' · ')}</p>}
                  {t.variants.filter((v) => !aliasesOf(t.id).includes(v)).length > 0 && <p className="mt-1 text-xs bx-muted">Also written: {t.variants.filter((v) => !aliasesOf(t.id).includes(v)).join(' · ')}</p>}
                  <p className="mt-2 text-sm flex flex-wrap gap-x-4 gap-y-1">
                    {concept && <Link className="underline" to={`/library/primers/${concept.id}`}>Read the {CONCEPT_WORD} → {concept.title}</Link>}
                    {t.see.length > 0 && <span>See also: {t.see.map((s) => <Link key={s} className="underline mr-2" to={`/library/glossary#${s}`}>{getTerm(s)?.term ?? s}</Link>)}</span>}
                  </p>
                  {t.appears_in.length > 0 && <p className="mt-1 text-xs bx-muted">In the guide: {t.appears_in.map((s) => <Link key={s} className="underline mr-2" to={`/library/guide#${s}`}>{sectionTitle(s)}</Link>)}</p>}
                  {t.in_records.length > 0 && <p className="mt-1 text-xs bx-muted">In {t.in_records.length} record{t.in_records.length === 1 ? '' : 's'}: {t.in_records.slice(0, 8).map((k) => { const m = recordsIndexById.get(k); return m ? <Link key={k} className="underline mr-2" to={m.to}>{m.title.slice(0, 50)}</Link> : null; })}{t.in_records.length > 8 && '…'}</p>}
                  {t.in_concepts.length > 0 && <p className="mt-1 text-xs bx-muted">In {CONCEPTS_LABEL.toLowerCase()}: {t.in_concepts.map((c) => <Link key={c} className="underline mr-1.5" to={`/library/primers/${c}`}>{getConcept(c)?.title ?? c}</Link>)}</p>}
                  {!t.appears_in.length && !t.in_records.length && !t.in_concepts.length && <p className="mt-1 text-xs bx-muted">Not linked anywhere in this build — listed on /methods.</p>}
                  {t.figures.length > 0 && <p className="mt-1 text-xs bx-muted">In figures: {t.figures.map((f) => <Link key={f} className="underline mr-2" to={`/library/guide#figure-${f}`}>{getFigure(f)?.label ?? f}</Link>)}</p>}
                </dd>
              </div>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
