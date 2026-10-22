import { useEffect, useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useNotebook } from '@/lib/notebook-context';
import { docToHtml } from '@/lib/export/html';
import { absoluteBase } from '@/lib/export';
import { S } from '@/strings';
import NotFound from './NotFound';

/**
 * `/notebook/:id/print`: the print view — the six sections and the generated Sources, with no header, nav or footer
 * (the Layout renders this route alone). `?print=1` (the Export menu's PDF) opens the print dialog; the print
 * stylesheet's @page margins make the PDF. The HTML comes from the pure serializer and escapes every value.
 */
export default function NotebookPrint() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const nb = useNotebook();
  const n = nb.store.notebooks.find((x) => x.id === id);
  const html = useMemo(() => (n ? docToHtml(n.doc, absoluteBase()) : ''), [n]);
  useEffect(() => { if (n && params.get('print') === '1') { const t = setTimeout(() => window.print(), 300); return () => clearTimeout(t); } }, [n, params]);
  if (!n) return <NotFound />;
  return (
    <div className="mx-auto max-w-[46rem] px-6 py-8 tt-print" data-testid="notebook-print">
      <p className="no-print mb-6 flex flex-wrap gap-4 text-[15px]"><Link to={`/notebook/${n.id}`}>← {S.backToPage}</Link><button type="button" className="bx-btn-text" onClick={() => window.print()}>{S.print}</button><span className="bx-muted">{S.printHint}</span></p>
      <div className="tt-print-body" dangerouslySetInnerHTML={{ __html: html }} />
      <p className="mt-10 text-[12px] bx-muted">Printed from TopTechHR. The evidence is the Key Personnel content pack; quotations keep their sources. Not advice.</p>
    </div>
  );
}
