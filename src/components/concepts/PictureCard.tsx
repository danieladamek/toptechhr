import { Link } from 'react-router-dom';
import type { Concept } from '@/types';
import { getFigure } from '@/lib/data';
import Markdown, { readerComponents } from '@/components/reader/Markdown';

/** "The key idea in one picture": the pack's prose describing a diagram, rendered as prose; no new diagram is drawn. The guide's figures it names are linked beside it. */
export default function PictureCard({ concept }: { concept: Concept }) {
  if (!concept.picture) return null;
  const figs = concept.figures.map((f) => getFigure(f)).filter(Boolean);
  return (
    <section className="mt-8" aria-labelledby="picture-h">
      <h2 id="picture-h" className="text-2xl">The key idea in one picture</h2>
      <div className="bx-card mt-3 p-4 border-l-4 border-l-[color:var(--bx-accent)]">
        <p className="text-[11px] font-semibold tracking-[0.15em] bx-muted">THE PICTURE, IN WORDS</p>
        <Markdown md={concept.picture} components={readerComponents} className="bx-prose mt-1" />
      </div>
      {figs.length > 0 && (
        <p className="mt-3 text-sm">The guide’s figures for this idea: {figs.map((f) => <Link key={f!.id} className="bx-chip border border-[color:var(--bx-line)] mr-1.5 hover:bg-paper-2 dark:hover:bg-night-2" to={`/library/guide#figure-${f!.id}`}>{f!.label} · {f!.title}</Link>)}</p>
      )}
    </section>
  );
}
