import { useRef } from 'react';
import { Link } from 'react-router-dom';
import type { Figure } from '@/types';
import { assetUrl, CONCEPTS_LABEL, getConcept, sectionTitle } from '@/lib/data';
import ExplainChips from './ExplainChips';
import FigureBody from './FigureBody';
import FigureHeader from './FigureHeader';
import Prose from '@/components/records/Prose';
import CiteList from '@/components/records/CiteList';
import { downloadSvg, svgToPdf } from './download';

const base = (p?: string) => (p ? p.split('/').pop()! : '');

/**
 * The figure's main picture as an SVG: the chart surface or the pathway, or — for a table — the table itself
 * wrapped in an SVG foreignObject, so every figure exports to SVG and PDF.
 */
function figureSvg(root: HTMLElement | null): SVGSVGElement | null {
  if (!root) return null;
  const svg = root.querySelector<SVGSVGElement>('svg.recharts-surface, svg[data-testid^="pathway-"]');
  if (svg) return svg;
  const table = root.querySelector('table');
  if (!table) return null;
  const w = Math.max(600, table.scrollWidth), h = table.scrollHeight;
  const ns = 'http://www.w3.org/2000/svg';
  const out = document.createElementNS(ns, 'svg');
  out.setAttribute('viewBox', `0 0 ${w} ${h}`); out.setAttribute('width', String(w)); out.setAttribute('height', String(h));
  const fo = document.createElementNS(ns, 'foreignObject');
  fo.setAttribute('width', String(w)); fo.setAttribute('height', String(h));
  const div = document.createElement('div');
  div.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  div.style.font = '12px sans-serif';
  const t = table.cloneNode(true) as HTMLTableElement;
  t.style.borderCollapse = 'collapse';
  t.querySelectorAll('th,td').forEach((c) => { (c as HTMLElement).style.cssText = 'border:1px solid #d9d2c7;padding:3px 5px;vertical-align:top;text-align:left'; });
  div.appendChild(t); fo.appendChild(div); out.appendChild(fo);
  // measured off-screen so getBoundingClientRect works for the PDF rasteriser
  out.style.position = 'fixed'; out.style.left = '-99999px'; document.body.appendChild(out);
  setTimeout(() => out.remove(), 3000);
  return out;
}

/** InfographicFrame pattern: title, the figure, caption, how to read it, what it is made of, every export. */
export default function FigureFrame({ figure, headless = false }: { figure: Figure; headless?: boolean }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const Wrap = headless ? 'div' : 'figure';
  return (
    <Wrap className={headless ? '' : 'bx-card p-4 sm:p-6'} aria-labelledby={headless ? undefined : `fig-title-${figure.id}`}>
      {!headless && <FigureHeader meta={figure} />}
      <div className="mt-3 flex flex-wrap gap-1.5 text-sm no-print" aria-label="Downloads" data-testid="figure-downloads">
        <button type="button" className="bx-btn" onClick={() => { const s = figureSvg(bodyRef.current); if (s) downloadSvg(s, `${figure.id}.svg`); }}>SVG</button>
        <button type="button" className="bx-btn" onClick={() => { const s = figureSvg(bodyRef.current); if (s) svgToPdf(s, `${figure.id}.pdf`); }}>PDF</button>
        {figure.data && <a className="bx-btn" href={assetUrl(`figures/${base(figure.data)}`)} download>Data ({base(figure.data)})</a>}
        {figure.script && <a className="bx-btn" href={assetUrl(`figures/${base(figure.script)}`)} download>Script ({base(figure.script)})</a>}
      </div>
      <div className="mt-4" ref={bodyRef}><FigureBody figure={figure} /></div>
      <figcaption className="mt-4 border-t border-[color:var(--bx-line)] pt-3 text-sm leading-6">
        <span className="font-semibold">Caption. </span><Prose md={figure.caption} />
      </figcaption>
      <div className="mt-4">
        <h2 className="text-lg">How to read this figure</h2>
        <div className="bx-prose mt-1"><Prose md={figure.how_to_read} /></div>
      </div>
      <ExplainChips items={figure.explain} figureId={figure.id} />
      <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.15em] bx-muted">BUILT FROM ({figure.refs.length} REFERENCES)</p>
          <div className="mt-1" data-testid="figure-refs"><CiteList ns={figure.refs} /></div>
          {figure.concepts.length > 0 && (
            <>
              <p className="text-[11px] font-semibold tracking-[0.15em] bx-muted mt-3">{CONCEPTS_LABEL.toUpperCase()} FOR THIS FIGURE</p>
              <ul className="mt-1 flex flex-wrap gap-1.5">{figure.concepts.map((c) => <li key={c}><Link className="bx-chip border border-[color:var(--bx-line)] hover:bg-paper-2 dark:hover:bg-night-2" to={`/library/primers/${c}`}>{getConcept(c)?.title ?? c}</Link></li>)}</ul>
            </>
          )}
        </div>
        <div>
          <p className="text-[11px] font-semibold tracking-[0.15em] bx-muted">WHERE IT IS DISCUSSED</p>
          <ul className="mt-1 grid gap-0.5">{figure.discussed_in.map((s) => <li key={s}><Link className="underline" to={`/library/guide#${s}`}>{sectionTitle(s)}</Link></li>)}</ul>
        </div>
      </div>
      <div className="mt-4 text-xs bx-muted"><span className="font-semibold">Source: </span><Prose md={figure.source} /></div>
      <p className="mt-1 text-xs bx-muted" data-testid="figure-synthesis">
        <span className="font-semibold">What it is: </span>
        {figure.synthesis === 'data' ? 'synthesised from data across the cited works' : 'a conceptual diagram drawn by the builder from the cited works'} — no published figure image is reproduced anywhere in this app.
      </p>
    </Wrap>
  );
}
