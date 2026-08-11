/**
 * What the studio redistributes, and under which terms. Written by `pnpm licences:collect`
 * into `shared/licences.json`, read by the window the Help menu opens.
 *
 * Attribution is the obligation every one of these licences shares — MIT, Apache-2.0, BSD and
 * the LGPL all ask for the notice to travel with the binary. FFmpeg is the one that asks for
 * more: `sources` carries where its corresponding source lives.
 */
export type Licence = {
  name: string
  /**
   * As the package numbers itself. Absent for what ships without a number of its own — the
   * window then says so in the reader's language, which a sentence written here could not.
   */
  version?: string
  /** SPDX identifier as the package declares it, or `UNKNOWN` when it declares none. */
  spdx: string
  /** Full licence text, so the window is the notice rather than a link to it. */
  text: string
  /**
   * Where the corresponding sources are — a URL, never a sentence about one. The window draws a
   * translated label around it; prose written here would reach a French reader in English, and
   * no guard reads a generated JSON.
   */
  sources?: string
  /** Whether that source is the very version shipped, untouched — the offer copyleft asks for. */
  unmodified?: boolean
}

/**
 * What `THIRD-PARTY-NOTICES.md` writes where a component has no version of its own.
 *
 * English, and rightly so: that file addresses whoever arrives from outside the repository. The
 * window says the same thing from a bundle, in the reader's language — `licences.bundled`. Here
 * so the script that writes the file and the test that reads it share one definition; the two
 * drifted the day a sentence lived in only one of them.
 */
export const NO_VERSION = 'shipped with the application'

/**
 * Whether these terms oblige us to say where the source is, and not merely to carry the notice.
 *
 * Shared with `collect-licences.mjs`, which applies it: one definition, or the test that guards
 * the rule drifts from the rule itself. Matched on the prefix so a version bump still answers.
 */
export function isCopyleft(spdx: string): boolean {
  return /^(MPL|LGPL|GPL|AGPL|EPL|CDDL|OSL|CeCILL)/.test(spdx)
}

export const LICENCES_ROUTE = 'licences'

export function isLicencesRoute(hash: string): boolean {
  return hash.replace(/^#/, '') === LICENCES_ROUTE
}
