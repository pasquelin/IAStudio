import { mdiCubeOutline } from '@mdi/js'
import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { SphericalAngles } from '@shared/domain/angles'
import { PICTURES, type Asset } from '@shared/domain/asset'
import { safeFileName } from '@shared/domain/texture-export'
import { EmptyState } from '@/design/EmptyState'
import { getBridge } from '@/services/bridge'
import { reportFailure } from '@/services/diagnostics'
import { setSunAngles } from '@/engines/skybox/commands'
import { loadTexture } from '@/engines/scene/texture-cache'
import { SkyboxRenderer } from '@/engines/skybox/SkyboxRenderer'
import { AssetDropTarget } from '@/design/AssetDropTarget'
import { setSkyboxSource, skyboxOf, useSkyboxes } from '@/stores/skyboxes'
import { useDocuments } from '@/stores/documents'
import { useSkyboxViews, skyboxViewOf } from '@/stores/skybox-views'
import { useRestoredDocument } from '@/hooks/useRestoredDocument'
import { useShortcuts } from '@/hooks/useShortcuts'
import type { CommandId } from '@shared/domain/command'

/**
 * A sky handed to an engine as six faces, from the row of the native menu that was picked.
 *
 * The port is reached through `import()` rather than at the top of this file, for the chunk that
 * follows the first screen: statically imported, the export pass would be downloaded by anyone
 * who opens a sky, and it is only ever read by somebody who exports one.
 */
async function exportSkybox(documentId: string, size: number): Promise<void> {
  const bridge = getBridge()
  if (!bridge) return

  try {
    // Read once, before any `await`. Read twice — the picture here and the grading after the
    // `import()` — and a slider moved while the chunk downloads would export one sky's pixels
    // under another sky's settings, with nothing in the six files to say so.
    const sky = skyboxOf(useSkyboxes.getState(), documentId)

    // Guarded before the dialog: a sky with no picture would open a folder chooser to write six
    // files of nothing, and the message belongs where the gesture was made.
    if (!sky.source) throw new Error('this sky has no source to export')

    // Cleaned before it is either a folder or a file name: a document is titled by hand.
    const name = safeFileName(useDocuments.getState().documents[documentId]?.title ?? 'skybox')

    const { createSkyboxExportPort } = await import('@/engines/skybox/export-port')

    const files = await createSkyboxExportPort({ loadTexture })({
      assetId: sky.source.assetId,
      adjustments: sky.adjustments,
      name,
      size,
    })

    await bridge.skybox.export({ folder: name, files })
  } catch (error) {
    reportFailure('skybox.export', String(size), error)
  }
}

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
  const { fieldOfView, probes, view } = useSkyboxViews(state => skyboxViewOf(state, documentId))

  useRestoredDocument(documentId)

  // Only while this tab is in front. The event goes to the window, not to a document, so two
  // open skies would otherwise both answer one click of the same menu row — and both would open
  // a folder dialog.
  useEffect(() => {
    const bridge = getBridge()
    if (!bridge || !active) return

    return bridge.menu.onSkyboxExport(({ size }) => {
      void exportSkybox(documentId, size)
    })
  }, [documentId, active])

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

  useEffect(() => {
    engine.current?.setView(view)
  }, [view])

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
          return views.set(documentId, { probes: !skyboxViewOf(views, documentId).probes })
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
