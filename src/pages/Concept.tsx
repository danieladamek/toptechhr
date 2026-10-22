import { Link } from 'react-router-dom';
import { QA } from '@/components/notebook/QuoteControl';
import conceptsJson from '@/data/concepts.json';
import type { Concept as ConceptT } from '@/types';
import { CONCEPT_WORD, CONCEPTS_LABEL, getConcept, getFigure, getTerm } from '@/lib/data';
import Markdown, { readerComponents } from '@/components/reader/Markdown';
// manifest.concept_self_checks is false for this pack (APP-SPEC v0.6): no questions, no heading for them, no placeholder
import PictureCard from '@/components/concepts/PictureCard';
import NotFound from './NotFound';

const concepts = conceptsJson as unknown as ConceptT[];

const conceptComponents = readerComponents;

export default function Concept({ id }: { id?: string }) {
  const c = concepts.find((x) => x.id === id);
  if (!c) return <NotFound />;
  const idx = concepts.findIndex((x) => x.id === c.id);
  return (
    <div className="max-w-5xl lg:grid lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-10">
      <QA as="article" route={`/library/primers/${c.id}`} type="concepts" id={c.id} title={`Primer: ${c.title}`} className="min-w-0">
        <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.2em] bx-muted">{CONCEPT_WORD.toUpperCase()} · {idx + 1} OF {concepts.length}</p>
        <h1 className="text-3xl sm:text-4xl mt-1 leading-tight">{c.title}</h1>
        <Markdown md={c.one_liner} components={conceptComponents} className="bx-prose mt-3 text-[16px]" />
        <div className="bx-card mt-4 p-4 border-l-4 border-l-[color:var(--bx-accent)]">
          <p className="text-[11px] font-semibold tracking-[0.15em] bx-muted">WHY THIS GUIDE NEEDS IT</p>
          <Markdown md={c.why_here} components={conceptComponents} className="mt-1 text-sm leading-6" />
        </div>
        <Markdown md={c.body_before} math={c.has_math} components={conceptComponents} className="bx-101 bx-prose text-ink dark:text-night-ink mt-6" />
        <PictureCard concept={c} />
        {c.body_after && <Markdown md={c.body_after} math={c.has_math} components={conceptComponents} className="bx-101 bx-prose text-ink dark:text-night-ink mt-4" />}
        <section className="mt-8" aria-labelledby="fr-h">
          <h2 id="fr-h" className="text-2xl">Further reading</h2>
          <ul className="mt-2 grid gap-1.5 text-sm">
            {c.further_reading.map((r) => <li key={r.url}><a className="underline" href={r.url} target="_blank" rel="noreferrer">{r.title} ↗</a>{r.kind && <span className="bx-chip bg-paper-2 dark:bg-night-2 ml-2">{r.kind}</span>}</li>)}
          </ul>
        </section>
        <p className="mt-8 flex flex-wrap gap-2 text-sm">
          {idx > 0 && <Link className="bx-btn" to={`/library/primers/${concepts[idx - 1].id}`}>← {concepts[idx - 1].title}</Link>}
          {idx < concepts.length - 1 && <Link className="bx-btn" to={`/library/primers/${concepts[idx + 1].id}`}>{concepts[idx + 1].title} →</Link>}
          <Link className="bx-btn ml-auto" to="/library/primers">All {CONCEPTS_LABEL.toLowerCase()}</Link>
        </p>
      </QA>
      <aside className="mt-8 lg:mt-0 text-sm">
        <div className="lg:sticky lg:top-20 grid gap-5">
          {c.prerequisites.length > 0 && <div><p className="text-[11px] font-semibold tracking-[0.15em] bx-muted">READ FIRST</p><ul className="mt-1 grid gap-1">{c.prerequisites.map((p) => <li key={p}><Link className="underline" to={`/library/primers/${p}`}>{getConcept(p)?.title ?? p}</Link></li>)}</ul></div>}
          <div><p className="text-[11px] font-semibold tracking-[0.15em] bx-muted">TERMS</p><ul className="mt-1 flex flex-wrap gap-1">{c.terms.map((t) => <li key={t}><Link className="bx-chip border border-[color:var(--bx-line)] hover:bg-paper-2 dark:hover:bg-night-2" to={`/library/glossary#${t}`}>{getTerm(t)?.term.split(' (')[0] ?? t}</Link></li>)}</ul></div>
          {c.figures.length > 0 && <div><p className="text-[11px] font-semibold tracking-[0.15em] bx-muted">FIGURES</p><ul className="mt-1 grid gap-1">{c.figures.map((f) => <li key={f}><Link className="underline" to={`/library/guide#figure-${f}`}>{getFigure(f)?.label ?? f} · {getFigure(f)?.title}</Link></li>)}</ul></div>}
          {c.used_by_concepts.length > 0 && <div><p className="text-[11px] font-semibold tracking-[0.15em] bx-muted">LEADS TO</p><ul className="mt-1 grid gap-1">{c.used_by_concepts.map((p) => <li key={p}><Link className="underline" to={`/library/primers/${p}`}>{getConcept(p)?.title ?? p}</Link></li>)}</ul></div>}
        </div>
      </aside>
    </div>
  );
}
