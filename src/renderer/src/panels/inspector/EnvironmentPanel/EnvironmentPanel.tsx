import type { DisplayMode, SceneWorld } from '@shared/domain/scene'
import { setWorld } from '@/engines/scene/commands'
import type { Isolation } from '@/engines/scene/isolation'
import type { SceneNode } from '@/engines/scene/sceneState'
import { useSceneEdit } from '@/hooks/useSceneEdit'
import { useViewportSetting } from '@/hooks/useViewportSetting'
import { EnvironmentAtmosphereSection } from './EnvironmentAtmosphereSection'
import { EnvironmentBackgroundSection } from './EnvironmentBackgroundSection'
import { EnvironmentDisplaySection } from './EnvironmentDisplaySection'
import { EnvironmentGroundSection } from './EnvironmentGroundSection'
import { EnvironmentHelpersSection } from './EnvironmentHelpersSection'
import { EnvironmentLightingSection } from './EnvironmentLightingSection'
import { EnvironmentRenderSection } from './EnvironmentRenderSection'
import { EnvironmentShadowsSection } from './EnvironmentShadowsSection'
import { EnvironmentSnapSection } from './EnvironmentSnapSection'
import { EnvironmentVisibilitySection } from './EnvironmentVisibilitySection'

export type EnvironmentPanelProps = {
  documentId: string
  world: SceneWorld
  nodes: readonly SceneNode[]
  selectedIds: readonly string[]
  /** The mode of the view being worked in — one per pane, and this is the one in hand. */
  mode: DisplayMode
  onMode: (mode: DisplayMode) => void
  skeletons: boolean
  onSkeletons: (skeletons: boolean) => void
  snapping: boolean
  onSnapping: (snapping: boolean) => void
  isolation: Isolation
  onIsolation: (isolation: Isolation) => void
}

/**
 * How a scene is LIT and how it is LOOKED AT — two questions with two lifetimes, which is why
 * the document goes through a command, the person's own settings through `useViewportSetting`,
 * and the moment through `sceneViews`. No section here touches three.js.
 */
export function EnvironmentPanel({
  documentId,
  world,
  nodes,
  selectedIds,
  mode,
  onMode,
  skeletons,
  onSkeletons,
  snapping,
  onSnapping,
  isolation,
  onIsolation,
}: EnvironmentPanelProps) {
  const edit = useSceneEdit(documentId)
  const viewport = useViewportSetting()

  const change = (patch: Partial<SceneWorld>): void => edit.run(setWorld(patch))

  return (
    <>
      <EnvironmentDisplaySection mode={mode} onMode={onMode} world={world} onPreset={change} />

      <EnvironmentVisibilitySection
        documentId={documentId}
        nodes={nodes}
        selectedIds={selectedIds}
        isolation={isolation}
        onIsolation={onIsolation}
      />

      <EnvironmentLightingSection world={world} onChange={change} gesture={edit.gesture} />

      <EnvironmentBackgroundSection world={world} onChange={change} gesture={edit.gesture} />

      <EnvironmentGroundSection
        world={world}
        onChange={change}
        showGrid={viewport.view.showGrid}
        gridSize={viewport.view.gridSize}
        onViewport={viewport.set}
        gesture={edit.gesture}
      />

      <EnvironmentHelpersSection
        view={viewport.view}
        onViewport={viewport.set}
        skeletons={skeletons}
        onSkeletons={onSkeletons}
        gesture={edit.gesture}
      />

      <EnvironmentSnapSection
        view={viewport.view}
        onViewport={viewport.set}
        snapping={snapping}
        onSnapping={onSnapping}
      />

      <EnvironmentShadowsSection view={viewport.view} onViewport={viewport.set} />

      <EnvironmentAtmosphereSection world={world} onChange={change} gesture={edit.gesture} />

      <EnvironmentRenderSection
        world={world}
        onChange={change}
        view={viewport.view}
        onViewport={viewport.set}
        gesture={edit.gesture}
      />
    </>
  )
}
