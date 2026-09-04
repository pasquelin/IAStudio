import type {
  ContextBudgetReport,
  ContextSource,
  ContextSourceBudget,
  ContextSourceReport,
} from './context'

export const CONTEXT_BUDGETS: Record<ContextSource, ContextSourceBudget> = {
  mission: { maxItems: 1, maxCharacters: 1_200 },
  workspace: { maxItems: 1, maxCharacters: 900 },
  project: { maxItems: 1, maxCharacters: 800 },
  document: { maxItems: 1, maxCharacters: 800 },
  selection: { maxItems: 8, maxCharacters: 800 },
  documentState: { maxItems: 1, maxCharacters: 2_000 },
  actions: { maxItems: 12, maxCharacters: 6_000 },
  memories: { maxItems: 6, maxCharacters: 4_000 },
  jobs: { maxItems: 6, maxCharacters: 2_000 },
  results: { maxItems: 6, maxCharacters: 4_000 },
  projectContext: { maxItems: 8, maxCharacters: 1_200 },
  visual: { maxItems: 2, maxCharacters: 0, maxBytes: 8_000_000 },
}

const charactersOf = (value: unknown): number => JSON.stringify(value)?.length ?? 0

export function withinBudget<T>(
  values: readonly T[],
  budget: ContextSourceBudget,
  measure: (value: T) => unknown = value => value,
): { values: readonly T[]; report: ContextSourceReport } {
  const selected: T[] = []
  let characters = 0
  for (const value of values) {
    if (selected.length >= budget.maxItems) break
    const cost = charactersOf(measure(value))
    if (characters + cost > budget.maxCharacters) continue
    selected.push(value)
    characters += cost
  }
  return {
    values: selected,
    report: {
      ...budget,
      considered: values.length,
      selected: selected.length,
      characters,
      truncated: selected.length < values.length,
      contentTruncated: false,
    },
  }
}

export function emptyBudgetReport(): ContextBudgetReport {
  const empty = (source: ContextSource): ContextSourceReport => ({
    ...CONTEXT_BUDGETS[source],
    considered: 0,
    selected: 0,
    characters: 0,
    truncated: false,
    contentTruncated: false,
  })
  return {
    mission: empty('mission'),
    workspace: empty('workspace'),
    project: empty('project'),
    document: empty('document'),
    selection: empty('selection'),
    documentState: empty('documentState'),
    actions: empty('actions'),
    memories: empty('memories'),
    jobs: empty('jobs'),
    results: empty('results'),
    projectContext: empty('projectContext'),
    visual: empty('visual'),
  }
}
