import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useNotebook } from '@/lib/notebook-context';
import { loadHr } from '@/lib/heavy';
import type { HrTemplateSection } from '@/types';
import Editor from './Editor';
import { DeleteButton, ExportMenu, ImportButton, Persistence } from './NotebookControls';
import { S } from '@/strings';

/** The docked Notebook (KICKOFF §4c): pick a notebook, edit it, export or import, and the persistence line. */
export default function NotebookPanel({ onClose }: { onClose?: () => void }) {
  const nbk = useNotebook();
  const { store, active, dispatch } = nbk;
  const [sections, setSections] = useState<HrTemplateSection[]>([]);
  useEffect(() => { let live = true; loadHr().then((h) => { if (live) setSections(h.template.sections); }); return () => { live = false; }; }, []);
  return (
    <div className="flex h-full flex-col" data-testid="notebook-panel">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-display font-extrabold uppercase tracking-[0.14em]">{S.notebook}</h2>
        {onClose && <button type="button" className="bx-btn !px-2" onClick={onClose} aria-label={`${S.close} ${S.notebook}`}>×</button>}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {store.notebooks.length > 1 && (
          <select className="bx-input !w-auto !py-1 !text-[14px]" aria-label="Notebook" value={active?.id ?? ''} onChange={(e) => dispatch({ type: 'activate', id: e.target.value })}>
            {store.notebooks.map((n) => <option key={n.id} value={n.id}>{n.title || S.untitled}</option>)}
          </select>
        )}
        <button type="button" className="bx-btn" onClick={() => void nbk.create()} data-testid="new-notebook">{S.newNotebook}</button>
        {active && <ExportMenu nb={active} />}
        <ImportButton />
      </div>
      <div className="mt-3 flex-1 overflow-y-auto pr-1">
        {active ? (
          <>
            <label className="block">
              <span className="sr-only">{S.rename}</span>
              <input className="bx-input !text-[16px] font-semibold" value={active.title} onChange={(e) => dispatch({ type: 'rename', id: active.id, title: e.target.value })} aria-label={S.rename} data-testid="notebook-title" />
            </label>
            <div className="mt-2"><Editor nb={active} sections={sections} compact onDoc={(doc) => dispatch({ type: 'setDoc', id: active.id, doc })} /></div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-[13px]">
              <Link className="bx-btn-text" to={`/notebook/${active.id}`}>{S.openFull}</Link>
              <Link className="bx-btn-text" to="/notebook">{S.notebookH1}</Link>
              <DeleteButton nb={active} />
            </div>
          </>
        ) : (
          <p className="bx-muted text-[15px]">{S.noNotebooks}</p>
        )}
      </div>
      <div className="mt-3 border-t pt-2" style={{ borderColor: 'var(--bx-line)' }}><Persistence /></div>
    </div>
  );
}
