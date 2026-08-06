import { describe, expect, it } from 'vitest'
import { CHANNELS, EVENTS } from './ipc'

describe('IPC contract', () => {
  const allChannels = [...Object.values(CHANNELS), ...Object.values(EVENTS)]

  it('declares no duplicate channel', () => {
    expect(new Set(allChannels).size).toBe(allChannels.length)
  })

  it('prefixes every request channel with its domain', () => {
    for (const name of Object.values(CHANNELS)) expect(name).toMatch(/^[a-z]+:[a-z-]+$/)
  })

  it('prefixes every pushed event with `evt:`', () => {
    for (const name of Object.values(EVENTS)) expect(name).toMatch(/^evt:[a-z-]+$/)
  })
})
