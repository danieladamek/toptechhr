/**
 * How a state overlay's source is labelled (KICKOFF §1, §4d), from the record alone:
 *   - `primary_pending: true` and the overlay's `text` says the official text is pending (read on a mirror of the Code)
 *     → amber "Mirror of the Code; official text pending";
 *   - `primary_pending: true` otherwise → amber "Compilation-sourced; statute not yet read";
 *   - `primary_pending: false` and the text names an enrolled act → "Primary (enrolled act)";
 *   - otherwise → "Primary".
 */
import { S } from '@/strings';

export interface SourceKind { label: string; amber: boolean; mirror: boolean; compilation: boolean }

export function overlaySourceKind(o: { primary_pending?: boolean; text?: string }): SourceKind {
  const t = String(o.text ?? '');
  const mirror = /official text pending/i.test(t) || /\bmirror\b/i.test(t);
  if (o.primary_pending) return mirror ? { label: S.mirrorTag, amber: true, mirror: true, compilation: false } : { label: S.compilationTag, amber: true, mirror: false, compilation: true };
  if (/\benrolled\b/i.test(t)) return { label: S.primaryEnrolled, amber: false, mirror: false, compilation: false };
  return { label: S.primary, amber: false, mirror: false, compilation: false };
}
