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
  version: string
  /** SPDX identifier as the package declares it, or `UNKNOWN` when it declares none. */
  spdx: string
  /** Full licence text, so the window is the notice rather than a link to it. */
  text: string
  /** Where the corresponding sources are, for the copyleft ones that require the offer. */
  sources?: string
}

export const LICENCES_ROUTE = 'licences'

export function isLicencesRoute(hash: string): boolean {
  return hash.replace(/^#/, '') === LICENCES_ROUTE
}
