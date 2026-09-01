import { describe, expect, it } from 'vitest'
import { emptyScreen, newUiDocument, uiFromPayload, uiPayload } from './uiDocument'
import {
  DEFAULT_INTERACTION,
  DEFAULT_PLACEMENT,
  DEFAULT_STYLE,
  HOLDS_CHILDREN,
  UI_ALIGNS,
  UI_ANCHORS,
  UI_CURSORS,
  UI_ELEMENT_TYPES,
  UI_FITS,
  UI_JUSTIFIES,
  UI_MODES,
  UI_SCROLL_AXES,
  UI_TEXT_ALIGNS,
  UI_VERSION,
  type UiAlign,
  type UiAnchor,
  type UiCursor,
  type UiDocument,
  type UiElement,
  type UiElementType,
  type UiImage,
  type UiStack,
  type UiText,
  type UiFit,
  type UiJustify,
  type UiMode,
  type UiScrollAxis,
  type UiTextAlign,
} from './ui'

/** Named in order, so a failure says WHICH element rather than which uuid. */
function ids(): () => string {
  let next = 0
  return () => `e${(next += 1)}`
}

/** A file as it comes back off disk: through JSON, so nothing keeps a live reference. */
function reread(document: UiDocument): UiDocument {
  const state = uiFromPayload(JSON.parse(JSON.stringify(uiPayload(document))), ids())
  expect(state.trouble).toBeNull()
  return state.document
}

const TEXT: UiText = {
  value: '',
  font: { source: 'embedded', family: 'Lato' },
  size: 24,
  weight: 700,
  align: 'center',
  color: '#00ff00',
  wrap: false,
}

const IMAGE: UiImage = { assetId: '', fit: 'cover', tint: '#ff00ff' }

const STACK: UiStack = {
  direction: 'row',
  gap: 16,
  align: 'center',
  justify: 'between',
  wrap: true,
}

/** One element of every type, each carrying something of its own to lose. */
function sample(type: UiElementType, newId: () => string): UiElement {
  const base = {
    id: newId(),
    name: `a ${type}`,
    visible: false,
    enabled: false,
    locked: true,
    place: { ...DEFAULT_PLACEMENT, offset: { x: 12, y: 34 }, grow: 2 },
    style: { ...DEFAULT_STYLE, opacity: 0.5 },
    interaction: { ...DEFAULT_INTERACTION, action: 'poke', focusable: true },
  }

  if (type === 'screen') return { ...base, type, children: [] }
  if (type === 'stack') return { ...base, type, stack: STACK, children: [] }
  if (type === 'grid') {
    return { ...base, type, grid: { columns: 3, gap: 4, align: 'center' }, children: [] }
  }
  if (type === 'scroll') return { ...base, type, scroll: { axis: 'both' }, children: [] }
  if (type === 'button') return { ...base, type, text: { ...TEXT, value: 'Play' }, children: [] }
  if (type === 'text') return { ...base, type, text: { ...TEXT, value: 'Score' } }
  if (type === 'image') return { ...base, type, image: { ...IMAGE, assetId: 'asset_1' } }
  if (type === 'progress') {
    return {
      ...base,
      type,
      progress: { value: 0.25, min: 0, max: 1, fill: '#ff0000', track: '#111111' },
    }
  }
  if (type === 'slider') return { ...base, type, slider: { value: 3, min: 0, max: 10, step: 0.5 } }
  if (type === 'input') {
    return {
      ...base,
      type,
      input: { value: 'x', placeholder: 'name', maxLength: 12, secret: true },
    }
  }
  if (type === 'checkbox') return { ...base, type, checkbox: { checked: true } }
  if (type === 'spacer') return { ...base, type }

  return { ...base, type: 'panel', children: [] }
}

function documentWith(children: readonly UiElement[]): UiDocument {
  const blank = newUiDocument(ids())
  return { ...blank, root: { ...blank.root, children } }
}

describe('a ui document', () => {
  it.each([...UI_ELEMENT_TYPES])('round-trips a %s through what a file holds', type => {
    const element = sample(type, ids())

    expect(reread(documentWith([element])).root.children).toEqual([element])
  })

  it('round-trips elements nested three deep', () => {
    const newId = ids()
    const leaf = sample('text', newId)
    const middle = { ...sample('stack', newId), children: [leaf] } as UiElement
    const outer = { ...sample('panel', newId), children: [middle] } as UiElement

    expect(reread(documentWith([outer])).root.children).toEqual([outer])
  })

  it('keeps the mode and the design resolution it was written with', () => {
    const written: UiDocument = {
      ...documentWith([]),
      mode: 'world',
      design: { width: 800, height: 600 },
    }
    const read = reread(written)

    expect(read.mode).toBe('world')
    expect(read.design).toEqual({ width: 800, height: 600 })
  })

  it('stamps this build version onto what it wrote', () => {
    expect(reread(documentWith([])).version).toBe(UI_VERSION)
  })

  /**
   * Defaults first, the file on top: how a document written by an older build opens at all.
   * `name` defaults to NOTHING and not to the type — an outliner showing `panel` as a title
   * would be writing an English identifier onto a screen the studio translates.
   */
  it('fills what a file does not say rather than dropping the element', () => {
    const read = uiFromPayload(
      { root: { type: 'screen', id: 'root', children: [{ type: 'panel', id: 'p' }] } },
      ids(),
    ).document

    expect(read.root.children[0]).toEqual({
      id: 'p',
      type: 'panel',
      name: '',
      visible: true,
      enabled: true,
      locked: false,
      place: DEFAULT_PLACEMENT,
      style: DEFAULT_STYLE,
      interaction: DEFAULT_INTERACTION,
      children: [],
    })
  })

  it('drops a child it cannot read and keeps the ones around it', () => {
    const read = uiFromPayload(
      {
        root: {
          type: 'screen',
          id: 'root',
          children: [{ type: 'panel', id: 'a' }, { type: 'nonsense' }, { type: 'panel', id: 'b' }],
        },
      },
      ids(),
    ).document

    expect(read.root.children.map(child => child.id)).toEqual(['a', 'b'])
  })

  /**
   * An id is what a binding, a keyframe and a script's `get` key on, so losing one breaks those
   * either way — a visible element is something to repair, a vanished one something to notice.
   */
  it('mints an id a file has lost rather than losing the element', () => {
    const read = uiFromPayload(
      { root: { type: 'screen', children: [{ type: 'panel' }] } },
      ids(),
    ).document

    expect(read.root.children).toHaveLength(1)
    expect(read.root.children[0]?.id).not.toBe('')
  })

  /**
   * The whole reason a read answers a trouble: handed back as a blank screen, a half-synced
   * file is one ⌘S away from becoming one for good.
   */
  it('refuses a file rooted on anything but a screen rather than opening it blank', () => {
    expect(uiFromPayload({ root: { type: 'button', id: 'b' } }, ids()).trouble).toBe('unreadable')
    expect(uiFromPayload('not a document', ids()).trouble).toBe('unreadable')
    expect(uiFromPayload({}, ids()).trouble).toBe('unreadable')
  })

  /** Read before the shape, so « update the studio » and « repair this file » stay apart. */
  it('refuses a file written by a later build, and says which trouble it is', () => {
    const written = { ...uiPayload(documentWith([])), version: UI_VERSION + 1 }

    expect(uiFromPayload(written, ids()).trouble).toBe('too-new')
  })

  it('holds the design resolution to a pixel each way, whatever the file said', () => {
    const read = uiFromPayload(
      { ...uiPayload(documentWith([])), design: { width: 0, height: -9 } },
      ids(),
    )

    expect(read.document.design).toEqual({ width: 1, height: 1 })
  })

  it('keeps the bindings it can resolve', () => {
    const written: UiDocument = {
      ...documentWith([]),
      bindings: [
        { element: 'bar', property: 'value', source: { kind: 'game', path: 'score' }, fallback: 0 },
        {
          element: 'life',
          property: 'value',
          source: { kind: 'component', entity: 'e', component: 'Health', field: 'current' },
          fallback: null,
        },
      ],
    }

    expect(reread(written).bindings).toEqual(written.bindings)
  })

  /** A `kind` this build cannot resolve is dropped, never rewritten to a family it is not. */
  it('drops a binding whose source names an unknown family', () => {
    const read = uiFromPayload(
      {
        root: { type: 'screen', id: 'root', children: [] },
        bindings: [{ element: 'a', property: 'value', source: { kind: 'settings', path: 'x' } }],
      },
      ids(),
    ).document

    expect(read.bindings).toEqual([])
  })

  it('gives a fresh document a screen and nothing else', () => {
    const blank = newUiDocument(ids())

    expect(blank.root).toEqual(emptyScreen(ids()))
    expect(blank.bindings).toEqual([])
  })
})

/**
 * TypeScript cannot say on its own that an array covers its union — the shape
 * `shared/domain/exhaustive.test.ts` keeps, held here because these lists serve one format.
 *
 * A member added without listing it is not caught by what READS the list: `oneOf` simply falls
 * back, so a file written with that value opens showing another one. Worse for the element
 * types, where `isUiElementType` answers false and the element is dropped with its subtree.
 */
describe('every union of the format', () => {
  it('lists every member it declares', () => {
    const modes: Record<UiMode, true> = { screen: true, world: true }
    const types: Record<UiElementType, true> = {
      screen: true,
      panel: true,
      stack: true,
      grid: true,
      scroll: true,
      spacer: true,
      text: true,
      image: true,
      button: true,
      progress: true,
      slider: true,
      input: true,
      checkbox: true,
    }
    const anchors: Record<UiAnchor, true> = {
      topLeft: true,
      top: true,
      topRight: true,
      left: true,
      center: true,
      right: true,
      bottomLeft: true,
      bottom: true,
      bottomRight: true,
    }
    const aligns: Record<UiAlign, true> = { start: true, center: true, end: true, stretch: true }
    const justifies: Record<UiJustify, true> = {
      start: true,
      center: true,
      end: true,
      between: true,
      around: true,
    }
    const fits: Record<UiFit, true> = { contain: true, cover: true, fill: true, none: true }
    const cursors: Record<UiCursor, true> = {
      default: true,
      pointer: true,
      text: true,
      notAllowed: true,
    }
    const textAligns: Record<UiTextAlign, true> = { left: true, center: true, right: true }
    const axes: Record<UiScrollAxis, true> = { vertical: true, horizontal: true, both: true }

    expect([...UI_MODES].sort()).toEqual(Object.keys(modes).sort())
    expect([...UI_ELEMENT_TYPES].sort()).toEqual(Object.keys(types).sort())
    expect([...UI_ANCHORS].sort()).toEqual(Object.keys(anchors).sort())
    expect([...UI_ALIGNS].sort()).toEqual(Object.keys(aligns).sort())
    expect([...UI_JUSTIFIES].sort()).toEqual(Object.keys(justifies).sort())
    expect([...UI_FITS].sort()).toEqual(Object.keys(fits).sort())
    expect([...UI_CURSORS].sort()).toEqual(Object.keys(cursors).sort())
    expect([...UI_TEXT_ALIGNS].sort()).toEqual(Object.keys(textAligns).sort())
    expect([...UI_SCROLL_AXES].sort()).toEqual(Object.keys(axes).sort())
  })

  /**
   * `HOLDS_CHILDREN` is a `Record`, so the compiler already refuses a type that answers nothing.
   * What it cannot refuse is a WRONG answer, and one costs the children of every such element.
   */
  it('agrees with what each type carries', () => {
    const carrying = UI_ELEMENT_TYPES.filter(type => 'children' in sample(type, ids()))

    expect(carrying.filter(type => !HOLDS_CHILDREN[type])).toEqual([])
    expect(
      UI_ELEMENT_TYPES.filter(type => HOLDS_CHILDREN[type] && !carrying.includes(type)),
    ).toEqual([])
  })
})
