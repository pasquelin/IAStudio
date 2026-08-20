import { describe, expect, it } from 'vitest'
import { WINDOW_SOURCES } from './windowSources'

/**
 * What edits a document, against what an outside client may ask for.
 *
 * The registry is held to its handlers, and the handlers to the tool list, in both directions —
 * but nothing held either to the STUDIO. A command written for a panel and published nowhere is
 * invisible from outside, and every guard stays green: measured on 2026-08-20, the whole world of
 * a 3D scene, the padlocks of a layer and the typeface of a caption were in exactly that state.
 */

/** The modules whose exports ARE the edits of a document — one per workspace that keeps one. */
const COMMAND_MODULES = [
  'engines/canvas/commands.ts',
  'engines/scene/commands.ts',
  'engines/scene/animationCommands.ts',
  'engines/timeline/commands.ts',
]

/** The end of a parameter list, braces and nesting counted, so a multi-line signature is read. */
function afterParameters(source: string, from: number): number {
  let depth = 0

  for (let index = from; index < source.length; index += 1) {
    if (source[index] === '(') depth += 1
    else if (source[index] === ')') {
      depth -= 1
      if (depth === 0) return index + 1
    }
  }

  return source.length
}

/**
 * Every command a module publishes — an exported function whose RETURN type is a `Command`.
 *
 * The return type and not the name: `copiesOf` and `keyableProperties` are read by commands and
 * are not ones, while `mergeDown` is one and says nothing of the sort in its name.
 */
function commandsOf(source: string): string[] {
  return [...source.matchAll(/export function (\w+)\(/g)]
    .filter(match =>
      source
        .slice(afterParameters(source, match.index + match[0].length - 1))
        .startsWith(': Command<'),
    )
    .map(match => match[1] ?? '')
}

/**
 * Everything the handlers are made of, as one text, WITH THE PROSE TAKEN OUT: `flatten` was read
 * as published because a comment used the English word, and it has no action at all.
 */
const HANDLERS = Object.entries(WINDOW_SOURCES)
  .filter(([path]) => path.includes('/assistant/') && path.endsWith('.ts'))
  .map(([, source]) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, ''))
  .join('\n')

/** Read once, like `HANDLERS`: both rules below walk the same four modules. */
const COMMANDS: readonly (readonly [string, readonly string[]])[] = COMMAND_MODULES.map(module => [
  module,
  commandsOf(Object.entries(WINDOW_SOURCES).find(([path]) => path.endsWith(module))?.[1] ?? ''),
])

/**
 * A command a combinator builds FROM, rather than a gesture of its own. Publishing one would be
 * publishing the same edit twice, under a name nobody performs.
 */
const COMBINATORS: readonly string[] = ['multi', 'editClip', 'railOnNewShot']

/**
 * Reached through `command.run` rather than by an action of its own — the OTHER door, which this
 * rule cannot see: a client fires the registry command beside each one and the surface in front
 * builds the edit. Listed so they do not read as gestures nothing can reach.
 */
const THROUGH_A_COMMAND: Readonly<Record<string, string>> = {
  flatten: 'canvas.flatten',
  clearGuides: 'canvas.clearGuides',
  removeCameraShot: 'scene.delete',
}

/**
 * The gestures no action publishes yet, named one by one — a map of what is left rather than a
 * count to make fall. Two rules hold it: a command added without a door fails the first, and one
 * that gains a door and stays listed here fails the second, so the list cannot rot in either
 * direction.
 *
 * Grouped by what would open them. The scene's half is the larger, and it is the one a client
 * driving the 3D space runs into first.
 */
const NOT_PUBLISHED: readonly string[] = [
  // The canvas: a mask, a caption's own box, guides, and the paint itself — which needs a live
  // GPU surface rather than a command, see the head of `canvasActions.ts`.
  'setLayerMask',
  'resizeCaption',
  'translateLayer',
  'paintPixels',
  'addGuide',
  'moveGuide',
  'removeGuide',
  // The scene: what a node is made of, what it is painted with, and what it casts.
  'setShadowOn',
  'setGeometry',
  'setGeometryOn',
  'setLightOn',
  'setMaterialOn',
  'setPath',
  'setCameraOn',
  'setSprite',
  'setSpriteOn',
  'setText',
  'setTextOn',
  'setTextMaterial',
  'setModelLanes',
  'setModelTextures',
  'groupNodes',
  'addNodes',
  'removeNodes',
  'moveNodes',
  // The animation band: keys, tracks, the shots a rail is bound to, and what a recorded move
  // becomes.
  'addAnimationTrack',
  'removeAnimationTrack',
  'setAnimationKey',
  'removeAnimationKey',
  'keyNode',
  'keySubject',
  'unkeySubject',
  'moveAnimationKey',
  'recordMove',
  'movesToCommand',
  'lensToCommand',
  'reorderCameraShots',
  'railForShot',
]

describe('what edits a document, and what an outside client may ask for', () => {
  /** A regex that reads nothing prints the same green as one that works. */
  it('finds the commands at all', () => {
    for (const [module, names] of COMMANDS) expect(names.length, module).toBeGreaterThan(10)

    expect(HANDLERS.length).toBeGreaterThan(10_000)
  })

  it('leaves no command of a document that no action can reach', () => {
    const known = new Set([...COMBINATORS, ...NOT_PUBLISHED, ...Object.keys(THROUGH_A_COMMAND)])
    const orphans = COMMANDS.flatMap(([module, names]) =>
      names
        .filter(name => !known.has(name) && !new RegExp(`\\b${name}\\b`).test(HANDLERS))
        .map(name => `${module} — ${name}`),
    )

    expect(orphans.sort()).toEqual([])
  })

  /**
   * The three lists against the modules themselves. A name that no longer names a command — one
   * renamed, one that stopped being a `Command` — is an entry that guards nothing while reading
   * as an exemption: `collapseLayer` sat here for a day in exactly that state.
   */
  it('names nothing the modules do not declare', () => {
    const declared = new Set(COMMANDS.flatMap(([, names]) => names))
    const listed = [...COMBINATORS, ...NOT_PUBLISHED, ...Object.keys(THROUGH_A_COMMAND)]

    expect(listed.filter(name => !declared.has(name)).sort()).toEqual([])
  })

  /** The other direction: a gesture that gained a door and stayed on the list above. */
  it('keeps no name on the list once an action reaches it', () => {
    const published = NOT_PUBLISHED.filter(name => new RegExp(`\\b${name}\\b`).test(HANDLERS))

    expect(published.sort()).toEqual([])
  })
})
