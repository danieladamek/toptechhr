/**
 * Notebook → HTML, without a DOM (pure; the HTML export, the Markdown export's input and the print view share it).
 * A quote is a <figure> whose <figcaption> is its source line, so provenance travels with the text in every format;
 * a plan row renders its pack text verbatim with the [owner] / [date] / [measure] placeholders until filled; the
 * Sources section is generated here from everything cited above, numbered in pack order.
 */
import { collectSources, quoteSourceLine, type Notebook, type PMNode, type RefLine, type RowAttrs } from '@/lib/notebook';

export const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function marks(text: string, ms: PMNode['marks'] = []): string {
  let out = esc(text);
  for (const m of ms ?? []) {
    if (m.type === 'bold') out = `<strong>${out}</strong>`;
    else if (m.type === 'italic') out = `<em>${out}</em>`;
    else if (m.type === 'strike') out = `<s>${out}</s>`;
    else if (m.type === 'code') out = `<code>${out}</code>`;
    else if (m.type === 'link') out = `<a href="${esc(m.attrs?.href)}">${out}</a>`;
  }
  return out;
}

const inline = (n: PMNode): string => (n.content ?? []).map((k) => (k.type === 'text' ? marks(k.text ?? '', k.marks) : k.type === 'hardBreak' ? '<br>' : inline(k))).join('');

export function rowHtml(a: RowAttrs, absolute = ''): string {
  const placeholder = (v: string | undefined, ph: string) => (v && v.trim() ? esc(v) : `<span class="tt-placeholder">${ph}</span>`);
  const lines = a.lines.map((l) => `<p><strong>${esc(l.label)}</strong> ${esc(l.text)}</p>`).join('');
  const fields = a.kind === 'action'
    ? `<p class="tt-row-fields"><strong>Owner:</strong> ${placeholder(a.owner, '[owner]')} · <strong>By:</strong> ${placeholder(a.by, '[date]')} · <strong>Measure:</strong> ${placeholder(a.measure, '[measure]')}</p>`
    : '';
  const cites = a.refs.length ? `<p class="tt-row-cites">Sources: ${a.refs.map((r) => `[${r.n}]`).join(' ')}</p>` : '';
  const pack = a.packName && a.packName !== a.title ? `<p class="tt-row-pack">${esc(a.packName)}</p>` : '';
  return `<div class="tt-row" data-kind="${esc(a.kind)}" data-ref="${esc(a.refId)}"><p class="tt-row-title"><strong>${esc(a.title)}</strong>${a.route ? ` <a href="${esc(absolute + a.route)}">↗</a>` : ''}</p>${pack}${lines}${fields}${cites}</div>`;
}

export function quoteHtml(attrs: Record<string, unknown>, absolute = ''): string {
  const line = quoteSourceLine({ title: String(attrs.title ?? ''), citations: (attrs.citations as number[]) ?? [], asOf: (attrs.asOf as string | null) ?? undefined });
  const route = String(attrs.route ?? '');
  return `<figure class="tt-quote"><blockquote>${esc(attrs.text)}</blockquote><figcaption>${esc(line)}${route ? ` · <a href="${esc(absolute + route)}">${esc(absolute + route)}</a>` : ''}</figcaption></figure>`;
}

export function sourcesHtml(sources: RefLine[]): string {
  if (!sources.length) return '<p><em>No sources cited above.</em></p>';
  return `<ol class="tt-sources">${sources.map((s) => `<li value="${s.n}" data-n="${s.n}">[${s.n}] ${esc(s.citation || 'citation line not captured — see the Sources tab of the Library')}</li>`).join('')}</ol>`;
}

/** The doc body as HTML. `absolute` prefixes routes so exported links point back at the live app. */
export function docToHtml(doc: PMNode, absolute = ''): string {
  const sources = collectSources(doc);
  const node = (n: PMNode): string => {
    switch (n.type) {
      case 'doc': return (n.content ?? []).map(node).join('\n');
      case 'paragraph': return n.content?.length ? `<p>${inline(n)}</p>` : '';
      case 'heading': { const l = Math.min(6, Math.max(1, Number(n.attrs?.level ?? 2))); return `<h${l}>${inline(n)}</h${l}>`; }
      case 'bulletList': return `<ul>${(n.content ?? []).map(node).join('')}</ul>`;
      case 'orderedList': return `<ol>${(n.content ?? []).map(node).join('')}</ol>`;
      case 'listItem': return `<li>${(n.content ?? []).map(node).join('')}</li>`;
      case 'taskList': return `<ul class="tt-tasks">${(n.content ?? []).map(node).join('')}</ul>`;
      case 'taskItem': return `<li>${n.attrs?.checked ? '☑' : '☐'} ${(n.content ?? []).map(node).join('')}</li>`;
      case 'blockquote': return `<blockquote>${(n.content ?? []).map(node).join('')}</blockquote>`;
      case 'codeBlock': return `<pre><code>${esc(n.content?.map((k) => k.text ?? '').join('') ?? '')}</code></pre>`;
      case 'horizontalRule': return '<hr>';
      case 'hardBreak': return '<br>';
      case 'quoteBlock': return quoteHtml(n.attrs ?? {}, absolute);
      case 'planRow': return rowHtml(n.attrs as unknown as RowAttrs, absolute);
      case 'sourcesBlock': return sourcesHtml(sources);
      case 'text': return marks(n.text ?? '', n.marks);
      default: return (n.content ?? []).map(node).join('');
    }
  };
  return node(doc);
}

const PRINT_CSS = `body{font-family:"Open Sans",system-ui,sans-serif;color:#1F2A44;max-width:46rem;margin:2rem auto;padding:0 1rem;line-height:1.6}
h1,h2,h3{font-family:Montserrat,system-ui,sans-serif;color:#1F2A44}
.tt-quote{margin:1rem 0;padding:.75rem 1rem;border-left:4px solid #2A7FBF;background:#EEF3FA}
.tt-quote blockquote{margin:0;font-style:italic}
.tt-quote figcaption{font-size:.85em;color:#4A5568;margin-top:.25rem}
.tt-row{border:1px solid #D9E4F0;border-radius:12px;padding:.5rem .75rem;margin:.75rem 0}
.tt-row p{margin:.2rem 0}
.tt-placeholder{font-family:monospace;color:#B45309;background:#FEF3C7;padding:0 .2rem}
.tt-sources{padding-left:0;list-style:none}`;

/** The self-contained HTML export (KICKOFF §4c): one file, inline styles, the quote provenance as <figcaption>. */
export function notebookToHtml(nb: Notebook, absolute = ''): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(nb.title)}</title><style>${PRINT_CSS}</style></head>
<body>
${docToHtml(nb.doc, absolute)}
<hr><p style="font-size:.85em;color:#4A5568">Exported from TopTechHR on ${esc(new Date().toISOString().slice(0, 10))}. The evidence is the Key Personnel content pack; quotations keep their sources. Not advice.</p>
</body></html>
`;
}
