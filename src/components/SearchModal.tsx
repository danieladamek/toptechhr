import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { search, type SearchHit } from '@/lib/search';

const KIND_LABEL: Record<SearchHit['kind'], string> = {
  term: 'Term', concept: 'Primer', figure: 'Figure', section: 'Guide', stages: 'Stage', patterns: 'Pattern', constraints: 'Constraint',
  levers: 'Action', gates: 'Rule', enablers: 'Program', indicators: 'Number', states: 'State', controversies: 'Controversy', changes: 'Change',
};

/** ⌘K search over records, guide sections, terms and primers (KICKOFF §4). */
export default function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const hits = search(q);
  useEffect(() => { if (open) { setQ(''); setSel(0); setTimeout(() => inputRef.current?.focus(), 0); } }, [open]);
  useEffect(() => { setSel(0); }, [q]);
  if (!open) return null;
  const go = (h: SearchHit) => { onClose(); navigate(h.to); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, hits.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === 'Enter' && hits[sel]) { e.preventDefault(); go(hits[sel]); }
  };
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/40 p-4 pt-[10vh]" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="Search" className="bx-card w-full max-w-xl p-3" onKeyDown={onKey}>
        <label htmlFor="global-search" className="sr-only">Search records, guide sections, terms and primers</label>
        <input id="global-search" ref={inputRef} className="bx-input !text-base" placeholder="Search actions, rules, numbers, terms…" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" role="combobox" aria-expanded={hits.length > 0} aria-controls="search-results" aria-activedescendant={hits[sel] ? `hit-${hits[sel].kind}-${hits[sel].id}` : undefined} />
        <ul id="search-results" role="listbox" className="mt-2 max-h-[60vh] overflow-y-auto divide-y divide-[color:var(--bx-line)]">
          {q && hits.length === 0 && <li className="p-3 text-sm bx-muted">No matches.</li>}
          {hits.map((h, i) => (
            <li key={`${h.kind}-${h.id}`} id={`hit-${h.kind}-${h.id}`} role="option" aria-selected={i === sel}>
              <button type="button" className={`w-full text-left px-2 py-2 rounded-md flex gap-3 items-baseline ${i === sel ? 'bg-paper-2 dark:bg-night-2' : ''}`} onMouseEnter={() => setSel(i)} onClick={() => go(h)}>
                <span className="bx-chip bg-paper-2 dark:bg-night-2 shrink-0 w-24 justify-center">{KIND_LABEL[h.kind]}</span>
                <span className="min-w-0"><span className="font-semibold">{h.title}</span><span className="block text-xs bx-muted truncate">{h.subtitle}</span></span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] bx-muted">↑↓ to move · Enter to open · Esc to close</p>
      </div>
    </div>
  );
}
