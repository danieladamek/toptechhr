import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { ROOT } from './helpers';
import { dependencyLists, walk } from '../../src/lib/graph-walk';
import { buildGraph } from '../../scripts/lib/graph';
import { layout, type MapData } from '../../src/lib/map-layout';

/** 12 nodes, every relation, and a cycle (c4 → c5 → c6 → c4). */
const E = [
  { id: 'e1', from: 'l1', to: 'c1', relation: 'enables' },
  { id: 'e2', from: 'c1', to: 'c2', relation: 'precondition' },
  { id: 'e3', from: 'c2', to: 'c3', relation: 'amplifies' },
  { id: 'e4', from: 'l2', to: 'c3', relation: 'trade-off' },
  { id: 'e5', from: 'c3', to: 'c4', relation: 'amplifies' },
  { id: 'e6', from: 'c4', to: 'c5', relation: 'precondition' },
  { id: 'e7', from: 'c5', to: 'c6', relation: 'amplifies' },
  { id: 'e8', from: 'c6', to: 'c4', relation: 'enables' },
  { id: 'e9', from: 'l3', to: 'c7', relation: 'enables' },
  { id: 'e10', from: 'c7', to: 'c8', relation: 'trade-off' },
  { id: 'e11', from: 'l4', to: 'c8', relation: 'enables' },
];
const sorted = (s: Set<string>) => [...s].sort();

describe('the graph walker', () => {
  it('upstream follows edges backwards to every tail', () => {
    const w = walk('c3', E, 'upstream');
    expect(sorted(w.nodes)).toEqual(['c1', 'c2', 'l1', 'l2']);
    expect(sorted(w.edges)).toEqual(['e1', 'e2', 'e3', 'e4']);
  });
  it('downstream follows edges forwards and terminates on a cycle', () => {
    const w = walk('c3', E, 'downstream');
    expect(sorted(w.nodes)).toEqual(['c4', 'c5', 'c6']);
    expect(sorted(w.edges)).toEqual(['e5', 'e6', 'e7', 'e8']);
  });
  it('inside the cycle every member is upstream of every other, and the start is not its own ancestor', () => {
    const w = walk('c5', E, 'upstream');
    expect(sorted(w.nodes)).toEqual(['c1', 'c2', 'c3', 'c4', 'c6', 'l1', 'l2']);
    expect(w.nodes.has('c5')).toBe(false);
  });
  it('a disconnected component is never reached', () => {
    expect(walk('c8', E, 'upstream').nodes).toEqual(new Set(['c7', 'l3', 'l4']));
    expect(walk('c1', E, 'downstream').nodes.has('c8')).toBe(false);
  });
  it('the dependency lists put inbound edges under "depends on" and outbound under "is depended on by"', () => {
    const d = dependencyLists('c3', E);
    expect(d.dependsOn.map((e) => e.id)).toEqual(['e3', 'e4']);
    expect(d.dependedOnBy.map((e) => e.id)).toEqual(['e5']);
    const c4 = dependencyLists('c4', E);
    expect(c4.dependsOn.map((e) => e.id)).toEqual(['e5', 'e8']);
    expect(c4.dependedOnBy.map((e) => e.id)).toEqual(['e6']);
  });
  it('the precomputed closures match the walker, per relation as well as overall', () => {
    const g = buildGraph(E);
    expect(g.walks.c3.up.all.nodes).toEqual(['c1', 'c2', 'l1', 'l2']);
    expect(g.walks.c3.up.amplifies.nodes).toEqual(['c2']);
    expect(g.walks.c4.down.precondition.nodes).toEqual(['c5']);
    expect(g.inbound.c4).toEqual(['e5', 'e8']);
    expect(g.outbound.l1).toEqual(['e1']);
  });
});

describe('the map layout', () => {
  it('is a pure function: identical on every call, every node placed, constraints inside their stage’s sector', () => {
    const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/map.json'), 'utf8')) as MapData;
    const a = layout(data); const b = layout(data);
    expect([...a.entries()]).toEqual([...b.entries()]);
    expect(a.size).toBe(data.nodes.length);
    const n = data.stages.length;
    for (const node of data.nodes.filter((x) => x.kind === 'constraint')) {
      const i = data.stages.findIndex((s) => s.id === node.stage);
      const lo = -Math.PI / 2 + (2 * Math.PI * i) / n; const hi = lo + (2 * Math.PI) / n;
      expect(a.get(node.id)!.angle).toBeGreaterThanOrEqual(lo);
      expect(a.get(node.id)!.angle).toBeLessThanOrEqual(hi);
    }
  });
  it('draws exactly the 144 edges of links.yaml', () => {
    const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/map.json'), 'utf8')) as MapData;
    const links = yaml.load(fs.readFileSync(path.join(ROOT, 'pack/key-personnel/content-pack/links.yaml'), 'utf8')) as { id: string; from: string; to: string; relation: string }[];
    expect(data.edges.map((e) => [e.id, e.from, e.to, e.relation])).toEqual(links.map((l) => [l.id, l.from, l.to, l.relation]));
  });
});
