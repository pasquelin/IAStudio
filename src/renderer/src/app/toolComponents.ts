import { lazy } from 'react'
import type { ToolId } from '@shared/domain/tool'
import type { ToolDefinition } from '@/panels/definition'

/**
 * What the title row must know before the panel's chunk arrives — the header lays itself out on
 * the first paint, and a separator turning up a frame later would shift a row already on screen.
 * `'fill-actions'` additionally takes the row's free width in a band.
 */
type HeaderRole = 'actions' | 'fill-actions'

type ToolEntry = {
  load: () => Promise<{ definition: ToolDefinition }>
  role: HeaderRole | null
}

/**
 * Every panel: the module it lives in, and what its header does. Exported so
 * `toolComponents.test.ts` can resolve each specifier — a specifier written beside a key is a
 * second copy of the panel's name, and `layers` naming the meshes module would swap the two in
 * silence. `import()` takes a literal, so the copy stays. That test holds this column and the
 * header roles; what `panel()` then wires them to is only covered where a panel is rendered.
 *
 * A glob keyed on the folder would remove that copy, and was written before being put back:
 * `eager-graph.test.ts` walks STATIC imports, so a glob is invisible to it — the guard that
 * watches this very property would have stayed green whatever the glob did to the entry chunk.
 */
export const TOOL_ENTRIES: Record<ToolId, ToolEntry> = {
  assistant: { load: () => import('@/panels/assistant'), role: 'actions' },
  layers: { load: () => import('@/panels/layers'), role: 'actions' },
  meshes: { load: () => import('@/panels/meshes'), role: 'actions' },
  lights: { load: () => import('@/panels/lights'), role: 'actions' },
  timeline: { load: () => import('@/panels/timeline'), role: 'fill-actions' },
  explorer: { load: () => import('@/panels/explorer'), role: 'actions' },
  git: { load: () => import('@/panels/git'), role: 'actions' },
  history: { load: () => import('@/panels/history'), role: 'actions' },
  scene: { load: () => import('@/panels/scene'), role: null },
  generator: { load: () => import('@/panels/generator'), role: null },
  inspector: { load: () => import('@/panels/inspector'), role: 'actions' },
  assets: { load: () => import('@/panels/assets'), role: 'actions' },
  projects: { load: () => import('@/panels/projects'), role: null },
  animations: { load: () => import('@/panels/animations'), role: null },
  text: { load: () => import('@/panels/text'), role: null },
  context: { load: () => import('@/panels/context'), role: 'actions' },
  problems: { load: () => import('@/panels/problems'), role: null },
}

/** A panel that publishes no actions still needs something for `lazy` to resolve to. */
const NoActions = () => null

function panel({ load, role }: ToolEntry): ToolDefinition {
  return {
    Content: lazy(async () => ({ default: (await load()).definition.Content })),
    // One `import()` for both halves: the module resolves once, and the second `lazy` reads it
    // from the module cache rather than asking for the chunk again.
    Actions:
      role === null
        ? undefined
        : lazy(async () => ({ default: (await load()).definition.Actions ?? NoActions })),
    fillActions: role === 'fill-actions',
  }
}

/**
 * Held rather than rebuilt: `lazy()` gives a fresh component every call, and a panel handed a
 * new one on each render would remount — losing its scroll, its selection and whatever was
 * being typed in it — on every frame of a zone drag.
 */
const HELD = new Map<ToolId, ToolDefinition>()

/**
 * What a tool draws, loaded on demand. The home screen opens ONE panel, and importing them all
 * outright held `engines/`, four helpers of the editors' folders and the usage formatter in the
 * chunk the splash screen waits for: first screen 2 331 395 → 2 081 385 bytes, −250 010,
 * −10,7 %, measured at equal commit with the preloads counted and no sourcemaps.
 */
export function toolDefinition(id: ToolId): ToolDefinition {
  const held = HELD.get(id)
  if (held) return held

  const made = panel(TOOL_ENTRIES[id])
  HELD.set(id, made)
  return made
}

/** The tools this version knows. State from an older one may name something else. */
export function isKnownTool(id: string): id is ToolId {
  return id in TOOL_ENTRIES
}
