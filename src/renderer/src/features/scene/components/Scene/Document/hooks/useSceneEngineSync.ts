import { useEffect } from 'react'
import type { ExportFormat } from '@shared/domain/scene'
import type { SceneRenderer, TransformMode } from '@/engines/scene/SceneRenderer'
import { captureSceneView } from '@/helpers/captureSceneView'
import { useCheckerTextures } from '@/hooks/useCheckerTextures'
import { useExportMenu } from '@/hooks/useExportMenu'
import { useMaterialRefresh } from '@/hooks/useMaterialRefresh'
import { useShelfRefresh } from '@/hooks/useShelfRefresh'
import { useSkyRefresh } from '@/hooks/useSkyRefresh'
import { getBridge } from '@/services/bridge'
import { reportFailure } from '@/services/diagnostics'
import type { sceneOf } from '@/stores/scenes'
import { useSceneViews, type sceneViewChromeOf } from '@/stores/sceneViews'
import { sceneExportFiles } from '../sceneExportFiles'

async function exportScene(
  documentId: string,
  format: ExportFormat,
  scope: 'scene' | 'selection',
): Promise<void> {
  const bridge = getBridge()
  if (!bridge) return
  try {
    const { folder, files } = await sceneExportFiles(documentId, format, scope)
    const encoded = files[0]
    if (encoded) await bridge.scene.export({ name: folder, format, data: encoded.bytes })
  } catch (error) {
    reportFailure('scene.export', format, error)
  }
}

/** Pushes declarative document/view state into the live imperative renderer. */
export function useSceneEngineSync({
  engine,
  scene,
  viewport,
  view,
  mode,
  documentId,
  active,
}: {
  engine: { current: SceneRenderer | null }
  scene: ReturnType<typeof sceneOf>
  viewport: Parameters<SceneRenderer['configure']>[0]
  view: ReturnType<typeof sceneViewChromeOf>
  mode: TransformMode
  documentId: string
  active: boolean
}) {
  useSceneRendererState(engine, scene, viewport, view, mode, documentId)
  useSceneRendererResources(engine)
  useSceneDocumentExports(active, documentId)
}

function useSceneRendererResources(engine: { current: SceneRenderer | null }): void {
  useShelfRefresh(() => engine.current?.refreshTextures())
  useMaterialRefresh(materialIds => engine.current?.dressModels(materialIds))
  useSkyRefresh(() => engine.current?.lightAgain())
  useCheckerTextures()
}

function useSceneDocumentExports(active: boolean, documentId: string): void {
  useExportMenu(active, bridge =>
    bridge.menu.onSceneExport(({ format, scope }) => void exportScene(documentId, format, scope)),
  )
  useExportMenu(active, bridge =>
    bridge.menu.onSceneCapture(({ quality }) => void captureSceneView(documentId, quality)),
  )
}

function useSceneRendererState(
  engine: { current: SceneRenderer | null },
  scene: ReturnType<typeof sceneOf>,
  viewport: Parameters<SceneRenderer['configure']>[0],
  view: ReturnType<typeof sceneViewChromeOf>,
  mode: TransformMode,
  documentId: string,
): void {
  useEffect(() => engine.current?.apply(scene), [engine, scene])
  useEffect(() => engine.current?.configure(viewport), [engine, viewport])
  useEffect(() => engine.current?.setMode(mode), [engine, mode])
  useEffect(() => engine.current?.setSnapping(view.snapping), [engine, view.snapping])
  useEffect(() => engine.current?.setIsolation(view.isolation), [engine, view.isolation])
  useEffect(
    () => engine.current?.setSpace(view.localFrame ? 'local' : 'world'),
    [engine, view.localFrame],
  )
  useEffect(() => {
    engine.current?.setPoseMode(view.poseMode)
    if (!view.poseMode) {
      engine.current?.setPickedBone(null)
      useSceneViews.getState().setPickedBone(documentId, null)
    }
  }, [documentId, engine, view.poseMode])
  useEffect(() => engine.current?.setPickedBone(view.pickedBone), [engine, view.pickedBone])
  useEffect(
    () => engine.current?.setPickedPathPoint(view.pickedPathPoint),
    [engine, view.pickedPathPoint],
  )
  useEffect(() => engine.current?.setProjection(view.projection), [engine, view.projection])
  useEffect(
    () => engine.current?.setDisplayModes(view.displays, view.quadEdges),
    [engine, view.displays, view.quadEdges],
  )
  useEffect(() => engine.current?.setSkeletons(view.skeletons), [engine, view.skeletons])
  useEffect(() => engine.current?.setQuadView(view.quad), [engine, view.quad])
  useEffect(() => engine.current?.setPaneViews(view.panes), [engine, view.panes])
}
