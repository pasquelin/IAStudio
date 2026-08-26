// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import { createRefusedAi } from './refusedAi'
import type { AiAudioRequest, AiDialogueRequest, AiImageRequest } from '../ports/aiPort'
import { createRingLog } from './ringLog'

describe('the AI a game may not spend on yet', () => {
  it('refuses every generation by name, and leaves the refusal readable', async () => {
    const log = createRingLog()
    const ai = createRefusedAi(log)

    const image: AiImageRequest = { prompt: 'a torch', width: 512, height: 512 }
    const dialogue: AiDialogueRequest = { prompt: 'greet the player', speaker: 'guard' }
    const sound: AiAudioRequest = { prompt: 'a creaking door', seconds: 2 }

    const answers = [
      await ai.generateImage(image),
      await ai.generateDialogue(dialogue),
      await ai.generateAudio(sound),
    ]

    expect(answers).toEqual([
      { ok: false, refused: 'notGranted' },
      { ok: false, refused: 'notGranted' },
      { ok: false, refused: 'notGranted' },
    ])
    expect(log.recent().map(entry => entry.message)).toEqual([
      'game.ai.generateImage refused: notGranted',
      'game.ai.generateDialogue refused: notGranted',
      'game.ai.generateAudio refused: notGranted',
    ])
  })
})
