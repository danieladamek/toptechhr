/**
 * The /map layout (KICKOFF §4b), adapted from the Alabama systems map: a pure function of the data, identical on every
 * load, no force simulation.
 *
 * - The nine stages are nine equal sectors of a ring in stage order, clockwise from the top.
 * - Constraints sit on the inner ring inside their stage's sector, evenly spaced in pack order, alternating between two
 *   close radii so neighbours do not touch.
 * - Levers sit on a middle ring beside the constraints they act on: each lever next to the first constraint listing
 *   it (pack order), nudged apart deterministically, alternating between two radii.
 * - Gates sit on an outer arc beside the stages they bind: at the circular mean of those stages' sector centres,
 *   nudged apart deterministically.
 */
export interface MapNode { id: string; kind: 'constraint' | 'lever' | 'gate'; name: string; stage?: string; stages?: string[]; first?: string | null }
export interface MapEdge { id: string; from: string; to: string; relation: string; link: string; grade: string }
export interface MapData { stages: { id: string; name: string }[]; nodes: MapNode[]; edges: MapEdge[] }
export interface Pos { x: number; y: number; angle: number; r: number }

export const W = 1000; export const H = 1000; export const CX = 500; export const CY = 500;
export const R_C = [232, 262] as const;
export const R_L = [352, 384] as const;
export const R_G = 462;
export const R_STAGE_LABEL = 170;
export const SECTOR_INNER = 205;
export const SECTOR_OUTER = 292;

const TAU = Math.PI * 2;
const START = -Math.PI / 2;
const norm = (a: number) => { let x = a % TAU; if (x < -Math.PI) x += TAU; if (x >= Math.PI) x -= TAU; return x; };

export function sectorOf(i: number, n: number): { a0: number; a1: number; mid: number } {
  const a0 = START + (TAU * i) / n;
  const a1 = START + (TAU * (i + 1)) / n;
  return { a0, a1, mid: (a0 + a1) / 2 };
}

/** Spread wanted angles apart by at least `min`, deterministically (sorted, relaxed in fixed passes, wrap-aware). */
export function spread(want: { id: string; a: number }[], min: number, passes = 60): { id: string; a: number }[] {
  const xs = want.map((w) => ({ ...w })).sort((p, q) => p.a - q.a || p.id.localeCompare(q.id));
  if (xs.length < 2) return xs;
  for (let pass = 0; pass < passes; pass++) {
    let moved = false;
    for (let i = 0; i < xs.length; i++) {
      const j = (i + 1) % xs.length;
      let d = xs[j].a - xs[i].a; if (j === 0) d += TAU;
      if (d < min - 1e-9) { const push = (min - d) / 2; xs[i].a -= push; xs[j].a += push; moved = true; }
    }
    if (!moved) break;
  }
  return xs;
}

export function layout(data: MapData): Map<string, Pos> {
  const pos = new Map<string, Pos>();
  const n = data.stages.length;
  const stageIndex = new Map(data.stages.map((s, i) => [s.id, i]));
  const put = (id: string, a: number, r: number) => pos.set(id, { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a), angle: a, r });

  // constraints: evenly inside their sector, pack order, alternating radii
  for (const s of data.stages) {
    const list = data.nodes.filter((x) => x.kind === 'constraint' && x.stage === s.id);
    const { a0, a1 } = sectorOf(stageIndex.get(s.id)!, n);
    const pad = (a1 - a0) * 0.06;
    list.forEach((c, i) => put(c.id, a0 + pad + ((a1 - a0 - 2 * pad) * (i + 0.5)) / list.length, R_C[i % 2]));
  }

  // levers: beside the first constraint listing them
  const levers = data.nodes.filter((x) => x.kind === 'lever');
  const leverWant = levers.map((l) => {
    const anchor = l.first ? pos.get(l.first) : undefined;
    const stage = l.stages?.[0];
    const a = anchor ? anchor.angle : stage !== undefined && stageIndex.has(stage) ? sectorOf(stageIndex.get(stage)!, n).mid : START;
    return { id: l.id, a };
  });
  spread(leverWant, (2.15 * Math.PI) / 180).forEach((w, i) => put(w.id, w.a, R_L[i % 2]));

  // gates: at the circular mean of the sectors they bind
  const gates = data.nodes.filter((x) => x.kind === 'gate');
  const gateWant = gates.map((g) => {
    const mids = (g.stages ?? []).filter((s) => stageIndex.has(s)).map((s) => sectorOf(stageIndex.get(s)!, n).mid);
    if (!mids.length) return { id: g.id, a: START };
    const sx = mids.reduce((a, m) => a + Math.cos(m), 0); const sy = mids.reduce((a, m) => a + Math.sin(m), 0);
    return { id: g.id, a: Math.hypot(sx, sy) < 1e-6 ? mids[0] : Math.atan2(sy, sx) };
  });
  for (const w of spread(gateWant, (3.9 * Math.PI) / 180)) put(w.id, norm(w.a), R_G);
  return pos;
}

/** A curved edge between two node positions, bowing toward the centre; returns the path and its label point. */
export function edgePath(a: Pos, b: Pos, nodeR = 7): { d: string; mx: number; my: number } {
  const dx = b.x - a.x; const dy = b.y - a.y; const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len; const uy = dy / len;
  const s = { x: a.x + ux * (nodeR + 1), y: a.y + uy * (nodeR + 1) };
  const t = { x: b.x - ux * (nodeR + 4), y: b.y - uy * (nodeR + 4) };
  const mx0 = (s.x + t.x) / 2; const my0 = (s.y + t.y) / 2;
  const pull = Math.min(0.55, len / 900);
  const cx = mx0 + (CX - mx0) * pull; const cy = my0 + (CY - my0) * pull;
  return { d: `M${s.x.toFixed(1)},${s.y.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${t.x.toFixed(1)},${t.y.toFixed(1)}`, mx: (s.x + 2 * cx + t.x) / 4, my: (s.y + 2 * cy + t.y) / 4 };
}

/** The sector wedge of a stage between two radii, as an SVG path. */
export function wedge(i: number, n: number, r0 = SECTOR_INNER, r1 = SECTOR_OUTER): string {
  const { a0, a1 } = sectorOf(i, n);
  const p = (a: number, r: number) => `${(CX + r * Math.cos(a)).toFixed(1)},${(CY + r * Math.sin(a)).toFixed(1)}`;
  return `M${p(a0, r0)} L${p(a0, r1)} A${r1},${r1} 0 0 1 ${p(a1, r1)} L${p(a1, r0)} A${r0},${r0} 0 0 0 ${p(a0, r0)} Z`;
}
