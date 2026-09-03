import { useCallback, type RefObject } from 'react'
import type { CommandId } from '@shared/domain/command'
import { DEFAULT_CAPTURE_QUALITY } from '@shared/domain/sceneCapture'
import { isDisplayMode } from '@shared/domain/scene'
import type { TransformMode } from '@/engines/scene/SceneRenderer'
import type { SceneRenderer } from '@/engines/scene/SceneRenderer'
import { nextDisplayMode } from '@/engines/scene/sceneView'
import { displayOfPane, sceneViewOf, useSceneViews } from '@/stores/sceneViews'
import { captureSceneView } from '@/helpers/captureSceneView'
import { addNodeTo } from '@/hooks/useAddNode'
import { runSceneCommand } from '@/features/scene/components/sceneCommands'
import { addedKind } from '@/features/scene/components/Scene/sceneTools'

type SceneCommandView = {
  skeletons: boolean
  poseMode: boolean
  quad: boolean
  quadEdges: boolean
  projection: 'perspective' | 'orthographic'
}

type Options = {
  documentId: string
  engine: RefObject<SceneRenderer | null>
  view: SceneCommandView
  setMode: (mode: TransformMode) => void
  setNavigating: (change: boolean | ((current: boolean) => boolean)) => void
  setLocalFrame: (change: (current: boolean) => boolean) => void
  changeIsolation: (command: 'isolate' | 'hide' | 'showAll') => void
  openAddMenu: () => void
}

export function useSceneDocumentCommands(options: Options) {
  const {
    documentId,
    engine,
    view,
    setMode,
    setNavigating,
    setLocalFrame,
    changeIsolation,
    openAddMenu,
  } = options
  const paneInHand = useCallback(() => engine.current?.activePane() ?? 0, [engine])
  const armTool = useCallback(
    (tool: TransformMode) => {
      setNavigating(false)
      setMode(tool)
    },
    [setMode, setNavigating],
  )
  const cycleDisplay = useCallback(() => {
    const pane = paneInHand()
    const displays = sceneViewOf(useSceneViews.getState(), documentId).displays
    useSceneViews
      .getState()
      .setDisplay(documentId, pane, nextDisplayMode(displayOfPane(displays, pane)))
  }, [documentId, paneInHand])

  const run = useCallback(
    (command: CommandId) => {
      const shared = runSceneCommand(documentId, command)
      if (shared !== false) return shared
      if (command === 'scene.select') return armTool('select')
      if (command === 'scene.translate') return armTool('translate')
      if (command === 'scene.rotate') return armTool('rotate')
      if (command === 'scene.scale') return armTool('scale')
      if (command === 'scene.snap') return useSceneViews.getState().toggleSceneSnapping(documentId)
      if (command === 'scene.isolate') return changeIsolation('isolate')
      if (command === 'scene.hide') return changeIsolation('hide')
      if (command === 'scene.showAll') return changeIsolation('showAll')
      if (command === 'scene.space') return setLocalFrame(current => !current)
      if (command === 'scene.navigate') return setNavigating(current => !current)
      if (command === 'scene.display') return cycleDisplay()
      if (command === 'scene.capture')
        return void captureSceneView(documentId, DEFAULT_CAPTURE_QUALITY)
      if (command === 'scene.skeletons')
        return useSceneViews.getState().setSkeletons(documentId, !view.skeletons)
      if (command === 'scene.poseMode')
        return useSceneViews.getState().setPoseMode(documentId, !view.poseMode)
      if (command === 'scene.quad') return useSceneViews.getState().setQuad(documentId, !view.quad)
      if (command === 'scene.quadEdges')
        return useSceneViews.getState().setQuadEdges(documentId, !view.quadEdges)
      if (command === 'scene.projection') {
        const projection = view.projection === 'perspective' ? 'orthographic' : 'perspective'
        return useSceneViews.getState().setProjection(documentId, projection)
      }
      if (command === 'scene.add' && !engine.current?.flightHeld) return openAddMenu()
    },
    [
      armTool,
      changeIsolation,
      cycleDisplay,
      documentId,
      engine,
      openAddMenu,
      setLocalFrame,
      setNavigating,
      view,
    ],
  )

  const runMode = useCallback(
    (toolId: string, modeId: string) => {
      const added = addedKind(toolId, modeId)
      if (added) return addNodeTo(documentId, added)
      if (isDisplayMode(modeId))
        useSceneViews.getState().setDisplay(documentId, paneInHand(), modeId)
    },
    [documentId, paneInHand],
  )
  return { run, runMode }
}
