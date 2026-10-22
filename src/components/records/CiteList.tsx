import { Paragraph } from '@/components/reader/Cite';
import Cite from '@/components/reader/Cite';

/** A list of reference numbers (`cite: [n, …]`) as citation tokens with their own fold-out. */
export default function CiteList({ ns }: { ns: number[] }) {
  if (!ns.length) return null;
  return <div className="text-sm [&>p]:my-0"><Paragraph>{ns.map((n) => <Cite key={n} ns={[n]} label={String(n)} />)}</Paragraph></div>;
}
