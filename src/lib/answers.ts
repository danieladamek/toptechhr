/**
 * The Start answers (KICKOFF §4a): goal, pattern, stage, conditions, state — kept in localStorage under one key, with
 * the visible "stays in this browser" line wherever they are asked. `toPathfinder` turns them into the pathfinder's
 * own answers: the goal maps to its default stage, and "Fill a role" defers to the stage step ("Not sure" → no stage).
 * The ranking itself is the pack's rule, implemented unchanged in ./pathfinder.ts.
 */
import { useCallback, useEffect, useState } from 'react';
import type { Answers } from '@/lib/pathfinder';
import type { HrStep } from '@/types';
import type { StartAnswers } from '@/lib/notebook';

export const ANSWERS_KEY = 'toptechhr-start';
export const DEFAULT_STATE = 'us-al';
const EVENT = 'toptechhr-start-changed';

export function readAnswers(): StartAnswers {
  try { const t = localStorage.getItem(ANSWERS_KEY); return t ? (JSON.parse(t) as StartAnswers) : {}; } catch { return {}; }
}
function write(a: StartAnswers | null) {
  try { if (a === null) localStorage.removeItem(ANSWERS_KEY); else localStorage.setItem(ANSWERS_KEY, JSON.stringify(a)); } catch { /* blocked storage: answers live for this tab */ }
  window.dispatchEvent(new Event(EVENT));
}

/** The answers, shared by every component that reads them (Start, Plan, the notebook's "situation"). */
export function useStartAnswers(): [StartAnswers, (patch: Partial<StartAnswers>) => void, () => void] {
  const [a, setA] = useState<StartAnswers>(readAnswers);
  useEffect(() => {
    const on = () => setA(readAnswers());
    window.addEventListener(EVENT, on);
    window.addEventListener('storage', on);
    return () => { window.removeEventListener(EVENT, on); window.removeEventListener('storage', on); };
  }, []);
  const set = useCallback((patch: Partial<StartAnswers>) => write({ ...readAnswers(), ...patch }), []);
  const clear = useCallback(() => write(null), []);
  return [a, set, clear];
}

export const goalOption = (steps: HrStep[], goal?: string) => steps.find((s) => s.id === 'goal')?.options?.find((o) => o.label === goal);
/** "Fill a role" is the goal whose stage set is chosen by the stage step (it has no default stage). */
export const goalRevealsStage = (steps: HrStep[], goal?: string) => { const o = goalOption(steps, goal); return !!o && !o.default_stage; };

/** The stage the answers stand for: the stage step's answer under "Fill a role", else the goal's default stage. */
export function effectiveStage(steps: HrStep[], a: StartAnswers): string | null {
  const o = goalOption(steps, a.goal);
  if (!o) return a.stage ?? null;
  if (!o.default_stage) return a.stage ?? null;
  return o.default_stage;
}

export function toPathfinder(steps: HrStep[], a: StartAnswers): Answers {
  return { pattern: a.pattern || undefined, stage: effectiveStage(steps, a) ?? undefined, conditions: a.conditions ?? [], state: a.state || DEFAULT_STATE };
}

export const hasAnswers = (a: StartAnswers) => !!(a.goal || a.pattern || a.stage || (a.conditions && a.conditions.length));

/** The Situation line of the action-plan template: the Start answers as a sentence, in the steps' own labels. */
export function situationSentence(steps: HrStep[], a: StartAnswers, stateName: (id: string) => string, stageLabel: (id: string) => string): string {
  const label = (id: HrStep['id'], tag?: string | null) => steps.find((s) => s.id === id)?.options?.find((o) => (o.tag ?? null) === (tag ?? null))?.label ?? tag ?? '';
  const parts: string[] = [];
  if (a.goal) parts.push(`Goal: ${a.goal}.`);
  if (a.pattern) parts.push(`Pattern: ${label('pattern', a.pattern)}.`);
  const st = effectiveStage(steps, a);
  if (st) parts.push(`Stage: ${stageLabel(st)}.`);
  if (a.conditions?.length) parts.push(`Conditions: ${a.conditions.map((c) => label('conditions', c)).join('; ')}.`);
  parts.push(`State: ${stateName(a.state || DEFAULT_STATE)}.`);
  return parts.join(' ');
}
