import { describe, expect, it } from 'vitest'
import { createDocumentStore } from './document-store'
import type { Command } from '@/engines/core/history'

/**
 * The coalescing rule, which decides what one ⌘Z gives back. Dragging a field emits dozens of
 * values a second and they must collapse into one entry; two separate edits must not.
 */

type Text = { value: string }

/** A command that sets an absolute value, the way every coalescing command in the studio does. */
function set(id: string, value: string): Command<Text> {
  let before = ''
  return {
    id,
    apply: state => {
      before = state.value
      return { value }
    },
    revert: () => ({ value: before }),
  }
}

const storeOf = () => {
  const store = createDocumentStore<Text>({ value: '' })
  store.use.getState().ensure('doc', () => ({ value: '' }))
  return store
}

const entries = (store: ReturnType<typeof storeOf>): number =>
  store.use.getState().histories['doc']?.past.length ?? 0

const valueOf = (store: ReturnType<typeof storeOf>): string =>
  store.stateOf(store.use.getState(), 'doc').value

describe('a gesture held over a document', () => {
  it('collapses its own commands into one entry', () => {
    const store = storeOf()
    const { beginGesture, runCommand } = store.use.getState()

    beginGesture('doc')
    runCommand('doc', set('slider', 'a'))
    runCommand('doc', set('slider', 'b'))
    runCommand('doc', set('slider', 'c'))

    expect(entries(store)).toBe(1)
    expect(valueOf(store)).toBe('c')
  })

  it('keeps two gestures of the same field apart', () => {
    const store = storeOf()
    const { beginGesture, endGesture, runCommand } = store.use.getState()

    beginGesture('doc')
    runCommand('doc', set('slider', 'a'))
    endGesture('doc')
    beginGesture('doc')
    runCommand('doc', set('slider', 'b'))

    expect(entries(store)).toBe(2)
  })

  /**
   * The defect: `runCommand` rewrote the gesture's id on *every* command, so a command from
   * elsewhere took the gesture over. Two of them landing while a cursor is held then coalesced
   * into each other — one ⌘Z undoing both generations at once — which outside a gesture they
   * never would.
   *
   * The workspace that made this reachable is Skyboxes: it introduced the first asynchronous
   * writer, a generation that lands whenever it lands.
   */
  it('never merges two commands from elsewhere into each other', () => {
    const store = storeOf()
    const { beginGesture, runCommand } = store.use.getState()

    beginGesture('doc')
    runCommand('doc', set('slider', 'a'))
    runCommand('doc', set('generate', 'first image'))
    runCommand('doc', set('generate', 'second image'))

    // Three: the drag, and one entry per generation. Outside a gesture these are always three.
    expect(entries(store)).toBe(3)
  })

  // What an interrupted gesture must still do: carry on collapsing, into an entry of its own.
  it('goes on collapsing after something else wrote in the middle', () => {
    const store = storeOf()
    const { beginGesture, runCommand } = store.use.getState()

    beginGesture('doc')
    runCommand('doc', set('slider', 'a'))
    runCommand('doc', set('generate', 'an image'))
    runCommand('doc', set('slider', 'b'))
    runCommand('doc', set('slider', 'c'))

    expect(entries(store)).toBe(3)
    expect(valueOf(store)).toBe('c')
  })

  it('merges nothing at all outside a gesture', () => {
    const store = storeOf()
    const { runCommand } = store.use.getState()

    runCommand('doc', set('slider', 'a'))
    runCommand('doc', set('slider', 'b'))

    expect(entries(store)).toBe(2)
  })
})
