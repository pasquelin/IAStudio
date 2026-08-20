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
   * A target may only ask for an effect its SOURCE allowed. Armed with `move` alone, every
   * surface that ADDS rather than moves — the animation band takes an object and leaves it in
   * the scene — could not ask for `copy`, which is the effect that draws the `+` under the
   * pointer. Without it a drop that would work looks exactly like one that would not, and a
   * mismatch is refused by the platform in silence, with no error anywhere.
   */
  it('allows BOTH effects, so a target that adds can show the + that says so', () => {
    const event = armed()
    dragChannel('application/x-test').start(event as never, 'row-1')

    expect(event.dataTransfer.effectAllowed).toBe('copyMove')
  })

  it('carries a handful as one, and gives them back in order', () => {
    const event = armed()
    const channel = dragListChannel('application/x-test-list')
    channel.start(event as never, ['a', 'b', 'c'])

    expect(channel.idsFrom(event as never)).toEqual(['a', 'b', 'c'])
    expect(event.dataTransfer.effectAllowed).toBe('copyMove')
  })
})
