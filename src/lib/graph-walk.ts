/**
 * "Depends on" / "Is depended on by" (KICKOFF §4b /map), ported from apps/alabama-mental-health-systems: everything
 * upstream or downstream of a node, found by walking the drawn edges of links.yaml — nothing inferred. Every relation
 * reads tail → head (precondition: the head cannot be addressed until the tail is; amplifies: the tail makes the head
 * worse; trade-off: acting on the tail worsens the head; enables: acting on the tail makes the head easier), so in
 * every case the head depends on the tail. Pure; the content build runs it once per node and relation so the page
 * needs no runtime traversal, and the unit tests run it on a fixture.
 */
export interface WalkEdge { id: string; from: string; to: string; relation?: string }
export type WalkMode = 'upstream' | 'downstream';

export function walk(start: string, edges: WalkEdge[], mode: WalkMode): { nodes: Set<string>; edges: Set<string> } {
  const nodes = new Set<string>();
  const used = new Set<string>();
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const e of edges) {
      const next = mode === 'upstream' ? (e.to === cur ? e.from : null) : (e.from === cur ? e.to : null);
      if (next === null) continue;
      used.add(e.id);
      if (next !== start && !nodes.has(next)) { nodes.add(next); queue.push(next); }
    }
  }
  return { nodes, edges: used };
}

/** The dependency lists under a node: "depends on" is every edge into it, "is depended on by" every edge out of it. */
export function dependencyLists<E extends WalkEdge>(node: string, edges: E[]): { dependsOn: E[]; dependedOnBy: E[] } {
  return { dependsOn: edges.filter((e) => e.to === node), dependedOnBy: edges.filter((e) => e.from === node) };
}
