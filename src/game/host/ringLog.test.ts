// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import { createRingLog } from './ringLog'
import type { LogEntry } from '../ports/logPort'

describe('what a game says about itself', () => {
  it('keeps what was written, oldest first', () => {
    const log = createRingLog()
    log.write('info', 'one')
    log.write('error', 'two')

    expect(log.recent().map(entry => entry.message)).toEqual(['one', 'two'])
    expect(log.recent().map(entry => entry.level)).toEqual(['info', 'error'])
  })

  /** A game left running writes without end: a log that keeps everything is a leak with a name. */
  it('drops the oldest once it is full', () => {
    const log = createRingLog(undefined, 2)
    for (const message of ['one', 'two', 'three']) log.write('info', message)

    expect(log.recent().map(entry => entry.message)).toEqual(['two', 'three'])
  })

  it('passes every entry on to the host that asked for them', () => {
    const echoed: LogEntry[] = []
    const log = createRingLog(entry => echoed.push(entry))
    log.write('warn', 'careful')

    expect(echoed.map(entry => entry.message)).toEqual(['careful'])
  })
})
