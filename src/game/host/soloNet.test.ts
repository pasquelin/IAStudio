// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import { createSoloNet } from './soloNet'
import type { Player } from '../ports/netPort'

const alone: Player = { id: 'p1', name: 'Alba', local: true }

describe('who is playing, alone', () => {
  /** Both sides at once, so every branch a networked game would take is reachable today. */
  it('answers as the server and as the client, holding the one player', () => {
    const net = createSoloNet(alone)

    expect(net.isServer()).toBe(true)
    expect(net.isClient()).toBe(true)
    expect(net.localPlayer()).toEqual(alone)
    expect(net.players()).toEqual([alone])
  })
})
