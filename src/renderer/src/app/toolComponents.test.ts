import { describe, expect, it } from 'vitest'
import type { ToolId } from '@shared/domain/tool'
import type { ToolDefinition } from '@/panels/definition'
import { definition as assets } from '@/panels/assets'
import { definition as assistant } from '@/panels/assistant'
import { definition as explorer } from '@/panels/explorer'
import { definition as git } from '@/panels/git'
import { definition as history } from '@/panels/history'
import { definition as animations } from '@/panels/animations'
import { definition as context } from '@/panels/context'
import { definition as generator } from '@/panels/generator'
import { definition as inspector } from '@/panels/inspector'
import { definition as layers } from '@/panels/layers'
import { definition as lights } from '@/panels/lights'
import { definition as meshes } from '@/panels/meshes'
import { definition as problems } from '@/panels/problems'
import { definition as projects } from '@/panels/projects'
import { definition as scene } from '@/panels/scene'
import { definition as text } from '@/panels/text'
import { definition as timeline } from '@/panels/timeline'
import { isKnownTool, TOOL_ENTRIES, toolDefinition } from './toolComponents'

/**
 * The panels themselves, imported outright — which only a test may do. The table reaches them
 * through `import()`, so what it says about them is a second copy of the truth, and nothing but
 * this file stops the two from drifting.
 *
 * Keyed on `ToolId`, like the table it checks: a panel added, renamed or dropped fails to
 * compile here rather than at a case.
 */
const PANELS: Record<ToolId, ToolDefinition> = {
  assistant,
  layers,
  meshes,
  lights,
  timeline,
  explorer,
  git,
  history,
  scene,
  generator,
  inspector,
  assets,
  projects,
  animations,
  text,
  context,
  problems,
}

const IDS = Object.keys(PANELS).filter(isKnownTool)

function idsWhere(holds: (definition: ToolDefinition) => boolean): string[] {
  return IDS.filter(id => holds(toolDefinition(id))).sort()
}

function panelsWhere(holds: (definition: ToolDefinition) => boolean): string[] {
  return IDS.filter(id => holds(PANELS[id])).sort()
}

describe('the tool table', () => {
  it('knows every panel there is, and nothing else', () => {
    expect(IDS).toHaveLength(Object.keys(PANELS).length)
    expect(isKnownTool('nothing-of-the-sort')).toBe(false)
  })

  // The header draws its separator on the first paint, before the panel's chunk lands. Declaring
  // one for a panel that publishes none would put a divider beside an empty row, and forgetting
  // one would make the divider appear a frame after the row it separates.
  it('declares actions for exactly the panels that publish them', () => {
    expect(idsWhere(tool => tool.Actions !== undefined)).toEqual(
      panelsWhere(tool => tool.Actions !== undefined),
    )
  })

  it('declares a filled action row for exactly the panels that ask for one', () => {
    expect(idsWhere(tool => tool.fillActions === true)).toEqual(
      panelsWhere(tool => tool.fillActions === true),
    )
  })

  /**
   * What the language used to hold on its own, before the panels went lazy: a key named its own
   * module, because it WAS the binding. Now the specifier sits beside the key as a string, and
   * nothing else would notice if `layers` came to load the meshes panel — the two would simply
   * swap, both of them rendering, no test the wiser. Resolving each one is the only way to tell.
   */
  it('loads, for every tool, the panel of that same name', async () => {
    for (const id of IDS) {
      const loaded = await TOOL_ENTRIES[id].load()
      expect(loaded.definition).toBe(PANELS[id])
    }
  })

  /**
   * `lazy()` gives a fresh component every call. A panel handed a new one on each render would
   * remount — losing its scroll, its selection and whatever was being typed in it — on every
   * frame of a zone drag, which writes a new size on every `pointermove`.
   */
  it('hands out the same components every time it is asked', () => {
    for (const id of IDS) {
      expect(toolDefinition(id)).toBe(toolDefinition(id))
    }
  })
})
