import { useEffect, useState } from 'react';
import { assetUrl } from '@/lib/data';
import type { BlsLatest } from '@/types';

/**
 * The build-time BLS refresh (KICKOFF §3, ported from Key Personnel §4c): public/data/benchmarks/latest.json, written
 * by scripts/refresh-bls.mjs in the deploy workflow and never committed. The page reads it from its own origin; when
 * it is missing (a local build), every figure is the pack's alone. Nothing is fetched from anywhere else.
 */
export type BlsRow = BlsLatest['series'][number];
export interface BlsState { loaded: boolean; data: BlsLatest | null; bySeries: Map<string, BlsRow> }

let cached: Promise<BlsLatest | null> | null = null;
export function loadBls(): Promise<BlsLatest | null> {
  cached ??= fetch(assetUrl('data/benchmarks/latest.json'), { cache: 'no-cache' })
    .then((r) => (r.ok && (r.headers.get('content-type') ?? '').includes('json') ? (r.json() as Promise<BlsLatest>) : null))
    .catch(() => null);
  return cached;
}

export function useBls(): BlsState {
  const [s, setS] = useState<BlsState>({ loaded: false, data: null, bySeries: new Map() });
  useEffect(() => {
    let live = true;
    loadBls().then((d) => { if (live) setS({ loaded: true, data: d, bySeries: new Map((d?.series ?? []).map((r) => [r.series, r])) }); });
    return () => { live = false; };
  }, []);
  return s;
}

/** A refreshed row that returned a value. */
export const okRow = (r?: BlsRow) => (r && r.status === 'ok' && r.value != null ? r : undefined);
export const periodText = (r: BlsRow) => [r.periodName, r.year].filter(Boolean).join(' ') || r.period || '';
