/**
 * Notebook → Markdown with `turndown` (KICKOFF §4c). Quotes become `>` blocks with the source line under the quoted
 * text (still inside the block quote, so the two never separate); plan rows become a short labelled list; the Sources
 * section is the generated numbered list. Input is the pure HTML from ./html.ts.
 */
import TurndownService from 'turndown';
import { docToHtml } from './html';
import type { Notebook } from '@/lib/notebook';

export function notebookToMarkdown(nb: Notebook, absolute = ''): string {
  const td = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', emDelimiter: '*', codeBlockStyle: 'fenced' });
  td.addRule('quoteFigure', {
    filter: (node) => node.nodeName === 'FIGURE' && (node as HTMLElement).classList?.contains('tt-quote'),
    replacement: (_content, node) => {
      const el = node as HTMLElement;
      const quote = (el.querySelector('blockquote')?.textContent ?? '').trim();
      const source = (el.querySelector('figcaption')?.textContent ?? '').trim();
      return `\n\n${quote.split('\n').map((l) => `> ${l}`).join('\n')}\n>\n> — ${source}\n\n`;
    },
  });
  td.addRule('placeholder', {
    filter: (node) => node.nodeName === 'SPAN' && (node as HTMLElement).classList?.contains('tt-placeholder'),
    replacement: (content) => `\`${content}\``,
  });
  td.addRule('sourcesList', {
    filter: (node) => node.nodeName === 'OL' && (node as HTMLElement).classList?.contains('tt-sources'),
    replacement: (_content, node) => `\n\n${Array.prototype.slice.call((node as HTMLElement).getElementsByTagName('li')).map((li: Element) => `- ${(li.textContent ?? '').trim()}`).join('\n')}\n\n`,
  });
  const body = td.turndown(docToHtml(nb.doc, absolute));
  return `${body.trim()}\n\n---\n\n*Exported from TopTechHR on ${new Date().toISOString().slice(0, 10)}. The evidence is the Key Personnel content pack; quotations keep their sources. Not advice.*\n`;
}
