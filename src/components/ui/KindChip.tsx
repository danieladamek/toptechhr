/** The glossary’s own `domain` (evidence | selection | attraction | pay | clearance | contract | law | people | planning | guide): text, not colour. */
export default function KindChip({ kind }: { kind: string }) {
  return <span className="bx-chip border border-[color:var(--bx-line)] bx-muted">{kind}</span>;
}
