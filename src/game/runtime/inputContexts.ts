// SPDX-License-Identifier: MIT

import type { InputMap } from '@shared/domain/inputMap'

export type InputContexts = {
  active: () => readonly string[]
  push: (id: string) => void
  pop: (id: string) => void
}

/**
 * 🛑 `report` is what an author's only feedback used to be: nothing. `push` of a context no file
 * declares is a no-op, and a script asking for `menu` on a project with no `menu.input.json` saw
 * no return value, no fault and no log line.
 */
export function createInputContexts(
  maps: readonly InputMap[],
  report?: (message: string) => void,
): InputContexts {
  const known = new Set(maps.map(map => map.id))
  const active = maps.filter(map => map.defaultActive).map(map => map.id)
  const said = new Set<string>()

  return {
    active: () => [...active],
    push: id => {
      if (!known.has(id)) {
        if (report && !said.has(id)) {
          said.add(id)
          report(
            `input context ${id} is not declared by any control map, so pushing it does nothing`,
          )
        }
        return
      }
      if (!active.includes(id)) active.push(id)
    },
    pop: id => {
      const index = active.indexOf(id)
      if (index >= 0) active.splice(index, 1)
    },
  }
}
