import { useEffect } from 'react'
import type { TakeShape } from '@/engines/audio/edits'
import { writeTakeClip } from '@/stores/sequences'

/**
 * Keeps the montage clip of a take in step with the chain edited above it — cropping shortens
 * the clip, a fade puts a bevel on it, normalising moves its level.
 *
 * The shape is not worked out here: it comes back from the worker beside the samples, because
 * two of the five steps are measured on them. This is only where it lands.
 *
 * Null on either side is a document with nothing to tie: a take no track would hold, or a chain
 * whose render has not come back yet.
 */
export function useTakeClip(documentId: string, clipId: string | null, shape: TakeShape | null) {
  useEffect(() => {
    if (clipId && shape) writeTakeClip(documentId, clipId, shape)
  }, [documentId, clipId, shape])
}
