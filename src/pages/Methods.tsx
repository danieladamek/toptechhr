import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import provenanceJson from '@/data/provenance.json';
import buildErrorsJson from '@/data/build-errors.json';
import type { BuildError, Hypothesis, TodoItem } from '@/types';
import { AS_OF, asOfLong, assetUrl, CONCEPTS_LABEL, getTerm, LEDGER_STATUSES, manifest, OVERLAY_LABEL, scrollToId, sectionTitle } from '@/lib/data';
import { loadLedger, loadQueries, loadScope, loadSynthesis, loadTodo, useAsync } from '@/lib/heavy';
import { findRecord, recordMeta, recordsIndexById } from '@/lib/records';
import Prose from '@/components/records/Prose';
import FieldView from '@/components/records/FieldView';
import type { RecordType, OverlayKey } from '@/types';
import { Controversies, HrLayerNote, StagesAndPatterns } from '@/components/methods/MethodsExtra';

const buildErrors = buildErrorsJson as BuildError[];
/** provenance.json as written; lists that are empty in this build are typed loosely so the page still lists them when they are not. */
type Voice = { count: number; items: { where: string; excerpt: string }[]; imperatives: { where: string; excerpt: string }[]; procedure_imperatives: number };
const P = { ...provenanceJson, voice: provenanceJson.voice as unknown as Voice };

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="bx-card p-3"><p className="text-[11px] font-semibold tracking-[0.15em] bx-muted">{label}</p><p className="text-base font-display mt-0.5">{value}</p></div>;
}
function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return <h2 id={id} className="text-[26px] mt-12 scroll-mt-28">{children}</h2>;
}
const list = (o: Record<string, number> | undefined | null) => Object.entries(o ?? {}).map(([k, v]) => `${k} ${Number(v).toLocaleString()}`).join(' · ');
const TODO_KIND: Record<string, string> = { gap: 'Gaps', conflict: 'Conflicts between sources', unverified: 'Unverified', recheck: 'Recheck', hypothesis: 'Ledger adjudications awaiting a source' };
const TODO_PAGE = 60;
/** "constraints/c-x/what" → a link to the record when it resolves. */
const keyLink = (k: string) => { const [t, id] = k.split('/'); const m = recordsIndexById.get(`${t}/${id}`); return m ? <Link className="underline" to={m.to}>{k}</Link> : k.startsWith('review.md/') ? <Link className="underline" to={`/library/guide#${k.split('/')[1]}`}>{k}</Link> : <code className="font-mono text-xs">{k}</code>; };

function TodoKind({ kind, items, open }: { kind: string; items: TodoItem[]; open: boolean }) {
  const [n, setN] = useState(TODO_PAGE);
  const [q, setQ] = useState('');
  const shown = q ? items.filter((t) => `${t.id} ${t.where} ${t.what} ${t.text}`.toLowerCase().includes(q.toLowerCase())) : items;
  return (
    <details className="mt-2 text-sm" data-testid={`todo-${kind}`} open={open}>
      <summary className="cursor-pointer"><span className="bx-todo">TODO(author) · {TODO_KIND[kind] ?? kind}: {items.length}</span></summary>
      <input className="bx-input max-w-xs mt-2" placeholder="Filter…" value={q} onChange={(e) => { setQ(e.target.value); setN(TODO_PAGE); }} aria-label={`Filter ${TODO_KIND[kind] ?? kind}`} />
      <ul className="mt-2 grid gap-2">{shown.slice(0, n).map((t) => (
        <li key={t.id} id={`todo-${t.id}`} className="scroll-mt-24 border-l-2 border-[color:var(--bx-line)] pl-2">
          <code className="font-mono text-xs">{t.id}</code> <span className="bx-muted">({keyLink(t.where)})</span> — <Prose md={t.what} className="inline [&_p]:inline" />
          {t.text && <div className="text-xs bx-muted mt-0.5"><Prose md={t.text} /></div>}
        </li>
      ))}</ul>
      {shown.length > n && <button type="button" className="bx-btn mt-2" onClick={() => setN((x) => x + TODO_PAGE * 3)}>Show more ({shown.length - n} left)</button>}
    </details>
  );
}

/** A ledger entry's `original`: a category name, or the row as the author wrote it (generalised), field by field. */
function Original({ o }: { o: Hypothesis['original'] }) {
  if (typeof o === 'string') return <span>{o}</span>;
  const labels: Record<string, string> = { challenge: 'Challenge', mitigation: 'Mitigation', tradeoff: 'Trade-off', dependencies: 'Dependencies', depends_on: 'Depends on' };
  return (
    <dl className="grid gap-0.5 sm:grid-cols-[7rem_1fr] sm:gap-x-2">
      {Object.entries(o).map(([k, v]) => <Fragment key={k}><dt className="text-xs font-semibold bx-muted">{labels[k] ?? k}</dt><dd>{Array.isArray(v) ? v.join(', ') : String(v)}</dd></Fragment>)}
    </dl>
  );
}

/** The hypothesis ledger in full (KICKOFF §1): the only place a guess is shown, each with its status and evidence. */
function Ledger() {
  const ledger = useAsync(loadLedger);
  const [status, setStatus] = useState('');
  if (!ledger) return <p className="bx-muted" role="status">Loading…</p>;
  const shown = ledger.entries.filter((h) => !status || h.status === status);
  const agree = Object.entries(ledger.adjudicated_counts).every(([k, v]) => (ledger.counts[k] ?? 0) === v);
  return (
    <div data-testid="ledger">
      <details className="mt-2 text-sm"><summary className="cursor-pointer bx-muted">The ledger’s header, as written</summary><pre className="mt-2 whitespace-pre-wrap font-body text-[13px] leading-6">{ledger.header}</pre></details>
      <div className="mt-3 overflow-x-auto"><table className="bx-table" data-testid="ledger-counts">
        <thead><tr><th scope="col">Status</th><th scope="col">Adjudicated (header)</th><th scope="col">Entries in the ledger</th></tr></thead>
        <tbody>{LEDGER_STATUSES.filter((s) => s in ledger.adjudicated_counts || s in ledger.counts).map((s) => <tr key={s}><td><button type="button" className="underline" onClick={() => setStatus(status === s ? '' : s)}>{s}</button></td><td className="tabular-nums">{ledger.adjudicated_counts[s] ?? 0}</td><td className="tabular-nums" data-testid={`ledger-count-${s}`}>{ledger.counts[s] ?? 0}</td></tr>)}</tbody>
      </table></div>
      <p className="text-xs bx-muted mt-1">{agree ? 'The counts in the header agree with the entries.' : 'The header counts and the entries disagree; the build lists the difference as an error.'} Version {ledger.version}, as of {ledger.as_of}. {ledger.entries.length} entries{status ? `; showing ${shown.length} ${status}` : ''}.</p>
      <ol className="mt-3 grid gap-2">
        {shown.map((h) => (
          <li key={h.id} id={h.id} className="bx-card p-3 text-sm scroll-mt-24" data-testid={`ledger-${h.id}`}>
            <p className="flex flex-wrap items-center gap-2"><code className="font-mono text-xs">{h.id}</code><span className="bx-status font-semibold">{h.status}</span><span className="text-xs bx-muted">{h.kind}{h.stage_guess ? ` · guessed stage ${h.stage_guess}` : ''}{h.adjudicated ? ` · adjudicated ${h.adjudicated}` : ''}{h.sweep !== undefined ? ` · sweep ${h.sweep}` : ''}</span></p>
            <div className="mt-1.5"><span className="text-xs font-semibold bx-muted">The guess, in general words: </span><Original o={h.original} /></div>
            {h.evidence && <div className="mt-1.5"><span className="text-xs font-semibold bx-muted">What the evidence says: </span><Prose md={h.evidence} /></div>}
            {h.mapped_to.length > 0 && <p className="mt-1.5 text-xs"><span className="bx-muted">Absorbed by: </span>{h.mapped_to.map((m) => { const r = findRecord(m); return r ? <Link key={m} className="underline mr-2" to={r.to}>{r.title}</Link> : <span key={m} className="bx-todo mr-2">{m}</span>; })}</p>}
            {h.queries.length > 0 && <p className="mt-1 text-xs bx-muted">Queries: {h.queries.map((q) => String(q)).join(' · ')}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** `/methods` — the app's honesty (APP-SPEC §2, topic mode; KICKOFF §4). */
export default function Methods() {
  const scope = useAsync(loadScope);
  const todo = useAsync(loadTodo);
  const syn = useAsync(loadSynthesis);
  const queries = useAsync(loadQueries) ?? [];
  const [params] = useSearchParams();
  const todoTarget = params.get('todo');
  const [qf, setQf] = useState('');
  const [slice, setSlice] = useState('');
  const [qn, setQn] = useState(100);
  const [synFile, setSynFile] = useState('');
  const slices = useMemo(() => [...new Set(queries.map((q) => q.slice))].sort(), [queries]);
  const bySlice = useMemo(() => slices.map((s) => { const qs = queries.filter((q) => q.slice === s); return { s, n: qs.length, hits: qs.reduce((a, q) => a + (q.hits_n ?? 0), 0), zero: qs.filter((q) => q.hits_n === 0).length }; }), [slices, queries]);
  const shownQ = useMemo(() => { const n = qf.trim().toLowerCase(); return queries.map((q, i) => ({ ...q, i })).filter((q) => (!slice || q.slice === slice) && (!n || `${q.text} ${q.engine} ${q.note ?? ''}`.toLowerCase().includes(n))); }, [qf, slice, queries]);
  const todoByKind = useMemo(() => (todo ?? []).reduce<Record<string, TodoItem[]>>((a, t) => { (a[t.kind] ??= []).push(t); return a; }, {}), [todo]);
  const todoKindOf = todoTarget ? (todo ?? []).find((t) => t.id === todoTarget)?.kind : undefined;
  useEffect(() => { if (todo && todoTarget) scrollToId(`todo-${todoTarget}`); }, [todo, todoTarget]);
  const cell = 'border-b border-[color:var(--bx-line)] px-2 py-1 align-top';
  const S = scope as (typeof scope & { evidence_grades: Record<string, string>; search_strategy: { pre_sweep?: unknown; sweeps_run?: unknown; sweep_order_proposed?: unknown; snowball?: unknown } }) | undefined;
  const cp = (scope?.corpus_profile ?? {}) as Record<string, unknown>;
  const recSyn = (syn?.records ?? []).filter((s) => !synFile || s.file === synFile);

  return (
    <div className="max-w-[60rem] text-[16px]">
      <h1 className="text-[32px] sm:text-[38px]">Methods &amp; provenance</h1>
      <p className="mt-2 flex flex-wrap items-center gap-2">
        <span className="bx-chip border border-[color:var(--bx-line)] bx-muted">COMMISSIONED GUIDE — NOT PEER REVIEWED · NOT ADVICE</span>
        <span className="bx-asof">Current as of {AS_OF}</span>
      </p>
      <p className="mt-3 text-[17px] leading-8 font-semibold">This is a scope-bounded commissioned review, not a systematic review.</p>
      <p className="mt-2">
        The evidence behind TopTechHR is the Key Personnel content pack, written by an AI research builder ({manifest.builder.name} v{manifest.builder.version}, {manifest.builder.date}) from a scoped sweep of published studies and public government sources;
        this app was built from that pack by Claude Code. Nothing here is official, peer reviewed or advice. What it offers instead is traceability: every claim carries a citation, every inference is
        marked as one, and the scope, the interview, the author’s own guesses with what the evidence said about each, and every search query are published below. It is current as of {asOfLong()}.
      </p>
      <p className="mt-2 font-semibold" data-testid="recheck-statement">Every one of the {P.references.total} references awaits its re-read against the live page: at this build each carries <code>recheck: true</code>, and each card says so.</p>
      <nav aria-label="On this page" className="mt-3 text-sm flex flex-wrap gap-x-3 gap-y-1">
        {[['hr-layer', 'The HR layer'], ['counts', 'Provenance counts'], ['errors', 'Build errors'], ['todo', 'TODO(author)'], ['synthesis', 'Synthesis'], ['scope', 'Scope'], ['interview', 'Interview'], ['grades', 'Evidence grades'], ['queries', 'Every query'], ['corpus', 'Corpus profile'], ['gaps', 'Known gaps'], ['ledger', 'Hypothesis ledger'], ['voice', 'Voice'], ['terms', 'Term linking'], ['build', 'How the app was built']].map(([id, l]) => <a key={id} className="underline" href={`#${id}`}>{l}</a>)}
      </nav>

      <H2 id="hr-layer">The HR layer and the pinned pack</H2>
      <HrLayerNote />

      <H2 id="counts">Provenance counts</H2>
      <div className="mt-3 grid gap-2 sm:grid-cols-3" data-testid="provenance-counts">
        <Stat label="GUIDE" value={`${P.words.toLocaleString()} words · ${P.sections} sections`} />
        <Stat label="BLOCKS (CITED / FRAMING / SYNTHESIS)" value={`${P.blocks.total} (${P.blocks.cited} / ${P.blocks.framing} / ${P.blocks.synthesis})`} />
        <Stat label="SYNTHESIS: GUIDE SENTENCES / RECORD FIELDS" value={`${P.synthesis_passages} / ${P.record_synthesis_markers}`} />
        <Stat label="UNCITED BLOCKS" value={<span data-testid="uncited-count">{P.blocks.uncited} in the guide · {P.concept_uncited} in {CONCEPTS_LABEL} · {P.glossary_uncited} in the glossary · {P.record_prose.uncited} in records · {P.ledger_uncited} in the ledger</span>} />
        <Stat label="GLOSSARY TERMS LINKED" value={`${P.terms.linked} of ${P.terms.occurring} occurring (${P.terms.linked_pct_of_occurring}%)`} />
        <Stat label="TERMS (TOTAL / REACHABLE / UNMATCHED IN THE GUIDE)" value={`${P.terms.total} / ${P.terms.reachable_anywhere} / ${P.terms.unmatched.length}`} />
        <Stat label="REFERENCES BY TIER" value={`${P.references.total} · ${list(P.references.by_tier)}`} />
        <Stat label="BY SOURCE KIND" value={list(P.references.by_source_kind)} />
        <Stat label="BY STUDY DESIGN" value={list(P.references.by_study_design)} />
        <Stat label="CITED / NEVER CITED" value={`${P.references.cited} / ${P.references.never_cited}${P.references.never_cited_list.length ? ` ([${P.references.never_cited_list.join('], [')}])` : ''}`} />
        <Stat label="RECHECK PENDING / UNVERIFIED BUT CITED" value={`${P.references.recheck_pending} / ${P.references.unverified_but_cited.length}`} />
        <Stat label="FIGURES BY SYNTHESIS KIND" value={`${P.figures.total} (${list(P.figures.by_synthesis)})`} />
        <Stat label="RECORD PROSE ITEMS (CITED)" value={`${P.record_prose.items.toLocaleString()} (${P.record_prose.cited.toLocaleString()})`} />
        <Stat label="TODO(AUTHOR)" value={`${P.todo.count} · ${list(P.todo.by_kind)}${P.todo.inline_markers.length ? ` · ${P.todo.inline_markers.length} inline` : ''}`} />
        <Stat label="QUERIES" value={`${P.queries.total} · ${P.queries.hits.toLocaleString()} hits · ${P.queries.zero_hit} with none`} />
      </div>
      <p className="mt-3 text-sm" data-testid="records-by-file"><span className="font-semibold">Records by file: </span>{list(P.records as Record<string, number>)}.</p>
      <p className="mt-1 text-sm" data-testid="edges-by-relation"><span className="font-semibold">Edges by relation: </span>{list(P.edges_by_relation)}; by grade {list(P.edges_by_grade)}.</p>
      <p className="mt-1 text-sm" data-testid="ledger-by-status"><span className="font-semibold">Hypothesis ledger by status: </span>{list(P.ledger.by_status)} ({P.ledger.entries} entries; {list(P.ledger.by_kind)}).</p>
      <p className="mt-1 text-sm" data-testid="overlays-by-status"><span className="font-semibold">State overlays: </span>{P.states.overlays} across {P.states.records} records; {P.states.primary_pending.true} compilation-sourced (primary_pending) and {P.states.primary_pending.false} resting on a primary read in the sweep.</p>
      <details className="mt-1 text-sm"><summary className="cursor-pointer bx-muted">Overlays by status, one row per overlay</summary>
        <ul className="mt-1 grid gap-0.5">{(Object.keys(P.states.by_status) as OverlayKey[]).map((o) => <li key={o}><span className="font-semibold">{OVERLAY_LABEL[o]}:</span> {list((P.states.by_status as Record<string, Record<string, number>>)[o])} · compilation-sourced {(P.states.primary_pending_by_overlay as Record<string, number>)[o]}</li>)}</ul>
      </details>
      <p className="mt-1 text-sm"><span className="font-semibold">Changes by status: </span>{list(P.changes_by_status)}; superseded: {P.superseded.join(', ') || 'none'}.</p>
      <p className="mt-1 text-sm">The full record is <a className="underline" href={assetUrl('provenance.json')}>provenance.json</a>.</p>

      <H2 id="errors">Build errors ({buildErrors.length})</H2>
      {buildErrors.length === 0 ? <p className="mt-2">The content build found no errors.</p> : (
        <>
          <p className="mt-2">The content build checks every id and every citation in the pack and applies the citation-coverage gate to the guide, the {CONCEPTS_LABEL}, the glossary definitions, the record prose and the ledger’s evidence. These are errors in the pack, recorded rather than repaired: uncited prose is never given a citation, and an unknown id is never re-pointed at a similar one. The app was built from everything else.</p>
          <ul className="mt-2 grid gap-1 text-sm" data-testid="build-errors">{buildErrors.map((e, i) => <li key={i}><span className="bx-todo mr-1">error</span>{keyLink(e.where)} — {e.message}</li>)}</ul>
        </>
      )}

      <H2 id="todo">TODO(author) — the open items ({P.todo.count})</H2>
      <p className="mt-2">Every gap, unverified fact, conflict between sources, recheck item and ledger adjudication awaiting a source that the pack records, by kind. They are shown, never filled.</p>
      {!todo && <p className="bx-muted" role="status">Loading…</p>}
      {Object.entries(todoByKind).map(([k, items]) => <TodoKind key={k} kind={k} items={items} open={todoKindOf === k} />)}
      {P.todo.inline_markers.length > 0 && (
        <div className="mt-3 text-sm" data-testid="inline-todos"><p className="font-semibold">TODO(author) written inside pack text ({P.todo.inline_markers.length})</p>
          <ul className="mt-1 grid gap-1">{P.todo.inline_markers.map((t, i) => <li key={i}><span className="bx-todo mr-1">TODO(author)</span>{keyLink(t.where)} — {t.excerpt}</li>)}</ul>
        </div>
      )}

      <H2 id="synthesis">Every synthesis passage</H2>
      <p className="mt-2">A <em>synthesis</em> passage states a conclusion the cited sources do not individually state. In the guide each is marked with a quiet underline and the word synthesis; in a record, a field whose text carries “(synthesis)” sits under a quiet left rule with the same label. Here is every one, linked.</p>
      <h3 className="text-lg mt-4">In the guide ({syn?.review.length ?? P.synthesis_passages})</h3>
      <ol className="mt-2 grid gap-2 text-sm" data-testid="synthesis-list">
        {(syn?.review ?? []).map((s) => <li key={s.id}><Link className="underline font-semibold" to={`/library/guide#${s.id}`} data-testid={`synthesis-link-${s.id}`}>{sectionTitle(s.section)}</Link> — {s.excerpt}{s.excerpt.length >= 220 ? '…' : ''}</li>)}
      </ol>
      <h3 className="text-lg mt-6">In the records ({syn?.records.length ?? P.record_synthesis_markers})</h3>
      <p className="text-sm mt-1">By file: {list(P.record_synthesis_by_file)} (and every controversy’s “what a recruiter can rely on”).</p>
      <select className="bx-input max-w-xs mt-2" value={synFile} onChange={(e) => setSynFile(e.target.value)} aria-label="Filter record synthesis by file"><option value="">Every file</option>{Object.keys(P.record_synthesis_by_file).concat(['controversies']).filter((x, i, a) => a.indexOf(x) === i).map((f) => <option key={f} value={f}>{f}</option>)}</select>
      <ol className="mt-2 grid gap-1.5 text-sm max-h-[40rem] overflow-y-auto" data-testid="record-synthesis-list">
        {recSyn.map((s) => {
          const m = recordMeta(s.file as RecordType, s.record);
          const to = m ? (m.to.includes('#') ? `${m.to.split('#')[0]}#${s.id}` : `${m.to}#${s.id}`) : '#';
          return <li key={s.id}><Link className="underline font-semibold" to={to}>{m?.title ?? s.record}</Link> <span className="bx-muted text-xs">({s.file} · {s.field})</span> — {s.excerpt}{s.excerpt.length >= 220 ? '…' : ''}</li>;
        })}
      </ol>

      {S && (
        <>
          <H2 id="scope">Scope</H2>
          <p className="mt-2"><span className="font-semibold">Topic: </span>{S.topic}</p>
          <p className="mt-1"><span className="font-semibold">Question: </span>{S.question}</p>
          <p className="mt-1 text-sm">Purpose {S.purpose} · level: {S.level} · stance {S.stance} · depth {S.depth} · current from {S.time_window.current_from}{S.time_window.seminal ? `; seminal: ${S.time_window.seminal}` : ''}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 text-sm" data-testid="scope-in-out">
            <div className="bx-card p-3"><p className="font-semibold">In</p><ul className="list-disc pl-5 mt-1 grid gap-1">{S.boundary.in.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
            <div className="bx-card p-3"><p className="font-semibold">Out</p><ul className="list-disc pl-5 mt-1 grid gap-1">{S.boundary.out.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
          </div>
          {S.boundary.rationale && <p className="mt-2 text-sm"><span className="font-semibold">Why: </span>{S.boundary.rationale}</p>}
          {S.excluded.length > 0 && <><p className="mt-3 font-semibold text-sm">Left out on purpose</p><ul className="list-disc pl-5 text-sm grid gap-1">{S.excluded.map((x, i) => <li key={i}>{x.what} — {x.why}</li>)}</ul></>}
          {S.anchors.length > 0 && <><p className="mt-3 font-semibold text-sm">Anchors</p><ul className="list-disc pl-5 text-sm grid gap-1" data-testid="anchors">{(S.anchors as { citation: string; why?: string; proposed_by?: string }[]).map((x, i) => <li key={i}>{x.citation} — {x.why}{x.proposed_by === 'author' && <span className="bx-muted"> (the author’s starting point: carried only as the hypothesis ledger below, never as a source)</span>}</li>)}</ul></>}
          {S.assumptions.length > 0 && <><p className="mt-3 font-semibold text-sm">Assumptions</p><div className="text-sm"><FieldView value={S.assumptions} /></div></>}

          <H2 id="interview">The interview, as asked and answered ({S.interview.length})</H2>
          {S.assumed && <p className="mt-2"><span className="bx-todo">Some answers were assumed</span></p>}
          <dl className="mt-3 grid gap-3 text-sm" data-testid="interview">{(S.interview as { q: string; answer: string; asked?: string }[]).map((x, i) => <div key={i} className="bx-card p-3"><dt className="font-semibold">{x.q}</dt><dd className="mt-1">“{x.answer}”{x.asked ? <span className="bx-muted"> ({String(x.asked)})</span> : null}</dd></div>)}</dl>

          <H2 id="grades">The evidence grades</H2>
          <dl className="mt-2 grid gap-1.5 text-sm sm:grid-cols-[11rem_1fr]" data-testid="evidence-grades">{Object.entries(S.evidence_grades).map(([k, v]) => <Fragment key={k}><dt className="font-semibold">{k}</dt><dd>{v}</dd></Fragment>)}</dl>
        </>
      )}

      <H2 id="queries">Every query ({queries.length})</H2>
      <p className="mt-2">Every search the sweep ran, with the hits each returned as the sweep noted them — including the ones that found nothing ({P.queries.zero_hit}). {S && <>Run on {String(S.search_strategy.run_on)}; sources {S.search_strategy.sources.join(', ')}.</>}</p>
      {S && (
        <div className="mt-2 grid gap-2 text-sm">
          {S.search_strategy.sweeps_run !== undefined && <div className="bx-card p-3"><p className="font-semibold">Sweeps run</p><FieldView value={S.search_strategy.sweeps_run} /></div>}
          {S.search_strategy.pre_sweep !== undefined && <div className="bx-card p-3"><p className="font-semibold">Pre-sweep</p><FieldView value={S.search_strategy.pre_sweep} /></div>}
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="bx-card p-3"><p className="font-semibold">Snowball</p><FieldView value={S.search_strategy.snowball} /></div>
            <div className="bx-card p-3"><p className="font-semibold">Inclusion</p><ul className="list-disc pl-5">{S.search_strategy.inclusion.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
            <div className="bx-card p-3"><p className="font-semibold">Exclusion</p><ul className="list-disc pl-5">{S.search_strategy.exclusion.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
          </div>
        </div>
      )}
      <div className="overflow-x-auto mt-3"><table className="w-full text-sm" data-testid="queries-by-slice">
        <caption className="text-left text-xs bx-muted">Hits by slice (the slice is the sweep that ran the query; P is the pre-sweep)</caption>
        <thead><tr><th className={`${cell} text-left`}>Slice</th><th className={`${cell} text-right`}>Queries</th><th className={`${cell} text-right`}>Hits</th><th className={`${cell} text-right`}>Zero-hit</th></tr></thead>
        <tbody>{bySlice.map((r) => <tr key={r.s}><td className={cell}><button type="button" className="underline" onClick={() => setSlice(r.s)}>{r.s}</button></td><td className={`${cell} text-right tabular-nums`}>{r.n}</td><td className={`${cell} text-right tabular-nums`}>{r.hits.toLocaleString()}</td><td className={`${cell} text-right tabular-nums`}>{r.zero}</td></tr>)}</tbody>
      </table></div>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        <label className="sr-only" htmlFor="qf">Filter queries</label>
        <input id="qf" className="bx-input max-w-xs" placeholder="Filter queries…" value={qf} onChange={(e) => setQf(e.target.value)} />
        <select className="bx-input max-w-[12rem]" value={slice} onChange={(e) => setSlice(e.target.value)} aria-label="Slice"><option value="">All slices</option>{slices.map((s) => <option key={s} value={s}>{s}</option>)}</select>
        <span className="bx-muted self-center" role="status">{shownQ.length} shown</span>
      </div>
      <div className="overflow-x-auto mt-2 max-h-[36rem] overflow-y-auto"><table className="w-full text-xs" data-testid="queries-table">
        <thead className="sticky top-0" style={{ background: 'var(--bx-surface)' }}><tr><th className={`${cell} text-left`}>#</th><th className={`${cell} text-left`}>Query</th><th className={`${cell} text-left`}>Slice</th><th className={`${cell} text-left`}>Engine</th><th className={`${cell} text-right`}>Hits</th><th className={`${cell} text-left`}>Date</th></tr></thead>
        <tbody>{shownQ.slice(0, qn).map((q) => <tr key={q.i}><td className={`${cell} tabular-nums`}>{q.i + 1}</td><td className={cell}>{q.text}{q.note && <span className="block bx-muted">{q.note}</span>}{q.invalid && <span className="bx-todo ml-1">recorded with its fields out of place — a build error</span>}</td><td className={cell}>{q.slice}</td><td className={cell}>{q.engine}</td><td className={`${cell} text-right tabular-nums`}>{String(q.hits)}</td><td className={cell}>{q.date}</td></tr>)}</tbody>
      </table></div>
      {shownQ.length > qn && <button type="button" className="bx-btn mt-2" onClick={() => setQn((n) => n + 400)}>Show more ({shownQ.length - qn} left)</button>}

      {S && (
        <>
          <H2 id="corpus">Corpus profile</H2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 text-sm" data-testid="corpus-profile">
            <Stat label="BY TIER" value={list(S.corpus_profile.by_tier)} />
            <Stat label="BY SOURCE KIND" value={list(cp.by_source_kind as Record<string, number> | undefined)} />
            <Stat label="BY STUDY DESIGN" value={list(cp.by_study_design as Record<string, number> | undefined)} />
            <Stat label="YEAR RANGE · TOTAL" value={`${((cp.year_range as number[] | undefined) ?? []).join('–')} · ${String(cp.total ?? '—')}`} />
          </div>
          <p className="mt-2 text-sm"><span className="font-semibold">Concentration: </span>{S.corpus_profile.concentration}</p>
          <p className="mt-1 text-sm"><span className="font-semibold">Dissent represented: </span>{S.corpus_profile.dissent_represented ? 'yes' : 'no'}. {S.corpus_profile.dissent_note}</p>

          <H2 id="gaps">Known gaps ({S.search_strategy.known_gaps.length})</H2>
          <ul className="list-disc pl-5 mt-2 text-sm grid gap-1" data-testid="known-gaps">{S.search_strategy.known_gaps.map((g, i) => <li key={i}>{g}</li>)}</ul>
        </>
      )}

      <H2 id="ledger">The hypothesis ledger ({P.ledger.entries})</H2>
      <p className="mt-2">Before the sweep the author supplied sixty of his own guesses about staffing, in eight categories, and called them best guesses. Each was carried as a hypothesis, never as a fact, and tested against the evidence; this is the whole ledger, with what the evidence said about each and the records that absorbed it. A record that tested a guess says so in a small line linking here. Figure 4 draws the outcomes by category.</p>
      <Ledger />

      <H2 id="stages">The stages and the failure patterns</H2>
      <p className="mt-2">The nine stages the pack is organised by and the eight patterns the Start step names, each with its cited description; the Plan ranks constraints by them.</p>
      <div className="mt-3"><StagesAndPatterns /></div>

      <H2 id="controversies">The controversies</H2>
      <p className="mt-2">Where the sources disagree, each side is shown with its citations; the closing paragraph is a synthesis and is marked as one.</p>
      <div className="mt-3"><Controversies /></div>

      <H2 id="voice">Voice</H2>
      <p className="mt-2 text-sm">The guide does not tell a reader what to do about their own opening. Pack text that addresses the reader in the second person, or opens a sentence with an instruction, is recorded here as a pack error and rendered as written. The scan for instructions is a word-list heuristic: it reads the prose fields, and counts the {P.voice.procedure_imperatives} sentences in a lever’s <code>how_to</code> or a gate’s <code>steps</code> separately, since those are procedure steps taken from cited guidance.</p>
      <details className="mt-2 text-sm" open><summary className="cursor-pointer font-semibold">Second person ({P.voice.count})</summary>
        <ul className="mt-2 grid gap-1" data-testid="voice-list">{P.voice.items.map((v, i) => <li key={i}>{keyLink(v.where)} — “{v.excerpt}”</li>)}</ul>
      </details>
      <details className="mt-2 text-sm"><summary className="cursor-pointer font-semibold">Sentences opening with an instruction ({P.voice.imperatives.length})</summary>
        <ul className="mt-2 grid gap-1" data-testid="imperative-list">{P.voice.imperatives.map((v, i) => <li key={i}>{keyLink(v.where)} — “{v.excerpt}”</li>)}</ul>
      </details>

      <H2 id="terms">Term linking</H2>
      <p className="mt-2 text-sm">
        Glossary terms are matched whole-word and case-insensitively, longest match first (so “key-personnel substitution” is never linked as “key personnel clause”); a variant written in capitals matches only in capitals.
        The first occurrence in each guide section, {CONCEPTS_LABEL} page and record is linked. {P.terms.linked} of the {P.terms.occurring} terms that occur in the guide text are linked ({P.terms.linked_pct_of_occurring}%);
        {' '}{P.terms.linked_in_records} terms are linked from records. Occurring but never linked (every occurrence sits inside a longer term):{' '}
        {P.terms.occurring_not_linked.map((t) => getTerm(t)?.term ?? t).join(', ') || 'none'}. Terms that do not occur in the guide text ({P.terms.unmatched.length}; they occur in records and {CONCEPTS_LABEL}): {P.terms.unmatched.map((t) => getTerm(t)?.term ?? t).join(', ')}.
        Dollar amounts are currency, never maths: every “$” followed by a digit is escaped before the maths renderer sees it, so only the {CONCEPTS_LABEL}’ own <code>$r$</code>-style spans render as equations.
      </p>

      <H2 id="build">How the app was built</H2>
      <ul className="list-disc pl-5 mt-2 text-sm grid gap-1">
        <li><strong>Written by the guide’s builder</strong> ({manifest.builder.name} v{manifest.builder.version}): the guide, every record, the dependency graph’s edges and their evidence, the glossary, the {CONCEPTS_LABEL}, the figures and their data, the reference summaries, the hypothesis ledger, the pathfinder questions and its rule. It is the only source of content in this app.</li>
        <li><strong>Done by this build</strong>: parsing and validation, the citation-coverage gate, term linking, citation fold-outs, the pathfinder exactly as its rule states it (the Plan’s ranking), the precondition order of each constraint’s actions, the numbers grouped by place and sector with each counterpart resolved, the record pages in the order the KICKOFF fixes, the figure components, the Notebook (quotes with their provenance, the action-plan template and its exports), and this page.</li>
        <li><strong>The BLS refresh</strong>: for the indicators that name a BLS series, a scheduled workflow requests the latest value from the BLS Public Data API when the site is built and writes it into the site; <Link className="underline" to="/numbers">Numbers</Link> shows it beside the pack’s figure, never in place of it. No page calls BLS or anything else at runtime.</li>
        <li>No analytics, no accounts, no server. Start answers and notebooks live in this browser’s localStorage only; the dependency map is not ported — it lives in the evidence edition.</li>
      </ul>
    </div>
  );
}
