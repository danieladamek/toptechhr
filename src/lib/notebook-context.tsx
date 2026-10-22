import { createContext, useCallback, useContext, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { loadHr, loadRefMeta } from '@/lib/heavy';
import {
  loadStore, newId, newNotebook, reducer, saveStore, type Notebook, type NotebookAction, type Quote, type RefLine, type RowAttrs, type StartAnswers, type Store,
} from '@/lib/notebook';
import type { AnchorInfo } from '@/lib/quote';
import { readAnswers, situationSentence } from '@/lib/answers';
import { S } from '@/strings';

/**
 * The Notebook provider (KICKOFF §4c): one store in localStorage, the docked panel's open state, and the actions every
 * page uses — quote, add to plan, add rule, add number. Nothing is sent anywhere.
 */
interface Ctx {
  store: Store;
  active: Notebook | null;
  open: boolean;
  setOpen: (o: boolean) => void;
  toggle: () => void;
  dispatch: (a: NotebookAction) => void;
  /** The active notebook's id, creating one from the template when there is none. */
  ensure: () => Promise<string>;
  create: (opts?: { startAnswers?: StartAnswers; activate?: boolean }) => Promise<string>;
  addQuote: (q: { text: string; anchor: AnchorInfo; citations: number[] }) => Promise<void>;
  addRows: (rows: RowAttrs[]) => Promise<void>;
  inPlan: (kind: RowAttrs['kind'], refId: string) => boolean;
  toast: string | null;
  say: (m: string) => void;
}
const C = createContext<Ctx | null>(null);

/** Citation lines for a list of [n]s, from the slim reference shards (bundled; no network). */
export async function refLines(ns: number[]): Promise<RefLine[]> {
  if (!ns.length) return [];
  const meta = await loadRefMeta(ns);
  return [...new Set(ns)].sort((a, b) => a - b).map((n) => ({ n, citation: meta.get(n)?.citation ?? '' }));
}

export function NotebookProvider({ children }: { children: ReactNode }) {
  // saved as part of each change, not in an effect, so a reload or a navigation right after a change never loses it
  const [store, dispatch] = useReducer((s: Store, a: NotebookAction) => { const next = reducer(s, a); saveStore(next); return next; }, undefined, () => loadStore());
  const [open, setOpenState] = useState<boolean>(() => { try { return sessionStorage.getItem('toptechhr-notebook-open') === '1'; } catch { return false; } });
  const [toast, setToast] = useState<string | null>(null);
  const storeRef = useRef(store);
  storeRef.current = store;
  const setOpen = useCallback((o: boolean) => { setOpenState(o); try { sessionStorage.setItem('toptechhr-notebook-open', o ? '1' : '0'); } catch { /* ignore */ } }, []);
  const toggle = useCallback(() => setOpen(!open), [open, setOpen]);
  const timer = useRef<number>();
  const say = useCallback((m: string) => { setToast(m); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setToast(null), 3500); }, []);

  const create = useCallback(async (opts: { startAnswers?: StartAnswers; activate?: boolean } = {}) => {
    const hr = await loadHr();
    const startAnswers = opts.startAnswers ?? readAnswers();
    const [{ default: states }, { STAGE_LABEL }] = await Promise.all([import('@/data/home.json'), import('@/lib/data')]);
    const stateName = (id: string) => (states as { states: { id: string; state: string }[] }).states.find((s) => s.id === id)?.state ?? id;
    const situation = Object.keys(startAnswers).length ? situationSentence(hr.situations.steps, startAnswers, stateName, (s) => (STAGE_LABEL as Record<string, string>)[s] ?? s) : undefined;
    const nb = newNotebook(hr.template as Parameters<typeof newNotebook>[0], { title: hr.template.name || S.untitled, startAnswers, situation });
    dispatch({ type: 'create', notebook: nb, activate: opts.activate });
    return nb.id;
  }, []);

  const ensure = useCallback(async () => {
    const s = storeRef.current;
    if (s.activeId && s.notebooks.some((n) => n.id === s.activeId)) return s.activeId;
    if (s.notebooks.length) { const id = s.notebooks[s.notebooks.length - 1].id; dispatch({ type: 'activate', id }); return id; }
    return create();
  }, [create]);

  const addQuote = useCallback(async (q: { text: string; anchor: AnchorInfo; citations: number[] }) => {
    const id = await ensure();
    const quote: Quote = {
      id: newId('q'), text: q.text, title: q.anchor.title, citations: q.citations, refs: await refLines(q.citations),
      anchor: { route: q.anchor.route, recordType: q.anchor.recordType, recordId: q.anchor.recordId, ...(q.anchor.sectionId ? { sectionId: q.anchor.sectionId } : {}) },
      ...(q.anchor.asOf ? { asOf: q.anchor.asOf } : {}), capturedAt: new Date().toISOString(),
    };
    dispatch({ type: 'addQuote', id, quote });
    setOpen(true);
    say(S.quoted);
  }, [ensure, say, setOpen]);

  const addRows = useCallback(async (rows: RowAttrs[]) => {
    const id = await ensure();
    for (const row of rows) dispatch({ type: 'addRow', id, row });
    say(rows.length > 1 ? S.addedAll : S.added);
  }, [ensure, say]);

  const active = store.notebooks.find((n) => n.id === store.activeId) ?? null;
  const inPlan = useCallback((kind: RowAttrs['kind'], refId: string) => {
    const nb = storeRef.current.notebooks.find((n) => n.id === storeRef.current.activeId);
    if (!nb) return false;
    if (kind === 'action') return nb.actions.some((a) => a.leverId === refId);
    if (kind === 'rule') return nb.rules.includes(refId);
    if (kind === 'number') return nb.numbers.includes(refId);
    return JSON.stringify(nb.doc).includes(`"refId":"${refId}"`);
  }, [store]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo<Ctx>(() => ({ store, active, open, setOpen, toggle, dispatch, ensure, create, addQuote, addRows, inPlan, toast, say }), [store, active, open, setOpen, toggle, ensure, create, addQuote, addRows, inPlan, toast, say]);
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useNotebook(): Ctx {
  const c = useContext(C);
  if (!c) throw new Error('useNotebook outside NotebookProvider');
  return c;
}
