import { Link } from 'react-router-dom';
import { conceptsIndex, getFigure, getTerm, SELF_CHECKS } from '@/lib/data';
import Prose from '@/components/records/Prose';

export default function Concepts() {
  const ordered = [...conceptsIndex].sort((a, b) => a.prerequisites.length - b.prerequisites.length || a.title.localeCompare(b.title));
  return (
    <div className="max-w-[52rem]">
      <h1 className="text-[32px] sm:text-[38px]">Primers</h1>
      <p className="bx-prose mt-2">
        {conceptsIndex.length} short introductions to what the guide presumes a reader already knows, written by the guide's builder with every claim cited.
        Each says why the guide needs it, describes the key idea in one picture, explains the arithmetic where there is any, and says how the guide uses it{SELF_CHECKS ? ', and ends with a self-check' : ''}. A primer marked “read first” has another before it.
      </p>
      <ol className="mt-6 grid gap-3">
        {ordered.map((c) => (
          <li key={c.id} className="bx-card p-4">
            <h2 className="text-xl"><Link className="underline decoration-dotted" to={`/library/primers/${c.id}`}>{c.title}</Link></h2>
            <div className="bx-prose mt-1"><Prose md={c.one_liner} /></div>
            <p className="mt-2 text-xs bx-muted flex flex-wrap gap-x-4 gap-y-1">
              {c.prerequisites.length > 0
                ? <span>Read first: {c.prerequisites.map((p) => <Link key={p} className="underline mr-1.5" to={`/library/primers/${p}`}>{conceptsIndex.find((x) => x.id === p)?.title ?? p}</Link>)}</span>
                : <span>No prerequisites</span>}
              {c.figures.length > 0 && <span>Figures: {c.figures.map((f) => <Link key={f} className="underline mr-1.5" to={`/library/guide#figure-${f}`}>{getFigure(f)?.label ?? f}</Link>)}</span>}
              <span>{c.terms.length} terms · e.g. {c.terms.slice(0, 3).map((t) => getTerm(t)?.term.split(' (')[0] ?? t).join(', ')}</span>
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
