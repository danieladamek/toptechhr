import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useNotebook } from '@/lib/notebook-context';
import { loadHr } from '@/lib/heavy';
import Editor from '@/components/notebook/Editor';
import { DeleteButton, ExportMenu, ImportButton, Persistence } from '@/components/notebook/NotebookControls';
import type { HrTemplateSection } from '@/types';
import { S } from '@/strings';
import NotFound from './NotFound';

/** `/notebook/:id`: the full-page editor. */
export default function NotebookPage() {
  const { id = '' } = useParams();
  const nb = useNotebook();
  const navigate = useNavigate();
  const [sections, setSections] = useState<HrTemplateSection[]>([]);
  useEffect(() => { let live = true; loadHr().then((h) => { if (live) setSections(h.template.sections); }); return () => { live = false; }; }, []);
  const n = nb.store.notebooks.find((x) => x.id === id);
  useEffect(() => { if (n && nb.store.activeId !== n.id) nb.dispatch({ type: 'activate', id: n.id }); }, [n, nb]);
  if (!n) return <NotFound />;
  return (
    <div className="mx-auto max-w-[56rem] px-4 lg:px-8 py-10" data-testid="notebook-page">
      <p className="tt-eyebrow"><Link to="/notebook">{S.notebookH1}</Link></p>
      <h1 className="sr-only">{n.title || S.untitled}</h1>
      <label className="mt-2 block">
        <span className="sr-only">{S.rename}</span>
        <input className="bx-input !text-[24px] font-display font-extrabold" value={n.title} onChange={(e) => nb.dispatch({ type: 'rename', id: n.id, title: e.target.value })} aria-label={S.rename} data-testid="notebook-title" />
      </label>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <ExportMenu nb={n} />
        <ImportButton />
        <Link className="bx-btn" to={`/notebook/${n.id}/print`}>{S.print}</Link>
        <span className="ml-auto"><DeleteButton nb={n} after={() => navigate('/notebook')} /></span>
      </div>
      <div className="mt-6 bx-card p-5 sm:p-8"><Editor nb={n} sections={sections} onDoc={(doc) => nb.dispatch({ type: 'setDoc', id: n.id, doc })} /></div>
      <div className="mt-4"><Persistence /></div>
    </div>
  );
}
