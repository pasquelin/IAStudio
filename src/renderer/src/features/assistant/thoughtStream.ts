import type { AssistantProgress } from '@shared/domain/assistant'
import { defined } from '@shared/guards'
import { createFrameCoalesce, type FrameCoalesce } from '@/engines/core/frameCoalesce'
import { getBridge } from '@/services/bridge'
import { useAssistant } from '@/stores/assistant'

/**
 * 🛑 One store write per painted FRAME, never per token — 50 to 100 renders a second otherwise.
 * `schedule` keeps only the LAST value given, so the deltas are joined here or they are lost.
 */
export function connectThoughtStream(frames: FrameCoalesce = createFrameCoalesce()): () => void {
  const bridge = getBridge()
  if (!bridge) return () => {}

  let held: AssistantProgress = { delta: '' }

  const stop = bridge.assistant.onStream(progress => {
    held = {
      delta: progress.restart === true ? '' : held.delta + progress.delta,
      // 🛑 Every field the frame carries, listed: rebuilt from a literal, a field added upstream
      // is dropped HERE in silence — `windowTokens` was, and the whole ratio never rendered.
      ...defined({
        promptTokens: progress.promptTokens ?? held.promptTokens,
        promptChars: progress.promptChars ?? held.promptChars,
        replyTokens: progress.replyTokens ?? held.replyTokens,
        windowTokens: progress.windowTokens ?? held.windowTokens,
      }),
      // 🛑 `held`, not just this frame: a throttled window coalesces the whole turn into one, and
      // a restart read off the last frame alone leaves the thrown-away attempt on screen.
      ...(progress.restart === true || held.restart === true ? { restart: true } : {}),
    }

    frames.schedule(held, pending => {
      held = { delta: '' }
      useAssistant.getState().noteProgress(pending)
    })
  })

  return () => {
    // The last words of an answer that landed inside the pending frame, rather than dropped.
    frames.flush()
    stop()
  }
}
