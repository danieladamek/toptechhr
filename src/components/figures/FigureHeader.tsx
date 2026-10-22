import type { Figure } from '@/types';

export const SYNTH_NOTE: Record<string, string> = {
  data: 'Assembled by the builder from values published in the cited sources. Values are as published, each row with its own source.',
  conceptual: 'Drawn by the builder from the cited sources. It is a diagram, not data.',
};

/** The figure's heading: label, kind, title, provenance — from the slim index, so it paints first. */
export default function FigureHeader({ meta }: { meta: Pick<Figure, 'id' | 'label' | 'kind' | 'title' | 'provenance'> & { synthesis?: Figure['synthesis'] | null } }) {
  return (
    <div className="flex flex-wrap items-start gap-3">
      <div className="flex-1 min-w-[16rem]">
        <p className="text-[11px] font-semibold tracking-[0.15em] bx-muted">{meta.label.toUpperCase()} · {meta.kind.toUpperCase()}</p>
        <h3 id={`fig-title-${meta.id}`} className="text-xl mt-1">{meta.title}</h3>
      </div>
      <span className="flex items-center gap-2">
        <span className="bx-chip border border-[color:var(--bx-line)]" title={meta.synthesis ? SYNTH_NOTE[meta.synthesis] : undefined}>{meta.provenance}</span>
      </span>
    </div>
  );
}

