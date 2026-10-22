import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Figure, Pathway as PathwayT, PathwayEdge, PathwayNode } from '@/types';
import { GATE_COLOUR, getTerm, stageColour } from '@/lib/data';
import { recordMeta } from '@/lib/records';
import { svgToPng } from './download';
import CiteList from '@/components/records/CiteList';
import Term from '@/components/reader/Term';

const PAD = 14;
const COL_W = 150, NODE_W = 138, ROW_H = 92, NODE_H = 62;

/** Wrap a label into lines of ~`max` characters (the full label is always in the card). */
function lines(label: string, max: number, cap: number): string[] {
  const words = label.split(/\s+/); const out: string[] = []; let cur = '';
  for (const w of words) { if ((cur + ' ' + w).trim().length > max && cur) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
  if (cur) out.push(cur);
  return out.length > cap ? [...out.slice(0, cap - 1), `${out[cap - 1].slice(0, max - 1)}…`] : out;
}

const EDGE_DASH: Record<string, string | undefined> = { sequence: undefined, binds: '6 3', 'observed-at': '1.5 3.5' };

/**
 * The stage map (Figure 5) as a fixed-layout SVG from the pack's `col`/`row`. Stages are filled in their stage colour,
 * gate groups are dashed boxes in the gate colour, failure patterns are rounded outlines; a sequence arrow is solid, a
 * binds arrow dashed and an observed-at arrow dotted. Every node is a button: a stage node links to its stage page and a
 * pattern node to its pattern record.
 */
export default function Pathway({ figure, data, inline }: { figure: Figure; data: PathwayT; inline?: boolean }) {
  const [sel, setSel] = useState<{ node?: string; edge?: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const minRow = Math.min(...data.nodes.map((n) => n.row));
  const maxRow = Math.max(...data.nodes.map((n) => n.row));
  const maxCol = Math.max(...data.nodes.map((n) => n.col));
  const W = PAD * 2 + maxCol * COL_W + NODE_W, H = PAD * 2 + (maxRow - minRow) * ROW_H + NODE_H;
  const box = useMemo(() => new Map(data.nodes.map((n) => [n.id, { x: PAD + n.col * COL_W, y: PAD + (n.row - minRow) * ROW_H, w: NODE_W, h: NODE_H }])), [data, minRow]);
  const touches = (e: PathwayEdge) => !!sel?.node && (e.from === sel.node || e.to === sel.node);
  const selNode = sel?.node ? data.nodes.find((n) => n.id === sel.node) : undefined;
  const selEdge = sel?.edge !== undefined ? data.edges[sel.edge] : undefined;
  const nodeById = new Map(data.nodes.map((n) => [n.id, n]));
  const style = (n: PathwayNode) => {
    switch (n.type) {
      case 'stage': return { fill: stageColour(n.stage), fillOpacity: 1, text: '#ffffff', rx: 6, dash: undefined as string | undefined, weight: 700, stroke: 'var(--bx-ink)' };
      case 'gate-group': return { fill: GATE_COLOUR, fillOpacity: 0.12, text: 'var(--bx-ink)', rx: 4, dash: '6 3', weight: 600, stroke: GATE_COLOUR };
      case 'pattern': return { fill: 'var(--bx-bg)', fillOpacity: 1, text: 'var(--bx-ink)', rx: 16, dash: undefined, weight: 600, stroke: 'var(--bx-ink)' };
      default: return { fill: 'var(--bx-bg)', fillOpacity: 1, text: 'var(--bx-ink)', rx: 6, dash: undefined, weight: 400, stroke: 'var(--bx-ink)' };
    }
  };
  const recordLink = (n: PathwayNode) => (n.stage ? `/library/methods#stage-${n.stage}` : n.pattern ? recordMeta('patterns', n.pattern)?.to ?? null : null);

  return (
    <div>
      {!inline && (
        <div className="flex flex-wrap gap-1 justify-end no-print">
          <button type="button" className="bx-btn" onClick={() => svgRef.current && svgToPng(svgRef.current, `${figure.id}.png`)}>PNG</button>
        </div>
      )}
      <div className="mt-2 overflow-auto rounded-md border border-[color:var(--bx-line)]" style={{ maxHeight: inline ? 560 : 820 }}>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ width: '100%', minWidth: Math.round(W * 0.62), height: 'auto' }} role="group" aria-label={`${figure.label}: ${figure.title}. ${data.nodes.length} boxes; select one for its card.`} data-testid={`pathway-${figure.id}`} className="block">
          <defs>
            <marker id={`arr-${figure.id}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="currentColor" /></marker>
          </defs>
          <g className="text-[color:var(--bx-muted)]">
            {data.edges.map((e, i) => {
              const a = box.get(e.from), b = box.get(e.to);
              if (!a || !b) return null;
              const sameRow = Math.abs(a.y - b.y) < 1;
              const x1 = sameRow ? (b.x > a.x ? a.x + a.w : a.x) : a.x + a.w / 2;
              const y1 = sameRow ? a.y + a.h / 2 : b.y > a.y ? a.y + a.h : a.y;
              const x2 = sameRow ? (b.x > a.x ? b.x : b.x + b.w) : b.x + b.w / 2;
              const y2 = sameRow ? b.y + b.h / 2 : b.y > a.y ? b.y : b.y + b.h;
              const my = (y1 + y2) / 2;
              const d = sameRow ? `M${x1},${y1} L${x2},${y2}` : `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`;
              const on = touches(e) || sel?.edge === i;
              return (
                <g key={i}>
                  <path d={d} fill="none" stroke="currentColor" strokeWidth={on ? 2.2 : 1.1} strokeOpacity={sel && !on ? 0.22 : 0.85} strokeDasharray={EDGE_DASH[e.type ?? ''] } strokeLinecap={e.type === 'observed-at' ? 'round' : undefined} markerEnd={`url(#arr-${figure.id})`} />
                  <path d={d} fill="none" stroke="transparent" strokeWidth={10} onMouseEnter={() => setSel({ edge: i })} onClick={() => setSel({ edge: i })} style={{ cursor: 'pointer' }}><title>{`${nodeById.get(e.from)?.label ?? e.from} → ${nodeById.get(e.to)?.label ?? e.to} (${e.type ?? 'link'})`}</title></path>
                </g>
              );
            })}
          </g>
          {data.nodes.map((n) => {
            const p = box.get(n.id)!;
            const on = sel?.node === n.id || (selEdge && (selEdge.from === n.id || selEdge.to === n.id));
            const st = style(n);
            const ls = lines(n.label, 21, 4);
            return (
              <g key={n.id} transform={`translate(${p.x},${p.y})`} tabIndex={0} role="button" aria-label={`${n.label} (${n.type})`} aria-pressed={sel?.node === n.id}
                onMouseEnter={() => setSel({ node: n.id })} onFocus={() => setSel({ node: n.id })} onClick={() => setSel({ node: n.id })}
                onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setSel({ node: n.id }); } }}
                style={{ cursor: 'pointer', outline: 'none' }} data-testid={`node-${n.id}`} data-kind={n.type}>
                <rect width={p.w} height={p.h} rx={st.rx} fill={st.fill} fillOpacity={st.fillOpacity} stroke={st.stroke} strokeOpacity={0.7} strokeWidth={on ? 3 : 1.2} strokeDasharray={st.dash} />
                <text x={8} y={p.h / 2 - (ls.length - 1) * 6.5 + 4} fontSize={n.type === 'stage' ? 13 : 11} fill={st.text} fontWeight={st.weight}>
                  {ls.map((l, i) => <tspan key={i} x={8} dy={i === 0 ? 0 : 13}>{l}</tspan>)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="mt-2 text-xs bx-muted flex flex-wrap gap-x-4">
        <span>filled box: a stage</span><span>dashed box: a group of gates</span><span>rounded box: a failure pattern</span>
        <span>solid arrow: sequence</span><span>dashed arrow: binds</span><span>dotted arrow: observed at</span>
      </p>
      <div className="mt-3 bx-card p-3 text-sm min-h-[5.5rem]" aria-live="polite" data-testid="pathway-card">
        {!sel && <p className="bx-muted">Hover, focus or select a box or an arrow for its full label and the record it links to.</p>}
        {selNode && (
          <div>
            <p className="font-semibold">{selNode.label} <span className="bx-chip border border-[color:var(--bx-line)] bx-muted ml-1">{selNode.type}</span></p>
            {recordLink(selNode) && <p className="mt-1"><Link className="underline" to={recordLink(selNode)!}>{selNode.stage ? 'The stage page →' : 'The pattern record →'}</Link></p>}
            {selNode.term && getTerm(selNode.term) && <p className="mt-1 text-sm">Term: <Term id={selNode.term}>{getTerm(selNode.term)!.term}</Term></p>}
            {selNode.refs.length > 0 && <div className="mt-1"><CiteList ns={selNode.refs} /></div>}
          </div>
        )}
        {selEdge && (
          <div>
            <p className="font-semibold">{nodeById.get(selEdge.from)?.label} → {nodeById.get(selEdge.to)?.label}</p>
            <p className="mt-1 text-xs bx-muted">{selEdge.type}{selEdge.label ? ` · ${selEdge.label}` : ''}</p>
            {selEdge.refs.length > 0 && <div className="mt-1"><CiteList ns={selEdge.refs} /></div>}
          </div>
        )}
      </div>
      {data.note && <p className="mt-2 text-xs bx-muted">{data.note}</p>}
    </div>
  );
}
