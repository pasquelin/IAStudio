import { useEffect } from 'react'
import type { SceneRenderer } from '@/engines/scene/SceneRenderer'
import type { sceneViewChromeOf } from '@/stores/sceneViews'

export function useSceneReliefState(
  engine: { current: SceneRenderer | null },
  view: ReturnType<typeof sceneViewChromeOf>,
): void {
  useEffect(() => engine.current?.setSculptMode?.(view.sculptMode), [engine, view.sculptMode])
  useEffect(() => engine.current?.setArmedRelief?.(view.armedRelief), [engine, view.armedRelief])
  useEffect(
    () => engine.current?.setSculptBrush?.(view.sculptRadius, view.sculptFalloff),
    [engine, view.sculptRadius, view.sculptFalloff],
  )
}
