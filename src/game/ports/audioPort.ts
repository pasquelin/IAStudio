// SPDX-License-Identifier: MIT

import type { Ref } from '@shared/domain/ref'

export type AudioPlay = { volume: number; loop: boolean }

/** What a caller may still do to a sound it started. */
export type AudioVoice = {
  stop: () => void
  /**
   * Its level, linear in `[0, 1]`, written while it plays. What a fade IS.
   *
   * 🛑 NO implementation answers this yet: `createInertAudio` is the only `AudioPort` of the
   * repository and its `play` answers `null`, so no voice exists to be turned down. The timeline
   * computes the level and a test measures it; nobody hears it. A real mixer will also want a
   * RAMP here — writing a level at 60 Hz is what zipper noise is.
   */
  gain: (level: number) => void
}

/**
 * Nothing when the host could not start the sound — an asset it cannot serve, or a host with no
 * audio at all. A caller that gets nothing has nothing to stop, which is the whole of the
 * contract.
 */
export type AudioPort = {
  play: (ref: Ref, how: AudioPlay) => AudioVoice | null
  stopAll: () => void
}
