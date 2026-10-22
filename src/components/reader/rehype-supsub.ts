import type { Element, Parents, Root, RootContent } from 'hast';

/**
 * Turns raw `<sup>…</sup>` / `<sub>…</sub>` markers (left by remark as `raw` nodes) into real elements, and the
 * content build's `<mark data-syn="id">…</mark>` pairs into the synthesis span: the synthesised sentence, quietly
 * underlined, with a stable id for /methods and a small "synthesis" label after it (KICKOFF §1). No rehype-raw, no HTML
 * parser in the bundle; any other raw HTML is dropped by react-markdown, which is the sanitisation we want.
 */
export function rehypeSupSub() {
  return (tree: Root) => { walk(tree); };
}

const OPEN = /^<(sup|sub)>$|^<mark data-syn="([a-z0-9-]+)">$/;

function walk(parent: Parents) {
  const out: RootContent[] = [];
  const kids = parent.children as RootContent[];
  for (let i = 0; i < kids.length; i++) {
    const k = kids[i];
    const open = k.type === 'raw' ? OPEN.exec(k.value.trim()) : null;
    if (open) {
      const tag = open[1] ?? 'mark';
      const close = kids.findIndex((c, j) => j > i && c.type === 'raw' && c.value.trim() === `</${tag}>`);
      if (close > i) {
        const inner = kids.slice(i + 1, close);
        const el: Element = tag === 'mark'
          ? {
            type: 'element', tagName: 'span', properties: { id: open[2], className: ['bx-syn'], dataTestid: 'synthesis', title: 'Synthesis: a conclusion the cited works do not individually state' },
            children: [...(inner as Element['children']), { type: 'element', tagName: 'span', properties: { className: ['bx-syn-label'] }, children: [{ type: 'text', value: 'synthesis' }] }],
          }
          : { type: 'element', tagName: tag, properties: {}, children: inner as Element['children'] };
        walk(el);
        out.push(el);
        i = close;
        continue;
      }
    }
    if ('children' in k) walk(k as Parents);
    out.push(k);
  }
  parent.children = out as typeof parent.children;
}
