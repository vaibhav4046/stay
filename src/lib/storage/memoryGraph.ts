/**
 * 3-Tier Stateful Memory Graph
 * Tier 1: Working Memory (active block, pending intention, immediate vocal affect)
 * Tier 2: Episodic Memory (temporal session events, emotional trajectory, outcome logs)
 * Tier 3: Semantic Knowledge Graph (ADHD barrier relations, strategy affinity, personal triggers)
 */

export interface GraphNode {
  id: string;
  type: 'concept' | 'barrier' | 'strategy' | 'routine' | 'trigger';
  label: string;
  weight: number; // 0..1 importance / frequency
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  from: string;
  to: string;
  relation: 'struggles_with' | 'succeeds_with' | 'calmed_by' | 'prefers' | 'triggers_avoidance_in';
  weight: number; // -1.0 (strong hindrance) to +1.0 (strong affinity)
  lastReinforced: string;
}

export interface WorkingMemory {
  activeTaskText: string | null;
  currentIntention: string | null;
  transientAffect: string | null;
  sessionStartedAt: number | null;
}

export interface EpisodicMemoryEvent {
  id: string;
  timestamp: string;
  task: string;
  strategy: string;
  outcome: string;
  affectShift?: string;
}

export interface MemoryGraphState {
  working: WorkingMemory;
  episodic: EpisodicMemoryEvent[];
  nodes: Record<string, GraphNode>;
  edges: GraphEdge[];
}

const STORAGE_KEY = 'stay_memory_graph_v1';

export function createInitialGraph(): MemoryGraphState {
  const nodes: Record<string, GraphNode> = {
    'strat-task_shrinking': { id: 'strat-task_shrinking', type: 'strategy', label: 'Task Shrinking (2-min)', weight: 0.9 },
    'strat-implementation_intention': { id: 'strat-implementation_intention', type: 'strategy', label: 'Implementation Intentions', weight: 0.8 },
    'strat-timeboxing': { id: 'strat-timeboxing', type: 'strategy', label: 'Timeboxing Focus Blocks', weight: 0.75 },
    'strat-reframing': { id: 'strat-reframing', type: 'strategy', label: 'Cognitive Reframing', weight: 0.7 },
    'barrier-overwhelm': { id: 'barrier-overwhelm', type: 'barrier', label: 'Cognitive Overwhelm', weight: 0.85 },
    'barrier-initiation_deficit': { id: 'barrier-initiation_deficit', type: 'barrier', label: 'Executive Initiation Delay', weight: 0.9 },
  };

  const edges: GraphEdge[] = [
    { from: 'barrier-overwhelm', to: 'strat-task_shrinking', relation: 'calmed_by', weight: 0.85, lastReinforced: new Date().toISOString() },
    { from: 'barrier-initiation_deficit', to: 'strat-task_shrinking', relation: 'succeeds_with', weight: 0.9, lastReinforced: new Date().toISOString() },
  ];

  return {
    working: {
      activeTaskText: null,
      currentIntention: null,
      transientAffect: null,
      sessionStartedAt: null,
    },
    episodic: [],
    nodes,
    edges,
  };
}

export function loadMemoryGraph(): MemoryGraphState {
  if (typeof window === 'undefined') return createInitialGraph();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialGraph();
    const parsed = JSON.parse(raw) as MemoryGraphState;
    return parsed?.nodes ? parsed : createInitialGraph();
  } catch {
    return createInitialGraph();
  }
}

export function saveMemoryGraph(state: MemoryGraphState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // quota guard
  }
}

/**
 * Record an episodic event and update semantic edge weights.
 */
export function recordGraphEvent(
  task: string,
  strategy: string,
  outcome: 'started' | 'partly_started' | 'not_started' | 'paused_or_stopped',
  affectShift?: string
): MemoryGraphState {
  const state = loadMemoryGraph();

  // 1. Update Episodic Memory
  const event: EpisodicMemoryEvent = {
    id: `epi-${Date.now()}`,
    timestamp: new Date().toISOString(),
    task,
    strategy,
    outcome,
    affectShift,
  };
  state.episodic = [event, ...state.episodic.slice(0, 49)]; // keep latest 50

  // 2. Reinforce or weaken semantic edge
  const strategyNodeId = `strat-${strategy}`;
  const delta = outcome === 'started' ? 0.15 : outcome === 'partly_started' ? 0.08 : -0.1;

  let existingEdge = state.edges.find((e) => e.to === strategyNodeId);
  if (existingEdge) {
    existingEdge.weight = Math.max(-1.0, Math.min(1.0, existingEdge.weight + delta));
    existingEdge.lastReinforced = new Date().toISOString();
  } else {
    state.edges.push({
      from: 'barrier-initiation_deficit',
      to: strategyNodeId,
      relation: delta > 0 ? 'succeeds_with' : 'struggles_with',
      weight: delta,
      lastReinforced: new Date().toISOString(),
    });
  }

  saveMemoryGraph(state);
  return state;
}

/**
 * Synthesizes a compact, high-signal prompt inject from the 3-tier memory graph.
 */
export function synthesizeMemoryContext(state: MemoryGraphState): string {
  const lines: string[] = [];

  if (state.working.activeTaskText) {
    lines.push(`Active intention: "${state.working.activeTaskText}"`);
  }

  const topAffinities = state.edges
    .filter((e) => e.weight > 0.3)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3);

  if (topAffinities.length > 0) {
    lines.push(
      `Validated user affinities: ${topAffinities.map((e) => `${e.to.replace('strat-', '')} (+${e.weight.toFixed(2)})`).join(', ')}`
    );
  }

  const recent = state.episodic.slice(0, 2);
  if (recent.length > 0) {
    lines.push(
      `Recent attempts: ${recent.map((r) => `"${r.task.slice(0, 25)}" -> ${r.outcome}`).join('; ')}`
    );
  }

  return lines.join(' | ');
}
