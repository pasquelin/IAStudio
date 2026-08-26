import { describe, expect, it, vi } from 'vitest'
import { publishCommand, subscribeToCommands } from './commandBus'

describe('the command bus', () => {
  it('hands a command to everyone listening', () => {
    const heard = vi.fn()
    const stop = subscribeToCommands(heard)

    publishCommand('canvas.flatten')

    expect(heard).toHaveBeenCalledWith('canvas.flatten', null)
    stop()
  })

  /** Who it is for travels with it; whether that listener wants it is the listener's business. */
  it('names the document a sender addressed it to', () => {
    const heard = vi.fn()
    const stop = subscribeToCommands(heard)

    publishCommand('canvas.maskFromSelection', 'doc-2')

    expect(heard).toHaveBeenCalledWith('canvas.maskFromSelection', 'doc-2')
    stop()
  })

  it('says nothing more once a listener has stopped', () => {
    const heard = vi.fn()
    subscribeToCommands(heard)()

    publishCommand('canvas.flatten')

    expect(heard).not.toHaveBeenCalled()
  })

  /**
   * A document unmounts on the command it is handed — closing its tab is a command like any
   * other. Iterating the live set would then skip the listener that follows it.
   */
  it('survives a listener that unsubscribes while being called', () => {
    const second = vi.fn(() => true)
    const stop = subscribeToCommands(() => {
      stop()
      return true
    })
    const stopSecond = subscribeToCommands(second)

    publishCommand('canvas.flatten')

    expect(second).toHaveBeenCalledWith('canvas.flatten', null)
    stopSecond()
  })
})
