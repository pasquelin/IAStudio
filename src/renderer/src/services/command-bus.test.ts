import { describe, expect, it, vi } from 'vitest'
import { publishCommand, subscribeToCommands } from './command-bus'

describe('the command bus', () => {
  it('hands a command to everyone listening', () => {
    const heard = vi.fn()
    const stop = subscribeToCommands(heard)

    publishCommand('canvas.flatten')

    expect(heard).toHaveBeenCalledWith('canvas.flatten')
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
    const second = vi.fn()
    const stop = subscribeToCommands(() => stop())
    const stopSecond = subscribeToCommands(second)

    publishCommand('canvas.flatten')

    expect(second).toHaveBeenCalledWith('canvas.flatten')
    stopSecond()
  })
})
