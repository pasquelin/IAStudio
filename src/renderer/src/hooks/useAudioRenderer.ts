import { useEffect, useState } from 'react'
import AudioWorker from '@/engines/audio/audio.worker?worker'
import { createAudioRenderer, type AudioRenderer } from '@/engines/audio/audioRender'

/**
 * The editor's render worker, one per open take.
 *
 * The renderer is built during render and the worker only when a take reaches it: React runs a
 * state initialiser twice in development and keeps one of the two, and a worker spawned there
 * would be the one nothing ever terminates.
 */
export function useAudioRenderer(): AudioRenderer {
  const [renderer] = useState(() => createAudioRenderer(() => new AudioWorker()))

  useEffect(() => () => renderer.dispose(), [renderer])

  return renderer
}
