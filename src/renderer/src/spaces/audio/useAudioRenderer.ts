import { useEffect, useState } from 'react'
import AudioWorker from '@/engines/audio/audio.worker?worker'
import { createAudioRenderer, type AudioRenderer } from '@/engines/audio/audio-render'

/**
 * The editor's render worker, one per open take.
 *
 * Built in an effect rather than while rendering: React mounts a component twice in
 * development, and a worker created during render would be the one nothing ever terminates.
 * Null until it exists, which is one frame of the empty state the decode already shows.
 */
export function useAudioRenderer(): AudioRenderer | null {
  const [renderer, setRenderer] = useState<AudioRenderer | null>(null)

  useEffect(() => {
    const created = createAudioRenderer(new AudioWorker())
    setRenderer(created)
    return () => created.dispose()
  }, [])

  return renderer
}
