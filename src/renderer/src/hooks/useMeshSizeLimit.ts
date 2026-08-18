import { useEffect, useState } from 'react'
import { getBridge } from '@/services/bridge'

/**
 * The biggest mesh a model will take, in bytes, or `undefined` while nobody knows.
 *
 * Read off the model's OWN schema and never written down here: Uthana's character rigger answers
 * 30 000 000 today and nothing promises it will tomorrow. `undefined` refuses nothing, which is
 * the same rule an unreadable plan lives under — being wrong about a limit hides a file that
 * would have gone through.
 *
 * One call, and only for the model actually about to be used: a limit is asked before an upload,
 * not for every row of a list.
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
      ?.scenario.describeModel(modelId)
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
