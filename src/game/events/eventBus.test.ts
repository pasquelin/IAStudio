// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import { createEventBus, type EventBus } from './eventBus'
import type { GameEvent } from './gameEvent'

const started = (): GameEvent => ({ name: 'GameStarted', payload: {} })

const quiet = (): EventBus => createEventBus(() => {})

describe('the bus a world speaks on', () => {
  it('delivers nothing until it is drained', () => {
    const bus = quiet()
    const heard: string[] = []
    bus.on('GameStarted', event => heard.push(event.name))

    bus.emit(started())
    expect(heard).toEqual([])
    expect(bus.pending()).toBe(1)

    bus.drain()
    expect(heard).toEqual(['GameStarted'])
  })

  /**
   * The crash every engine has: a handler destroying an entity while a system walks the store.
   * What a handler emits waits for the NEXT drain, so no delivery is ever reentrant.
   */
  it('holds back what a handler emits, rather than delivering it inside the drain', () => {
    const bus = quiet()
    const heard: string[] = []
    bus.on('GameStarted', () => bus.emit({ name: 'GameStopped', payload: {} }))
    bus.on('GameStopped', event => heard.push(event.name))

    bus.emit(started())
    bus.drain()
    expect(heard).toEqual([])

    bus.drain()
    expect(heard).toEqual(['GameStopped'])
  })

  it('stops delivering to a listener that let go', () => {
    const bus = quiet()
    const heard: string[] = []
    const off = bus.on('GameStarted', event => heard.push(event.name))

    off()
    bus.emit(started())
    bus.drain()

    expect(heard).toEqual([])
  })

  /** The one-shot, and the obvious way to write it: it must not cost the next listener its turn. */
  it('delivers to every listener even when one drops itself mid-delivery', () => {
    const bus = quiet()
    const heard: string[] = []
    const off = bus.on('GameStarted', () => {
      heard.push('once')
      off()
    })
    bus.on('GameStarted', () => heard.push('after'))

    bus.emit(started())
    bus.drain()

    expect(heard).toEqual(['once', 'after'])
  })

  it('reports a handler that threw and delivers to the rest all the same', () => {
    const troubles: string[] = []
    const bus = createEventBus(error => troubles.push(String(error)))
    const heard: string[] = []
    bus.on('GameStarted', () => {
      throw new Error('broken')
    })
    bus.on('GameStarted', () => heard.push('after'))

    bus.emit(started())
    bus.drain()

    expect(heard).toEqual(['after'])
    expect(troubles).toEqual(['Error: broken'])
  })

  /** A throw used to leave the tick's events in the buffer, and they came back two drains later. */
  it('never delivers an event a second time, whatever a handler did', () => {
    const bus = createEventBus(() => {})
    const heard: string[] = []
    bus.on('GameStarted', () => {
      heard.push('started')
      throw new Error('broken')
    })
    bus.on('GamePaused', event => heard.push(event.name))

    bus.emit(started())
    bus.drain()
    bus.emit({ name: 'GamePaused', payload: {} })
    bus.drain()
    bus.drain()

    expect(heard).toEqual(['started', 'GamePaused'])
  })

  /** What STOP does: nothing of one Play session may reach the next, this tick included. */
  it('forgets every listener and everything queued when it is cleared', () => {
    const bus = quiet()
    const heard: string[] = []
    bus.on('GameStarted', event => heard.push(event.name))
    bus.emit(started())

    bus.clear()
    bus.drain()

    expect(heard).toEqual([])
    expect(bus.pending()).toBe(0)
  })

  it('stops the delivery under way when a handler raises the STOP', () => {
    const bus = quiet()
    const heard: string[] = []
    bus.on('GameStarted', () => bus.clear())
    bus.on('GameStarted', () => heard.push('after'))

    bus.emit(started())
    bus.drain()

    expect(heard).toEqual([])
  })
})
