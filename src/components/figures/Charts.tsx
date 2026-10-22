import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
// No <LabelList>: recharts 2.x renders it with a string ref, which React 18's StrictMode rejects in production.
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts';
import type { ChartSpec, Row } from '@/types';
import { PALETTE } from '@/lib/data';
import { downloadCsv, svgToPng } from './download';

interface Props { id: string; spec: ChartSpec; rows: Row[]; fields: string[]; inline?: boolean }

const num = (v: unknown) => (typeof v === 'number' ? v : v == null || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);
/**
 * Series colours from manifest.palette.groups: a series named for a stage takes that stage's colour; others take
 * the remaining palette colours in turn. Every series is also given a glyph and its name, never colour alone.
 */
const FAMILY_KEYS = ['select', 'offer', 'attract', 'clear-start', 'retain', 'handover', 'develop', 'onboard', 'plan', 'gate'];
const EXTRA = ['#4a4a8a', '#8a3b3b', '#2f6f7a', '#6b5b2a'];
const GLYPHS = ['●', '■', '▲', '◆', '★', '✚', '⬟', '⬢'];
const SHAPES = ['circle', 'square', 'triangle', 'diamond', 'star', 'cross', 'wye', 'circle'] as const;
function seriesStyles(series: string[]) {
  const free = [...FAMILY_KEYS.map((k) => PALETTE[k]).filter(Boolean), ...EXTRA];
  const taken = new Set(series.map((s) => PALETTE[s]).filter(Boolean));
  const pool = free.filter((c) => !taken.has(c));
  let j = 0;
  return series.map((s, i) => ({ key: s, colour: PALETTE[s] ?? pool[j++ % pool.length], glyph: GLYPHS[i % GLYPHS.length], shape: SHAPES[i % SHAPES.length] }));
}

function Downloads({ png, csv }: { png: () => void; csv: () => void }) {
  return <span className="ml-auto inline-flex gap-1 no-print"><button type="button" className="bx-btn" onClick={png}>PNG</button><button type="button" className="bx-btn" onClick={csv}>CSV</button></span>;
}

function ToggleLegend({ title, items, hidden, onToggle }: { title?: string; items: { key: string; colour: string; glyph: string }[]; hidden: Set<string>; onToggle: (k: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {title && <span className="bx-muted">{title}:</span>}
      <ul className="flex flex-wrap gap-1.5" aria-label={`${title ?? 'Series'} (select to show or hide)`}>
        {items.map((it) => (
          <li key={it.key}>
            <button type="button" className={`bx-btn !py-0.5 ${hidden.has(it.key) ? 'opacity-50 line-through' : ''}`} aria-pressed={!hidden.has(it.key)} onClick={() => onToggle(it.key)} data-testid="legend-toggle">
              <span aria-hidden="true" style={{ color: it.colour }}>{it.glyph}</span> {it.key}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function useFrame(id: string, rows: Row[], fields: string[]) {
  const ref = useRef<HTMLDivElement>(null);
  return { ref, png: () => { const svg = ref.current?.querySelector('svg.recharts-surface'); if (svg) svgToPng(svg as SVGSVGElement, `${id}.png`); }, csv: () => downloadCsv(rows, fields, `${id}.csv`) };
}
const toggler = (set: React.Dispatch<React.SetStateAction<Set<string>>>) => (k: string) => set((h) => { const n = new Set(h); if (n.has(k)) n.delete(k); else n.add(k); return n; });

function TipRow({ p, keys }: { p: Row; keys: string[] }) {
  return <>{keys.filter((k) => p[k] != null && p[k] !== '').map((k) => <p key={k} className="mt-0.5"><span className="bx-muted">{k.replace(/_/g, ' ')}:</span> {String(p[k]).length > 220 ? `${String(p[k]).slice(0, 220)}…` : String(p[k])}</p>)}</>;
}

/**
 * Bars (Figures 4 and 7) and stacked bars (Figure 6): exact values and the row's own source in the tooltip, legend
 * toggles. Where the x value repeats within a series (one foundation, several policies), each row keeps its own bar,
 * numbered. A missing value is a gap, never a zero.
 */
export function Bars({ id, spec, rows, fields, inline }: Props) {
  const stacked = spec.type === 'stacked-bar';
  const xf = spec.x?.field ?? fields[0]; const yf = spec.y?.field ?? fields[1]; const sf = spec.series?.field;
  const series = sf ? [...new Set(rows.map((r) => String(r[sf])))] : [yf];
  const styles = seriesStyles(series);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const { ref, png, csv } = useFrame(id, rows, fields);
  const data = useMemo(() => {
    const groups = new Map<string, Record<string, unknown>>();
    const used = new Map<string, number>();
    for (const r of rows) {
      const k = `s${sf ? series.indexOf(String(r[sf])) : 0}`;
      let x = String(r[xf]);
      if (!stacked) {
        const n = (used.get(`${x}|${k}`) ?? 0) + 1;
        used.set(`${x}|${k}`, n);
        if (n > 1) x = `${x} (${n})`;
      }
      if (!groups.has(x)) groups.set(x, { __x: x });
      const g = groups.get(x)!;
      // dataKeys are positional (s0, s1…): a series name with a dot would be read as a property path
      g[k] = num(r[yf]);
      g[`__row:${k}`] = r;
    }
    return [...groups.values()];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, xf, yf, sf, stacked]);
  const extraKeys = fields.filter((f) => ![xf, yf].includes(f) && !/_sort$/.test(f));
  const many = data.length > 8;
  const h = many ? Math.max(inline ? 420 : 480, data.length * (inline ? 15 : 17) + 60) : inline ? 320 : 400;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <ToggleLegend title={spec.series?.label} items={styles} hidden={hidden} onToggle={toggler(setHidden)} />
        {!inline && <Downloads png={png} csv={csv} />}
      </div>
      <p className="text-xs bx-muted mt-1">{spec.y?.label ?? yf}</p>
      <div ref={ref} className="mt-1" style={{ width: '100%', height: h }} role="img" aria-label={`${stacked ? 'Stacked bar' : 'Bar'} chart of ${spec.y?.label ?? yf} by ${spec.x?.label ?? xf}${sf ? ` and ${spec.series?.label ?? sf}` : ''}. Every value is in the table below.`} data-testid={`chart-${id}`}>
        <ResponsiveContainer>
          <BarChart data={data} layout={many ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 16, left: 8, bottom: many ? 8 : 48 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--bx-line)" />
            {many ? (
              <>
                <XAxis type="number" domain={[0, 'auto']} tick={{ fill: 'var(--bx-muted)', fontSize: 11 }} tickFormatter={(v: number) => v.toLocaleString('en-US', { notation: 'compact' })} />
                <YAxis type="category" dataKey="__x" width={inline ? 190 : 280} interval={0} tick={{ fill: 'var(--bx-muted)', fontSize: 10 }} tickFormatter={(v: string) => (v.length > (inline ? 34 : 50) ? `${v.slice(0, inline ? 33 : 49)}…` : v)} />
              </>
            ) : (
              <>
                <XAxis dataKey="__x" interval={0} tick={{ fill: 'var(--bx-muted)', fontSize: 10 }} tickFormatter={(v: string) => (v.length > 26 ? `${v.slice(0, 25)}…` : v)} label={{ value: spec.x?.label ?? xf, position: 'insideBottom', offset: -36, fill: 'var(--bx-muted)', fontSize: 12 }} />
                <YAxis domain={[0, 'auto']} allowDecimals={false} width={56} tick={{ fill: 'var(--bx-muted)', fontSize: 11 }} />
              </>
            )}
            <Tooltip
              cursor={{ fill: 'var(--bx-bg-2)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const g = payload[0].payload as Record<string, unknown>;
                return (
                  <div className="bx-card p-2 text-xs max-w-[24rem] bg-paper dark:bg-night" data-testid="chart-tooltip">
                    <p className="font-semibold">{String(g.__x)}</p>
                    {payload.map((p) => { const r = g[`__row:${String(p.dataKey)}`] as Row | undefined; return r ? (
                      <div key={String(p.dataKey)} className="mt-1 border-t border-[color:var(--bx-line)] pt-1">
                        <p><span style={{ color: p.color }} aria-hidden="true">■ </span>{String(p.name)}: <strong>{r[yf] === null ? 'no figure' : String(r[yf])}</strong></p>
                        <TipRow p={r} keys={extraKeys} />
                      </div>) : null; })}
                  </div>
                );
              }}
            />
            {styles.map((s, i) => !hidden.has(s.key) && <Bar key={s.key} dataKey={`s${i}`} name={s.key} fill={s.colour} stackId={stacked ? 'a' : undefined} isAnimationActive={false} />)}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-xs bx-muted">Hover or focus a bar for its exact value as recorded and its source. Toggle a series in the legend; a missing value is a gap, not a zero.</p>
    </div>
  );
}

/** A deterministic small offset for points that share a date and a status, so none hides another. It carries no meaning. */
export function offsets<T>(items: T[], key: (t: T) => string, step = 0.11): number[] {
  const seen = new Map<string, number>();
  return items.map((it) => {
    const k = key(it);
    const n = seen.get(k) ?? 0;
    seen.set(k, n + 1);
    // 0, +1, −1, +2, −2 … steps, capped inside the row's band
    const m = n === 0 ? 0 : (n % 2 ? 1 : -1) * Math.ceil(n / 2);
    return Math.max(-0.42, Math.min(0.42, m * step / Math.max(1, Math.sqrt(n / 6 + 1))));
  });
}

/**
 * Figure 10: dated changes, date on x and one row per status on y, coloured by the part of the guide that recorded
 * them. Points that share a date and a status are offset so they do not hide each other; the offset carries no
 * meaning. Each point opens its change record.
 */
export function DateScatter({ id, spec, rows, fields, inline }: Props) {
  const navigate = useNavigate();
  const xf = spec.x?.field ?? fields[0]; const yf = spec.y?.field ?? fields[1]; const sf = spec.series?.field;
  const series = sf ? [...new Set(rows.map((r) => String(r[sf])))] : ['all'];
  const styles = seriesStyles(series);
  const cats = [...new Set(rows.map((r) => String(r[yf])))].sort();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const { ref, png, csv } = useFrame(id, rows, fields);
  const pts = useMemo(() => {
    const base: (Row & { __x: number; __c: number })[] = rows.map((r) => ({ ...r, __x: Date.parse(`${String(r[xf])}T00:00:00Z`), __c: cats.indexOf(String(r[yf])) })).filter((p) => Number.isFinite(p.__x));
    const off = offsets(base, (p) => `${p.__x}|${p.__c}`);
    return base.map((p, i) => ({ ...p, __y: p.__c + off[i] })) as (Row & { __x: number; __y: number })[];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, xf, yf]);
  const fmt = (t: number) => new Date(t).toISOString().slice(0, 7);
  const extraKeys = fields.filter((f) => ![xf, 'id', 'record', 'plot_date'].includes(f));
  const open = (p: Row) => { const rid = String(p.id ?? String(p.record ?? '').split('/')[1] ?? ''); if (rid) navigate(`/rules#${rid}`); };
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <ToggleLegend title={spec.series?.label} items={styles} hidden={hidden} onToggle={toggler(setHidden)} />
        {!inline && <Downloads png={png} csv={csv} />}
      </div>
      <div ref={ref} className="mt-2" style={{ width: '100%', height: inline ? 380 : 460 }} role="img" aria-label={`Timeline of ${pts.length} dated changes by ${spec.y?.label ?? yf}. Every entry is in the table below.`} data-testid={`chart-${id}`}>
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 12, right: 16, left: 8, bottom: 28 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--bx-line)" />
            <XAxis type="number" dataKey="__x" domain={['dataMin - 2592000000', 'dataMax + 2592000000']} tickFormatter={fmt} tick={{ fill: 'var(--bx-muted)', fontSize: 11 }} label={{ value: spec.x?.label ?? xf, position: 'insideBottom', offset: -16, fill: 'var(--bx-muted)', fontSize: 12 }} />
            <YAxis type="number" dataKey="__y" domain={[-0.5, cats.length - 0.5]} ticks={cats.map((_, i) => i)} tickFormatter={(v: number) => cats[Math.round(v)] ?? ''} width={160} interval={0} tick={{ fill: 'var(--bx-muted)', fontSize: 11 }} />
            <ZAxis range={[46, 46]} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as Row;
              return <div className="bx-card p-2 text-xs max-w-[24rem] bg-paper dark:bg-night" data-testid="chart-tooltip"><p className="font-semibold">{String(p.date ?? p[xf])} · {String(p[yf])}</p><TipRow p={p} keys={extraKeys.filter((k) => k !== 'date' && k !== yf)} /><p className="mt-1 bx-muted">Select the point to open the change record.</p></div>;
            }} />
            {styles.map((s) => !hidden.has(s.key) && <Scatter key={s.key} name={s.key} data={pts.filter((p) => !sf || String(p[sf]) === s.key)} fill={s.colour} shape={s.shape} isAnimationActive={false} onClick={(d: { payload?: Row }) => d?.payload && open(d.payload)} style={{ cursor: 'pointer' }} />)}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-xs bx-muted" data-testid="offset-note">Hover or focus a point for the change, its date, status and sources; select it to open the change record. Points that share a date and a status are moved a little up or down so none hides another — the offset carries no meaning. Each point sits at the date in the data’s plot_date column; every one is in the table below.</p>
    </div>
  );
}

export default function Charts(props: Props) {
  if (props.spec.type === 'scatter') return <DateScatter {...props} />;
  return <Bars {...props} />;
}
