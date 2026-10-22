import { lazy, Suspense, useState } from 'react';
import type { Figure } from '@/types';
import Pathway from './Pathway';
import DataTable, { JurisdictionGrid } from './DataTable';
import Todo from '@/components/ui/Todo';

const Charts = lazy(() => import('./Charts'));

/** One component per figure kind (APP-SPEC §4). `inline` = the compact variant embedded in the guide and on record pages. */
export default function FigureBody({ figure, inline }: { figure: Figure; inline?: boolean }) {
  const [view, setView] = useState<'grid' | 'table'>('grid');
  switch (figure.kind) {
    case 'pathway':
    case 'network':
      return figure.pathway ? <Pathway figure={figure} data={figure.pathway} inline={inline} /> : <Todo>no node/edge data for {figure.id}</Todo>;
    case 'table':
      if (figure.id === 'jurisdiction-lists' && figure.table) {
        return (
          <div>
            <div className="flex gap-1 text-xs mb-2" role="group" aria-label="Show as">
              <button type="button" className={`bx-btn !py-0.5 ${view === 'grid' ? 'bx-btn-on' : ''}`} aria-pressed={view === 'grid'} onClick={() => setView('grid')}>Grid</button>
              <button type="button" className={`bx-btn !py-0.5 ${view === 'table' ? 'bx-btn-on' : ''}`} aria-pressed={view === 'table'} onClick={() => setView('table')}>Table</button>
            </div>
            {view === 'grid' ? <JurisdictionGrid figure={figure} rows={figure.table.rows} /> : <DataTable figure={figure} rows={figure.table.rows} inline={inline} />}
          </div>
        );
      }
      return <DataTable figure={figure} rows={figure.table?.rows ?? []} inline={inline} />;
    case 'chart':
      return (
        <div>
          {figure.chart ? (
            <Suspense fallback={<div className="bx-muted text-sm" style={{ minHeight: inline ? 400 : 480 }} role="status">Loading figure…</div>}>
              <Charts id={figure.id} spec={figure.chart} rows={figure.table?.rows ?? []} fields={figure.table?.fields ?? []} inline={inline} />
            </Suspense>
          ) : <Todo>chart {figure.id} has no chart spec</Todo>}
          {figure.table && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer bx-muted">Every value in this figure, with its own record and sources ({figure.table.rows.length} rows)</summary>
              <div className="mt-2"><DataTable figure={figure} rows={figure.table.rows} inline={inline} /></div>
            </details>
          )}
        </div>
      );
    case 'image':
      return <Todo>this pack reproduces no published figure images; nothing to show for {figure.id}</Todo>;
  }
}
