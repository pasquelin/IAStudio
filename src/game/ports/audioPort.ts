// SPDX-License-Identifier: MIT

import type { Ref } from '@shared/domain/ref'

export type AudioPlay = { volume: number; loop: boolean }

/** What stops a sound once it has started. */
export type AudioVoice = { stop: () => void }

/**
 * Nothing when the host could not start the sound — an asset it cannot serve, or a host with no
 * audio at all. A caller that gets nothing has nothing to stop, which is the whole of the
 * contract.
 */
export type AudioPort = {
  play: (ref: Ref, how: AudioPlay) => AudioVoice | null
  stopAll: () => void
}
