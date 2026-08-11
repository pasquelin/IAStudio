import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CloseChoice } from '@shared/domain/document'
import { addNode } from '@/engines/scene/commands'
import { meshNode } from '@/engines/scene/scene-fixtures'
import { installFakeBridge } from '@/services/fake-bridge'
import { forgetReportedFailures } from '@/services/diagnostics'
import { clearScenes } from '@/stores/scene-fixtures'
import { useDocuments } from '@/stores/documents'
import { useScenes } from '@/stores/scenes'
import { unsavedDocumentIds } from './document-io'
import { guardUnsavedWork } from './unsaved-guard'

// The real one needs a live Dockview; this file only checks what the guard asks of the document.
vi.mock('./dockview-api', () => ({ closePanel: vi.fn() }))

const box = meshNode('box-1')

/** A document with work in it — what the guard exists to refuse to lose. */
const openDirtyScene = async (): Promise<string> => {
  const created = await useDocuments.getState().create('3d')
  if (!created) throw new Error('expected a document')
  useScenes.getState().runCommand(created.id, addNode(box))
  return created.id
}

// One jsdom window serves the whole file: a guard left armed would answer the next test's
// gesture too, and the counts would be those of every test run so far.
const armed: Array<() => void> = []

const arm = (target: Window): (() => void) => {
  const stop = guardUnsavedWork(target)
  armed.push(stop)
  return stop
}

const leave = (target: Window): Event => {
  const event = new Event('beforeunload', { cancelable: true })
  target.dispatchEvent(event)
  return event
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  clearScenes()
  forgetReportedFailures()
  useDocuments.setState({ documents: {}, activeId: null })
})

afterEach(() => {
  armed.splice(0).forEach(stop => stop())
})

describe('guardUnsavedWork', () => {
  it('lets the window go when no document holds unsaved work', () => {
    installFakeBridge({})
    arm(window)

    expect(leave(window).defaultPrevented).toBe(false)
  })

  it('refuses to let the window go while a document holds unsaved work', async () => {
    installFakeBridge({ documents: { confirmClose: () => Promise.resolve('cancel') } })
    arm(window)
    await openDirtyScene()

    expect(leave(window).defaultPrevented).toBe(true)
  })

  it('asks about the work rather than dropping it silently', async () => {
    const confirmClose = vi.fn(() => Promise.resolve<'cancel'>('cancel'))
    installFakeBridge({ documents: { confirmClose } })
    arm(window)
    await openDirtyScene()

    leave(window)

    await vi.waitFor(() => expect(confirmClose).toHaveBeenCalledTimes(1))
  })

  // Answering "discard" settles the document, so the next attempt to leave finds nothing at
  // stake — that is what makes a second ⌘Q go through instead of asking again forever.
  it('leaves nothing dirty once the question is answered, so the next attempt goes through', async () => {
    installFakeBridge({ documents: { confirmClose: () => Promise.resolve('discard') } })
    arm(window)
    await openDirtyScene()

    leave(window)

    await vi.waitFor(() => expect(unsavedDocumentIds()).toEqual([]))
    expect(leave(window).defaultPrevented).toBe(false)
  })

  it('keeps the document when the question is cancelled', async () => {
    installFakeBridge({ documents: { confirmClose: () => Promise.resolve('cancel') } })
    arm(window)
    const documentId = await openDirtyScene()

    leave(window)

    await vi.waitFor(() => expect(unsavedDocumentIds()).toEqual([documentId]))
  })

  // Cancelling the last question must leave the studio as it was. Answering document by document
  // and closing as the answers came in threw away the ones answered before the cancel.
  it('keeps every document when a later question is cancelled', async () => {
    const answers: CloseChoice[] = ['discard', 'cancel']
    installFakeBridge({
      documents: { confirmClose: () => Promise.resolve(answers.shift() ?? 'cancel') },
    })
    arm(window)
    const first = await openDirtyScene()
    const second = await openDirtyScene()

    leave(window)

    await vi.waitFor(() => expect(answers).toEqual([]))
    expect(unsavedDocumentIds().sort()).toEqual([first, second].sort())
  })

  // Cancelling stops the whole gesture, so the documents behind the cancelled one are not even
  // asked about — a second dialog after "Cancel" would be the studio arguing with the answer.
  it('asks nothing further once a question is cancelled', async () => {
    const confirmClose = vi.fn(() => Promise.resolve<'cancel'>('cancel'))
    installFakeBridge({ documents: { confirmClose } })
    arm(window)
    await openDirtyScene()
    await openDirtyScene()

    leave(window)

    await vi.waitFor(() => expect(confirmClose).toHaveBeenCalledTimes(1))
    expect(unsavedDocumentIds()).toHaveLength(2)
  })

  it('writes the work when the answer is to save it', async () => {
    const write = vi.fn(() => Promise.resolve())
    installFakeBridge({ documents: { confirmClose: () => Promise.resolve('save'), write } })
    arm(window)
    await openDirtyScene()

    leave(window)

    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(1))
    expect(unsavedDocumentIds()).toEqual([])
  })

  // A write that refuses must leave the tab where it was: closing anyway would lose the work the
  // dialog had just promised to keep.
  it('keeps the document when the save it promised refuses', async () => {
    installFakeBridge({
      documents: {
        confirmClose: () => Promise.resolve('save'),
        write: () => Promise.reject(new Error('read-only volume')),
      },
    })
    arm(window)
    const documentId = await openDirtyScene()

    leave(window)

    await vi.waitFor(() => expect(unsavedDocumentIds()).toEqual([documentId]))
  })

  // A dialog per keypress is the failure this guards against: the answer to the first is still
  // out when the second arrives.
  it('asks once however many times the gesture is repeated', async () => {
    const confirmClose = vi.fn(() => Promise.resolve<'cancel'>('cancel'))
    installFakeBridge({ documents: { confirmClose } })
    arm(window)
    await openDirtyScene()

    leave(window)
    leave(window)
    leave(window)

    await vi.waitFor(() => expect(confirmClose).toHaveBeenCalledTimes(1))
  })

  // A rejected write used to close the dialog and say nothing: no failure reported, and every
  // later attempt to leave replayed the same silent scene.
  it('reports a failed answer instead of swallowing it, and asks again next time', async () => {
    const confirmClose = vi.fn(() => Promise.reject(new Error('volume gone')))
    const report = vi.fn(() => Promise.resolve())
    installFakeBridge({ documents: { confirmClose }, diagnostics: { report } })
    arm(window)
    await openDirtyScene()

    leave(window)
    await vi.waitFor(() =>
      expect(report).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'error', scope: 'document.close' }),
      ),
    )

    // The flag released, so the gesture is answerable again rather than stuck on the first try.
    leave(window)
    await vi.waitFor(() => expect(confirmClose).toHaveBeenCalledTimes(2))
  })

  // No bridge means no dialog, and the answer a missing dialog gives is the one that loses
  // nothing: the work stays exactly where it was.
  it('keeps the work when there is nothing to ask with', async () => {
    installFakeBridge({})
    arm(window)
    const documentId = await openDirtyScene()
    Reflect.deleteProperty(globalThis, 'studio')

    leave(window)

    await vi.waitFor(() => expect(unsavedDocumentIds()).toEqual([documentId]))
  })

  it('stops refusing once it is taken off', async () => {
    installFakeBridge({ documents: { confirmClose: () => Promise.resolve('cancel') } })
    const stop = arm(window)
    await openDirtyScene()

    stop()

    expect(leave(window).defaultPrevented).toBe(false)
  })
})
