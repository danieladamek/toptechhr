/**
 * The dependency graph, precomputed (KICKOFF §3.5): `links.yaml` exactly, every node's inbound and outbound edge ids,
 * and every node's upstream and downstream closure — over all four relations together and under each relation
 * alone — so /map needs no runtime traversal. The walk is the app's own (src/lib/graph-walk.ts).
 */
import { walk, type WalkEdge } from '../../src/lib/graph-walk';
import { RELATIONS } from './schemas';

export interface Closure { nodes: string[]; edges: string[] }
export type Walks = Record<string, { up: Record<string, Closure>; down: Record<string, Closure> }>;

export function buildGraph(edges: (WalkEdge & { relation: string })[]) {
  const inbound: Record<string, string[]> = {};
  const outbound: Record<string, string[]> = {};
  for (const e of edges) {
    (outbound[e.from] ??= []).push(e.id);
    (inbound[e.to] ??= []).push(e.id);
  }
  const nodes = [...new Set(edges.flatMap((e) => [e.from, e.to]))].sort();
  const walks: Walks = {};
  const pack = (w: { nodes: Set<string>; edges: Set<string> }): Closure => ({ nodes: [...w.nodes].sort(), edges: [...w.edges].sort() });
  for (const n of nodes) {
    const up: Record<string, Closure> = { all: pack(walk(n, edges, 'upstream')) };
    const down: Record<string, Closure> = { all: pack(walk(n, edges, 'downstream')) };
    for (const r of RELATIONS) {
      const sub = edges.filter((e) => e.relation === r);
      const u = pack(walk(n, sub, 'upstream'));
      const d = pack(walk(n, sub, 'downstream'));
      if (u.edges.length) up[r] = u;
      if (d.edges.length) down[r] = d;
    }
    walks[n] = { up, down };
  }
  return { edges: edges.map((e) => e.id), inbound, outbound, walks };
}
