import MiniSearch from 'minisearch';
import searchJson from '@/data/search.json';

export type SearchKind = 'term' | 'concept' | 'figure' | 'section' | 'stages' | 'patterns' | 'constraints' | 'levers' | 'gates' | 'enablers' | 'indicators' | 'states' | 'controversies' | 'changes';
export interface SearchHit { kind: SearchKind; id: string; title: string; subtitle: string; to: string }

/**
 * ⌘K search (KICKOFF §2, §4): MiniSearch over the index the content build writes — terms with their variants, the
 * primers, figures, guide sections and every record (stages, patterns, constraints, levers, gates, enablers,
 * benchmarks, states, controversies, changes). Prefix and light fuzzy matching; titles weigh more than body text.
 * Lives in the lazy search chunk, built on first use.
 */
const DOCS = (searchJson as (SearchHit & { hay: string })[]).map((d, i) => ({ ...d, key: i }));
let mini: MiniSearch<(typeof DOCS)[number]> | null = null;
function index() {
  if (!mini) {
    mini = new MiniSearch({ idField: 'key', fields: ['title', 'hay'], storeFields: ['kind', 'id', 'title', 'subtitle', 'to'], searchOptions: { boost: { title: 3 }, prefix: true, fuzzy: 0.15, combineWith: 'AND' } });
    mini.addAll(DOCS);
  }
  return mini;
}

export function search(q: string, limit = 16): SearchHit[] {
  const query = q.trim();
  if (!query) return [];
  const exact = query.toLowerCase();
  return index().search(query)
    .map((r) => ({ r, bonus: String(r.title).toLowerCase() === exact ? 1000 : String(r.title).toLowerCase().startsWith(exact) ? 100 : 0 }))
    .sort((a, b) => b.r.score + b.bonus - (a.r.score + a.bonus))
    .slice(0, limit)
    .map(({ r }) => ({ kind: r.kind as SearchKind, id: String(r.id), title: String(r.title), subtitle: String(r.subtitle), to: String(r.to) }));
}
