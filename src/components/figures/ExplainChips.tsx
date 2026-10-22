import { Link } from 'react-router-dom';
import type { Explain } from '@/types';
import { getConcept, getTerm } from '@/lib/data';
import Popover from '@/components/ui/Popover';
import Prose from '@/components/records/Prose';

/** ⓘ popovers written from the content pack's explain[] block; each may link a term and/or a primer. */
export default function ExplainChips({ items, figureId }: { items: Explain[]; figureId: string }) {
  if (!items.length) return null;
  return (
    <div className="mt-3">
      <p className="text-[11px] font-semibold tracking-[0.15em] bx-muted">WHAT THE PARTS MEAN</p>
      <ul className="mt-1 flex flex-wrap gap-1.5" aria-label="Explanations">
        {items.map((ex, i) => {
          const t = getTerm(ex.term); const c = getConcept(ex.concept);
          return (
            <li key={i}>
              <Popover className="bx-chip border border-[color:var(--bx-line)] bg-white/70 dark:bg-night-2 hover:bg-paper-2 dark:hover:bg-[#2b261f]" testId={`explain-${figureId}-${i}`} content={
                <div>
                  <p className="font-semibold">{ex.on}</p>
                  <div className="mt-1 leading-6"><Prose md={ex.text} /></div>
                  {(t || c) && <p className="mt-2 flex flex-wrap gap-x-4 text-xs">{t && <Link className="underline" to={`/library/glossary#${t.id}`}>{t.term} →</Link>}{c && <Link className="underline" to={`/library/primers/${c.id}`}>Primer: {c.title} →</Link>}</p>}
                </div>
              }>
                <span aria-hidden="true">ⓘ</span> {ex.on}
              </Popover>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
