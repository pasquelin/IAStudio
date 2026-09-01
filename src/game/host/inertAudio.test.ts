// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import { createInertAudio } from './inertAudio'
import type { AudioPlay, AudioVoice } from '../ports/audioPort'

describe('the audio of a host with no mixer', () => {
  /** Nothing to stop is what the port reserves for a host that cannot start a sound. */
  it('starts no sound, so a caller has nothing to stop', () => {
    const how: AudioPlay = { volume: 1, loop: true }
    const voice: AudioVoice | null = createInertAudio().play({ kind: 'asset', id: 'asset_1' }, how)

    expect(voice).toBeNull()
  })
})
