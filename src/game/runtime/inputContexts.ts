import type { InputMap } from '@shared/domain/inputMap'

export type InputContexts = {
  active: () => readonly string[]
  push: (id: string) => void
  pop: (id: string) => void
}

export function createInputContexts(maps: readonly InputMap[]): InputContexts {
  const known = new Set(maps.map(map => map.id))
  const active = maps.filter(map => map.defaultActive).map(map => map.id)

  return {
    active: () => [...active],
    push: id => {
      if (known.has(id) && !active.includes(id)) active.push(id)
    },
    pop: id => {
      const index = active.indexOf(id)
      if (index >= 0) active.splice(index, 1)
    },
  }
}
