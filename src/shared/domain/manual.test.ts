import { describe, expect, it } from 'vitest'
import { deadManualLinks, manualTargetOf, type ManualChapter } from './manual'

const chapter = (slug: string, markdown: string, titles: string[]): ManualChapter => ({
  number: slug.slice(0, 2),
  slug,
  title: slug,
  markdown,
  headings: titles.map(title => ({ anchor: title, title, depth: 2 })),
})

describe('manualTargetOf', () => {
  // The three shapes a shipped chapter uses, and the refusal that makes the collector a gate.
  it('reads the shapes a chapter uses, and refuses anything else', () => {
    expect(manualTargetOf('#le-montage')).toEqual({ kind: 'anchor', anchor: 'le-montage' })
    expect(manualTargetOf('10-espace-video.md#les-pistes')).toEqual({
      kind: 'chapter',
      slug: '10-espace-video',
      anchor: 'les-pistes',
    })
    expect(manualTargetOf('https://scenario.com')).toEqual({
      kind: 'external',
      url: 'https://scenario.com',
    })
    expect(manualTargetOf('javascript:alert(1)')).toBeNull()
    expect(manualTargetOf('../guide-utilisateur.md')).toBeNull()
  })
})

describe('deadManualLinks', () => {
  it('accepts a link that names one heading of a shipped chapter', () => {
    const chapters = [
      chapter('01-one', 'see [there](02-two.md#deep)', ['top']),
      chapter('02-two', 'nothing here', ['deep']),
    ]

    expect(deadManualLinks(chapters, 'fr')).toEqual([])
  })

  /**
   * Chapter 15 carries three "Annuler et rétablir", so this is the manual's own shape rather
   * than an invented one. The window resolves an anchor with `getElementById`, which answers the
   * first match — a link meaning the third would land silently on the first.
   */
  it('refuses a link into a title the chapter repeats', () => {
    const chapters = [chapter('15-keys', 'back to [undo](#undo)', ['undo', 'undo', 'undo'])]

    expect(deadManualLinks(chapters, 'fr')).toEqual([
      'fr/15-keys: "#undo" names 3 headings, so it cannot land where it means',
    ])
  })
})
