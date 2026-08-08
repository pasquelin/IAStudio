import { embeddedFontOf, embeddedFontUrl, type FontRef } from '@shared/domain/font'
import { createFontLibrary, type FontLibrary, type FontSource } from '@/engines/core/fonts'
import { getBridge } from './bridge'

/**
 * Where the studio's typefaces actually come from: its own folder for a face it ships, and across
 * the boundary for one the machine has installed — the renderer has no filesystem, and never will.
 *
 * Here rather than in `engines/core`, which holds the library itself: an engine reaches for no
 * boundary of its own, exactly as `SceneRenderer` takes its mesh loader rather than building one.
 */
export const bridgeFonts: FontSource = {
  installed: async () => (await getBridge()?.fonts.list()) ?? [],

  bytes: async (ref: FontRef) => {
    if (ref.source === 'system') return (await getBridge()?.fonts.read(ref.family)) ?? null

    const embedded = embeddedFontOf(ref.family)
    if (!embedded) return null

    const response = await fetch(embeddedFontUrl(embedded.file))
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)

    return new Uint8Array(await response.arrayBuffer())
  },
}

/**
 * The one library the workspaces share, so a face is parsed once for the whole studio. Engines
 * take it as an option, the way they take a loader.
 */
export const studioFonts: FontLibrary = createFontLibrary(bridgeFonts)
