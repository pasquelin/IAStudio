import { describe, expect, it } from 'vitest'
import { WORKSPACE_IDS } from '@shared/domain/workspace'
import { INSTRUCTION_MAX } from '@shared/domain/assistant'
import { preambleLength, studioBriefing } from './instruction'

describe('what the model is told about the studio', () => {
  /**
   * The half of "say it before you promise" that lives in the prompt: a refusal after the fact
   * still follows a sentence announcing a picture.
   */
  it('names the spaces nothing can generate in, and says nothing when all are served', () => {
    expect(studioBriefing(['image', 'video'])).toContain('No model ready for: image, video.')
    expect(studioBriefing()).not.toContain('No model ready')
  })

  /**
   * 🛑 The WORST case, not today's machine. The state line is the one part of the preamble that
   * grows with the studio, and measuring it empty would let a machine where nothing is chosen eat
   * the room the sentence needs.
   */
  it('leaves the sentence its room on a machine where nothing can generate', () => {
    expect(INSTRUCTION_MAX - preambleLength(WORKSPACE_IDS)).toBeGreaterThan(4_000)
  })
})
