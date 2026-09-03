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
import { selectedNodes, type SceneState } from '@/engines/scene/sceneState'
import { displayOfPane } from '@/stores/sceneViews'
import { ADD_TOOLS, SCENE_TOOLS } from '@/features/scene/components/Scene/sceneTools'

type Options = {
  scene: SceneState
  view: {
    snapping: Parameters<typeof isSnapping>[0]
    projection: 'perspective' | 'orthographic'
    skeletons: boolean
    poseMode: boolean
    quad: boolean
    quadEdges: boolean
    displays: Parameters<typeof displayOfPane>[0]
  }
  bindings: Parameters<typeof bindingOf>[1]
  label: (binding: ReturnType<typeof bindingOf>) => string
  localFrame: boolean
  nothingHeld: boolean
  isolated: boolean
}

export function useSceneDocumentTools(options: Options) {
  const { scene, view, bindings, label, localFrame, nothingHeld, isolated } = options
  const foldable = useMemo(
    () => selectedNodes(scene.nodes, scene.selectedIds),
    [scene.nodes, scene.selectedIds],
  )
  const cannotCarve = !canCarve(foldable)
  const cannotNegate = !canNegate(foldable)
  const allMarked = allNegative(foldable)
  const matterName = useMemo(
    () =>
      canCarve(foldable)
        ? carvePlan(carveScene(foldable, scene.nodes), 'subtract')?.matter.name
        : undefined,
    [foldable, scene.nodes],
  )
  const cannotSeparate = !canSeparate(foldable)

  return useMemo(() => {
    const pressed: Partial<Record<CommandId, boolean>> = {
      'scene.snap': isSnapping(view.snapping),
      'scene.space': localFrame,
      'scene.projection': view.projection === 'orthographic',
      'scene.skeletons': view.skeletons,
      'scene.poseMode': view.poseMode,
      'scene.quad': view.quad,
      'scene.quadEdges': view.quadEdges,
      'scene.isolate': isolated,
      'scene.negate': allMarked,
    }
    const nothingSelected = scene.selectedIds.length === 0
    const unavailable: Partial<Record<CommandId, boolean>> = {
      'scene.delete': nothingSelected,
      'scene.duplicate': nothingSelected,
      'scene.group': nothingSelected,
      'scene.copy': nothingSelected,
      'scene.cut': nothingSelected,
      'scene.paste': nothingHeld,
      'scene.frame': nothingSelected,
      'scene.frameFollow': nothingSelected,
      'scene.isolate': nothingSelected && !isolated,
      'scene.hide': nothingSelected,
      'scene.showAll': !isolated,
      'scene.negate': cannotNegate,
      'scene.carve': cannotCarve,
      'scene.weld': cannotCarve,
      'scene.intersect': cannotCarve,
      'scene.separate': cannotSeparate,
      'scene.invertCarve': !canInvertCarve(foldable),
    }
    return [
      ...ADD_TOOLS,
      ...SCENE_TOOLS.map(tool => ({
        ...tool,
        shortcut: label(bindingOf(tool.command, bindings)),
        activeMode: tool.id === 'display' ? displayOfPane(view.displays, 0) : undefined,
        disabled: unavailable[tool.command],
        pressed: pressed[tool.command],
        ...(tool.command === 'scene.carve' && matterName
          ? { descriptionKey: 'sceneTools.carveOnHint', descriptionValues: { name: matterName } }
          : {}),
        ...(tool.id === 'isolate' && isolated
          ? {
              labelKey: 'sceneTools.leaveIsolation',
              descriptionKey: 'sceneTools.leaveIsolationHint',
            }
          : {}),
      })),
    ]
  }, [
    allMarked,
    bindings,
    cannotCarve,
    cannotNegate,
    cannotSeparate,
    foldable,
    isolated,
    label,
    localFrame,
    matterName,
    nothingHeld,
    scene.selectedIds.length,
    view,
  ])
}
