import { createHash } from 'node:crypto'
import { basename } from 'node:path'
import { ggufHeaderOf, type GgufHeader } from '@shared/domain/gguf'
import type { LocalModel } from '@shared/domain/localModel'

/**
 * A manifest for a weights file the person already holds — rank 3 of ADR-20, and the explicit
 * gesture the rank has always asked for.
 *
 * 🛑 What the header does not say is NOT asked of them, and that is a decision rather than an
 * omission: a GGUF names its architecture, its window and what its publisher calls it, and the
 * file system answers for the size. The one figure nobody can read is what it will take once
 * resident — announced as an estimate, and replaced by a measurement at the first load.
 */

/** How much of the file the header is looked for in, growing until it fits or the file ends. */
export const HEADER_WINDOWS: readonly number[] = [256 * 1024, 4 * 1024 * 1024, 32 * 1024 * 1024]

/** Where a file that declares no window is put. Qwen, Llama and Phi all declare one. */
const FALLBACK_CONTEXT_TOKENS = 4096

/**
 * `[?]` A fifth above the weights, for the attention cache and the runtime's own working set.
 * An ESTIMATE and never a measurement — R3 of ADR-19 — and the load answers with the real figure.
 */
const RESERVATION_FACTOR = 1.2

export type OwnModelDeps = {
  /** Reads the first `bytes` of the file. Fewer at the end of a file is an ordinary answer. */
  readHead: (path: string, bytes: number) => Promise<Uint8Array>
  sizeOf: (path: string) => Promise<number>
}

/** Why a file the person pointed at cannot become a manifest. */
export class UnreadableWeights extends Error {}

/**
 * A stable id for a path, short enough to key a radio group and to read in a journal.
 *
 * The PATH and not the file name: two folders holding `model.gguf` are two models, and keying on
 * the name would have the second replace the first without a word.
 */
export function ownModelId(path: string): string {
  return `own-${createHash('sha256').update(path).digest('hex').slice(0, 12)}`
}

/** The header, read from windows that grow: a large model's metadata runs past a first read. */
async function headerOf(path: string, deps: OwnModelDeps): Promise<GgufHeader> {
  for (const window of HEADER_WINDOWS) {
    const reading = ggufHeaderOf(await deps.readHead(path, window))

    if (reading.kind === 'header') return reading.header
    if (reading.kind === 'not-gguf') throw new UnreadableWeights(`${path} is not a GGUF file`)
  }

  throw new UnreadableWeights(`the metadata of ${path} runs past what is read of it`)
}

export async function ownModelFrom(path: string, deps: OwnModelDeps): Promise<LocalModel> {
  // Independent of one another, so they are not queued: the header may take three reads.
  const [header, diskBytes] = await Promise.all([headerOf(path, deps), deps.sizeOf(path)])

  return {
    id: ownModelId(path),
    // What the publisher wrote in the file, else the file's own name: both are DATA, and a model
    // with no name at all would be a row nobody can tell from the next. An EMPTY `general.name`
    // is a name nobody wrote — the reader reports the file faithfully, and deciding is here.
    name: header.name === null || header.name.trim() === '' ? basename(path) : header.name,
    format: 'gguf',
    loader: 'llamacpp',
    rank: 3,
    // Empty, and that is the mark: nothing here can read the licence of a file someone handed
    // over, so it stays out of the notices — see `provenanceUnverified`.
    licence: '',
    licenceUrl: '',
    source: '',
    // Nothing to fetch: the weights are where they put them, which `weightsPath` says.
    files: [],
    diskBytes,
    contextTokens: header.contextLength ?? FALLBACK_CONTEXT_TOKENS,
    reservationBytes: Math.round(diskBytes * RESERVATION_FACTOR),
    modality: 'text',
    ...(header.architecture === null ? {} : { summary: header.architecture }),
    weightsPath: path,
  }
}
