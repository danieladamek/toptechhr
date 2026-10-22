/** plan-order.json and numbers.json builders (KICKOFF §5), on fixtures; and the pack README sweep paragraph. */
import { describe, expect, it } from 'vitest';
import { buildNumbers, planOrder, sweepSummary, type IndicatorIn } from '../../scripts/lib/hr';

describe('plan-order', () => {
  const constraints = [{ id: 'c-a', levers: ['l-1', 'l-2', 'l-3'] }, { id: 'c-b', levers: ['l-3', 'l-4'] }];
  it('a precondition edge between two levers of one constraint puts its tail first, and names the edge', () => {
    const o = planOrder(constraints, [{ id: 'k-9', from: 'l-3', to: 'l-1', relation: 'precondition' }]);
    expect(o['c-a'].levers).toEqual(['l-2', 'l-3', 'l-1']);
    expect(o['c-a'].do_first).toEqual({ 'l-3': [{ before: 'l-1', edge: 'k-9' }] });
  });
  it('an edge to a lever outside the list does not reorder', () => {
    const o = planOrder(constraints, [{ id: 'k-1', from: 'l-4', to: 'l-1', relation: 'precondition' }]);
    expect(o['c-a'].levers).toEqual(['l-1', 'l-2', 'l-3']);
    expect(o['c-a'].do_first).toEqual({});
    expect(o['c-b'].levers).toEqual(['l-3', 'l-4']);
  });
  it('other relations never reorder; ties keep pack order', () => {
    const o = planOrder(constraints, [{ id: 'k-2', from: 'l-3', to: 'l-1', relation: 'enables' }, { id: 'k-3', from: 'l-2', to: 'l-1', relation: 'amplifies' }]);
    expect(o['c-a'].levers).toEqual(['l-1', 'l-2', 'l-3']);
  });
  it('a chain of preconditions orders transitively', () => {
    const o = planOrder([{ id: 'c', levers: ['l-1', 'l-2', 'l-3'] }], [
      { id: 'k-a', from: 'l-3', to: 'l-2', relation: 'precondition' },
      { id: 'k-b', from: 'l-2', to: 'l-1', relation: 'precondition' },
    ]);
    expect(o.c.levers).toEqual(['l-3', 'l-2', 'l-1']);
  });
});

describe('numbers.json', () => {
  const ind = (o: Partial<IndicatorIn> & { id: string }): IndicatorIn => ({ name: o.id, value: 'v', reference_period: 'p', ...o });
  const n = buildNumbers([
    ind({ id: 'us-x', geo: 'us', sector: 'all', counterpart: 'al-x', value: '4.2%', reference_period: 'Sep 2026', series: 'S1', series_confirmed: 'api' }),
    ind({ id: 'al-x', geo: 'al', sector: 'all', counterpart: 'us-x', value: '3.5%', reference_period: 'Sep 2026' }),
    ind({ id: 'hsv-y', geo: 'huntsville-msa', counterpart: 'us-x' }),
    ind({ id: 'plain' }),
    ind({ id: 'bad', geo: 'al', counterpart: 'missing' }),
  ]);
  it('resolves a counterpart to {id, value, reference_period} both ways', () => {
    expect(n.cards['al-x'].counterpart_stub).toMatchObject({ id: 'us-x', value: '4.2%', reference_period: 'Sep 2026' });
    expect(n.cards['us-x'].counterpart_stub).toMatchObject({ id: 'al-x', value: '3.5%', reference_period: 'Sep 2026' });
    expect(n.cards['us-x'].counterpart_of.sort()).toEqual(['al-x', 'hsv-y']);
  });
  it('a tag-less record defaults to us / all and series_confirmed none', () => {
    expect(n.cards.plain).toMatchObject({ geo: 'us', sector: 'all', series_confirmed: 'none', counterpart_stub: null });
    expect(n.groups.us.all).toContain('plain');
  });
  it('groups by geo × sector in pack order and reports one-way and unresolved counterparts', () => {
    expect(n.groups).toEqual({ us: { all: ['us-x', 'plain'] }, al: { all: ['al-x', 'bad'] }, 'huntsville-msa': { all: ['hsv-y'] } });
    expect(n.one_way).toEqual([{ id: 'hsv-y', counterpart: 'us-x' }]);
    expect(n.unresolved).toEqual([{ id: 'bad', counterpart: 'missing' }]);
    expect(n.cards['us-x'].series_confirmed).toBe('api');
  });
});

describe('the pack README sweep paragraph', () => {
  it('takes the latest "What sweep N found" section, as written', () => {
    const md = '# x\n\n## What sweep 2 found, in one paragraph\n\nTwo.\n\n## What sweep 10 found, in one paragraph\n\nTen **bold**.\n\n## Sweep order\n\nno\n';
    expect(sweepSummary(md)).toEqual({ sweep: 10, heading: 'What sweep 10 found, in one paragraph', text: 'Ten **bold**.' });
  });
});
