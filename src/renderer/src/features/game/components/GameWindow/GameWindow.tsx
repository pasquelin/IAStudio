import { mdiGamepadVariantOutline } from '@mdi/js'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { RuntimeReport } from '@shared/domain/gameRuntime'
import { EmptyState } from '@/components/EmptyState'
import { SceneRenderer } from '@/engines/scene/SceneRenderer'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { environmentDressOf } from '@/features/skybox/components/environmentDress'
import { wornModelDress } from '@/features/material/modelDress'
import { createGameStage } from '@/game/gameStage'
import { assetVersionOf } from '@/stores/assets'
import { useProject } from '@/stores/project'
import { GameWindowDebug } from './GameWindowDebug'

/**
 * A scene played as a game, alone in a window of its own. It holds an ENGINE of its own — a WebGL
 * context never crosses a window — and replays the scene the studio publishes on `gameChannel`.
 */
export function GameWindow() {
  const { t } = useTranslation()
  const hostRef = useRef<HTMLDivElement>(null)
  const [report, setReport] = useState<RuntimeReport | null>(null)

  useEffect(() => {
    const element = hostRef.current
    if (!element) return

    // 🛑 The project, and not just the scene: a model wears the material and the sky of OTHER
    // documents, and the ports that read them walk this window's own stores. Without it a game
    // draws every model in its raw file dress.
    const leaving = useProject.getState().connect()

    const renderer = new SceneRenderer({
      // A game is played, never picked: nothing here selects, transforms or opens a menu.
      onSelect: () => {},
      onTransform: () => {},
      chrome: false,
      assetVersion: assetVersionOf,
      wornDress: wornModelDress,
      environmentDress: environmentDressOf,
    })
    renderer.mount(element)
    // A game wants the scene, not the workshop it was built in. `chrome: false` above holds the
    // furniture the settings cannot reach — bodies, frustums, rails; these three are the ones a
    // person can turn on, and a game must not inherit them from the studio's preferences.
    renderer.configure({
      ...DEFAULT_SETTINGS.three,
      showGrid: false,
      lightHelpers: 'off',
      cameraHelpers: 'off',
      boundingBoxes: 'off',
    })

    // 🛑 Aimed ONCE per game: nothing here ever dragged a viewport, so without it the window
    // opens on the engine's default angle — and re-aiming per frame makes the camera chase a
    // walking character's bounding box, so the picture breathes with every step.
    let framed = false

    // The WINDOW, not the host: a game window is all game, and a key pressed anywhere in it is
    // meant for the game — where the studio had to hand over a focusable div beside its panels.
    const stage = createGameStage({
      renderer,
      input: window,
      onReport: one => {
        setReport(one)
        if (one === null) framed = false
        // Answers false while the models are still landing, which is what lets this keep asking.
        else if (!framed) framed = renderer.frameContents()
      },
    })

    return () => {
      stage.close()
      renderer.dispose()
      void leaveProject(leaving)
    }
  }, [])

  return (
    <div className="bg-monitor relative h-full w-full">
      <div ref={hostRef} className="absolute inset-0" />
      {report === null && (
        <div className="pointer-events-none absolute inset-0">
          <EmptyState icon={mdiGamepadVariantOutline} message={t('game.window.waiting')} />
        </div>
      )}
      {report !== null && <GameWindowDebug report={report} />}
    </div>
  )
}

/** The unsubscribe the connection answers with, awaited where a teardown cannot be async. */
async function leaveProject(leaving: Promise<() => void>): Promise<void> {
  // Swallowed with a reason: the window is going away, and a project read that never answered has
  // nothing left to unsubscribe from.
  try {
    ;(await leaving)()
  } catch {
    /* the connection never landed */
  }
}
