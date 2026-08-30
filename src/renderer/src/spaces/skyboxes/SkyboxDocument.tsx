import { mdiCubeOutline } from '@mdi/js'
import { useCallback, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { SphericalAngles } from '@shared/domain/angles'
import type { SkyboxExportCommand } from '@shared/ipc'
import { PICTURES, type Asset } from '@shared/domain/asset'
import { EmptyState } from '@/design/EmptyState'
import { PANE_TOOLBAR } from '@/design/styles'
import { Toolbar } from '@/design/Toolbar/Toolbar'
import { setSunAngles } from '@/engines/skybox/commands'
import { loadTexture } from '@/engines/scene/textureCache'
import { SkyboxRenderer } from '@/engines/skybox/SkyboxRenderer'
import { AssetDropTarget } from '@/design/AssetDropTarget'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useExportMenu } from '@/hooks/useExportMenu'
import { isSkyboxDirty, setSkyboxSource, skyboxOf, useSkyboxes } from '@/stores/skyboxes'
import { useDocumentIsInFront } from '@/stores/documents'
import { useSkyboxViews, skyboxViewOf } from '@/stores/skyboxViews'
import { useRestoredDocument } from '@/hooks/useRestoredDocument'
import { useShelfRefresh } from '@/hooks/useShelfRefresh'
import { useShortcuts } from '@/hooks/useShortcuts'
import { assetVersionOf } from '@/stores/assets'
import { livePreviewOf } from '@/stores/livePreviews'
import { bindingOf, type CommandId } from '@shared/domain/command'
import { useShortcutLabel } from '@/hooks/useShortcutLabel'
import { useMountedEngine } from '@/hooks/useMountedEngine'
import { runDocumentExport } from '@/app/documentExport'
import { useBindingOverrides } from '@/stores/bindings'
import { skyboxExportFiles } from './skyboxExportFiles'
import { SKYBOX_TOOLS, skyboxViewFrom } from './skyboxTools'

/**
 * A sky handed to an engine as six faces, from the row of the native menu that was picked.
 *
 * The port is reached through `import()` rather than at the top of this file, for the chunk that
 * follows the first screen: statically imported, the export pass would be downloaded by anyone
 * who opens a sky, and it is only ever read by somebody who exports one.
 */
async function exportSkybox(documentId: string, command: SkyboxExportCommand): Promise<void> {
  await runDocumentExport(
    documentId,
    {
      kind: 'skybox',
      scope: 'skybox.export',
      label: command.kind === 'faces' ? String(command.size) : command.target,
    },
    // The rendering is `skyboxExportFiles`, which the outside door shares. A sky with no picture
    // throws THERE, before any dialog: a folder chooser opened to write six files of nothing is a
    // question nobody can answer.
    async (bridge, watch) =>
      bridge.skybox.export(await skyboxExportFiles(documentId, command, watch)),
  )
}

export function SkyboxDocument({ documentId }: { documentId: string }) {
  const { t } = useTranslation()

  const content = useSkyboxes(state => skyboxOf(state, documentId))
  const active = useDocumentIsInFront(documentId)

  // Held in a store rather than here: the controls that set these live in the View panel, and
  // the centre carries the toolbar and the rulers only. Session state all the same — none of it
  // is saved with the document, and ⌘Z never touches it.
  const { fieldOfView, probes, view } = useSkyboxViews(state => skyboxViewOf(state, documentId))
  const bindings = useBindingOverrides()
  const label = useShortcutLabel()

  useDocumentTitle(
    documentId,
    useSkyboxes(state => isSkyboxDirty(state, documentId)),
  )

  useRestoredDocument(documentId)

  useExportMenu(active, bridge =>
    bridge.menu.onSkyboxExport(command => {
      void exportSkybox(documentId, command)
    }),
  )

  const { host, engine } = useMountedEngine(
    documentId,
    () =>
      new SkyboxRenderer({
        loadTexture,
        assetVersion: assetVersionOf,
        livePreview: livePreviewOf,
        onSunChange: (angles: SphericalAngles) =>
          useSkyboxes.getState().runCommand(documentId, setSunAngles(angles)),
      }),
    content,
  )

  useShelfRefresh(() => engine.current?.refreshSource())

  useEffect(() => {
    engine.current?.setFieldOfView(fieldOfView)
  }, [fieldOfView, engine])

  useEffect(() => {
    engine.current?.setProbesVisible(probes)
  }, [probes, engine])

  useEffect(() => {
    engine.current?.setView(view)
  }, [view, engine])

  // The panel above this viewport drives the field of view with a slider, so this document
  // re-renders on every frame of that drag — the bar must not be rebuilt with it.
  const tools = useMemo(
    () =>
      SKYBOX_TOOLS.map(tool => ({
        ...tool,
        // Read off the registry rather than written on the button: a key remapped in the
        // settings has to move on the bar with it, as the two other bars already do.
        shortcut: label(bindingOf(tool.command, bindings)),
        activeMode: tool.id === 'view' ? view : undefined,
        pressed: tool.id === 'probes' ? probes : undefined,
      })),
    [view, probes, bindings, label],
  )

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

  useShortcuts({ scope: 'skybox', enabled: active, documentId, onCommand: run })

  return (
    <AssetDropTarget
      accepts={PICTURES}
      onDrop={onDrop}
      // No frame: see `ImageDocument`.
      outlined={false}
      className="relative size-full"
    >
      {/* The renderer makes its own canvas in here — see `ViewportEngine.mount`. */}
      <div ref={host} className="absolute inset-0" />

      {!content.source && (
        <div className="pointer-events-none absolute inset-0">
          <EmptyState icon={mdiCubeOutline} message={t('skybox.noSource')} />
        </div>
      )}

      <Toolbar
        className={PANE_TOOLBAR}
        tools={tools}
        onTool={id => {
          const command = SKYBOX_TOOLS.find(candidate => candidate.id === id)?.command
          if (command) run(command)
        }}
        onMode={(_toolId, modeId) => {
          const chosen = skyboxViewFrom(modeId)
          if (chosen) useSkyboxViews.getState().set(documentId, { view: chosen })
        }}
      />
    </AssetDropTarget>
  )
}
