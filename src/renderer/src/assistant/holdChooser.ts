import { useAssistant } from '@/stores/assistant'
import { registerChooser } from './chooser'
import { revealChat } from './revealChat'

/**
 * The studio's chooser, for as long as the shell is up. It brings the conversation up before
 * asking, as `holdConfirmer` does: a question drawn where nobody is looking is not a question.
 */
export function holdChooser(): () => void {
  return registerChooser(request => {
    revealChat()

    return useAssistant.getState().askChoice(request.question, request.choices)
  })
}
