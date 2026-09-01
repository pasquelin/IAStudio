// SPDX-License-Identifier: MIT

import type { AiPort, AiRefusal, AiResult } from '../ports/aiPort'
import type { LogPort } from '../ports/logPort'

/**
 * The only refusal any host answers today, and the reason the port exists before the permission
 * does — the grid of consent is what is postponed, not the abstraction. See `aiPort.ts`.
 */
const AI_NOT_GRANTED: AiRefusal = 'notGranted'

/**
 * Every method that would engage credits or an outside service refuses, by name, and says so in
 * the log. A refusal nobody can read is how a game ends up appearing to do nothing.
 */
export function createRefusedAi(log: LogPort): AiPort {
  const refuse = async (method: string): Promise<AiResult<never>> => {
    log.write('warn', `game.ai.${method} refused: ${AI_NOT_GRANTED}`)
    return { ok: false, refused: AI_NOT_GRANTED }
  }

  return {
    generateImage: () => refuse('generateImage'),
    generateDialogue: () => refuse('generateDialogue'),
    generateAudio: () => refuse('generateAudio'),
  }
}
