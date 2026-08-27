import { byCodeUnit } from '@shared/text'

/** What a project holds, as a script names it. Everything a completion should propose. */
export type ProjectNames = {
  /** Scene documents, by the name their author gave them. */
  scenes: readonly string[]
  /** Prefabs the manifest declares. */
  prefabs: readonly string[]
  /** Entity names of the scene being played — what `game.spawn` and `self.say` reach. */
  entities: readonly string[]
  /** Component types the studio has a descriptor for. */
  components: readonly string[]
  /** Event names something in the project actually emits. */
  events: readonly string[]
}

/**
 * The project's own declaration, layered over `studio.d.ts`.
 *
 * 🛑 This is what turns a typo into a RED squiggle before a Play: `self.get('Helth')` is not a
 * string the union holds, so the type worker refuses it — and that is the whole reason a child
 * and a model can both write a script that references something real.
 *
 * An empty list widens back to `string` rather than to `never`: a project with no prefab yet must
 * not make every `spawn` an error.
 */
export function projectTypes(names: ProjectNames): string {
  return [
    '// Generated for THIS project. Nothing edits it: it is rebuilt whenever the project changes.',
    "declare module '@studio' {",
    union('SceneName', names.scenes),
    union('PrefabName', names.prefabs),
    union('EntityName', names.entities),
    union('ComponentType', names.components),
    union('EventName', names.events),
    '}',
    '',
  ].join('\n')
}

const union = (name: string, values: readonly string[]): string => {
  const held = [...new Set(values)].filter(one => one.length > 0).sort(byCodeUnit)
  const spelt = held.length === 0 ? 'string' : held.map(one => JSON.stringify(one)).join(' | ')
  return `  export type ${name} = ${spelt}`
}
