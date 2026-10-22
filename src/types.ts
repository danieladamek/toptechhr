export type BlockMarker = 'framing' | 'synthesis' | null;

export type Chunk =
  | { kind: 'md'; md: string; hasMath: boolean; marker: BlockMarker; id: string | null; synthesis: string[] }
  | { kind: 'figure'; id: string };

export interface Section {
  id: string; title: string; depth: number; number: string | null;
  chunks: Chunk[]; terms: string[]; cites: number[]; figures: string[]; words: number;
  blocks: number; cited_blocks: number; framing_blocks: number; synthesis_blocks: number;
}

export type Domain = 'evidence' | 'selection' | 'attraction' | 'pay' | 'clearance' | 'contract' | 'law' | 'people' | 'planning' | 'guide';

export interface GlossaryEntry {
  id: string; term: string; kind: string; domain: Domain;
  variants: string[]; short: string; definition: string; concept?: string; see: string[];
  appears_in: string[]; in_records: string[]; in_concepts: string[]; occurrences: number; figures: string[];
}

export interface SelfCheck { q: string; options: string[]; answer: number; explanation: string }
export interface Concept {
  id: string; title: string; one_liner: string; why_here: string; prerequisites: string[]; terms: string[]; figures: string[];
  further_reading: { title: string; url: string; kind?: string }[]; self_check: SelfCheck[];
  body_before: string; picture: string | null; body_after: string; has_math: boolean;
  used_by_terms: string[]; used_by_figures: string[]; used_by_concepts: string[];
}

export type Row = Record<string, string | number | null>;
export interface PathwayNode { id: string; label: string; type: string; col: number; row: number; stage?: string; pattern?: string; refs: number[]; term?: string }
export interface PathwayEdge { from: string; to: string; type?: string; label?: string; refs: number[] }
export interface Pathway { id?: string; note: string; nodes: PathwayNode[]; edges: PathwayEdge[] }
export interface Explain { on: string; text: string; term?: string; concept?: string }
export interface Axis { field?: string; label?: string; unit?: string; scale?: 'linear' | 'log' }
export interface ChartSpec { type: string; x?: Axis; y?: Axis; series?: { field: string; label?: string }; ci?: [string, string] }
export interface Figure {
  id: string; label: string; title: string; kind: 'chart' | 'table' | 'network' | 'pathway' | 'image';
  synthesis?: 'data' | 'conceptual'; refs: number[]; data?: string; script?: string;
  columns?: { field: string; label?: string }[];
  chart?: ChartSpec; caption: string; how_to_read: string;
  explain: Explain[]; concepts: string[]; discussed_in: string[]; source: string;
  table?: { rows: Row[]; fields: string[] }; pathway?: Pathway;
  provenance: string;
}

export type Tier = 'seminal' | 'classic' | 'current' | 'background';

export interface Reference {
  n: number; key: string; tier: Tier; tier_note?: string; citation: string; url: string; doi?: string; journal: string; year: number;
  published: string; date_note?: string; accessed: string; publisher: string;
  source_kind: 'primary' | 'secondary'; peer_reviewed: boolean; study_design: string; population: string; effect: string;
  read: 'full' | 'partial' | 'not-fetched';
  summary: string; why_it_mattered: string; key_facts: string[]; quotes: string[];
  role_here: string; role_note: string; cited_in: string[]; used_by: string[]; verified: boolean; recheck: boolean;
  cited_sections: string[]; cited_records: string[]; cited_ledger: number; cited_elsewhere: string[]; anchor: string | null;
}
export interface ReferenceMeta {
  n: number; key: string; year: number; tier: Tier; publisher: string; source_kind: 'primary' | 'secondary'; study_design: string; read: string; role_here: string;
  verified: boolean; recheck: boolean; seminal: boolean; peer_reviewed: boolean;
  citation: string; cited_sections: string[]; cited: boolean; anchor: boolean;
}

export interface TodoItem { id: string; kind: string; where: string; about: string; what: string; text: string }
export interface BuildError { where: string; message: string }
export interface SynthesisPassage { id: string; section: string; excerpt: string; words: number }
export interface RecordSynthesis { id: string; file: RecordType; record: string; field: string; excerpt: string }

/* ── extension records (KICKOFF §4b). Prose strings arrive term- and citation-linked from the content build. */

export type StageId = 'plan' | 'attract' | 'select' | 'offer' | 'clear-start' | 'onboard' | 'develop' | 'retain' | 'handover';
export type Relation = 'precondition' | 'amplifies' | 'trade-off' | 'enables';
export type RecordType = 'stages' | 'patterns' | 'constraints' | 'levers' | 'gates' | 'enablers' | 'indicators' | 'links' | 'states' | 'controversies' | 'changes';
export interface PendingChange { status: string; date: string; text: string; [k: string]: unknown }

export interface RecordBase { id: string; name: string; as_of?: string; sources: number[]; legacy: string[]; changes_affecting: string[]; [k: string]: unknown }

export interface Metric { id: string; definition: string; benchmark: string[] }
export interface Stage extends RecordBase {
  id: StageId; order: number; what: string; decided_by: string; failure_patterns: string[]; metrics: Metric[];
  literatures: string[]; gates: string[]; constraints: string[]; status?: string;
}
export interface Pattern extends RecordBase { stage?: StageId; what: string; points_at: string[]; reasons: { constraint: string; why: string }[] }
export interface Constraint extends RecordBase {
  stage: StageId; what: string; mechanism: string; how_to_tell: string[] | string; indicators: string[]; levers: string[]; gates: string[];
  situations: string[]; decided_by: string; evidence_grade: string; controversy: string; as_of: string; conflicts: string[];
  inbound: string[]; outbound: string[]; patterns: string[];
}
export interface LeverEvidence { grade: string; effect: string; population: string; k_n: string; [k: string]: unknown }
export interface Lever extends RecordBase {
  stages: StageId[]; what: string; evidence: LeverEvidence; what_it_does_not_do: string; costs: string;
  when_it_binds_elsewhere: string[]; gates: string[]; enablers: string[]; how_to: string[] | string; as_of: string; controversy?: string;
  constraints: string[]; inbound: string[]; outbound: string[];
}
export interface Gate extends RecordBase {
  what: string; governing_text: string; applies_when: string; binds: StageId[]; steps: string[] | string; official_url: string;
  pending_changes: PendingChange[]; as_of: string; conflicts: string[];
  stages: StageId[]; constraints: string[]; levers: string[]; states: { state: string; overlay: OverlayKey; status: string; primary_pending: boolean }[];
}
export interface Enabler extends RecordBase {
  kind: 'data-source' | 'program' | 'reference' | 'tooling' | 'standard'; what: string; cost: string; conditions: string;
  levers: string[]; official_url: string; pending_changes: PendingChange[]; as_of: string; levers_all: string[];
}
export interface Indicator extends RecordBase {
  value: string; reference_period: string; published: string; publisher: string; series: string; stages: StageId[]; note: string;
  constraints: string[]; metric_stages: StageId[];
}
export interface Link { id: string; from: string; to: string; relation: Relation; link: string; evidence: string; grade: string; legacy: string[]; sources: number[]; changes_affecting: string[] }
export type OverlayKey = 'pay_transparency' | 'salary_history_ban' | 'noncompete' | 'stay_or_pay' | 'ai_hiring' | 'cannabis_testing' | 'ban_the_box' | 'credit_check' | 'mini_warn';
export interface Overlay { status: string; text: string; sources: number[]; primary_pending: boolean; gates: string[]; threshold?: string; effective?: string; notice_days?: string; [k: string]: unknown }
export type StateRecord = { id: string; state: string; abbr: string; localities?: string; state_gates?: string[]; sources: number[]; as_of: string; recheck: boolean; changes_affecting: string[] } & Record<OverlayKey, Overlay>;
export interface Controversy extends RecordBase { question: string; positions: { holder: string; claim: string; sources: number[] }[]; what_a_recruiter_can_rely_on: string; named_by: string[] }
export interface Change { id: string; date: string; status: string; title: string; what: string; stages: StageId[]; records: string[]; sources: number[]; superseded_by: string | null }

export interface Hypothesis {
  id: string; kind: string; original_id: string; original: string | Record<string, unknown>; category?: string; status: string; stage_guess: string;
  mapped_to: string[]; evidence: string; queries: unknown[]; adjudicated?: string; sweep?: string | number;
}
export interface Ledger { header: string; version: string | null; as_of: string | null; adjudicated_counts: Record<string, number>; counts: Record<string, number>; entries: Hypothesis[] }

export interface PfOption { tag: string | null; label: string }
export interface PfQuestion { id: 'pattern' | 'stage' | 'conditions' | 'state'; prompt: string; type: 'single' | 'multi'; options: PfOption[] }
export interface PfRow { id: string; stage: StageId; patterns: string[]; conditions: string[] }
export interface Pathfinder { rule: string; questions: PfQuestion[]; pattern_aliases: Record<string, string>; constraints: PfRow[]; note: string }

export interface Closure { nodes: string[]; edges: string[] }
export interface GraphData { edges: string[]; walks: Record<string, { up: Record<string, Closure>; down: Record<string, Closure> }> }

export interface RecordMeta { type: RecordType; id: string; title: string; to: string; stage: StageId | null; stages: StageId[]; grade: string | null; status: string | null; date: string | null; as_of: string | null }

export interface HomeData {
  constraints: { id: string; name: string; stage: StageId; levers: string[]; gates: string[] }[];
  levers: Record<string, { name: string; grade: string }>;
  gates: Record<string, { name: string }>;
  stages: { id: StageId; name: string; order: number; constraints: number; gates: number; patterns: string[] }[];
  changes: { id: string; date: string; status: string; title: string }[];
  states: { id: string; state: string; abbr: string }[];
}

/* ── slim indexes */

export interface TermShort { id: string; term: string; domain: Domain; short: string; concept: string | null }
export interface ConceptMeta { id: string; title: string; one_liner: string; prerequisites: string[]; figures: string[]; terms: string[] }
export interface SectionMeta { id: string; title: string; depth: number; number: string | null; words: number; figures: string[]; synthesis_blocks: number; terms: string[] }
export interface FigureMeta {
  id: string; label: string; title: string; kind: Figure['kind']; chart_type: string | null; synthesis: 'data' | 'conceptual' | null;
  provenance: string; concepts: string[]; refs: number[]; rows: number | null; has_chart: boolean; discussed_in: string[]; data: string | null; script: string | null;
}

/** public/data/benchmarks/latest.json, written by scripts/refresh-bls.mjs (KICKOFF §4c). */
export interface BlsLatest {
  fetchedAt: string;
  endpoint?: string;
  series: { series: string; period: string | null; value: string | null; year?: string | null; periodName?: string | null; status: string; error?: string }[];
}

/* ── TopTechHR (KICKOFF §3) */
export interface HrStepOption { label: string; tag?: string | null; stages?: string[]; default_stage?: string | null; hint?: string }
export interface HrStep { id: 'goal' | 'pattern' | 'stage' | 'conditions' | 'state'; prompt: string; type: 'single' | 'multi'; maps_to: string; shown_when?: string; default?: string; note?: string; options?: HrStepOption[] }
export interface HrAction { lever: string; plain_name: string; moment: string; stage?: string | null }
export interface HrRule { gate: string; plain_name: string; moment: string; also: string[]; geo?: string; sector?: string }
export interface HrTemplateSection { id: 'situation' | 'confirmed' | 'actions' | 'rules' | 'numbers' | 'sources'; title: string; fills_from: string; editable: boolean; placeholders?: string[] }
export interface Hr {
  situations: { steps: HrStep[] };
  actions: { moments: string[]; byLever: Record<string, HrAction> };
  rules: { moments: string[]; byGate: Record<string, HrRule>; order: string[] };
  template: { name: string; sections: HrTemplateSection[] };
  aliases: { alias: string; term: string }[];
}
export interface PlanOrderEntry { levers: string[]; do_first: Record<string, { before: string; edge: string }[]> }
export interface CounterpartStub { id: string; name: string; value: string; reference_period: string; geo: string }
export interface NumberCard extends Indicator { geo: string; sector: string; series_confirmed: string; counterpart: string; counterpart_stub: CounterpartStub | null; counterpart_of: string[] }
export interface Numbers { groups: Record<string, Record<string, string[]>>; cards: Record<string, NumberCard>; unresolved: { id: string; counterpart: string }[]; one_way: { id: string; counterpart: string }[] }
