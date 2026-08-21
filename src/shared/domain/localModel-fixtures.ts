import type { LocalModel } from './localModel'

/** The unit `formatBytes` counts in, so a size written here reads back as a round figure. */
export const GIBI = 1024 * 1024 * 1024

/** A manifest that passes the whitelist, for a suite that cares about one field of it. */
export function localModel(over: Partial<LocalModel> = {}): LocalModel {
  return {
    id: 'parakeet',
    name: 'Parakeet',
    format: 'onnx',
    loader: 'sherpa-onnx',
    rank: 1,
    licence: 'Apache-2.0',
    licenceUrl: 'https://example.invalid/licence',
    source: 'https://example.invalid/model',
    files: [{ role: 'encoder', name: 'e.onnx', url: 'https://x/e', bytes: GIBI, sha256: 'a' }],
    diskBytes: GIBI,
    reservationBytes: 2 * GIBI,
    ...over,
  }
}
