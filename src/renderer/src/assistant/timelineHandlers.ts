import { refused, type ActionOutcome } from '@shared/domain/assistant'
import {
  TIMELINE_TEMPLATES,
  type TimelineTemplate,
  type TransitionKind,
  TRANSITION_KINDS,
} from '@shared/domain/animation'
import { TIMELINE_LISTS } from '@shared/domain/gameActions'
import {
  addTimelineRow,
  removeTimelineRow,
  setTimelineTemplate,
} from '@/engines/scene/timelineCommands'
import { newId } from '@/helpers/ids'
import { sceneOf, useScenes } from '@/stores/scenes'
import type { ActionHandlers } from './actionHandler'
import { numberOf, textOf } from './actionInputs'
import { mounted } from './sceneHandlers'

/**
 * What a timeline CUES, driven from outside the window.
 *
 * 🛑 One action for the four lists: what `what` MEANS is read by the list, exactly as
 * `component.set` reads a value by what its descriptor declares. A model that had to tell four
 * schemas apart before asking for anything is a model that asks for nothing.
 */
export const TIMELINE_HANDLERS: ActionHandlers = {
  'timeline.cue': input => {
    const open = mounted()
    if (!open) return refused('wrongSurface')

    const list = textOf(input, 'list') ?? ''
    if (!TIMELINE_LISTS.includes(list)) return refused('badInput', `no list "${list}"`)

    const at = numberOf(input, 'at') ?? 0
    if (!Number.isFinite(at) || at < 0) return refused('badInput', 'at must be a positive number')

    const what = textOf(input, 'what') ?? ''
    const duration = numberOf(input, 'duration') ?? 0
    const id = newId()

    if (list === 'events') {
      if (what.length === 0) return refused('badInput', 'an event needs a name')
      const entity = textOf(input, 'entity')
      useScenes
        .getState()
        .runCommand(
          open.documentId,
          addTimelineRow('events', { id, at, name: what, ...(entity ? { entity } : {}) }),
        )
      return { ok: true, data: { id } }
    }

    if (list === 'transitions') {
      if (!TRANSITION_KINDS.includes(what as TransitionKind)) {
        return refused('badInput', `no transition "${what}" — ${TRANSITION_KINDS.join(', ')}`)
      }
      useScenes
        .getState()
        .runCommand(
          open.documentId,
          addTimelineRow('transitions', { id, at, kind: what as TransitionKind, duration }),
        )
      return { ok: true, data: { id } }
    }

    // A sound or a picture: `what` is the asset, and a row with no length plays nothing at all.
    if (what.length === 0) return refused('badInput', `${list} needs an asset`)
    if (duration <= 0) return refused('badInput', `${list} needs a duration`)
    useScenes.getState().runCommand(
      open.documentId,
      addTimelineRow(list === 'audio' ? 'audio' : 'video', {
        id,
        assetId: what,
        start: at,
        duration,
      }),
    )
    return { ok: true, data: { id } }
  },

  'timeline.remove': input => {
    const open = mounted()
    if (!open) return refused('wrongSurface')

    const list = textOf(input, 'list') ?? ''
    if (!TIMELINE_LISTS.includes(list)) return refused('badInput', `no list "${list}"`)

    const id = textOf(input, 'id') ?? ''
    return runOrRefuse(open.documentId, removeTimelineRow(listOf(list), id), `no row "${id}"`)
  },

  'timeline.template': input => {
    const open = mounted()
    if (!open) return refused('wrongSurface')

    const template = textOf(input, 'template') ?? ''
    if (!TIMELINE_TEMPLATES.includes(template as TimelineTemplate)) {
      return refused('badInput', `no template "${template}"`)
    }
    return runOrRefuse(
      open.documentId,
      setTimelineTemplate(template as TimelineTemplate),
      'is already as asked',
    )
  },
}

/** The list, narrowed — `TIMELINE_LISTS` is what a model chooses from, and it is plain text. */
const listOf = (list: string): 'events' | 'audio' | 'video' | 'transitions' =>
  list === 'events' || list === 'audio' || list === 'video' ? list : 'transitions'

/** A command the state refuses left the document untouched, and `ok` would send it again. */
function runOrRefuse(
  documentId: string,
  command: ReturnType<typeof setTimelineTemplate>,
  already: string,
): ActionOutcome {
  if (command.refuses?.(sceneOf(useScenes.getState(), documentId))) {
    return refused('badInput', already)
  }
  useScenes.getState().runCommand(documentId, command)
  return { ok: true }
}
