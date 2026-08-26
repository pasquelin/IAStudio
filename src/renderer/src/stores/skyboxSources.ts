import { useEffect } from 'react'
import { skyboxFromPayload } from '@/app/skyboxDocument'
import { skySourceUri } from '@/engines/skybox/gltfSky'
import type { SkyboxContent } from '@shared/domain/skybox'
import { createDocumentSource } from './documentSource'
import { PATH_RESOLVERS } from './pathResolvers'
import { skyboxOf, skyboxStore, useSkyboxes } from './skyboxes'

/**
 * The skies a scene is lit by, whose document is no tab's. Deliberately NOT written back to:
 * nothing here edits a sky.
 */
const skies = createDocumentSource({
  kind: 'skybox',
  // The very reader an open tab comes through: a sky's `.gltf` names its picture by a path beside
  // the document, which only that reader resolves.
  parse: skyboxFromPayload,
  // The file NAMES a picture and the read found none: the catalogue had not landed. Rare, and
  // measured — a sky OUR studio wrote carries the asset id in `extras`, so only one written
  // elsewhere depends on the path resolving.
  whole: (state, payload) => !skySourceUri(payload) || state.source !== null,
  ...PATH_RESOLVERS,
})

/**
 * The sky a scene should be lit by: the open tab's, the copy read off disk, or `null`. A plain
 * function over both stores rather than a hook — engines subscribe to nothing.
 */
export function litSkyOf(skyId: string): SkyboxContent | null {
  const open = useSkyboxes.getState()
  if (skyboxStore.hasState(open, skyId)) {
    // The copy is dropped while a tab holds the document, so closing that tab re-reads the file
    // rather than falling back on what was on disk before it was edited.
    skies.forget(skyId)
    return skyboxOf(open, skyId)
  }

  return skies.copyOf(skyId)
}

/** Reads a sky a scene names but no tab holds. Once per document. */
export const loadSkySource = skies.load

/** Every landing of a read, so a viewport can light again what it had to leave in the studio. */
export const onSkiesRead = skies.subscribe

/**
 * The sky a document id names, as a PANEL reads it: the open tab's, the copy read off disk, or
 * `null`. The reactive half of `litSkyOf`, which engines call and which subscribes to nothing.
 */
export function useSkySource(skyId: string): SkyboxContent | null {
  const open = useSkyboxes(state =>
    skyboxStore.hasState(state, skyId) ? skyboxOf(state, skyId) : null,
  )
  // Whether a TAB holds it, never the tab's CONTENT: the effect below would otherwise tear down
  // and set up again on every value a drag emits in that tab.
  const held = open !== null
  const copy = skies.useCopyOf(skyId)

  // In an effect, never during the render: reading a file is not something a paint does. And not
  // for an EMPTY slot, which names no document — the read would fail and file a line saying so.
  // `copy` too, as `useWornMaterial` keeps it: an engine that throws a copy away changes the store
  // without changing `held`, and without this the panel would never ask for the file again.
  useEffect(() => {
    if (!held && skyId) void loadSkySource(skyId)
  }, [skyId, held, copy])

  return open ?? copy
}
