import type { RefObject } from 'react'
import type { SceneRenderer, TransformMode } from '@/engines/scene/SceneRenderer'
import type { SceneStats } from '@/engines/scene/sceneStats'
import type { ScreenBox } from '@/engines/scene/marqueeSelection'
import type { PaneView } from '@/engines/scene/sceneView'
import type { Asset } from '@shared/domain/asset'
import type { CommandId } from '@shared/domain/command'
import type { ToolbarProps } from '@/components/Toolbar/Toolbar'
import type { SceneCamera } from '../PaneGrid/ScenePaneGridMenu'
import { AssetDropTarget } from '@/components/AssetDropTarget'
import { Toolbar } from '@/components/Toolbar/Toolbar'
import { PANE_TOOLBAR } from '@/components/styles'
import { SceneDocumentMarquee } from './SceneDocumentMarquee'
import { SceneClock } from '../SceneClock'
import { SceneCounters } from '../SceneCounters'
import { SceneSnapBar } from '../Snap/SceneSnapBar'
import { SceneNavigationHint } from '../SceneNavigationHint'
import { CameraPreview } from '../../Camera/CameraPreview'
import { ScenePaneGrid } from '../PaneGrid/ScenePaneGrid'
import { NAVIGATE_TOOL, SCENE_TOOLS } from '../sceneTools'

type Props = {
  documentId: string
  host: RefObject<HTMLDivElement | null>
  engine: RefObject<SceneRenderer | null>
  live: SceneRenderer | null
  duration: number
  stats: { scene: SceneStats; selected: SceneStats }
  marquee: ScreenBox | null
  flySpeed: number | null
  armed: boolean
  mode: TransformMode
  quad: boolean
  panes: readonly PaneView[]
  cameras: readonly SceneCamera[]
  tools: NonNullable<ToolbarProps['tools']>
  onDrop: (asset: Asset) => void
  onPaneView: (pane: number, chosen: PaneView) => void
  onCommand: (command: CommandId) => void
  onMode: (toolId: string, modeId: string) => void
}

export function SceneDocumentView({
  documentId,
  host,
  engine,
  live,
  duration,
  stats,
  marquee,
  flySpeed,
  armed,
  mode,
  quad,
  panes,
  cameras,
  tools,
  onDrop,
  onPaneView,
  onCommand,
  onMode,
}: Props) {
  return (
    <AssetDropTarget
      accepts={['mesh']}
      onDrop={onDrop}
      outlined={false}
      className="relative size-full"
    >
      <div ref={host} tabIndex={-1} className="absolute inset-0 outline-none" />
      <SceneDocumentMarquee box={marquee} />
      <SceneClock documentId={documentId} duration={duration} renderer={live} />
      <SceneCounters scene={stats.scene} selected={stats.selected} />
      <SceneSnapBar
        documentId={documentId}
        speed={flySpeed}
        onSpeed={speed => engine.current?.setFlySpeed(speed)}
      />
      {armed && <SceneNavigationHint speed={flySpeed} />}
      <CameraPreview documentId={documentId} />
      {quad && <ScenePaneGrid views={panes} cameras={cameras} onView={onPaneView} />}
      <Toolbar
        className={PANE_TOOLBAR}
        tools={tools}
        activeTool={armed ? NAVIGATE_TOOL : mode}
        onTool={id => {
          const command = SCENE_TOOLS.find(candidate => candidate.id === id)?.command
          if (command) onCommand(command)
        }}
        onMode={onMode}
      />
    </AssetDropTarget>
  )
}
