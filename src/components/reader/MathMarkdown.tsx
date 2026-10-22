import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { rehypeSupSub } from './rehype-supsub';
import 'katex/dist/katex.min.css';

/**
 * KaTeX-enabled markdown (the primers, and any block that carries maths). Loaded lazily. Inline `$…$` maths is on:
 * the content build escapes every `$` followed by a digit as `\$` (KICKOFF §3.4a), so "$1,200 for one and $10,625"
 * stays currency and only the primers' `$r$`, `$d$`, `$\bar{x}_1$` spans become maths.
 */
export default function MathMarkdown({ md, components, className }: { md: string; components?: Components; className?: string }) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeSupSub, [rehypeKatex, { output: 'html' }]]} components={components}>{md}</ReactMarkdown>
    </div>
  );
}
