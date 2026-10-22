import { Link } from 'react-router-dom';
import type { TermShort } from '@/types';
import { CONCEPT_WORD, getConcept } from '@/lib/data';
import KindChip from './KindChip';

/** The short popover body for a glossary term (short definition + full entry + primer link). */
export default function TermCard({ term, onNavigate }: { term: TermShort; onNavigate?: () => void }) {
  const concept = getConcept(term.concept);
  return (
    <div>
      <p className="font-display text-base font-semibold leading-snug">{term.term} <KindChip kind={term.domain} /></p>
      <p className="mt-1 leading-6">{term.short}</p>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <Link className="underline font-semibold" to={`/library/glossary#${term.id}`} onClick={onNavigate}>Full entry →</Link>
        {concept && <Link className="underline" to={`/library/primers/${concept.id}`} onClick={onNavigate}>Read the {CONCEPT_WORD} → {concept.title.split(':')[0]}</Link>}
      </p>
    </div>
  );
}

