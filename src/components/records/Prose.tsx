import Markdown, { readerComponents } from '@/components/reader/Markdown';

/**
 * Pack prose from a record, rendered as written. Strings arrive from the content build with term links and
 * citation tokens already in place, so terms open popovers and `[n]` opens a fold-out under the paragraph.
 */
export default function Prose({ md, className = '' }: { md: string; className?: string }) {
  if (!md) return null;
  return <Markdown md={md} components={readerComponents} className={`bx-rec-prose ${className}`} />;
}
