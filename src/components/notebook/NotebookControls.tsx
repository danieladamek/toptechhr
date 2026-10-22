import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotebook } from '@/lib/notebook-context';
import { importJson, type Notebook } from '@/lib/notebook';
import { exportNotebook, type ExportKind } from '@/lib/export';
import { S } from '@/strings';

/** Export (docx · PDF · HTML · Markdown · JSON), Import, Delete — shared by the panel and the full page. */
export function ExportMenu({ nb }: { nb: Notebook }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const items: [ExportKind, string][] = [['docx', S.exportDocx], ['pdf', S.exportPdf], ['html', S.exportHtml], ['md', S.exportMd], ['json', S.exportJson]];
  return (
    <div className="relative" onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}>
      <button type="button" className="bx-btn" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((o) => !o)} data-testid="export-menu">{S.export} ▾</button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 grid min-w-[12rem] gap-0.5 rounded-[12px] p-1.5 bx-card" role="group" aria-label={S.export}>
          {items.map(([k, label]) => (
            <button key={k} type="button" className="text-left rounded-[8px] px-3 py-1.5 text-[15px] hover:bg-[color:var(--bx-bg-2)]" data-testid={`export-${k}`}
              onClick={async () => { setOpen(false); await exportNotebook(nb, k, { openPrint: (id) => navigate(`/notebook/${id}/print?print=1`) }); }}>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ImportButton() {
  const { dispatch, say } = useNotebook();
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className="bx-btn" onClick={() => input.current?.click()} data-testid="import-json">{S.importJson}</button>
      <input ref={input} type="file" accept="application/json,.json" className="sr-only" aria-label={S.importJson} data-testid="import-file"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try { const nbs = importJson(await f.text()); dispatch({ type: 'merge', notebooks: nbs }); dispatch({ type: 'activate', id: nbs[0].id }); say(S.importDone(nbs.length)); } catch { say(S.importFailed); }
        }} />
    </>
  );
}

export function DeleteButton({ nb, after }: { nb: Notebook; after?: () => void }) {
  const { dispatch } = useNotebook();
  return (
    <button type="button" className="bx-btn-text" data-testid="delete-notebook" onClick={() => { if (window.confirm(S.confirmDelete)) { dispatch({ type: 'delete', id: nb.id }); after?.(); } }}>{S.deleteNotebook}</button>
  );
}

export const Persistence = () => <p className="text-[13px] bx-muted" data-testid="notebook-persistence">{S.persistence}</p>;
