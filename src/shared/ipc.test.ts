import { describe, expect, it } from 'vitest'
import { CHANNELS, EVENTS } from './ipc'

describe('contrat IPC', () => {
  const allChannels = [...Object.values(CHANNELS), ...Object.values(EVENTS)]

  it('ne déclare aucun canal en double', () => {
    expect(new Set(allChannels).size).toBe(allChannels.length)
  })

  it('préfixe chaque canal de requête par son domaine', () => {
    for (const name of Object.values(CHANNELS)) expect(name).toMatch(/^[a-z]+:[a-z-]+$/)
  })

  it('préfixe chaque événement poussé par `evt:`', () => {
    for (const name of Object.values(EVENTS)) expect(name).toMatch(/^evt:[a-z-]+$/)
  })
})
