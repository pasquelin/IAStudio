/**
 * What a local model declares about itself — see
 * `docs/ci/adr/ADR-20-surface-de-confiance-des-poids.md`.
 *
 * The ancestor of this type is `SttModelFile`, which carried role, name, url, bytes and digest and
 * NOT the three things that decide whether a model may be loaded at all: its format, its loader,
 * and its licence.
 */

/** Formats the studio can be handed. Whether one may be LOADED depends on the loader — see `admitsLoad`. */
export type ModelFormat = 'safetensors' | 'gguf' | 'onnx' | 'pickle'

/** What opens the weights. The pair, not the format, is what the whitelist is written on. */
export type ModelLoader = 'sherpa-onnx' | 'ollama' | 'llamacpp'

/**
 * Where the manifest came from, which is what decides how much the studio vouches for it.
 *
 * 1 — shipped with the application, versioned with the binary.
 * 2 — served by an endpoint the studio names. `[?]` None exists today.
 * 3 — supplied by the person, and installing it is an EXPLICIT action, never the consequence of
 *     a click on "Install".
 */
export type ProvenanceRank = 1 | 2 | 3

export type ModelFile = {
  /** What the loader asks for — `encoder`, `tokens`. Named so nothing spells file names twice. */
  readonly role: string
  readonly name: string
  readonly url: string
  readonly bytes: number
  readonly sha256: string
}

export type LocalModel = {
  readonly id: string
  /**
   * `name` rather than `title`, and the guard's own reason applies: this is DOCUMENT DATA, not a
   * word of the interface. A model is called what its publisher calls it, in every language.
   */
  readonly name: string
  readonly format: ModelFormat
  readonly loader: ModelLoader
  readonly rank: ProvenanceRank
  /** SPDX identifier. The licence travels WITH the weights — ADR-20 § E. */
  readonly licence: string
  readonly licenceUrl: string
  /** Where the weights are published, for the attribution the licence may ask for. */
  readonly source: string
  readonly files: readonly ModelFile[]
  /**
   * What it is expected to take once loaded. A RESERVATION, never a measured peak — R3 of ADR-19.
   *
   * Measured 2026-08-21 on the case that proves the gap: `llama3.2:3b` weighs 2.02 GB on disk and
   * the runtime reports 4.03 GB loaded, 8.21 GB at a 8192 context.
   */
  readonly reservationBytes: number
}

/** What the files weigh on disk, which is what a download has to fetch. */
export function downloadBytesOf(model: LocalModel): number {
  return model.files.reduce((total, file) => total + file.bytes, 0)
}

/** Bytes across the whole model, not within the file being fetched. */
export type DownloadProgress = { received: number; total: number }

/** Suffix of a download in flight. An orphan is kept, not swept: a resume starts from it. */
export const PART_SUFFIX = '.part'

/**
 * Whether the studio may load this pair, per ADR-20 § A: a pair is admitted when the loader, AS
 * CONFIGURED HERE, cannot execute code the file supplies.
 *
 * `pickle` is refused for every loader, and not "with a warning": the format executes arbitrary
 * code at read time. ONNX is admitted for `sherpa-onnx` alone, on a MEASURED property of that
 * loader — it registers no operator library and exposes no field to pass one — verified against
 * ONNX Runtime 1.27.1 on 2026-08-21.
 */
export function admitsLoad(format: ModelFormat, loader: ModelLoader): boolean {
  if (format === 'pickle') return false
  if (format === 'onnx') return loader === 'sherpa-onnx'
  return true
}

/** Why a model cannot be offered at all, whatever the machine could hold. */
export type ModelRefusal = 'format-not-admitted' | 'unverified-provenance'

/**
 * Whether a model may enter the catalogue, and why not.
 *
 * Rank 3 is refused HERE and admitted by an explicit gesture elsewhere: ADR-20 asks that supplying
 * one's own manifest never be the consequence of a click on "Install".
 */
export function modelRefusalOf(model: LocalModel): ModelRefusal | null {
  if (!admitsLoad(model.format, model.loader)) return 'format-not-admitted'
  if (model.rank === 3) return 'unverified-provenance'
  return null
}
