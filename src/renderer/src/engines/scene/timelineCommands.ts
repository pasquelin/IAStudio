import type {
  TimelineEvent,
  TimelineMedia,
  TimelineTemplate,
  TimelineTransition,
} from '@shared/domain/animation'
import type { Command } from '@/engines/core/history'
import type { SceneState } from './sceneState'

/**
 * What a timeline does BESIDES moving something, put there and taken back.
 *
 * 🛑 Its own file rather than three more in `animationCommands.ts` at 27 Ko: what a game cues is
 * a different question from what a camera does, and the file that holds both is the one nobody
 * opens. Each row arrives BUILT, id included — a redo must name what the undo took away.
 */

/** The four lists a game writes into. Named once so a command names one rather than spelling it. */
type GameRow = 'events' | 'audio' | 'video' | 'transitions'

type RowOf<List extends GameRow> = List extends 'events'
  ? TimelineEvent
  : List extends 'transitions'
    ? TimelineTransition
    : TimelineMedia

const written = <List extends GameRow>(
  state: SceneState,
  list: List,
  change: (rows: readonly RowOf<List>[]) => readonly RowOf<List>[],
): SceneState => ({
  ...state,
  animation: {
    ...state.animation,
    [list]: change((state.animation[list] ?? []) as readonly RowOf<List>[]),
  },
})

/** Puts a row on a list, or replaces the one already under that id. */
export function addTimelineRow<List extends GameRow>(
  list: List,
  row: RowOf<List>,
): Command<SceneState> {
  return {
    id: `timeline:${list}:add:${row.id}`,
    apply: state => written(state, list, rows => [...rows.filter(held => held.id !== row.id), row]),
    revert: state => written(state, list, rows => rows.filter(held => held.id !== row.id)),
    // A row already there under the same id and the same content is a call that does nothing.
    refuses: state =>
      JSON.stringify((state.animation[list] ?? []).find(held => held.id === row.id)) ===
      JSON.stringify(row),
  }
}

export function removeTimelineRow(list: GameRow, rowId: string): Command<SceneState> {
  let before: { at: number; row: RowOf<GameRow> } | null = null

  return {
    id: `timeline:${list}:remove:${rowId}`,
    apply: state => {
      const rows = state.animation[list] ?? []
      const at = rows.findIndex(row => row.id === rowId)
      const row = rows[at]
      if (!row) return state

      // Put back WHERE it was: the last transition of the list decides an overlap, so a row that
      // came back at the end would change what the picture does.
      before = { at, row }
      return written(state, list, held => held.filter(one => one.id !== rowId))
    },
    revert: state => {
      const origin = before
      if (!origin) return state
      return written(state, list, held => [
        ...held.slice(0, origin.at),
        origin.row,
        ...held.slice(origin.at),
      ])
    },
    refuses: state => !(state.animation[list] ?? []).some(row => row.id === rowId),
  }
}

/** Which rows the panel offers. Never what the engine can do — see `TimelineTemplate`. */
export function setTimelineTemplate(template: TimelineTemplate): Command<SceneState> {
  let before: TimelineTemplate | undefined

  return {
    id: `timeline:template:${template}`,
    apply: state => {
      before = state.animation.template
      return { ...state, animation: { ...state.animation, template } }
    },
    revert: state => ({ ...state, animation: { ...state.animation, template: before } }),
    refuses: state => state.animation.template === template,
  }
}
