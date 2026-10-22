import type { ReactNode } from 'react';
import { getTerm } from '@/lib/data';
import Popover from '@/components/ui/Popover';
import TermCard from '@/components/ui/TermCard';

/** A glossary term in the reader: visually quiet dotted underline, popover with the short definition. */
export default function Term({ id, children }: { id: string; children: ReactNode }) {
  const t = getTerm(id);
  if (!t) return <>{children}</>;
  return (
    <Popover className="bx-term" content={<TermCard term={t} />} testId={`term-${id}`}>
      {children}
    </Popover>
  );
}
