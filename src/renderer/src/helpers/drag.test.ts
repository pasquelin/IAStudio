import { describe, expect, it } from 'vitest'
import { dragChannel, dragListChannel } from './drag'

const armed = () => {
  const data = new Map<string, string>()
  return {
    dataTransfer: {
      effectAllowed: 'uninitialized' as string,
      types: [] as string[],
      setData: (type: string, value: string) => void data.set(type, value),
      getData: (type: string) => data.get(type) ?? '',
    },
  }
}

describe('a drag of our own', () => {
  it('carries its payload on its own type, which a desktop file never has', () => {
    const event = armed()
    dragChannel('application/x-test').start(event as never, 'row-1')

    expect(event.dataTransfer.getData('application/x-test')).toBe('row-1')
    expect(event.dataTransfer.getData('text/plain')).toBe('')
  })

  /*
   * A target may only ask for an effect its SOURCE allowed, and a mismatch is refused by the
   * platform in silence. `move` by default, which is what most drags of this studio mean — a row
   * reparented, a tab reordered — and the channel whose drop ADDS says so when it is built,
   * rather than every source of the studio being widened for one of them.
   */
  it('allows move by default, which is what a row moved or a tab reordered means', () => {
    const event = armed()
    dragChannel('application/x-test').start(event as never, 'row-1')

    expect(event.dataTransfer.effectAllowed).toBe('move')
  })

  it('takes the effect its channel was built with, so a drop that ADDS can show the +', () => {
    const event = armed()
    dragChannel('application/x-test', 'copy').start(event as never, 'row-1')

    expect(event.dataTransfer.effectAllowed).toBe('copy')
  })

  it('carries a handful as one, and gives them back in order', () => {
    const event = armed()
    const channel = dragListChannel('application/x-test-list', 'copy')
    channel.start(event as never, ['a', 'b', 'c'])

    expect(channel.idsFrom(event as never)).toEqual(['a', 'b', 'c'])
    expect(event.dataTransfer.effectAllowed).toBe('copy')
  })
})
