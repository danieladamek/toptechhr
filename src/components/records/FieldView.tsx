import type { ReactNode } from 'react';
import Prose from './Prose';
import CiteList from './CiteList';

export const humanise = (k: string) => k.replace(/_/g, ' ').replace(/\b(url)\b/gi, 'URL').replace(/^./, (c) => c.toUpperCase());

const isPlain = (v: unknown): v is string | number | boolean => ['string', 'number', 'boolean'].includes(typeof v);
const SECONDARY = /secondary_only/;

/**
 * Generic renderer for any record field, so nothing the pack records is dropped: strings as prose, lists as
 * lists, uniform lists of objects as tables, objects as labelled blocks, `cite: [n]` as citation tokens.
 * Keys named `secondary_only` are labelled "reported by secondary sources only".
 */
export default function FieldView({ value, name, depth = 0 }: { value: unknown; name?: string; depth?: number }): ReactNode {
  if (value === null || value === undefined || value === '') return <span className="bx-muted text-sm">— (empty in the pack)</span>;
  if (typeof value === 'string') {
    if (/^https?:\/\/\S+$/.test(value)) return <a className="underline break-all text-sm" href={value} target="_blank" rel="noreferrer">{value} ↗</a>;
    return <Prose md={value} />;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return <span className="text-sm">{String(value)}</span>;
  if (Array.isArray(value)) {
    if (!value.length) return <span className="bx-muted text-sm">none recorded</span>;
    if (name === 'cite' || (value.every((x) => typeof x === 'number') && /cite|sources|refs/.test(name ?? ''))) return <CiteList ns={value as number[]} />;
    const objs = value.every((x) => x && typeof x === 'object' && !Array.isArray(x));
    if (objs) {
      const keys = [...new Set(value.flatMap((x) => Object.keys(x as object)))];
      const flat = value.every((x) => Object.values(x as object).every((v) => isPlain(v) || v === null || (Array.isArray(v) && v.every((y) => typeof y === 'number'))));
      if (flat && keys.length <= 6) {
        return (
          <div className="overflow-x-auto">
            <table className="bx-table">
              <thead><tr>{keys.map((k) => <th key={k} scope="col">{k === 'cite' ? 'Sources' : humanise(k)}</th>)}</tr></thead>
              <tbody>{value.map((x, i) => <tr key={i}>{keys.map((k) => <td key={k}><FieldView value={(x as Record<string, unknown>)[k]} name={k} depth={depth + 1} /></td>)}</tr>)}</tbody>
            </table>
          </div>
        );
      }
      return <ul className="grid gap-2">{value.map((x, i) => <li key={i} className="border-l-2 border-[color:var(--bx-line)] pl-3"><FieldView value={x} depth={depth + 1} /></li>)}</ul>;
    }
    return (
      <ul className={`list-disc pl-5 grid gap-1 ${SECONDARY.test(name ?? '') ? 'bx-secondary' : ''}`}>
        {value.map((x, i) => <li key={i}>{SECONDARY.test(name ?? '') && <span className="bx-chip border border-dashed border-[color:var(--bx-line)] bx-muted mr-1" data-testid="secondary-only">reported by secondary sources only</span>}<FieldView value={x} depth={depth + 1} /></li>)}
      </ul>
    );
  }
  const entries = Object.entries(value as Record<string, unknown>);
  return (
    <dl className="grid gap-2">
      {entries.map(([k, v]) => (
        <div key={k} className={depth > 0 ? '' : ''}>
          <dt className="text-xs font-semibold bx-muted">{k === 'cite' ? 'Sources' : SECONDARY.test(k) ? 'Reported by secondary sources only' : humanise(k)}</dt>
          <dd className="mt-0.5"><FieldView value={v} name={k} depth={depth + 1} /></dd>
        </div>
      ))}
    </dl>
  );
}
