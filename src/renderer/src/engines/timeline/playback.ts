/**
 * One playback token for the whole app — spec § 8.7. Two players at once means two audible
 * streams and two hardware decoders fighting over the GPU, which reads as random stutter.
 */
export type PlaybackToken = {
  acquire: (owner: string, onRevoked: () => void) => void
  release: (owner: string) => void
  holder: () => string | null
}

export function createPlaybackToken(): PlaybackToken {
  let current: { owner: string; onRevoked: () => void } | null = null

  return {
    acquire: (owner, onRevoked) => {
      if (current && current.owner !== owner) current.onRevoked()
      current = { owner, onRevoked }
    },
    release: owner => {
      if (current?.owner === owner) current = null
    },
    holder: () => current?.owner ?? null,
  }
}

/** The studio's single token. Every player takes it from here, nobody makes its own. */
export const playbackToken = createPlaybackToken()
