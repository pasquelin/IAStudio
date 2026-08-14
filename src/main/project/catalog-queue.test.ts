import { describe, expect, it, onTestFinished } from 'vitest'
import { createCatalogQueue, serveCatalog, type CatalogServerPort } from './catalog-queue'
import { createCatalog } from './catalog'
import { openMemoryDatabase } from './sqlite-memory'
import {
  ABANDONED,
  type CatalogMessage,
  type CatalogRequest,
  type CatalogResponse,
} from './catalog-protocol'

const search = (id: number, text: string): CatalogRequest => ({
  id,
  op: 'search',
  query: { text },
})

/**
 * A queue whose turns the test takes by hand: `yieldTo` hands back the resume rather than
 * calling it, which is what lets a message arrive *while* a request is running.
 */
function harness() {
  const ran: number[] = []
  const answers: CatalogResponse[] = []
  const turns: (() => void)[] = []

  const queue = createCatalogQueue({
    run: request => {
      ran.push(request.id)
      return { id: request.id, ok: true, value: [] }
    },
    answer: response => answers.push(response),
    yieldTo: resume => turns.push(resume),
  })

  /** One turn of the loop. Returns whether there was one to take. */
  const turn = (): boolean => {
    const next = turns.shift()
    next?.()
    return Boolean(next)
  }

  return { queue, ran, answers, turn }
}

describe('the catalogue queue', () => {
  it('runs what it is given, in order', () => {
    const { queue, ran, turn } = harness()

    queue.accept(search(1, 'a'))
    queue.accept(search(2, 'b'))
    while (turn());

    expect(ran).toEqual([1, 2])
  })

  /**
   * The whole point. Six keystrokes queue six searches; the five that describe a word nobody is
   * looking for any more must never reach SQLite, which cannot be interrupted once it has begun.
   */
  it('never runs a request abandoned before its turn', () => {
    const { queue, ran, turn } = harness()

    queue.accept(search(1, 'm'))
    queue.accept(search(2, 'mo'))
    queue.accept(search(3, 'mos'))
    queue.accept({ op: 'abandon', target: 2 })
    while (turn());

    expect(ran).toEqual([1, 3])
  })

  /**
   * The property the whole shape exists for: the queue gives the loop its turn BETWEEN two
   * requests, so an abandon posted while one is running is read before the next one starts.
   * Drained in one go, all six searches of six keystrokes run before the first abandon is seen.
   */
  it('reads what arrived while it was running, before running the next one', () => {
    const { queue, ran, turn } = harness()

    queue.accept(search(1, 'm'))
    queue.accept(search(2, 'mo'))
    turn()
    // Posted while the first was running — the only moment that tells the two shapes apart.
    queue.accept({ op: 'abandon', target: 2 })
    while (turn());

    expect(ran).toEqual([1])
  })

  /** A caller that never abandoned must not be left holding a promise nobody settles. */
  it('answers an abandoned request rather than dropping it', () => {
    const { queue, answers, turn } = harness()

    queue.accept(search(1, 'm'))
    queue.accept({ op: 'abandon', target: 1 })
    while (turn());

    expect(answers).toEqual([{ id: 1, ok: false, error: ABANDONED }])
  })

  /**
   * The one it cannot save. An abandon that lands while its own request is running is too late —
   * and it must not then be held against the next request to carry that id.
   */
  it('lets go of an abandon that arrived too late', () => {
    const { queue, ran, turn } = harness()

    queue.accept(search(1, 'm'))
    turn()
    queue.accept({ op: 'abandon', target: 1 })
    queue.accept(search(1, 'again'))
    while (turn());

    expect(ran).toEqual([1, 1])
  })

  /** A queue that went quiet must start turning again on the next message. */
  it('picks up again after it has emptied', () => {
    const { queue, ran, turn } = harness()

    queue.accept(search(1, 'a'))
    while (turn());
    queue.accept(search(2, 'b'))
    while (turn());

    expect(ran).toEqual([1, 2])
  })
})

/**
 * The thread's own shape, without a thread: a port made of two functions is all `serveCatalog`
 * ever touches, which is why the entry point can be left as plumbing nobody tests.
 */
describe('a catalogue served on a port', () => {
  function fakePort(): CatalogServerPort & {
    send: (message: CatalogMessage) => void
    answers: CatalogResponse[]
  } {
    const answers: CatalogResponse[] = []
    let listener: ((message: CatalogMessage) => void) | null = null

    return {
      answers,
      postMessage: response => answers.push(response),
      on: (_event, next) => {
        listener = next
      },
      send: message => listener?.(message),
    }
  }

  /** One turn of the loop, which is what `serveCatalog` yields to between two requests. */
  const settle = (): Promise<void> => new Promise(resolve => setImmediate(resolve))

  it('answers what it is asked, off the catalogue it was given', async () => {
    const port = fakePort()
    const catalog = createCatalog(openMemoryDatabase())
    onTestFinished(catalog.close)
    serveCatalog(catalog, port)

    port.send({ id: 1, op: 'search', query: {} })
    await settle()
    await settle()

    expect(port.answers).toEqual([{ id: 1, ok: true, value: [] }])
  })

  /** The reason the queue exists at all, end to end: a search given up on never runs. */
  it('skips a request abandoned before its turn', async () => {
    const port = fakePort()
    const catalog = createCatalog(openMemoryDatabase())
    onTestFinished(catalog.close)
    serveCatalog(catalog, port)

    port.send({ id: 1, op: 'search', query: { text: 'mo' } })
    port.send({ id: 2, op: 'search', query: { text: 'mos' } })
    port.send({ op: 'abandon', target: 2 })
    for (let turn = 0; turn < 4; turn++) await settle()

    expect(port.answers).toEqual([
      { id: 1, ok: true, value: [] },
      { id: 2, ok: false, error: ABANDONED },
    ])
  })
})
