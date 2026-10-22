import recordsIndexJson from '@/data/records-index.json';
import type { RecordMeta, RecordType } from '@/types';

/** Lookup for "constraints/x"-style keys (reference cards, change ledgers, notes). The index is slim: titles, paths, stage, grade. */
export const recordsIndex = recordsIndexJson as unknown as RecordMeta[];
export const recordsIndexById = new Map<string, RecordMeta>(recordsIndex.map((r) => [`${r.type}/${r.id}`, r]));
export const recordMeta = (type: RecordType, id: string) => recordsIndexById.get(`${type}/${id}`);
/** Find a record by bare id, preferring the given types in order (a change's `records[]` and a ledger's `mapped_to` name bare ids). */
export function findRecord(id: string, prefer: RecordType[] = ['stages', 'constraints', 'levers', 'gates', 'enablers', 'patterns', 'indicators', 'controversies', 'states', 'changes', 'links']): RecordMeta | undefined {
  for (const t of prefer) { const m = recordsIndexById.get(`${t}/${id}`); if (m) return m; }
  return undefined;
}
