/**
 * The cards the Plan, Rules, Numbers and record pages share. Every pack field renders as written (term- and
 * citation-linked by the content build); the HR layer's plain name sits above the pack name, never instead of it.
 * Each card is a quote anchor, so a selection inside it carries the record's provenance into the Notebook.
 */
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Prose from '@/components/records/Prose';
import CiteList from '@/components/records/CiteList';
import { QA } from '@/components/notebook/QuoteControl';
import { useNotebook } from '@/lib/notebook-context';
import { actionRow, numberRow, overlayRow, ruleRow, constraintRow } from '@/lib/rows';
import { overlaySourceKind } from '@/lib/rules';
import { OVERLAY_LABEL, stageLabel } from '@/lib/data';
import { okRow, periodText, type BlsState } from '@/lib/bls';
import type { RowAttrs } from '@/lib/notebook';
import type { Constraint, Enabler, Gate, Lever, NumberCard as NumberCardT, Overlay, OverlayKey, StateRecord } from '@/types';
import { S } from '@/strings';

export const Grade = ({ grade }: { grade: string }) => <span className="tt-grade" data-testid="grade-chip" title="evidence grade">{grade}</span>;
export const Check = () => <span className="tt-check" data-testid="check-tag">{S.check}</span>;
export const AsOfChip = ({ d }: { d?: string | null }) => (d ? <span className="bx-asof" data-testid="record-asof">{S.asOf(String(d))}</span> : null);
export const GeoChips = ({ geo, sector }: { geo?: unknown; sector?: unknown }) => (
  <>
    {geo && geo !== 'us' ? <span className="tt-deco" data-testid="geo-chip">{String(geo) === 'al' ? 'Alabama' : String(geo) === 'huntsville-msa' ? 'Huntsville MSA' : String(geo)}</span> : null}
    {sector && sector !== 'all' ? <span className="tt-deco" data-testid="sector-chip">{String(sector)}</span> : null}
  </>
);

/** "Add to plan" and its siblings: builds the row from the pack record and adds it to the active notebook. */
export function AddButton({ kind, refId, build, label, testId }: { kind: RowAttrs['kind']; refId: string; build: () => Promise<RowAttrs | null>; label: string; testId?: string }) {
  const nb = useNotebook();
  const [busy, setBusy] = useState(false);
  const inPlan = nb.inPlan(kind, refId);
  return (
    <button type="button" className={`bx-btn no-print ${inPlan ? 'bx-btn-on' : ''}`} disabled={busy} aria-pressed={inPlan} data-testid={testId ?? `add-${kind}-${refId}`}
      onClick={async () => { if (inPlan) { nb.setOpen(true); return; } setBusy(true); const r = await build(); if (r) await nb.addRows([r]); setBusy(false); }}>
      {inPlan ? `✓ ${S.added}` : `+ ${label}`}
    </button>
  );
}

export function Card({ children, id, className = '', testId }: { children: ReactNode; id?: string; className?: string; testId?: string }) {
  return <article id={id} className={`bx-card p-5 sm:p-6 scroll-mt-28 ${className}`} data-testid={testId}>{children}</article>;
}

/** Lever: plain name over pack name, grade, the evidence as reported, "Does not:" directly beneath, Acts on, Do first. */
export function LeverCard({ lever, plainName, actsOn, doFirst, defense, route, headingLevel = 3, compact = false }: {
  lever: Lever; plainName?: string; actsOn: { id: string; name: string }[]; doFirst?: { other: string; edge: string }[]; defense?: boolean; route: string; headingLevel?: 2 | 3 | 4; compact?: boolean;
}) {
  const H = `h${headingLevel}` as 'h3';
  const ev = lever.evidence;
  return (
    <Card id={lever.id} testId="lever-card">
      <QA route={route} type="levers" id={lever.id} title={plainName || lever.name} asOf={lever.as_of} cites={lever.sources}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <H className="text-[19px] leading-snug" data-testid="plain-name">{plainName || lever.name}</H>
            {plainName && plainName !== lever.name
              ? <p className="mt-0.5 text-[14px] bx-muted" data-testid="pack-name"><Link to={`/plan/actions/${lever.id}`}>{lever.name}</Link></p>
              : <p className="mt-0.5 text-[14px]"><Link to={`/plan/actions/${lever.id}`}>Open the record</Link></p>}
          </div>
          <div className="flex flex-wrap items-center gap-1.5"><Grade grade={ev.grade} />{defense && <span className="tt-deco" data-testid="defense-chip">{S.defenseChip}</span>}</div>
        </div>
        <div className="mt-3 rounded-[12px] p-3" style={{ background: 'var(--bx-bg)' }} data-testid="evidence-block">
          <p className="tt-eyebrow">{S.effectAsReported}</p>
          <div data-testid="lever-effect" data-q-block=""><Prose md={ev.effect} /></div>
          <p className="mt-1.5 text-[14px]"><span className="font-semibold">{S.population}: </span></p>
          <div className="text-[15px]" data-testid="lever-population" data-q-block=""><Prose md={ev.population} /></div>
          {ev.k_n && <div className="mt-1 text-[14px]" data-q-block=""><span className="font-semibold">{S.kn}: </span><Prose md={ev.k_n} className="inline-block" /></div>}
        </div>
        <div className="mt-2 border-l-4 pl-3" style={{ borderColor: 'var(--bx-amber)' }} data-testid="limits-line" data-q-block="">
          <span className="tt-doesnot">{S.doesNot}</span>
          <Prose md={lever.what_it_does_not_do} />
        </div>
        {!compact && actsOn.length > 0 && (
          <p className="mt-3 text-[15px]" data-testid="acts-on"><span className="font-semibold" style={{ color: 'var(--bx-ink)' }}>{S.actsOn}: </span>
            {actsOn.map((c, i) => <span key={c.id}>{i > 0 && ' · '}<Link to={`/plan/constraints/${c.id}`}>{c.name}</Link></span>)}
          </p>
        )}
        {doFirst?.map((d) => <p key={d.edge} className="mt-2 text-[15px] font-semibold" style={{ color: 'var(--bx-ink)' }} data-testid="do-first">{S.doFirst(d.other, d.edge)}</p>)}
      </QA>
      <div className="mt-4"><AddButton kind="action" refId={lever.id} build={() => actionRow(lever.id)} label={S.addToPlan} /></div>
    </Card>
  );
}

/** A matched constraint: score as answers matched, the pack name, the first two how-to-tell lines, why it matched. */
export function ConstraintCard({ c, matches, reasons, sources, route }: { c: Constraint; matches: number; reasons: string[]; sources: ReactNode; route: string }) {
  const [open, setOpen] = useState(false);
  const tell = (Array.isArray(c.how_to_tell) ? c.how_to_tell : [c.how_to_tell]).filter(Boolean).slice(0, 2);
  return (
    <Card id={c.id} testId="constraint-card">
      <QA route={route} type="constraints" id={c.id} title={c.name} asOf={c.as_of} cites={c.sources}>
        <p className="tt-eyebrow" data-testid="match-count">{S.matches(matches)} · {stageLabel(c.stage)}</p>
        <h3 className="mt-1 text-[20px] leading-snug"><Link to={`/plan/constraints/${c.id}`} style={{ color: 'var(--bx-ink)' }}>{c.name}</Link></h3>
        <ul className="mt-2 grid gap-1 list-disc pl-5 text-[16px]">{tell.map((t, i) => <li key={i} data-q-block=""><Prose md={t} /></li>)}</ul>
      </QA>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" className="bx-btn-text" aria-expanded={open} onClick={() => setOpen((o) => !o)} data-testid="why-matched">{S.whyMatched} {open ? '▴' : '▾'}</button>
        <AddButton kind="constraint" refId={c.id} build={() => constraintRow(c.id)} label={S.addToPlan} />
      </div>
      {open && (
        <div className="mt-2 text-[15px]" data-testid="reasons">
          <ul className="grid gap-0.5">{reasons.map((r) => <li key={r}>✓ {r}</li>)}</ul>
          <div className="mt-2">{sources}</div>
        </div>
      )}
    </Card>
  );
}

export function ProgramCard({ e, level = 4 }: { e: Enabler; level?: 2 | 3 | 4 }) {
  const H = `h${level}` as 'h4';
  return (
    <Card id={e.id} testId="program-card" className="!p-4">
      <QA route={`/plan/programs/${e.id}`} type="enablers" id={e.id} title={e.name} asOf={e.as_of} cites={e.sources}>
        <div className="flex flex-wrap items-center gap-1.5"><span className="bx-status">{e.kind}</span><GeoChips geo={e.geo} sector={e.sector} /></div>
        <H className="mt-1.5 text-[17px] leading-snug"><Link to={`/plan/programs/${e.id}`} style={{ color: 'var(--bx-ink)' }}>{e.name}</Link></H>
        <div className="mt-1" data-q-block=""><Prose md={e.what} /></div>
        {e.cost && <div className="mt-1 text-[15px]" data-q-block=""><span className="font-semibold">{S.cost}: </span><Prose md={e.cost} /></div>}
        {e.conditions && <div className="mt-1 text-[15px]" data-q-block=""><span className="font-semibold">{S.conditions}: </span><Prose md={e.conditions} /></div>}
      </QA>
      {e.official_url && <p className="mt-2 text-[14px]"><a href={e.official_url} target="_blank" rel="noreferrer">{S.officialLink} ↗</a></p>}
    </Card>
  );
}

/** The first sentence of a linked pack field (the Plan shows "one line from applies_when"), cut at a sentence end. */
export function firstSentence(md: string): string {
  const s = String(md ?? '').trim();
  const m = /^([\s\S]{30,}?[.;])(\s+(?:\[[^\]]+\]\(#cite:[^)]+\)\s*)*)(?=\s+[A-Z(]|$)/.exec(s);
  return m ? (m[1] + (m[2] ?? '')).trim() : s;
}

/** An overlay's status chip, source kind and the pending wording (KICKOFF §1). */
export function OverlayBadges({ o }: { o: Overlay }) {
  const k = overlaySourceKind(o);
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="bx-status font-semibold" data-testid="status-chip">{o.status}</span>
      {k.amber ? <span className="tt-amber" data-testid={k.mirror ? 'mirror-tag' : 'compilation-tag'}>{k.label}</span> : null}
      {k.mirror ? <span className="text-[13px] bx-muted" data-testid="official-pending">{S.officialPending}</span> : null}
    </span>
  );
}

/** A gate on the Plan: Check tag, plain name, one line from applies_when, as_of, and the state overlays that modify it. */
export function RuleItem({ g, plainName, state, statute = false, level = 4 }: { g: Gate; plainName?: string; state?: StateRecord; statute?: boolean; level?: 2 | 3 | 4 }) {
  const H = `h${level}` as 'h4';
  const mods = state ? (Object.keys(OVERLAY_LABEL) as OverlayKey[]).filter((k) => state[k]?.gates?.includes(g.id)) : [];
  return (
    <li className="bx-card p-4 scroll-mt-28" id={g.id} data-testid="rule-item" data-gate={g.id}>
      <QA route={`/rules/${g.id}`} type="gates" id={g.id} title={plainName || g.name} asOf={g.as_of} cites={g.sources}>
        <div className="flex flex-wrap items-center gap-1.5"><Check />{statute && <span className="tt-deco" data-testid="statute-chip">{S.statute}</span>}<AsOfChip d={g.as_of} /><GeoChips geo={g.geo} sector={g.sector} /></div>
        <H className="mt-1.5 text-[17px] leading-snug"><Link to={`/rules/${g.id}`} style={{ color: 'var(--bx-ink)' }}>{plainName || g.name}</Link></H>
        {plainName && plainName !== g.name && <p className="text-[14px] bx-muted">{g.name}</p>}
        {g.applies_when && <div className="mt-1 text-[15px]" data-q-block=""><span className="font-semibold">{S.appliesWhen}: </span><Prose md={firstSentence(String(g.applies_when))} /></div>}
      </QA>
      {state && mods.length > 0 && (
        <div className="mt-2 grid gap-1.5" data-testid="modifying-overlays">
          <p className="tt-eyebrow">{S.modifiedBy(state.state)}</p>
          {mods.map((k) => (
            <QA key={k} route={`/rules/state/${state.id}#${k}`} type="states" id={state.id} section={k} title={`${state.state}: ${OVERLAY_LABEL[k]}`} asOf={state.as_of} cites={state[k].sources}>
              <p className="text-[15px]"><Link to={`/rules/state/${state.id}#${k}`}>{OVERLAY_LABEL[k]}</Link> <OverlayBadges o={state[k]} /></p>
            </QA>
          ))}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <AddButton kind="rule" refId={g.id} build={() => ruleRow(g.id)} label={S.addRule} />
        {state && mods.map((k) => <AddButton key={k} kind="rule" refId={`${state.id}:${k}`} build={() => overlayRow(state.id, k)} label={`${S.addRule}: ${OVERLAY_LABEL[k]}`} />)}
      </div>
    </li>
  );
}

/** A number card: value, period, publisher, its counterpart beside it, the refreshed BLS value beside the pack's. */
export function NumberCardView({ c, twin, bls, level = 3 }: { c: NumberCardT; twin?: NumberCardT; bls: BlsState; level?: 2 | 3 | 4 }) {
  const H = `h${level}` as 'h3';
  const row = c.series ? bls.bySeries.get(c.series) : undefined;
  const ok = okRow(row);
  const label = ok ? S.apiConfirmed : (S.seriesLabel[c.series_confirmed] ?? c.series_confirmed);
  const older = /older than|state table|from a state/i.test(String(c.note ?? ''));
  return (
    <Card id={c.id} testId="number-card" className="!p-4">
      <QA route={`/numbers#${c.id}`} type="indicators" id={c.id} title={c.name} cites={c.sources}>
        <div className="flex flex-wrap items-center gap-1.5"><GeoChips geo={c.geo} sector={c.sector} />{older && <span className="tt-amber" data-testid="older-note">{S.olderNote}</span>}</div>
        <H className="mt-1 text-[16px] leading-snug">{c.name}</H>
        <div className={`mt-2 grid gap-3 ${twin || c.counterpart_stub ? 'sm:grid-cols-2' : ''}`}>
          <div data-testid="pack-figure" data-q-block="">
            <p className="font-display text-[26px] font-extrabold leading-none" style={{ color: 'var(--bx-ink)' }}>{c.value}</p>
            <p className="mt-1 text-[14px]">{c.reference_period} · {c.publisher}</p>
            {ok && <p className="mt-1 text-[14px] font-semibold" data-testid="refreshed-value" style={{ color: 'var(--bx-ink)' }}>{ok.value} · {periodText(ok)} <span className="tt-grade">{S.refreshed(new Date(bls.data!.fetchedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }))}</span></p>}
          </div>
          {(twin || c.counterpart_stub) && (
            <div className="rounded-[12px] p-3" style={{ background: 'var(--bx-bg)' }} data-testid="counterpart">
              <p className="tt-eyebrow">{c.geo === 'us' ? S.counterpartOf : S.counterpart}</p>
              <p className="font-display text-[20px] font-extrabold leading-none mt-1" style={{ color: 'var(--bx-ink)' }}>{twin?.value ?? c.counterpart_stub!.value}</p>
              <p className="mt-1 text-[14px]">{twin?.name ?? c.counterpart_stub!.name}</p>
              <p className="text-[13px] bx-muted">{twin?.reference_period ?? c.counterpart_stub!.reference_period}</p>
            </div>
          )}
        </div>
        {c.series && (
          <p className="mt-2 text-[13px] bx-muted" data-testid="series-line">Series <code className="font-mono">{c.series}</code> · <span className={ok ? 'tt-grade' : ''} data-testid="series-label">{label}</span>{row && !ok ? ` · ${S.refreshFailed}` : ''}</p>
        )}
        {c.note && <div className="mt-2 text-[14px] bx-muted" data-q-block=""><Prose md={c.note} /></div>}
      </QA>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <AddButton kind="number" refId={c.id} build={() => numberRow(c.id)} label={S.addNumber} />
        <span className="text-[14px] font-semibold">Sources:</span><CiteList ns={c.sources} />
      </div>
    </Card>
  );
}
