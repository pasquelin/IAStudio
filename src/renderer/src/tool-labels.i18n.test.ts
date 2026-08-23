import { describe, expect, it } from 'vitest'
import { isRecord } from '@shared/guards'
import { LANGUAGES, TRANSLATIONS } from '@shared/i18n'
import { IMAGE_TOOLS, TOOL_COMMANDS } from '@/spaces/image/imageTools'
import { SCENE_TOOLS } from '@/spaces/three/sceneTools'

/** Widened, not cast: the bundle's inferred type carries no index signature. */
const read = (bundle: unknown, key: string): unknown =>
  key
    .split('.')
    .reduce<unknown>((current, part) => (isRecord(current) ? current[part] : undefined), bundle)

const titleKeyOf = (command: string): string =>
  `commands.${command.replace(/\.(\w)/, (_, letter: string) => letter.toUpperCase())}.title`

/** The button a row of the image table arms — the mode inside it when the row names one. */
const armedButton = ({ tool, mode }: { tool: string; mode?: string }) => {
  const button = IMAGE_TOOLS.find(candidate => candidate.id === tool)
  return mode === undefined ? button : button?.modes?.find(candidate => candidate.id === mode)
}

/** Both bars, as pairs of the two keys that name one tool. */
function pairs(): { command: string; labelKey: string }[] {
  const fromImage = TOOL_COMMANDS.flatMap(({ command, ...arms }) => {
    const labelKey = armedButton(arms)?.labelKey
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

  /**
   * What the rule above cannot see: a pair the two languages BOTH split, each its own way. The
   * palette shipped `Remplir le calque` against `Outil Pot de peinture`, and `Trait` against
   * `Forme Ligne` — the prefix may dress the bare name, never replace it.
   */
  it('carries the bare name inside the prefixed one, in every language', () => {
    const drift = LANGUAGES.flatMap(({ code }) =>
      pairs().flatMap(({ command, labelKey }) => {
        const label = read(TRANSLATIONS[code], labelKey)
        const title = read(TRANSLATIONS[code], titleKeyOf(command))
        if (typeof label !== 'string' || typeof title !== 'string')
          return [`${code} ${command}: ${labelKey} or its command title reads nothing`]
        return title.toLocaleLowerCase(code).includes(label.toLocaleLowerCase(code))
          ? []
          : [`${code} ${command}: "${title}" drops "${label}"`]
      }),
    )

    expect(drift).toEqual([])
  })

  /** `TOOL_COMMANDS` is written by hand, and a row that arms nothing leaves `pairs` in silence. */
  it('arms a button for every row of the image table', () => {
    const orphans = TOOL_COMMANDS.filter(entry => armedButton(entry) === undefined)

    expect(orphans.map(entry => entry.command)).toEqual([])
  })

  /**
   * A floor, so the rule above cannot go quiet by covering nothing. Lowered from thirty when the
   * 3D bar went from twenty-three buttons to eight: what left it are menu rows now, whose labels
   * come from `commands.*` and are the very keys this rule compares against — there is no second
   * name left for them to drift from.
   */
  it('covers both bars, so neither drifts unwatched', () => {
    expect(pairs().length).toBeGreaterThan(25)
  })
})
