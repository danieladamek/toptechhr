import { Link } from 'react-router-dom';
import { bodySections, shortSectionTitle } from '@/lib/data';

/** Section navigation: sticky rail on ≥1280 px, a select box below. `active` = section id in view. */
export default function SectionRail({ active, variant }: { active: string | null; variant: 'rail' | 'select' }) {
  if (variant === 'select') {
    return (
      <div className="no-print">
        <label htmlFor="section-select" className="sr-only">Jump to section</label>
        <select id="section-select" className="bx-input" value={active ?? ''} onChange={(e) => { const id = e.target.value; if (id) { document.getElementById(id)?.scrollIntoView(); history.replaceState(null, '', `#${id}`); } }}>
          <option value="">Jump to section…</option>
          {bodySections.map((s) => <option key={s.id} value={s.id}>{s.number ? `${s.number} ` : ''}{shortSectionTitle(s)}</option>)}
        </select>
      </div>
    );
  }
  return (
    <nav aria-label="Sections" className="bx-rail text-sm">
      <ol className="grid gap-0.5">
        {bodySections.map((s) => (
          <li key={s.id} style={{ paddingLeft: `${Math.max(0, s.depth - 2) * 0.75}rem` }}>
            <Link to={`#${s.id}`} aria-current={active === s.id ? 'location' : undefined} className={`block rounded px-2 py-0.5 leading-5 hover:bg-paper-2 dark:hover:bg-night-2 ${active === s.id ? 'font-semibold bg-paper-2 dark:bg-night-2' : 'bx-muted'}`}>
              {s.number && <span className="tabular-nums mr-1">{s.number}</span>}{shortSectionTitle(s)}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
