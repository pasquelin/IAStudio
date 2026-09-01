// SPDX-License-Identifier: MIT

import type { Ref } from '@shared/domain/ref'

/**
 * Why a generation did not happen, said rather than swallowed.
 *
 * `notGranted` is the only one any host answers today — decision of 2026-08-26. What is postponed
 * is not the abstraction but the PERMISSION to spend: in a distributed game the author of the
 * call is not who pays, there is no screen to ask on, a generation counts in seconds against a
 * step of 16,7 ms, and an exported game has neither an account nor a `safeStorage`.
 */
export type AiRefusal = 'notGranted' | 'noBudget' | 'offline' | 'failed'

/** Every AI answer is one or the other, so a caller cannot read a value that was never produced. */
export type AiResult<T> = { ok: true; value: T } | { ok: false; refused: AiRefusal }

export type AiImageRequest = { prompt: string; width: number; height: number }
export type AiDialogueRequest = { prompt: string; speaker: string }
export type AiAudioRequest = { prompt: string; seconds: number }

/**
 * What a script reaches as `game.ai`. Typed and documented from the first day so that granting
 * it later changes an implementation and no call site.
 */
export type AiPort = {
  generateImage: (request: AiImageRequest) => Promise<AiResult<Ref>>
  generateDialogue: (request: AiDialogueRequest) => Promise<AiResult<string>>
  generateAudio: (request: AiAudioRequest) => Promise<AiResult<Ref>>
}
