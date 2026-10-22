/**
 * Export entry points (KICKOFF §4c). The heavy libraries (`docx`, `turndown`) load only when asked for. Files are made
 * in the browser and handed to the reader as a download; nothing is uploaded. PDF is the print route with the print
 * stylesheet and window.print() — no PDF engine is bundled.
 */
import { exportFilename, exportJson, type Notebook } from '@/lib/notebook';

/** The live app's address, so exported links point back at it (the base path under Pages, the origin locally). */
export const absoluteBase = () => (typeof window === 'undefined' ? '' : `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}`);

export function download(name: string, data: Blob | string, type = 'text/plain;charset=utf-8') {
  const blob = typeof data === 'string' ? new Blob([data], { type }) : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export type ExportKind = 'docx' | 'pdf' | 'html' | 'md' | 'json';

export async function exportNotebook(nb: Notebook, kind: ExportKind, opts: { openPrint?: (id: string) => void } = {}) {
  const base = absoluteBase();
  switch (kind) {
    case 'docx': {
      const { notebookToDocxBlob } = await import('./docx');
      download(exportFilename(nb.title, 'docx'), await notebookToDocxBlob(nb, base));
      return;
    }
    case 'html': {
      const { notebookToHtml } = await import('./html');
      download(exportFilename(nb.title, 'html'), notebookToHtml(nb, base), 'text/html;charset=utf-8');
      return;
    }
    case 'md': {
      const { notebookToMarkdown } = await import('./markdown');
      download(exportFilename(nb.title, 'md'), notebookToMarkdown(nb, base), 'text/markdown;charset=utf-8');
      return;
    }
    case 'json':
      download(exportFilename(nb.title, 'json'), exportJson([nb]), 'application/json');
      return;
    case 'pdf':
      opts.openPrint?.(nb.id);
  }
}
