import { useMemo } from 'react'
import { bindingOf, type CommandId } from '@shared/domain/command'
import { isSnapping } from '@shared/domain/snap'
import {
  allNegative,
  canCarve,
  canInvertCarve,
  canNegate,
  canSeparate,
  carvePlan,
  carveScene,
} from '@/engines/csg/carve'
import { selectedNodes } from '@/engines/scene/sceneState'
import { useShortcutLabel } from '@/hooks/useShortcutLabel'
import { useBindingOverrides } from '@/stores/bindings'
import { useSceneClipboard } from '@/stores/sceneClipboard'
import type { sceneOf } from '@/stores/scenes'
import { displayOfPane, type sceneViewChromeOf } from '@/stores/sceneViews'
import { isolating } from '@/engines/scene/isolation'
import { ADD_TOOLS, SCENE_TOOLS } from '../../sceneTools'

type ToolbarFacts = {
  bindings: ReturnType<typeof useBindingOverrides>
  label: ReturnType<typeof useShortcutLabel>
  nothingHeld: boolean
  nothingSelected: boolean
  cannotCarve: boolean
  cannotNegate: boolean
  allMarked: boolean
  matterName?: string
  foldable: ReturnType<typeof selectedNodes>
  cannotSeparate: boolean
  isolated: boolean
  view: ReturnType<typeof sceneViewChromeOf>
}

function deriveSceneToolbarTools(facts: ToolbarFacts) {
  const { view } = facts
  const pressed: Partial<Record<CommandId, boolean>> = {
    'scene.snap': isSnapping(view.snapping),
    'scene.space': view.localFrame,
    'scene.projection': view.projection === 'orthographic',
    'scene.skeletons': view.skeletons,
    'scene.poseMode': view.poseMode,
    'scene.quad': view.quad,
    'scene.quadEdges': view.quadEdges,
    'scene.isolate': facts.isolated,
    'scene.negate': facts.allMarked,
  }
  const unavailable: Partial<Record<CommandId, boolean>> = {
    'scene.delete': facts.nothingSelected,
    'scene.duplicate': facts.nothingSelected,
    'scene.group': facts.nothingSelected,
    'scene.copy': facts.nothingSelected,
    'scene.cut': facts.nothingSelected,
    'scene.paste': facts.nothingHeld,
    'scene.frame': facts.nothingSelected,
    'scene.frameFollow': facts.nothingSelected,
    'scene.isolate': facts.nothingSelected && !facts.isolated,
    'scene.hide': facts.nothingSelected,
    'scene.showAll': !facts.isolated,
    'scene.negate': facts.cannotNegate,
    'scene.carve': facts.cannotCarve,
    'scene.weld': facts.cannotCarve,
    'scene.intersect': facts.cannotCarve,
    'scene.separate': facts.cannotSeparate,
    'scene.invertCarve': !canInvertCarve(facts.foldable),
  }
  return sceneTools(facts, pressed, unavailable)
}

function sceneTools(
  facts: ToolbarFacts,
  pressed: Partial<Record<CommandId, boolean>>,
  unavailable: Partial<Record<CommandId, boolean>>,
) {
  return [
    ...ADD_TOOLS,
    ...SCENE_TOOLS.map(tool => ({
      ...tool,
      shortcut: facts.label(bindingOf(tool.command, facts.bindings)),
      activeMode: tool.id === 'display' ? displayOfPane(facts.view.displays, 0) : undefined,
      disabled: unavailable[tool.command],
      pressed: pressed[tool.command],
      ...(tool.command === 'scene.carve' && facts.matterName
        ? {
            descriptionKey: 'sceneTools.carveOnHint',
            descriptionValues: { name: facts.matterName },
          }
        : {}),
      ...(tool.id === 'isolate' && facts.isolated
        ? { labelKey: 'sceneTools.leaveIsolation', descriptionKey: 'sceneTools.leaveIsolationHint' }
        : {}),
    })),
  ]
}

function useToolbarFacts(
  scene: ReturnType<typeof sceneOf>,
  view: ReturnType<typeof sceneViewChromeOf>,
): ToolbarFacts {
  const bindings = useBindingOverrides()
  const label = useShortcutLabel()
  const nothingHeld = useSceneClipboard(state => state.nodes.length === 0)
  const nothingSelected = scene.selectedIds.length === 0
  const foldable = useMemo(
    () => selectedNodes(scene.nodes, scene.selectedIds),
    [scene.nodes, scene.selectedIds],
  )
  const matterName = useMemo(
    () =>
      canCarve(foldable)
        ? carvePlan(carveScene(foldable, scene.nodes), 'subtract')?.matter.name
        : undefined,
    [foldable, scene.nodes],
  )
  return useMemo(
    () => ({
      bindings,
      label,
      nothingHeld,
      nothingSelected,
      cannotCarve: !canCarve(foldable),
      cannotNegate: !canNegate(foldable),
      allMarked: allNegative(foldable),
      matterName,
      foldable,
      cannotSeparate: !canSeparate(foldable),
      isolated: isolating(view.isolation),
      view,
    }),
    [bindings, label, nothingHeld, nothingSelected, foldable, matterName, view],
  )
}

/** Derives the toolbar once from the small pieces of scene/view state its buttons display. */
export function useSceneToolbarTools(
  scene: ReturnType<typeof sceneOf>,
  view: ReturnType<typeof sceneViewChromeOf>,
) {
  const facts = useToolbarFacts(scene, view)
  return useMemo(() => deriveSceneToolbarTools(facts), [facts])
}
