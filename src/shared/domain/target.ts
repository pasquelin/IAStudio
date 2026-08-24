/**
 * What the assistant may aim at inside the open document.
 *
 * The kinds are four of the seven `stores/selection.ts` tells apart — the ones that live INSIDE a
 * document. An asset and a file belong to the project, and neither is aimed at from a sentence
 * about the picture in front.
 */
export type TargetKind = 'layer' | 'node' | 'clip' | 'track'

export const TARGET_KINDS: readonly TargetKind[] = ['layer', 'node', 'clip', 'track']

export type Target = {
  id: string
  kind: TargetKind
  /** What the person calls it — a layer name, an object name. Never translated. */
  name: string
  selected: boolean
}

/**
 * How many reach the model, and how long each part may be on the way.
 *
 * Budget rather than taste, and the three multiply: `instruction.test.ts` saturates all of them
 * at once against a full project context, which is the only measurement that means anything.
 * 40 for an id leaves room for the 36 of a `crypto.randomUUID()`.
 */
export const TARGETS_MAX = 10
export const TARGET_NAME_MAX = 32
export const TARGET_ID_MAX = 40

/** Anything that could forge a line of the briefing — see `narrowTargets`. */
const FORGERY = /["\p{Cc}]/gu

/**
 * The share of the document worth telling the model about, most likely first, each cut to what
 * the budget allows.
 *
 * Selection wins over everything: what is picked is what "it" means in a sentence that names
 * nothing. Then the names the sentence actually spells, so a document of two hundred layers still
 * carries the one that was asked for. The rest fills what is left, in the order the space gave
 * them — which for a layer stack is the order the person sees.
 *
 * 🛑 Three things happen to a target on the way out, and each has already a way of biting.
 * A NAME is cut, because `parseThought` rejects one over the bound rather than trimming it, and a
 * long layer name would have lost the whole turn. A name is also SCRUBBED of quotes and control
 * characters: names arrive verbatim from third-party files — an `.ora` layer called `x"\n  other`
 * forges a line inside the briefing and steers which id the model aims at. An ID over the bound
 * is DROPPED rather than cut: a trimmed name still reads, a trimmed key resolves to nothing and
 * ends the turn in `notFound` with no explanation.
 */
export function narrowTargets(
  targets: readonly Target[],
  utterance: string,
  max = TARGETS_MAX,
): readonly Target[] {
  const said = utterance.toLowerCase()
  const rank = (target: Target): number => {
    if (target.selected) return 0
    return target.name !== '' && said.includes(target.name.toLowerCase()) ? 1 : 2
  }

  // `sort` is stable, so equal ranks keep the order they arrived in — no tie-breaker needed.
  return targets
    .filter(target => target.id.length <= TARGET_ID_MAX)
    .sort((one, other) => rank(one) - rank(other))
    .slice(0, max)
    .map(target => ({
      ...target,
      name: target.name.replace(FORGERY, ' ').slice(0, TARGET_NAME_MAX),
    }))
}
