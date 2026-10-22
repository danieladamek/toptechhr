import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { MINI, ROOT } from './helpers';
import { fieldOf, groupByStage, rank, scoreRow } from '../../src/lib/pathfinder';
import type { Pathfinder } from '../../src/types';

const pf = yaml.load(fs.readFileSync(path.join(MINI, 'pathfinder.yaml'), 'utf8')) as Pathfinder;
const STAGES = ['plan', 'attract', 'select', 'offer', 'clear-start', 'onboard', 'develop', 'retain', 'handover'];

describe('the pathfinder ranker (fixture)', () => {
  it('scores 3 for the pattern, 2 for the stage and 1 per condition, with reasons in the question labels’ words', () => {
    const r = rank(pf, { pattern: 'many-apply-few-qualify', stage: 'select', conditions: ['requires-clearance'] });
    expect(r.map((x) => [x.id, x.score])).toEqual([['c-one', 6], ['c-two', 5], ['c-three', 1]]);
    expect(r[0].reasons).toEqual([
      { question: 'pattern', label: 'Many applicants, few who qualify', points: 3 },
      { question: 'stage', label: 'select', points: 2 },
      { question: 'conditions', label: 'Clearance', points: 1 },
    ]);
  });
  it('hides a constraint with score 0', () => {
    expect(rank(pf, { pattern: 'many-apply-few-qualify' }).map((x) => x.id)).toEqual(['c-one', 'c-two']);
    expect(rank(pf, {})).toEqual([]);
  });
  it('the state answer changes nothing in the order', () => {
    const a = rank(pf, { stage: 'offer', conditions: ['urgent-start'] });
    const b = rank(pf, { stage: 'offer', conditions: ['urgent-start'], state: 'us-wa' });
    expect(b).toEqual(a);
    expect(rank(pf, { state: 'us-wa' })).toEqual([]);
  });
  it('honours pattern_aliases on either side', () => {
    expect(scoreRow(pf, pf.constraints[1], { pattern: 'start-then-struggle' }).score).toBe(3);
    expect(scoreRow(pf, pf.constraints[1], { pattern: 'pass-then-struggle' }).score).toBe(3);
    expect(scoreRow(pf, { ...pf.constraints[1], patterns: ['pass-then-struggle'] }, { pattern: 'start-then-struggle' }).score).toBe(3);
  });
  it('ties keep the pack’s row order; groups follow stage order; the field carries levers and gates', () => {
    const r = rank(pf, { conditions: ['requires-clearance'] });
    expect(r.map((x) => x.id)).toEqual(['c-one', 'c-three']);
    expect(groupByStage(r, STAGES).map((g) => g.stage)).toEqual(['select', 'offer']);
    expect(fieldOf(r, [{ id: 'c-one', levers: ['l-one'], gates: ['g-one'] }, { id: 'c-three', levers: ['l-two'], gates: ['g-one'] }]).sort()).toEqual(['c-one', 'c-three', 'g-one', 'l-one', 'l-two']);
  });
});

describe('the pathfinder on the real pack', () => {
  const real = yaml.load(fs.readFileSync(path.join(ROOT, 'pack/key-personnel/content-pack/pathfinder.yaml'), 'utf8')) as Pathfinder;
  it('"pass, then decline" lists c-salary-above-rate with 3 points', () => {
    const r = rank(real, { pattern: 'pass-then-decline' });
    expect(r.find((x) => x.id === 'c-salary-above-rate')?.score).toBe(3);
    expect(r.every((x) => x.score === 3)).toBe(true);
  });
});
