import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOT } from './helpers';
// @ts-expect-error — plain ESM module without types
import { BLS_V1, parseBls } from '../../scripts/lib/bls.mjs';

const fx = (f: string) => JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/bls', f), 'utf8'));

describe('the BLS refresh parser', () => {
  it('uses the v1 no-key endpoint', () => {
    expect(BLS_V1).toBe('https://api.bls.gov/publicAPI/v1/timeseries/data/');
  });
  it('takes the observation marked latest, with its period', () => {
    expect(parseBls('JTS540099000000000JOR', fx('jolts-v1.json'))).toEqual({ series: 'JTS540099000000000JOR', period: 'M08', year: '2026', periodName: 'August', value: '5.0', status: 'ok' });
  });
  it('reads Results as an array too (the documentation’s sample form)', () => {
    const j = fx('jolts-v1.json');
    expect(parseBls('JTS540099000000000JOR', { ...j, Results: [j.Results] }).value).toBe('5.0');
  });
  it('reports a series with no data, an HTTP failure and a refused request as errors, never as values', () => {
    const r = parseBls('CMU2030000000000P', fx('not-found-v1.json'));
    expect(r.status).toBe('error');
    expect(r.value).toBeNull();
    expect(r.error).toContain('Series does not exist');
    expect(parseBls('X', null, 503)).toMatchObject({ status: 'error', error: 'HTTP 503' });
    expect(parseBls('X', { status: 'REQUEST_NOT_PROCESSED', message: ['daily threshold'] })).toMatchObject({ status: 'error', error: 'REQUEST_NOT_PROCESSED: daily threshold' });
  });
});
