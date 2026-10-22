import { Link, useNavigate } from 'react-router-dom';
import { useNotebook } from '@/lib/notebook-context';
import { ImportButton, Persistence } from '@/components/notebook/NotebookControls';
import { longDate } from '@/lib/data';
import { S } from '@/strings';

/** `/notebook`: every notebook in this browser, a new one from the action-plan template, and Import. */
export default function Notebooks() {
  const nb = useNotebook();
  const navigate = useNavigate();
  const list = [...nb.store.notebooks].sort((a, b) => b.updated.localeCompare(a.updated));
  return (
    <div className="mx-auto max-w-[56rem] px-4 lg:px-8 py-10">
      <h1 className="text-[34px] sm:text-[42px]">{S.notebookH1}</h1>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" className="bx-btn-primary" data-testid="new-notebook-page" onClick={async () => { const id = await nb.create(); navigate(`/notebook/${id}`); }}>{S.newNotebook}</button>
        <ImportButton />
      </div>
      <div className="mt-3"><Persistence /></div>
      {list.length === 0 ? <p className="mt-8 text-[17px] bx-muted">{S.noNotebooks}</p> : (
        <ul className="mt-8 grid gap-3" data-testid="notebook-list">
          {list.map((n) => (
            <li key={n.id} className="bx-card p-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <Link to={`/notebook/${n.id}`} className="font-display text-[19px] font-bold" style={{ color: 'var(--bx-ink)' }}>{n.title || S.untitled}</Link>
                <p className="text-[14px] bx-muted">{S.updated(longDate(n.updated))} · {S.quotes(n.quotes.length)} · {n.actions.length} actions · {n.rules.length} rules · {n.numbers.length} numbers</p>
              </div>
              <div className="flex gap-3">
                <Link className="bx-btn-text" to={`/notebook/${n.id}`} onClick={() => nb.dispatch({ type: 'activate', id: n.id })}>Open</Link>
                <Link className="bx-btn-text" to={`/notebook/${n.id}/print`}>{S.print}</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
