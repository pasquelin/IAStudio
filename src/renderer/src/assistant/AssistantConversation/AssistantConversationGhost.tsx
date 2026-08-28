import type { Ref } from 'react'
import { cn } from '@/helpers/cn'
import { CONVERSATION_FIELD_TYPE } from './conversationStyles'

export type AssistantConversationGhostProps = {
  /** What the hand has written, painted invisible so the tail starts where the caret is. */
  typed: string
  /** What is left of the sentence, in grey ahead of the caret. */
  tail: string
  /** The key that takes it, already spelled in the reader's language. */
  accept: string
  ref?: Ref<HTMLDivElement>
}

/**
 * The grey rest of a sentence, painted behind the field a textarea cannot paint into.
 *
 * 🛑 Never in the value: put there the tail is what the store holds and what Enter sends.
 */
export function AssistantConversationGhost({
  typed,
  tail,
  accept,
  ref,
}: AssistantConversationGhostProps) {
  return (
    <div
      ref={ref}
      // Said by the live region beside the field: read from here too, a reader hears the sentence
      // it is already spelling out twice.
      aria-hidden
      className={cn(
        CONVERSATION_FIELD_TYPE,
        'pointer-events-none absolute inset-0 overflow-hidden break-words whitespace-pre-wrap',
      )}
    >
      <span className="invisible">{typed}</span>
      <span className="text-muted">{tail}</span>
      {/* Nobody presses a key they were never shown, and the tail alone reads as text already
        written. */}
      <kbd className="text-muted ml-1">{accept}</kbd>
    </div>
  )
}
