import { useEffect, useState } from 'react'
import { getBridge } from '@/services/bridge'

/**
 * The biggest mesh a model will take, in bytes, or `undefined` while nobody knows — which refuses
 * nothing: being wrong about a limit hides a file that would have gone through. Read off the
 * model's OWN schema, never written down: Uthana answers 30 000 000 today, and only today.
 */
export function useMeshSizeLimit(modelId: string | null): number | undefined {
  const [limit, setLimit] = useState<number | undefined>(undefined)

  // Forgotten during the render rather than in the effect: a limit read for one model must not
  // outlive the question it answered, and a `setState` inside an effect body cascades renders.
  const [asked, setAsked] = useState(modelId)
  if (asked !== modelId) {
    setAsked(modelId)
    setLimit(undefined)
  }

  useEffect(() => {
    if (!modelId) return

    let live = true
    void getBridge()
      ?.provider.describeModel(modelId)
      .then(model => {
        if (live) setLimit(model.fields.find(field => field.kind === 'mesh')?.maxSize)
      })
      .catch(() => {
        // Unreadable is « no limit known », which refuses nothing. The main process logged why.
      })

    return () => {
      live = false
    }
  }, [modelId])

  return limit
}
