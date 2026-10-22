import { Link } from 'react-router-dom';
import { loadControversies, loadPatterns, loadStages, useAsync } from '@/lib/heavy';
import { recordMeta } from '@/lib/records';
import { PACK, EDITION_URL } from '@/lib/data';
import Prose from '@/components/records/Prose';
import { Sources, SynProse, RecordLinks } from '@/components/records/Bits';
import { QA } from '@/components/notebook/QuoteControl';
import CiteList from '@/components/records/CiteList';

/**
 * What Key Personnel showed on its own pages and TopTechHR shows on /library/methods (KICKOFF §4d: "nothing is
 * dropped, only moved"): the nine stages, the eight failure patterns and the six controversies, each with an anchor
 * the rest of the app links to.
 */
export function StagesAndPatterns() {
  const stages = useAsync(loadStages);
  const patterns = useAsync(loadPatterns);
  if (!stages || !patterns) return <p className="bx-muted" role="status">Loading…</p>;
  return (
    <div className="grid gap-4" data-testid="stages-patterns">
      {stages.map((s) => (
        <details key={s.id} id={`stage-${s.id}`} className="bx-card p-4 scroll-mt-28">
          <summary className="cursor-pointer font-display font-bold" style={{ color: 'var(--bx-ink)' }}>{s.order}. {s.name}</summary>
          <QA route={`/library/methods#stage-${s.id}`} type="stages" id={s.id} title={`Stage: ${s.name}`} asOf={s.as_of} cites={s.sources}>
            <div className="mt-2"><SynProse md={s.what} synId={`syn-stages-${s.id}-what`} /></div>
            <p className="mt-2 text-[15px]"><span className="font-semibold">Decided by: </span>{s.decided_by}</p>
            {s.metrics.length > 0 && (
              <ul className="mt-2 grid gap-1 text-[15px]">{s.metrics.map((m) => <li key={m.id}><span className="font-semibold">{m.id}: </span><Prose md={m.definition} className="inline" />{m.benchmark.length > 0 && <span className="text-[13px] bx-muted"> · numbers: {m.benchmark.map((b) => <Link key={b} to={`/numbers#${b}`} className="mr-1">{recordMeta('indicators', b)?.title ?? b}</Link>)}</span>}</li>)}</ul>
            )}
          </QA>
          {s.failure_patterns.length > 0 && <p className="mt-2 text-[14px]"><span className="bx-muted mr-1">Patterns:</span><RecordLinks type="patterns" ids={s.failure_patterns} /></p>}
          <Sources ns={s.sources} />
        </details>
      ))}
      {patterns.map((p) => (
        <details key={p.id} id={`pattern-${p.id}`} className="bx-card p-4 scroll-mt-28">
          <summary className="cursor-pointer font-display font-bold" style={{ color: 'var(--bx-ink)' }}>Pattern: {p.name}</summary>
          <QA route={`/library/methods#pattern-${p.id}`} type="patterns" id={p.id} title={`Pattern: ${p.name}`} cites={p.sources}>
            <div className="mt-2"><SynProse md={p.what} synId={`syn-patterns-${p.id}-what`} /></div>
            <ul className="mt-2 grid gap-1 text-[15px]">{p.reasons.map((r) => <li key={r.constraint}><Link to={`/plan/constraints/${r.constraint}`} className="font-semibold">{recordMeta('constraints', r.constraint)?.title ?? r.constraint}</Link>: <Prose md={r.why} className="inline" /></li>)}</ul>
          </QA>
          <Sources ns={p.sources} />
        </details>
      ))}
    </div>
  );
}

export function Controversies() {
  const cs = useAsync(loadControversies);
  if (!cs) return <p className="bx-muted" role="status">Loading…</p>;
  return (
    <ol className="grid gap-4" data-testid="controversies">
      {cs.map((c) => (
        <li key={c.id} id={c.id} className="bx-card p-5 scroll-mt-28">
          <QA route={`/library/methods#${c.id}`} type="controversies" id={c.id} title={`Controversy: ${c.name}`} cites={c.sources}>
            <h3 className="text-[19px]">{c.name}</h3>
            <p className="mt-1 text-[16px] font-semibold">{c.question}</p>
            <ul className="mt-2 grid gap-2">{c.positions.map((p, i) => <li key={i} className="border-l-2 pl-3" style={{ borderColor: 'var(--bx-line)' }}><span className="font-semibold">{p.holder}: </span><Prose md={p.claim} className="inline" /> <CiteList ns={p.sources} /></li>)}</ul>
            <div className="bx-synthesis" id={`syn-controversies-${c.id}-what_a_recruiter_can_rely_on`}>
              <span className="bx-synthesis-label">synthesis — what the evidence lets a reader rely on</span>
              <Prose md={c.what_a_recruiter_can_rely_on} />
            </div>
          </QA>
          {c.named_by.length > 0 && <p className="mt-2 text-[14px] bx-muted">Named by: {c.named_by.map((k) => { const [t, id] = k.split('/'); const m = recordMeta(t as 'constraints', id); return m ? <Link key={k} to={m.to} className="mr-2">{m.title}</Link> : null; })}</p>}
          <Sources ns={c.sources} />
        </li>
      ))}
    </ol>
  );
}

export function HrLayerNote() {
  return (
    <div className="text-[16px] grid gap-2" data-testid="hr-layer-note">
      <p>TopTechHR carries no evidence of its own. Every fact, figure, rule and citation is the Key Personnel content pack’s, pinned at <code>{PACK.tag}</code> (as of {PACK.as_of}); the evidence edition is <a href={EDITION_URL} target="_blank" rel="noreferrer">Key Personnel ↗</a>.</p>
      <p>The only text of TopTechHR’s own is the HR layer (<code>hr-layer/</code>): plain names for the 69 actions and the rules, the moment HR meets each rule, the four Start steps, the action-plan template and glossary aliases. It renames and arranges; it never adds a fact. A plain name renders above the pack’s own name, never instead of it. <code>tools/validate_hr_layer.py</code> runs before every content build and fails it if any HR-layer line points at a record that does not exist, if a lever or a rule has no entry, or if the layer carries a <code>[n]</code>, a percentage or a dollar figure of its own.</p>
    </div>
  );
}
