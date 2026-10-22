import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import ledgerIndexJson from '@/data/ledger-index.json';
import type { PendingChange, RecordType, ReferenceMeta } from '@/types';
import { AS_OF, recordedDate, stageLabel, STATUS_WORD } from '@/lib/data';
import { findRecord, recordMeta } from '@/lib/records';
import { loadReference, loadRefMeta } from '@/lib/heavy';
import type { Reference } from '@/types';
import ReferenceCard from '@/components/reader/ReferenceCard';
import Prose from './Prose';
import FieldView from './FieldView';

const LEDGER = ledgerIndexJson as Record<string, string>;

export const BlockLabel = ({ children, id }: { children: ReactNode; id?: string }) => <h2 id={id} className="font-display text-[13px] font-bold tracking-[0.14em] uppercase mt-8 mb-2">{children}</h2>;

/** A stage as a text chip (TopTechHR carries no stage pages; the stages are described on /library/methods). */
export function StageChip({ stage }: { stage?: string | null }) {
  if (!stage) return null;
  return (
    <span className="bx-status" data-testid="stage-chip">{stageLabel(stage)}</span>
  );
}

/** An evidence grade as text, not colour — the grade is information, never a ranking. */
export const GradeChip = ({ grade, label = 'grade' }: { grade: string; label?: string }) => <span className="tt-grade" data-testid="grade-chip" title={`evidence ${label}`}>{grade}</span>;

/** Every record page shows its own as_of; a record that carries none says so and gives the sweep's date. */
export const AsOf = ({ date }: { date?: string | null }) => date
  ? <span className="bx-asof" data-testid="record-asof">as of {date}</span>
  : <span className="bx-asof" data-testid="record-asof" title="This record carries no as_of of its own">as of — not recorded on the record (sweep closed {AS_OF})</span>;

/** A change status as a labelled chip with its date (pending changes and the ledger). */
export function ChangeChip({ status, date }: { status: string; date?: string }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1" data-testid="change-chip">
      <span className="bx-status font-semibold">{STATUS_WORD[status] ?? status}</span>
      {date !== undefined && <span className="bx-chip bg-paper-2 dark:bg-night-2 tabular-nums">{recordedDate(date)}</span>}
    </span>
  );
}

/** `pending_changes[]`: a labelled block, each with its status word and date (KICKOFF §1 "pending is pending"). */
export function PendingChanges({ items, title = 'Pending changes' }: { items: PendingChange[]; title?: string }) {
  if (!items?.length) return null;
  const sorted = [...items].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return (
    <section aria-label={title} data-testid="pending-changes">
      <BlockLabel>{title}</BlockLabel>
      <ul className="grid gap-2">
        {sorted.map((p, i) => (
          <li key={i} className="bx-card p-2.5 text-sm">
            <p className="text-xs"><ChangeChip status={p.status} date={p.date} /></p>
            <Prose md={p.text} className="mt-1" />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** `conflicts[]` — "Where sources differ". Both readings are shown; none is picked. */
export function Conflicts({ items }: { items: string[] }) {
  if (!items?.length) return null;
  return (
    <section aria-label="Where sources differ" data-testid="conflicts">
      <BlockLabel>Where sources differ</BlockLabel>
      <ul className="grid gap-1.5 border-l-2 border-[color:var(--bx-line)] pl-3">
        {items.map((c, i) => <li key={i}><Prose md={c} /></li>)}
      </ul>
    </section>
  );
}

export function OfficialLink({ url, label = 'Official page' }: { url?: string | null; label?: string }) {
  if (!url) return null;
  return <p className="text-sm"><span className="font-semibold">{label}: </span><a className="underline break-all" href={url} target="_blank" rel="noreferrer">{url} ↗</a></p>;
}

/**
 * Pack prose that may carry the records' own `(synthesis)` marker: rendered with the same quiet left rule and
 * "synthesis" label as a review block, with a stable id /methods links to (KICKOFF §1). The words are unchanged.
 */
export function SynProse({ md, synId, className = '' }: { md: string; synId: string; className?: string }) {
  if (!md) return null;
  if (!md.includes('(synthesis)')) return <Prose md={md} className={className} />;
  return (
    <div className="bx-synthesis !my-1 scroll-mt-28" id={synId} data-testid="record-synthesis">
      <span className="bx-synthesis-label">synthesis</span>
      <Prose md={md} className={className} />
    </div>
  );
}

/** The stable id of a `(synthesis)`-marked record field — the same function as scripts/lib/records.ts synthesisId. */
export const synId = (file: string, id: string, field: string) => `syn-${file}-${id}-${field.replace(/\//g, '-')}`;

/** A list of prose strings; items carrying `(synthesis)` render as synthesis blocks with their ids. */
export function ListOf({ items, ordered = false, syn }: { items: string[] | string; ordered?: boolean; syn?: { file: string; id: string; field: string } }) {
  const list = typeof items === 'string' ? [items] : items;
  if (!list?.length) return null;
  const L = ordered ? 'ol' : 'ul';
  return (
    <L className={`${ordered ? 'list-decimal' : 'list-disc'} pl-5 grid gap-1`}>
      {list.map((s, i) => <li key={i}>{syn ? <SynProse md={s} synId={synId(syn.file, syn.id, typeof items === 'string' ? syn.field : `${syn.field}/${i}`)} /> : <Prose md={s} />}</li>)}
    </L>
  );
}

/** A labelled prose field (string or list), with synthesis marks; empty → nothing. */
export function Field({ label, value, syn, ordered, name }: { label: string; value: unknown; syn?: { file: string; id: string; field: string }; ordered?: boolean; name?: string }) {
  if (value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)) return null;
  return (
    <div>
      <BlockLabel>{label}</BlockLabel>
      {typeof value === 'string' ? (syn ? <SynProse md={value} synId={synId(syn.file, syn.id, syn.field)} /> : <Prose md={value} />)
        : Array.isArray(value) && value.every((x) => typeof x === 'string') ? <ListOf items={value as string[]} ordered={ordered} syn={syn} />
          : <FieldView value={value} name={name} />}
    </div>
  );
}

function useRefMeta(ns: number[]): Map<number, ReferenceMeta> | undefined {
  const [m, setM] = useState<Map<number, ReferenceMeta>>();
  const key = ns.join(',');
  useEffect(() => { let live = true; void loadRefMeta(ns).then((x) => { if (live) setM(x); }); return () => { live = false; }; }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return m;
}

function SourceRow({ n, meta }: { n: number; meta?: ReferenceMeta }) {
  const [open, setOpen] = useState(false);
  const [ref, setRef] = useState<Reference | null | undefined>();
  const toggle = () => { const o = !open; setOpen(o); if (o && ref === undefined) loadReference(n).then(setRef); };
  return (
    <li className="text-sm">
      <button type="button" className="text-left w-full hover:bg-paper-2 dark:hover:bg-night-2 rounded px-1 py-0.5" aria-expanded={open} onClick={toggle}>
        <span className="font-semibold">[{n}]</span> {meta ? meta.citation : <span className="bx-todo">reference not in the pack</span>}
        {meta && <span className="ml-1 text-xs bx-muted">· {meta.tier} · {meta.source_kind} · {meta.study_design}{meta.recheck ? ' · not yet re-read against the live page' : ''}</span>}
      </button>
      {open && <div className="bx-foldout">{ref ? <ReferenceCard r={ref} compact /> : ref === null ? <span className="bx-todo">reference [{n}] not in the pack</span> : <span role="status" className="bx-muted">Loading…</span>}</div>}
    </li>
  );
}

/** `sources[]` as reference cards behind a disclosure each. */
export function Sources({ ns }: { ns: number[] }) {
  const meta = useRefMeta(ns ?? []);
  if (!ns?.length) return null;
  return (
    <section aria-label="Sources" data-testid="sources">
      <BlockLabel>Sources ({ns.length})</BlockLabel>
      {meta ? <ul className="grid gap-0.5">{ns.map((n) => <SourceRow key={n} n={n} meta={meta.get(n)} />)}</ul> : <p className="text-sm bx-muted" role="status">Loading {ns.length} sources…</p>}
    </section>
  );
}

/** Links to records of one type by bare id. Unknown ids are shown, amber, not hidden. */
export function RecordLinks({ type, ids, testId }: { type: RecordType; ids: string[]; testId?: string }) {
  return (
    <span className="inline-flex flex-wrap gap-1.5" data-testid={testId}>
      {ids.map((id) => {
        const m = recordMeta(type, id);
        return m ? <Link key={id} className="bx-chip border border-[color:var(--bx-line)] hover:underline" to={m.to}>{m.title}</Link>
          : <span key={id} className="bx-todo" title="This id is not in the pack — listed on /methods as a build error">{id} (unknown {type.replace(/s$/, '')})</span>;
      })}
    </span>
  );
}

/** Links to records by bare id of any type (a change's `records[]`, a lever's `when_it_binds_elsewhere[]`). */
export function AnyRecordLinks({ ids, prefer }: { ids: string[]; prefer?: RecordType[] }) {
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {ids.map((id) => {
        const m = findRecord(id, prefer);
        return m ? <Link key={id} className="bx-chip border border-[color:var(--bx-line)] hover:underline" to={m.to}>{m.title}</Link>
          : <span key={id} className="bx-todo">{id} (not a record)</span>;
      })}
    </span>
  );
}

/**
 * The legacy line (KICKOFF §1 "the ledger is a ledger"): a small "tested the author's guess h-A3: supported" for each
 * ledger id the record carries, linking into the full ledger on /methods. The guess itself is never shown here.
 */
export function LegacyLine({ ids }: { ids: string[] }) {
  if (!ids?.length) return null;
  return (
    <p className="mt-6 text-xs bx-muted" data-testid="legacy-line">
      {ids.map((h, i) => (
        <span key={h}>{i > 0 && ' · '}Tested the author’s guess <Link className="underline" to={`/library/methods#${h}`}>{h}</Link>: {LEDGER[h] ? <span className="font-semibold">{LEDGER[h]}</span> : <span className="bx-todo">not in the ledger</span>}</span>
      ))}
    </p>
  );
}

/** Header for every record page: an eyebrow, the HR layer's plain name above the pack name (never instead of it), chips. */
export function RecordHeader({ title, plainName, eyebrow, children }: { title: string; plainName?: string; eyebrow?: string; children?: ReactNode }) {
  return (
    <div>
      {eyebrow && <p className="tt-eyebrow">{eyebrow}</p>}
      <h1 className="mt-1 text-[30px] sm:text-[38px] leading-tight" data-testid="record-title">{plainName || title}</h1>
      {plainName && plainName !== title && <p className="mt-1 text-[17px] bx-muted" data-testid="pack-name">{title}</p>}
      {children && <p className="mt-3 flex flex-wrap items-center gap-1.5 text-[13px]">{children}</p>}
    </div>
  );
}
