import type { RefObject } from 'react'

export type AssistantConversationGhostProps = {
  /** What the hand has written, painted invisible so the tail starts where the caret is. */
  typed: string
  /** What is left of the sentence, in grey ahead of the caret. */
  tail: string
  /** The key that takes it, already translated. */
  accept: string
  ref: RefObject<HTMLDivElement | null>
}

/**
 * The grey rest of a sentence, behind the field rather than in it.
 *
 * 🛑 A textarea paints no text of its own, so the tail CANNOT live in its value: put there it
 * would be what Enter sends and what the store holds, and the assistant would answer a sentence
 * nobody wrote. This layer mirrors the field's own type and gutters instead — change one and this
 * one moves with it, or the tail lands a character off.
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
      // Spoken by the live region beside the field, not read from here: a mirror announced twice
      // reads the sentence one is writing back at whoever is writing it.
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden px-1 text-xs break-words whitespace-pre-wrap"
    >
      <span className="invisible">{typed}</span>
      <span className="text-muted">{tail}</span>
      {/* Nobody presses a key they were never shown: the tail alone reads as text that is already
        there, and the hand types over it. */}
      <span className="text-muted border-border ml-1 rounded-(--radius-sc-sm) border px-1">
        {accept}
      </span>
    </div>
  )
}
