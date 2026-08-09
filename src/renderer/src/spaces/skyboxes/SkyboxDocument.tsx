import { mdiCubeOutline } from '@mdi/js'
import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { TextureLoader, type Texture } from 'three'
import type { SphericalAngles } from '@shared/domain/angles'
import { PICTURES, type Asset } from '@shared/domain/asset'
import { EmptyState } from '@/design/EmptyState'
import { setSunAngles } from '@/engines/skybox/commands'
import { SkyboxRenderer } from '@/engines/skybox/SkyboxRenderer'
import { AssetDropTarget } from '@/design/AssetDropTarget'
import { setSkyboxSource, skyboxOf, useSkyboxes } from '@/stores/skyboxes'
import { useDocuments } from '@/stores/documents'
import { useSkyboxViews, viewOf } from '@/stores/skybox-views'
import { useRestoredDocument } from '@/hooks/useRestoredDocument'
import { useShortcuts } from '@/hooks/useShortcuts'
import type { CommandId } from '@shared/domain/command'

/** jsdom decodes no image; the engine takes its loader as a port for exactly that reason. */
const loadTexture = (url: string): Promise<Texture> => new TextureLoader().loadAsync(url)

export function SkyboxDocument({ documentId }: { documentId: string }) {
  const { t } = useTranslation()
  const host = useRef<HTMLDivElement>(null)
  const engine = useRef<SkyboxRenderer | null>(null)

  const content = useSkyboxes(state => skyboxOf(state, documentId))
  // A hidden tab stays mounted: without this, two skies would answer the same key.
  const active = useDocuments(state => state.activeId === documentId)

  // Held in a store rather than here: the controls that set these live in the View panel, and
  // the centre carries the toolbar and the rulers only. Session state all the same — none of it
  // is saved with the document, and ⌘Z never touches it.
  const { fieldOfView, probes } = useSkyboxViews(state => viewOf(state, documentId))

  useRestoredDocument(documentId)

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
          return useSkyboxViews.getState().cycleView(documentId)
        case 'skybox.probes': {
          const views = useSkyboxViews.getState()
          return views.set(documentId, { probes: !viewOf(views, documentId).probes })
        }
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
    </AssetDropTarget>
  )
}
