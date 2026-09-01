import { useAssistant } from '@/stores/assistant'
import { registerConfirmer } from './confirm'
import { revealChat } from './components/Assistant/Toast/revealChat'

/**
 * The studio's confirmer, for as long as the shell is up — a question may come from outside this
 * window, which no panel can be relied on to be open for. It brings the conversation up before
 * asking, and asks anyway when it cannot: the question waits for the next host rather than being
 * refused on a surface the reader never saw.
 */
export function holdConfirmer(): () => void {
  return registerConfirmer(request => {
    revealChat()

    return useAssistant.getState().ask(request)
  })
}
