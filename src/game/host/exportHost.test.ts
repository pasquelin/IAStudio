// SPDX-License-Identifier: MIT

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createExportHost } from './exportHost'
import type { Player } from '../ports/netPort'

const player: Player = { id: 'p1', name: 'Alba', local: true }

const hosted = (): ReturnType<typeof createExportHost> =>
  createExportHost({
    input: document.createElement('div'),
    player,
    files: { asset_1: 'assets/torch.png' },
  })

describe('the game as an exported build fills it', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('serves its assets out of what it shipped, with no studio to ask', () => {
    expect(hosted().assets.urlOf({ kind: 'asset', id: 'asset_1' })).toBe('assets/torch.png')
  })

  /** No journal to send a line to: what a browser shows is the only place a fault appears. */
  it('prints what went wrong where a browser shows it, and keeps the rest to itself', () => {
    const printed = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const game = hosted()

    game.log.write('info', 'started')
    expect(printed).not.toHaveBeenCalled()

    game.log.write('warn', 'careful')
    expect(printed).toHaveBeenCalledWith('careful')
    expect(game.log.recent().map(entry => entry.message)).toEqual(['started', 'careful'])
  })

  it('refuses a generation, exactly as the studio does', async () => {
    expect(await hosted().ai.generateImage({ prompt: 'a torch', width: 64, height: 64 })).toEqual({
      ok: false,
      refused: 'notGranted',
    })
  })
})
