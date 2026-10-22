import { useEffect, useState } from 'react';
import { loadHr } from '@/lib/heavy';
import { DEFAULT_STATE, goalRevealsStage, useStartAnswers } from '@/lib/answers';
import homeJson from '@/data/home.json';
import type { Hr, HrStep } from '@/types';
import { S } from '@/strings';

const STATES = (homeJson as { states: { id: string; state: string; abbr: string }[] }).states;

const optionCls = (on: boolean) => `flex cursor-pointer items-start gap-2.5 rounded-[12px] px-3 py-2.5 text-[16px] leading-snug transition-colors ${on ? 'ring-2 ring-[color:var(--bx-accent)]' : ''}`;

function Single({ step, value, onChange, name }: { step: HrStep; value: string | null | undefined; onChange: (v: string | null) => void; name: string }) {
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={step.prompt}>
      {(step.options ?? []).map((o) => {
        const v = step.id === 'goal' ? o.label : (o.tag ?? null);
        const on = (value ?? null) === v && !(v === null && value === undefined);
        return (
          <label key={o.label} className={optionCls(on)} style={{ background: on ? 'var(--bx-bg-2)' : 'var(--bx-bg)' }}>
            <input type="radio" className="mt-1 accent-[#1F6FA8]" name={name} checked={on} onChange={() => onChange(v)} data-testid={`opt-${step.id}-${v ?? 'none'}`} />
            <span><span style={{ color: 'var(--bx-ink)' }} className="font-semibold">{o.label}</span>{o.hint && on && <span className="block text-[14px] bx-muted">{o.hint}</span>}</span>
          </label>
        );
      })}
    </div>
  );
}

/** The four steps (KICKOFF §4a), from hr-layer/situations.yaml; answers persist in this browser. */
export default function StartSteps({ hr: hrIn, compact = false }: { hr?: Hr; compact?: boolean }) {
  const [hr, setHr] = useState<Hr | undefined>(hrIn);
  useEffect(() => { if (!hr) { let live = true; loadHr().then((h) => { if (live) setHr(h); }); return () => { live = false; }; } }, [hr]);
  const [a, set, clear] = useStartAnswers();
  if (!hr) return <p className="bx-muted" role="status">{S.loading}</p>;
  const step = (id: HrStep['id']) => hr.situations.steps.find((s) => s.id === id)!;
  const goal = step('goal'), pattern = step('pattern'), stage = step('stage'), conditions = step('conditions'), state = step('state');
  const showStage = goalRevealsStage(hr.situations.steps, a.goal);
  const cards: { n: number; s: HrStep; body: JSX.Element }[] = [
    { n: 1, s: goal, body: (
      <>
        <Single step={goal} value={a.goal} name="goal" onChange={(v) => set({ goal: v ?? undefined, ...(goalRevealsStage(hr.situations.steps, v ?? undefined) ? {} : { stage: undefined }) })} />
        {showStage && (
          <fieldset className="mt-4" data-testid="stage-step">
            <legend className="font-display text-[15px] font-bold" style={{ color: 'var(--bx-ink)' }}>{stage.prompt}</legend>
            <Single step={stage} value={a.stage === undefined ? undefined : a.stage} name="stage" onChange={(v) => set({ stage: v })} />
          </fieldset>
        )}
      </>
    ) },
    { n: 2, s: pattern, body: <Single step={pattern} value={a.pattern} name="pattern" onChange={(v) => set({ pattern: v ?? undefined })} /> },
    { n: 3, s: conditions, body: (
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {(conditions.options ?? []).map((o) => {
          const tag = o.tag!;
          const on = (a.conditions ?? []).includes(tag);
          return (
            <label key={tag} className={optionCls(on)} style={{ background: on ? 'var(--bx-bg-2)' : 'var(--bx-bg)' }}>
              <input type="checkbox" className="mt-1 accent-[#1F6FA8]" checked={on} data-testid={`opt-conditions-${tag}`}
                onChange={() => set({ conditions: on ? (a.conditions ?? []).filter((c) => c !== tag) : [...(a.conditions ?? []), tag] })} />
              <span style={{ color: 'var(--bx-ink)' }} className="font-semibold">{o.label}</span>
            </label>
          );
        })}
      </div>
    ) },
    { n: 4, s: state, body: (
      <label className="mt-3 block max-w-sm">
        <span className="sr-only">{S.stateLabel}</span>
        <select className="bx-input" value={a.state ?? state.default ?? DEFAULT_STATE} onChange={(e) => set({ state: e.target.value })} data-testid="state-select">
          {STATES.map((s) => <option key={s.id} value={s.id}>{s.state}</option>)}
        </select>
      </label>
    ) },
  ];
  return (
    <div className="grid gap-5" data-testid="start-steps">
      {cards.map(({ n, s, body }) => (
        <fieldset key={s.id} className={`bx-card ${compact ? 'p-4' : 'p-5 sm:p-7'}`}>
          <legend className="sr-only">{s.prompt}</legend>
          <div className="flex items-center gap-3">
            <span className="tt-badge" aria-hidden="true">{n}</span>
            <div>
              <p className="tt-eyebrow">{S.stepLabel(n)}</p>
              <p className="font-display text-[19px] font-bold leading-tight" style={{ color: 'var(--bx-ink)' }}>{s.prompt}</p>
            </div>
          </div>
          {s.type === 'multi' && <p className="mt-2 text-[15px] bx-muted">{S.conditionsHint}</p>}
          {body}
        </fieldset>
      ))}
      <p className="flex flex-wrap items-center gap-4 text-[15px]">
        <span className="bx-muted" data-testid="stays-here">{S.staysHere}</span>
        <button type="button" className="bx-btn-text" onClick={clear} data-testid="clear-answers">{S.clearAnswers}</button>
      </p>
    </div>
  );
}
