import { describe, expect, it } from 'vitest'
import { WORKSPACE_IDS } from '@shared/domain/workspace'
import { INSTRUCTION_MAX } from '@shared/domain/assistant'
import { CONTEXT_COMPOSED_MAX } from '@shared/domain/projectContext'
import { TARGET_ID_MAX, TARGET_NAME_MAX, TARGETS_MAX, type Target } from '@shared/domain/target'
import { preambleLength, studioBriefing } from './instruction'

/**
 * EVERY bound at its widest, and each one matters: the list as long as it may be, each id and
 * each name as long as they may be, every line carrying the ` (selected)` suffix. Built from
 * plausible values instead, it measured 2 354 and stayed green while the reachable worst was
 * 1 552 — under the floor the case next to it claims to hold.
 */
const SATURATED: readonly Target[] = [...Array(TARGETS_MAX).keys()].map((at): Target => ({
  id: `${at}`.padEnd(TARGET_ID_MAX, 'i'),
  kind: 'layer',
  name: 'N'.repeat(TARGET_NAME_MAX),
  selected: true,
}))

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
   * 🛑 Every bound at once, not today's machine: nothing generateable, a full project context, and
   * a target list saturated on all three of its bounds. **2 130 left, measured 2026-08-24** — a
   * margin of 130 over the floor, so the next thing added to the briefing reddens here first.
   *
   * The floor is `brain.test.ts`'s two thousand, which this case had never followed: at four
   * thousand it went red on the target list alone, and the room it guarded had been spent long
   * before. `TARGETS_MAX`, `TARGET_NAME_MAX` and `TARGET_ID_MAX` were set from THIS measurement.
   */
  it('leaves the sentence its room with every part of the briefing at its widest', () => {
    const worst = preambleLength(WORKSPACE_IDS, 'x'.repeat(CONTEXT_COMPOSED_MAX), SATURATED)

    expect(INSTRUCTION_MAX - worst).toBeGreaterThan(2_000)
  })

  /** The ids are what `target.select` takes back, so they have to be IN what the model reads. */
  it('lists what the open document can be aimed at, and says nothing when there is nothing', () => {
    const briefing = studioBriefing([], '', [
      { id: 'sky-2', kind: 'layer', name: 'Sky', selected: true },
    ])

    expect(briefing).toContain('Targets in the open document:')
    expect(briefing).toContain('sky-2 — layer "Sky" (selected)')
    expect(studioBriefing()).not.toContain('Targets in the open document')
  })
})
