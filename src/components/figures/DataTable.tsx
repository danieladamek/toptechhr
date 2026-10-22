import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Figure, Row } from '@/types';
import { recordsIndexById } from '@/lib/records';
import Popover from '@/components/ui/Popover';
import CiteList from '@/components/records/CiteList';
import { downloadCsv } from './download';

const prettify = (f: string) => f.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const refsOf = (v: unknown) => String(v ?? '').split(/[;,]\s*/).map((x) => x.trim()).filter((x) => /^\d+$/.test(x)).map(Number);
const recordsOf = (v: unknown) => String(v ?? '').split(/;\s*/).map((x) => x.trim()).filter(Boolean);

/** A `record` cell: each pack record (file/id) it names, as a link; an unknown one is shown as written. */
export function RecordCell({ value }: { value: unknown }) {
  return <span className="inline-flex flex-col gap-0.5">{recordsOf(value).map((k) => { const m = recordsIndexById.get(k); return m ? <Link key={k} className="underline" to={m.to}>{m.title.length > 70 ? `${m.title.slice(0, 68)}…` : m.title}</Link> : <span key={k}>{k}</span>; })}</span>;
}

/**
 * Sortable, filterable table (Figures 3, 5, 8, 9 and the data behind every chart): the `record` column as links to
 * the pack records, `ref` as citation tokens with their fold-out, column-header ⓘ popovers from explain[].
 */
export default function DataTable({ figure, rows, inline }: { figure: Figure; rows: Row[]; inline?: boolean }) {
  const declared = figure.columns ?? (figure.table?.fields ?? []).map((f) => ({ field: f, label: undefined as string | undefined }));
  // the data's `record` column (the pack record each row came from) is always shown, as links, beside `ref`
  const cols = declared.some((c) => c.field === 'record') || !(figure.table?.fields ?? []).includes('record') ? declared
    : [...declared.filter((c) => c.field !== 'ref'), { field: 'record', label: 'Pack record' }, ...declared.filter((c) => c.field === 'ref')];
  const [sort, setSort] = useState<{ field: string; dir: 'asc' | 'desc' } | null>(null);
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    let r = rows;
    if (q.trim()) { const needle = q.toLowerCase(); r = r.filter((row) => Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(needle))); }
    if (sort) {
      r = [...r].sort((a, b) => { const va = a[sort.field], vb = b[sort.field]; const na = typeof va === 'number', nb = typeof vb === 'number'; const cmp = na && nb ? (va as number) - (vb as number) : va == null ? 1 : vb == null ? -1 : String(va).localeCompare(String(vb)); return sort.dir === 'asc' ? cmp : -cmp; });
    }
    return r;
  }, [rows, q, sort]);
  const explainFor = (field: string, label: string) => figure.explain.find((e) => { const on = e.on.toLowerCase(); return on === field.toLowerCase() || on === label.toLowerCase() || on.startsWith(`${field.toLowerCase()}:`) || on.startsWith(`column: ${field.toLowerCase()}`); });
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 no-print">
        <label className="sr-only" htmlFor={`filter-${figure.id}`}>Filter rows</label>
        <input id={`filter-${figure.id}`} className="bx-input max-w-xs" placeholder="Filter rows…" value={q} onChange={(e) => setQ(e.target.value)} data-testid={`filter-${figure.id}`} />
        <span className="text-xs bx-muted" role="status">{shown.length} of {rows.length} rows</span>
        {!inline && <button type="button" className="bx-btn ml-auto" onClick={() => downloadCsv(rows, figure.table?.fields ?? cols.map((c) => c.field), `${figure.id}.csv`)}>CSV</button>}
      </div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-sm border-collapse" data-testid={`table-${figure.id}`}>
          <caption className="sr-only">{figure.label}: {figure.title}</caption>
          <thead>
            <tr>
              {cols.map((c) => {
                const label = c.label ?? prettify(c.field);
                const ex = explainFor(c.field, label);
                const active = sort?.field === c.field;
                return (
                  <th key={c.field} scope="col" aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined} className="border-b-2 border-[color:var(--bx-line)] px-2 py-1.5 text-left align-bottom font-semibold bg-paper-2/60 dark:bg-night-2/60">
                    <span className="inline-flex items-center gap-1 flex-wrap">
                      <button type="button" className="underline decoration-dotted underline-offset-2 text-left" onClick={() => setSort((s) => (s?.field === c.field ? { field: c.field, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { field: c.field, dir: 'asc' }))} aria-label={`Sort by ${label}`}>
                        {label} <span aria-hidden="true">{active ? (sort!.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </button>
                      {ex && <Popover className="bx-chip !px-1.5 border border-[color:var(--bx-line)]" ariaLabel={`About ${label}`} content={<div><p className="font-semibold">{ex.on}</p><p className="mt-1 leading-6">{ex.text}</p></div>}>ⓘ</Popover>}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={i} className="odd:bg-white/40 dark:odd:bg-night-2/40 align-top">
                {cols.map((c, j) => (
                  <td key={c.field} className={`border-b border-[color:var(--bx-line)] px-2 py-1.5 ${j === 0 ? 'font-semibold' : ''}`}>
                    {c.field === 'ref' ? <CiteList ns={refsOf(r.ref)} /> : c.field === 'record' ? <RecordCell value={r.record} /> : String(r[c.field] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Figure 8 as a filled grid: jurisdictions down, the six lists across; a filled cell is a "yes" in the data. */
export function JurisdictionGrid({ figure, rows }: { figure: Figure; rows: Row[] }) {
  const cols = (figure.columns ?? []).filter((c) => !['jurisdiction', 'lists_num', 'ref', 'record'].includes(c.field));
  return (
    <div className="overflow-x-auto" data-testid="jurisdiction-grid">
      <table className="text-xs border-collapse">
        <caption className="sr-only">{figure.label} as a grid: a filled cell means the place is on that list.</caption>
        <thead><tr><th scope="col" className="text-left px-2 py-1">State, district or territory</th>{cols.map((c) => <th key={c.field} scope="col" className="px-1 py-1 align-bottom font-semibold"><span className="block w-16 leading-tight">{c.label ?? c.field}</span></th>)}<th scope="col" className="px-2 py-1">Lists</th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={String(r.jurisdiction)}>
            <th scope="row" className="text-left font-normal px-2 py-0.5 whitespace-nowrap">{String(r.jurisdiction)}</th>
            {cols.map((c) => { const yes = String(r[c.field] ?? '').toLowerCase() === 'yes'; return <td key={c.field} className="px-1 py-0.5"><span className="block h-4 w-16 rounded-sm border border-[color:var(--bx-line)]" style={{ background: yes ? 'var(--bx-accent)' : 'transparent' }} title={`${String(r.jurisdiction)} — ${c.label}: ${yes ? 'on the list' : 'not on the list'}`}><span className="sr-only">{yes ? 'on the list' : 'not on the list'}</span></span></td>; })}
            <td className="px-2 py-0.5 tabular-nums text-center">{String(r.lists_num ?? '')}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}
