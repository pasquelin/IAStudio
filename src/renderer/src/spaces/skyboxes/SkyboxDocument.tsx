import { mdiCubeOutline, mdiWeatherSunny } from '@mdi/js'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TextureLoader, type Texture } from 'three'
import type { SphericalAngles } from '@shared/domain/angles'
import {
  createSkyboxContent,
  DEFAULT_FIELD_OF_VIEW,
  MAX_FIELD_OF_VIEW,
  MIN_FIELD_OF_VIEW,
  SKYBOX_VIEWS,
  type SkyboxView,
} from '@shared/domain/skybox'
import { PICTURES, type Asset } from '@shared/domain/asset'
import { EmptyState } from '@/design/EmptyState'
import { ToolButton } from '@/design/ToolButton'
import { setSunAngles } from '@/engines/skybox/commands'
import { SkyboxRenderer } from '@/engines/skybox/SkyboxRenderer'
import { AssetDropTarget } from '@/design/AssetDropTarget'
import { chipSkin } from '@/design/styles'
import { setSkyboxSource, skyboxOf, useSkyboxes } from '@/stores/skyboxes'
import { useDocuments } from '@/stores/documents'
import { useShortcuts } from '@/hooks/useShortcuts'
import type { CommandId } from '@shared/domain/command'

/** i18n key of a view mode — never the label itself, as `SceneEntry` does for primitives. */
const VIEW_LABELS: Record<SkyboxView, string> = {
  immersive: 'skybox.viewImmersive',
  equirect: 'skybox.viewEquirect',
  cross: 'skybox.viewCross',
  faces: 'skybox.viewFaces',
}

/** jsdom decodes no image; the engine takes its loader as a port for exactly that reason. */
const loadTexture = (url: string): Promise<Texture> => new TextureLoader().loadAsync(url)

export function SkyboxDocument({ documentId }: { documentId: string }) {
  const { t } = useTranslation()
  const host = useRef<HTMLDivElement>(null)
  const engine = useRef<SkyboxRenderer | null>(null)

  const content = useSkyboxes(state => skyboxOf(state, documentId))
  // A hidden tab stays mounted: without this, two skies would answer the same key.
  const active = useDocuments(state => state.activeId === documentId)

  // Session state, not document state: how a sky is being looked at right now is not what it
  // is, and persisting it would make a reopened document argue with the window it opens in.
  const [view, setView] = useState<SkyboxView>('immersive')
  const [fieldOfView, setFieldOfView] = useState(DEFAULT_FIELD_OF_VIEW)
  // A skybox is judged by what it lights, not by its own picture — so the probes start on.
  const [probes, setProbes] = useState(true)

  useEffect(() => {
    useSkyboxes.getState().ensure(documentId, createSkyboxContent)
  }, [documentId])

  useEffect(() => {
    const element = host.current
    if (!element) return

    const renderer = new SkyboxRenderer({
      loadTexture,
      onSunChange: (angles: SphericalAngles) =>
        useSkyboxes.getState().runCommand(documentId, setSunAngles(angles)),
    })

    renderer.mount(element)
    engine.current = renderer
    return () => {
      renderer.dispose()
      engine.current = null
    }
  }, [documentId])

  // The engine holds no truth: every change is pushed back into it.
  useEffect(() => {
    engine.current?.apply(content)
  }, [content])

  useEffect(() => {
    engine.current?.setFieldOfView(fieldOfView)
  }, [fieldOfView])

  useEffect(() => {
    engine.current?.setProbesVisible(probes)
  }, [probes])

  const onDrop = (asset: Asset): void => setSkyboxSource(documentId, asset)

  /**
   * The keyboard this space never had. Its history existed and worked — the sun is moved by a
   * command — but nothing listened, so ⌘Z fell through to the platform and undid nothing at all.
   */
  const run = useCallback(
    (command: CommandId): void => {
      switch (command) {
        case 'skybox.view':
          // Cycles rather than one key per view: four modes, and a key each would spend four
          // letters on a space that has two other things to offer.
          return setView(current => {
            const next = SKYBOX_VIEWS.indexOf(current) + 1
            return SKYBOX_VIEWS[next % SKYBOX_VIEWS.length] ?? current
          })
        case 'skybox.probes':
          return setProbes(current => !current)
        case 'skybox.undo':
          return useSkyboxes.getState().undo(documentId)
        case 'skybox.redo':
          return useSkyboxes.getState().redo(documentId)
      }
    },
    [documentId],
  )

  useShortcuts({ scope: 'skybox', enabled: active, onCommand: run })

  return (
    <AssetDropTarget accepts={PICTURES} onDrop={onDrop} className="relative size-full">
      {/* The renderer makes its own canvas in here — see `ViewportEngine.mount`. */}
      <div ref={host} className="absolute inset-0" />

      {!content.source && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <EmptyState icon={mdiCubeOutline} message={t('skybox.noSource')} />
        </div>
      )}

      <div className="bg-base/80 absolute top-2 left-2 flex items-center gap-1 rounded-(--radius-sc-md) p-1">
        {SKYBOX_VIEWS.map(candidate => (
          <button
            key={candidate}
            type="button"
            onClick={() => setView(candidate)}
            aria-pressed={view === candidate}
            className={chipSkin(view === candidate)}
          >
            {t(VIEW_LABELS[candidate])}
          </button>
        ))}

        <ToolButton
          icon={mdiWeatherSunny}
          label={t('skybox.testObjects')}
          active={probes}
          onClick={() => setProbes(current => !current)}
        />

        <label className="text-muted flex items-center gap-1 pl-2 text-xs">
          {t('skybox.fieldOfView')}
          <input
            type="range"
            min={MIN_FIELD_OF_VIEW}
            max={MAX_FIELD_OF_VIEW}
            step={1}
            value={fieldOfView}
            onChange={event => setFieldOfView(Number(event.target.value))}
            className="accent-accent w-24"
          />
        </label>
      </div>
    </AssetDropTarget>
  )
}
