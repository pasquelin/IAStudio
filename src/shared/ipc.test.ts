import { describe, expect, it } from 'vitest'
import { CANAUX, EVENEMENTS } from './ipc'

describe('contrat IPC', () => {
  const tousLesCanaux = [...Object.values(CANAUX), ...Object.values(EVENEMENTS)]

  it('ne déclare aucun canal en double', () => {
    expect(new Set(tousLesCanaux).size).toBe(tousLesCanaux.length)
  })

  it('préfixe chaque canal de requête par son domaine', () => {
    for (const nom of Object.values(CANAUX)) expect(nom).toMatch(/^[a-z]+:[a-z-]+$/)
  })

  it('préfixe chaque événement poussé par `evt:`', () => {
    for (const nom of Object.values(EVENEMENTS)) expect(nom).toMatch(/^evt:[a-z-]+$/)
  })
})
