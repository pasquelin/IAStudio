/**
 * What a row offers when it can be moved in the stack at all.
 *
 * Here rather than in `TimelineRow.tsx` because the row and its grip both need it, and importing
 * it back from the row would close an import cycle.
 */
export type RowReorder = {
  /** Accessible name of the grip — it says which row is being moved. */
  label: string
  /**
   * Moves the row, and answers how many places it ACTUALLY travelled — zero at the ends of the
   * stack, where there is nowhere to go.
   *
   * The answer is what keeps a drag honest. Counting the pointer instead, a row held against the
   * bottom edge banks steps it never took, and bringing the pointer back where it started spends
   * them the other way: the row climbs a place it was never dragged over.
   */
  move: (by: number) => number
  /**
   * Both ends of the drag, for a stack whose order is an EDIT: a row dragged across three places
   * has to cost one ⌘Z, not three. Absent where the order is a way of looking rather than a
   * change to the document — the dope sheet's arrangement, which no history holds.
   */
  begin?: () => void
  end?: () => void
}
