import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createFakeStudio } from './fakeStudio'
import { rankOf } from './coverage'
import { PROJECT } from './project'
import { SCENARIOS } from './scenarios'

/**
 * 🛑 What makes « on en est où ? » answerable: every request of `BATTERIE.md` has a scenario, and
 * every scenario answers to a request. Without this, the list and the bench drift apart in
 * silence — a request added to the markdown is measured by nothing, and a scenario written for
 * no request is counted as coverage of a list it is not on.
 */
const LIST = readFileSync('scripts/evals/BATTERIE.md', 'utf8').split('\n')

const REQUESTS = LIST.filter(one => /^- \[[ x]\] «/.test(one))

/** A sentence as either side spells it — the quotes and the wrapping are not the point. */
const plainly = (said: string): string =>
  said.replace(/[’']/g, "'").replace(/\s+/g, ' ').trim().toLowerCase()

/**
 * What each request ASKS, in order.
 *
 * Two things a one-line regex gets wrong, and both were live: Prettier wraps a long request over
 * several lines, and section 30 writes a note AFTER the closing quote. So: join until the first
 * `»`, then read between the quotes.
 */
const asked = (): readonly string[] => {
  const found: string[] = []
  for (let at = 0; at < LIST.length; at += 1) {
    if (!/^- \[[ x]\] «/.test(LIST[at] ?? '')) continue

    let whole = LIST[at] ?? ''
    while (!whole.includes('»') && at + 1 < LIST.length) {
      at += 1
      whole = `${whole} ${LIST[at]}`
    }
    found.push(plainly(whole.slice(whole.indexOf('«') + 1, whole.indexOf('»'))))
  }

  return found
}

describe('the batterie and the bench', () => {
  it('carries one scenario per request of the list', () => {
    expect(SCENARIOS).toHaveLength(REQUESTS.length)
  })

  /**
   * 🛑 The list and the bench have to say the SAME sentence, or `BATTERIE.md` describes a bench
   * nobody runs. Seven had drifted — one of them asking for « l'os que je viens d'ajouter » on a
   * decor that never added one — and nothing was red: the count matched, the order matched, and
   * only the words differed.
   *
   * The LAST sentence, because a scenario whose chain is the subject carries its earlier steps
   * as setup — the list only ever names the request being scored.
   */
  it('says of each request the sentence the list carries', () => {
    const list = asked()
    const drifted = SCENARIOS.map((one, at) =>
      plainly(one.said.at(-1) ?? '') === list[at] ? null : one.name,
    ).filter(one => one !== null)

    expect(drifted).toEqual([])
  })

  it('names every scenario after the section and the rank it answers', () => {
    const misnamed = SCENARIOS.filter(one => !/^\d{1,2}\.\d{1,2} /.test(one.name))

    expect(misnamed.map(one => one.name)).toEqual([])
  })

  it('numbers them in the order the list reads', () => {
    const rank = (name: string): number => {
      const [section, at] = rankOf(name).split('.')
      return Number(section) * 100 + Number(at)
    }
    const ranks = SCENARIOS.map(one => rank(one.name))

    expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
  })

  /**
   * 🛑 A decor whose calls are REFUSED lays out nothing, and the scenario then runs against an
   * empty studio — the model is blamed for a scene that was never built. Found the day
   * `layer.add { kind: 'raster' }` was refused for an option the registry does not declare, and
   * nothing said so: the layer scenarios were about to be scored on a picture with no layers.
   */
  it('lays out every decor without a single refusal', () => {
    const broken: string[] = []
    for (const scenario of SCENARIOS) {
      if (!scenario.setup) continue

      const studio = createFakeStudio(PROJECT)
      scenario.setup(studio)
      if (studio.refusals().length > 0) {
        broken.push(`${scenario.name}: ${studio.refusals().join(', ')}`)
      }
    }

    expect(broken).toEqual([])
  })

  /**
   * 🛑 An oracle already true after the decor measures NOTHING: a model that answers with no call
   * at all scores a pass. Six were, and the report would have counted them as successes.
   */
  it('leaves no scenario a model could pass by doing nothing', () => {
    const vacuous = SCENARIOS.filter(scenario => {
      const studio = createFakeStudio(PROJECT)
      scenario.setup?.(studio)
      studio.settle()
      return scenario.passed({ studio, called: [], answers: [], refused: 0, said: '' })
    })

    expect(vacuous.map(one => one.name)).toEqual([])
  })

  it('gives every scenario something for the person to say', () => {
    const mute = SCENARIOS.filter(
      one => one.said.length === 0 || one.said.some(w => w.trim() === ''),
    )

    expect(mute.map(one => one.name)).toEqual([])
  })
})
