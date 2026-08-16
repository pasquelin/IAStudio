/**
 * Dragging something of ours between two surfaces, carried on a private MIME type: a file
 * dragged in from the desktop must not look like one of our own rows.
 *
 * One channel per kind of thing, made here rather than written out per surface — the subtle
 * part is `carries`, which a drop target must ask before calling `preventDefault`, and which
 * is the difference between a drop that works and one the browser silently refuses.
 */
type DragLike = { dataTransfer: DataTransfer | null }

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
      event.dataTransfer.effectAllowed = 'move'
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
  return {
    start: (event, ids) => {
      if (!event.dataTransfer) return
      event.dataTransfer.setData(type, ids.join('\n'))
      event.dataTransfer.effectAllowed = 'move'
    },
    carries: event => event.dataTransfer?.types.includes(type) ?? false,
    idsFrom: event => (event.dataTransfer?.getData(type) || '').split('\n').filter(Boolean),
  }
}
