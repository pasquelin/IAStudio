/**
 * Dragging something of ours between two surfaces, carried on a private MIME type: a file
 * dragged in from the desktop must not look like one of our own rows.
 *
 * One channel per kind of thing, made here rather than written out per surface — the subtle
 * part is `carries`, which a drop target must ask before calling `preventDefault`, and which
 * is the difference between a drop that works and one the browser silently refuses.
 */
/**
 * The one thing every reader of a drag needs, and the least a caller has to hand over. Exported
 * so a surface that only ASKS about a drag — a list deciding whether it would take one — can name
 * it rather than write the shape again; a `React.DragEvent` satisfies it, and so does a test's
 * double.
 */
export type DragLike = { dataTransfer: DataTransfer | null }

export type DragChannel = {
  start: (event: DragLike, id: string) => void
  /** Whether this drag is one of ours. `getData` answers nothing until the drop itself. */
  carries: (event: DragLike) => boolean
  /** What is being dragged, at the drop. Empty before then, by design of the platform. */
  idFrom: (event: DragLike) => string | null
}

export function dragChannel(type: string): DragChannel {
  return {
    start: (event, id) => {
      if (!event.dataTransfer) return
      event.dataTransfer.setData(type, id)
      // BOTH: a target may only ask for an effect its source allowed, so `move` alone left every
      // surface that ADDS unable to show the `+` that says a drop will work — and a mismatch is
      // refused by the platform in silence. Each target still says which of the two it means.
      event.dataTransfer.effectAllowed = 'copyMove'
    },
    carries: event => event.dataTransfer?.types.includes(type) ?? false,
    idFrom: event => event.dataTransfer?.getData(type) || null,
  }
}

export type DragListChannel = {
  start: (event: DragLike, ids: readonly string[]) => void
  carries: (event: DragLike) => boolean
  /** What is being dragged, at the drop. Empty before then, by design of the platform. */
  idsFrom: (event: DragLike) => readonly string[]
}

/**
 * The same, for a HANDFUL of things dragged as one — three files carried into a folder together.
 *
 * A separate channel rather than a comma inside the single one: a payload that is sometimes one
 * id and sometimes a list is a payload every target has to sniff, and an id holding a comma
 * would decide the question the wrong way in silence. Newline-separated, which no path of this
 * studio holds — `parseFolderPath` refuses a name with one.
 *
 * The platform still answers nothing until the drop itself, so a target asked at HOVER cannot
 * read what is coming. Whoever needs to know before then keeps it in state, as `Tree` does.
 */
export function dragListChannel(type: string): DragListChannel {
  // Built ON the single channel rather than beside it: what differs is how the payload is
  // written, and nothing about how a `DataTransfer` is armed or read.
  const one = dragChannel(type)

  return {
    start: (event, ids) => one.start(event, ids.join('\n')),
    carries: one.carries,
    idsFrom: event => (one.idFrom(event) ?? '').split('\n').filter(Boolean),
  }
}
