import { createHostRegistry } from '@/helpers/host-registry'

/** The editor, seen from the disk: it hands back the take as the chain has rendered it. */
export type AudioHost = {
  /** 16-bit PCM WAV, or `null` while the worker is still replaying the chain. */
  rendered: () => Uint8Array | null
}

const registry = createHostRegistry<AudioHost>()

/** Registers a document's editor. Returns the undo, for the effect that mounted it. */
export const holdAudio = registry.hold

/** `null` when no audio document by that id is open — every other kind, and a closed tab. */
export const audioHost = registry.get
