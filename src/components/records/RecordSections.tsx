import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { scrollToId } from '@/lib/data';
import { humanise } from './FieldView';
import { Field } from './Bits';

/** Every key not already rendered, in pack order — nothing the pack records is dropped. */
export function OtherFields({ record, shown }: { record: Record<string, unknown>; shown: Set<string> }) {
  return <>{Object.entries(record).filter(([k]) => !shown.has(k)).map(([k, v]) => <Field key={k} label={humanise(k)} value={v} name={k} />)}</>;
}

/** A record shown as a disclosure on a list page (`/gates#id`, `/enablers#id`…); opens itself when the URL hash names it. */
export function Disclosure({ id, summary, children, testId }: { id: string; summary: ReactNode; children: ReactNode; testId?: string }) {
  const loc = useLocation();
  const [open, setOpen] = useState(() => loc.hash === `#${id}`);
  useEffect(() => { if (loc.hash === `#${id}`) { setOpen(true); scrollToId(id); } }, [loc.hash, id]);
  return (
    <details id={id} open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)} className="bx-card scroll-mt-28" data-testid={testId ?? `rec-${id}`}>
      <summary className="cursor-pointer p-3 list-none flex items-start gap-2 [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="bx-muted mt-0.5">{open ? '▾' : '▸'}</span>
        <span className="min-w-0 flex-1">{summary}</span>
      </summary>
      {open && <div className="px-3 pb-4 pt-0 sm:px-5">{children}</div>}
    </details>
  );
}
