import { MENU_SURFACE, rowSkin } from '@/design/styles'
import { cn } from '@/helpers/cn'
import { HINT_TOP } from '@/helpers/tooltip'

export type AssistantConversationSuggestionsProps = {
  /** The sentences that match what is being typed, already translated. */
  matches: readonly string[]
  /** Which one the keyboard holds. Never `-1`: the first is held from the first keystroke. */
  active: number
  /** Names the list for a reader — one with no name is announced as "list box". */
  label: string
  hint: string
  id: string
  onChoose: (sentence: string) => void
}

/** The id of one line, composed HERE so the field naming it cannot spell it differently. */
export function suggestionId(listId: string, index: number): string {
  return `${listId}-${index}`
}

/**
 * What one can ask, filtered as it is typed. In flow and never floating, as the model picker is.
 *
 * 🛑 ABOVE the field, whose column pins to its foot: listed under it, every match arriving pushed
 * the field, the picker and Send up from under the hand that was typing.
 */
export function AssistantConversationSuggestions({
  matches,
  active,
  label,
  hint,
  id,
  onChoose,
}: AssistantConversationSuggestionsProps) {
  return (
    <div
      id={id}
      role="listbox"
      aria-label={label}
      // Bounded because it opens UPWARD now: unbounded, a run of matches would cover the thread
      // it grows into, and one writes to an answer one can still read.
      className={cn(MENU_SURFACE, 'max-h-40 shrink-0 overflow-y-auto rounded-(--radius-sc-sm)')}
    >
      {matches.map((sentence, index) => (
        <button
          key={sentence}
          type="button"
          role="option"
          id={suggestionId(id, index)}
          aria-selected={index === active}
          // Both, and on the same element: `aria-selected` is what a reader hears, `data-selected`
          // is what lifts a row's own words out of `muted` on the picked fill.
          data-selected={index === active ? '' : undefined}
          // The caret never leaves the field — that is what `aria-activedescendant` means — so
          // these are not tab stops. 🛑 Tab itself is taken by the tail when there is one, and
          // Escape is what gives the composer back to the keyboard.
          tabIndex={-1}
          // What a visible imperative cannot say on its own: it WRITES, and sends nothing.
          {...HINT_TOP(hint)}
          // The pointer must not take the caret out of the field: a press that blurred it closed
          // the very list it was pressing.
          onMouseDown={event => event.preventDefault()}
          onClick={() => onChoose(sentence)}
          className={cn(
            // A row, so no fill under the pointer — the studio keeps that for tiles. What answers
            // the hand here is the caret walking the list, and the pointer shape.
            // 🛑 No `bg-transparent` after it: `cn` is tailwind-merge, and it cancelled the very
            // fill `rowSkin` paints on the held row. A button is transparent by preflight anyway.
            rowSkin(index === active),
            'w-full cursor-pointer border-none px-2 py-1 text-left text-xs',
          )}
        >
          {sentence}
        </button>
      ))}
    </div>
  )
}
