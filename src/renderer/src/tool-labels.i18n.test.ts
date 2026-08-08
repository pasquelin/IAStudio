import { describe, expect, it } from 'vitest'
import { isRecord } from '@shared/guards'
import { TRANSLATIONS } from '@shared/i18n'
import { IMAGE_TOOLS, TOOL_COMMANDS } from '@/spaces/image/image-tools'
import { SCENE_TOOLS } from '@/spaces/three/scene-tools'

/** Widened, not cast: the bundle's inferred type carries no index signature. */
const read = (bundle: unknown, key: string): unknown =>
  key
    .split('.')
    .reduce<unknown>((current, part) => (isRecord(current) ? current[part] : undefined), bundle)

const titleKeyOf = (command: string): string =>
  `commands.${command.replace(/\.(\w)/, (_, letter: string) => letter.toUpperCase())}.title`

/** Both bars, as pairs of the two keys that name one tool. */
function pairs(): { command: string; labelKey: string }[] {
  const fromImage = TOOL_COMMANDS.flatMap(({ command, tool, mode }) => {
    const entry = IMAGE_TOOLS.find(candidate => candidate.id === tool)
    const labelKey = mode
      ? entry?.modes?.find(candidate => candidate.id === mode)?.labelKey
      : entry?.labelKey
    return labelKey === undefined ? [] : [{ command, labelKey }]
  })

  const fromScene = SCENE_TOOLS.flatMap(tool =>
    tool.command === undefined ? [] : [{ command: tool.command, labelKey: tool.labelKey }],
  )

  return [...fromImage, ...fromScene]
}

/**
 * A tool wears two names. In the image bar the two differ on purpose: the bar shows the tool in
 * context and names it bare — `Pinceau` — while the shortcuts screen lists it among hundreds of
 * unrelated rows and prefixes it — `Outil Pinceau`. Fifteen of its twenty pairs read that way,
 * so equality is the wrong rule to ask for.
 *
 * Where ENGLISH gives one label to both surfaces, though, the gap was never intended and French
 * must not invent one. Both bars have shipped that mistake: `Sélection rectangle` against
 * `Sélection rectangulaire`, and `Tourner` against `Pivoter` — the latter under a tooltip that
 * already said « Faire pivoter l'objet ».
 */
describe('the two names a tool wears', () => {
  it('agree in French wherever they agree in English', () => {
    for (const { command, labelKey } of pairs()) {
      const titleKey = titleKeyOf(command)
      if (read(TRANSLATIONS.en, labelKey) !== read(TRANSLATIONS.en, titleKey)) continue

      expect(read(TRANSLATIONS.fr, labelKey), `${command} is named twice`).toBe(
        read(TRANSLATIONS.fr, titleKey),
      )
    }
  })

  it('covers both bars, so neither drifts unwatched', () => {
    expect(pairs().length).toBeGreaterThan(30)
  })
})
