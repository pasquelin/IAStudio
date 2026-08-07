import { mdiCubeOutline, mdiWeatherSunny } from '@mdi/js'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TextureLoader, type Texture } from 'three'
import type { AdjustmentStack } from '@shared/domain/adjustments'
import type { SphericalAngles } from '@shared/domain/angles'
import {
  createSkyboxContent,
  DEFAULT_FIELD_OF_VIEW,
  MAX_FIELD_OF_VIEW,
  MIN_FIELD_OF_VIEW,
  SKYBOX_VIEWS,
  type SkyboxView,
} from '@shared/domain/skybox'
import { EmptyState } from '@/design/EmptyState'
import { ToolButton } from '@/design/ToolButton'
import { setAdjustment, setSunAngles } from '@/engines/skybox/commands'
import { SkyboxRenderer } from '@/engines/skybox/SkyboxRenderer'
import { cn } from '@/helpers/cn'
import { skyboxOf, useSkyboxes } from '@/stores/skyboxes'
import { AdjustmentSliders } from './AdjustmentSliders'

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

  const store = useSkyboxes.getState.bind(useSkyboxes)

  const onAdjust = useCallback(
    (key: keyof AdjustmentStack, value: number) =>
      store().runCommand(documentId, setAdjustment(key, value)),
    [documentId, store],
  )

  return (
    <div className="flex size-full flex-col">
      <div className="relative min-h-0 flex-1">
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
              className={cn(
                'h-(--sc-control) cursor-pointer rounded-(--radius-sc-sm) border-none px-2 text-xs',
                view === candidate ? 'bg-elevated text-text' : 'text-muted bg-transparent',
              )}
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
      </div>

      {/* Under the viewport, not beside it: grading is done while looking at the result. */}
      <div className="border-border bg-base flex shrink-0 flex-col gap-1 border-t px-2 py-1">
        <AdjustmentSliders
          adjustments={content.adjustments}
          onChange={onAdjust}
          onGestureStart={() => store().beginGesture(documentId)}
          onGestureEnd={() => store().endGesture(documentId)}
        />
      </div>
    </div>
  )
}
