import { lazy, Suspense } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { S } from '@/strings';
import NotFound from './NotFound';

const Read = lazy(() => import('./Read'));
const Concepts = lazy(() => import('./Concepts'));
const Concept = lazy(() => import('./Concept'));
const Glossary = lazy(() => import('./Glossary'));
const References = lazy(() => import('./References'));
const Methods = lazy(() => import('./Methods'));

const TABS = [
  { id: 'guide', label: S.tabs.guide },
  { id: 'primers', label: S.tabs.primers },
  { id: 'glossary', label: S.tabs.glossary },
  { id: 'sources', label: S.tabs.sources },
  { id: 'methods', label: S.tabs.methods },
] as const;

/**
 * `/library` (KICKOFF §4d): Guide · Primers · Glossary · Sources · Methods. Everything the Key Personnel guide, its
 * primers, glossary, references and /methods show is here; nothing is dropped, only moved.
 */
export default function Library() {
  const { tab = 'guide', itemId } = useParams();
  if (!TABS.some((t) => t.id === tab)) return <NotFound />;
  return (
    <div className="mx-auto max-w-content px-4 lg:px-14 py-8">
      <p className="tt-eyebrow">{S.libraryH1}</p>
      <nav aria-label={S.libraryH1} className="mt-2 mb-8 flex gap-1 overflow-x-auto border-b no-print" style={{ borderColor: 'var(--bx-line)' }}>
        {TABS.map((t) => <NavLink key={t.id} to={`/library/${t.id}`} className={({ isActive }) => `tt-tab ${isActive ? 'active' : ''}`} data-testid={`library-tab-${t.id}`}>{t.label}</NavLink>)}
      </nav>
      <Suspense fallback={<p className="bx-muted min-h-[60vh]" role="status">{S.loading}</p>}>
        {tab === 'guide' && <Read sectionId={itemId} />}
        {tab === 'primers' && (itemId ? <Concept id={itemId} /> : <Concepts />)}
        {tab === 'glossary' && <Glossary />}
        {tab === 'sources' && <References />}
        {tab === 'methods' && <Methods />}
      </Suspense>
    </div>
  );
}
