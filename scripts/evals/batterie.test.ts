import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createFakeStudio } from './fakeStudio'
import { PROJECT } from './project'
import { SCENARIOS } from './scenarios'

/**
 * 🛑 What makes « on en est où ? » answerable: every request of `BATTERIE.md` has a scenario, and
 * every scenario answers to a request. Without this, the list and the bench drift apart in
 * silence — a request added to the markdown is measured by nothing, and a scenario written for
 * no request is counted as coverage of a list it is not on.
 */
const REQUESTS = [...readFileSync('scripts/evals/BATTERIE.md', 'utf8').matchAll(/^- \[[ x]\] «/gm)]

describe('the batterie and the bench', () => {
  it('carries one scenario per request of the list', () => {
    expect(SCENARIOS).toHaveLength(REQUESTS.length)
  })

  it('names every scenario after the section and the rank it answers', () => {
    const misnamed = SCENARIOS.filter(one => !/^\d{1,2}\.\d{1,2} /.test(one.name))

    expect(misnamed.map(one => one.name)).toEqual([])
  })

  it('numbers them in the order the list reads', () => {
    const rank = (name: string): number => {
      const [section, at] = name.split(' ')[0]?.split('.') ?? []
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
