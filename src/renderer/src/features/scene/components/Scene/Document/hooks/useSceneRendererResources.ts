import type { SceneRenderer } from '@/engines/scene/SceneRenderer'
import { useCheckerTextures } from '@/hooks/useCheckerTextures'
import { useMaterialRefresh } from '@/hooks/useMaterialRefresh'
import { useShelfRefresh } from '@/hooks/useShelfRefresh'
import { useSkyRefresh } from '@/hooks/useSkyRefresh'

export function useSceneRendererResources(engine: { current: SceneRenderer | null }): void {
  useShelfRefresh(() => engine.current?.refreshTextures())
  useMaterialRefresh(materialIds => engine.current?.dressModels(materialIds))
  useSkyRefresh(() => engine.current?.lightAgain())
  useCheckerTextures()
}
