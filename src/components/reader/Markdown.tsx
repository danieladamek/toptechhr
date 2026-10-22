import { lazy, Suspense, type ComponentProps } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { rehypeSupSub } from './rehype-supsub';
import Term from './Term';
import Cite, { Paragraph } from './Cite';

// Raw HTML from the pack: only <sup>/<sub> are honoured, via rehypeSupSub; everything else is dropped.

function Anchor({ href, children }: ComponentProps<'a'>) {
  if (href === '#todo-author') return <span className="bx-todo" title="A gap in the content pack, listed on /methods">TODO(author)</span>;
  if (href?.startsWith('#term:')) return <Term id={href.slice(6)}>{children}</Term>;
  if (href?.startsWith('#cite:')) return <Cite ns={href.slice(6).split(',').map(Number)} label={String(children)} />;
  const external = !!href && /^https?:/.test(href);
  return <a href={href} className="underline" target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}>{children}</a>;
}

export const readerComponents: Components = {
  a: Anchor,
  p: ({ children }) => <Paragraph>{children}</Paragraph>,
};

/** Term links without the citation fold-out machinery — for prose outside the reader. */
export const recordComponents: Components = { a: Anchor };

const MathMarkdown = lazy(() => import('./MathMarkdown'));

/** A `TODO(author)` inside pack text renders as the amber marker (KICKOFF §1); the words around it are unchanged. */
const markTodos = (md: string) => (md.includes('TODO(author)') ? md.replace(/TODO\(author\)/g, '[TODO(author)](#todo-author)') : md);

/** Reader/notes markdown. `math` switches to the KaTeX-enabled renderer (separate chunk). */
export default function Markdown({ md: raw, math = false, components = readerComponents, className }: { md: string; math?: boolean; components?: Components; className?: string }) {
  const md = markTodos(raw);
  if (math) return <Suspense fallback={<div className="bx-muted text-sm">Rendering maths…</div>}><MathMarkdown md={md} components={components} className={className} /></Suspense>;
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSupSub]} components={components}>{md}</ReactMarkdown>
    </div>
  );
}
