import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { GraphNode } from '@shared/domain/graph'
import { installGraph } from '@/stores/graph-fixtures'
import { graphOf, historyOf, useGraphs } from '@/stores/graphs'
import { GraphNodeInspector } from './GraphNodeInspector'

const DOCUMENT = 'graph-1'

const TEXT: GraphNode = {
  id: 'text1',
  type: 'text',
  position: { x: 0, y: 0 },
  data: { value: 'a small grey rock' },
}

const NOTE: GraphNode = {
  id: 'stickyNote1',
  type: 'stickyNote',
  position: { x: 0, y: 0 },
  data: { content: 'Read me' },
}

const ASSET: GraphNode = {
  id: 'asset1',
  type: 'asset',
  position: { x: 0, y: 0 },
  data: { type: 'image', value: 'asset_Hr7', title: 'Kingfisher' },
}

const LOOP: GraphNode = { id: 'forEach1', type: 'forEach', position: { x: 0, y: 0 }, data: {} }

const APPROVAL: GraphNode = {
  id: 'approval1',
  type: 'approval',
  position: { x: 0, y: 0 },
  data: { message: 'On garde ?' },
}

/**
 * What a file can hold and the type cannot: `parseGraph` validates the node, never its `data`.
 * Written through `JSON.parse` so the shapes are the ones a reader really produces.
 */
const BAD_ASSET: GraphNode = {
  id: 'asset2',
  type: 'asset',
  position: { x: 0, y: 0 },
  ...JSON.parse('{"data":{"value":null,"type":{"kind":"image"}}}'),
}

const MANY_ASSETS: GraphNode = {
  id: 'asset3',
  type: 'asset',
  position: { x: 0, y: 0 },
  data: { type: 'image', value: ['asset_a', 'asset_b'], isMultiple: true },
}

beforeEach(() => {
  installGraph(DOCUMENT, {
    nodes: [TEXT, NOTE, ASSET, LOOP, APPROVAL],
    edges: [],
    inputKeys: [],
  })
})

const nodeById = (id: string): GraphNode | undefined =>
  graphOf(useGraphs.getState(), DOCUMENT).nodes.find(node => node.id === id)

/**
 * Subscribed, as `Inspector` is. Handed a frozen node instead, every field reads the value it
 * opened on however many keystrokes it took — so a test typing one character passes while the
 * second character overwrites the first.
 */
function Live({ id }: { id: string }) {
  const node = useGraphs(state => graphOf(state, DOCUMENT).nodes.find(entry => entry.id === id))
  return node ? <GraphNodeInspector documentId={DOCUMENT} node={node} /> : null
}

const show = (node: GraphNode): void => {
  render(<Live id={node.id} />)
}

describe('GraphNodeInspector', () => {
  it('names the node by the id an edge and a reference call it by', () => {
    show(TEXT)

    expect(screen.getByText('text1')).toBeInTheDocument()
  })

  it('writes what is typed into the node the canvas draws', async () => {
    show(TEXT)
    await userEvent.type(screen.getByLabelText('Prompt'), '!')

    expect(nodeById('text1')?.data).toMatchObject({ value: 'a small grey rock!' })
  })

  /**
   * A note carries its text under `content`, NOT `value` — read off a published App. Writing the
   * other field leaves the note blank on the canvas and blank again in the webapp.
   */
  it('writes a note under content rather than value', async () => {
    show(NOTE)
    await userEvent.type(screen.getByLabelText('Texte'), '!')

    expect(nodeById('stickyNote1')?.data).toMatchObject({ content: 'Read me!' })
    expect(nodeById('stickyNote1')?.data).not.toHaveProperty('value')
  })

  it('renames a node without touching what it holds', async () => {
    show(ASSET)
    await userEvent.clear(screen.getByLabelText('Titre'))
    await userEvent.type(screen.getByLabelText('Titre'), 'Reference')

    expect(nodeById('asset1')?.data).toMatchObject({ title: 'Reference', value: 'asset_Hr7' })
  })

  /**
   * A typed sentence is ONE undo entry. Without the gesture props of `useDocumentEdit` it is one
   * per keystroke, and a hundred of them evict everything the session did before.
   */
  it('collapses a typed sentence into a single history entry', async () => {
    show(TEXT)
    const before = historyOf(useGraphs.getState(), DOCUMENT).past.length
    await userEvent.type(screen.getByLabelText('Prompt'), 'ette')

    expect(historyOf(useGraphs.getState(), DOCUMENT).past.length).toBe(before + 1)
  })

  /** The eleven types the editor has no face for still say what they are, never nothing. */
  it('falls back to the raw name of a type it has no translation for', () => {
    show(LOOP)

    expect(screen.getByText('forEach')).toBeInTheDocument()
    expect(screen.queryByLabelText('Prompt')).not.toBeInTheDocument()
  })

  it('offers no text field on a type that carries no text', () => {
    show(ASSET)

    expect(screen.queryByLabelText('Prompt')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Source')).toHaveValue('asset_Hr7')
    expect(screen.getByText('image')).toBeInTheDocument()
  })

  /**
   * The one field an approval carries, and what the converter hands over as the flow node's
   * label — so the sentence the studio writes is the one a published run puts to the user.
   */
  it('writes the question an approval asks', async () => {
    show(APPROVAL)
    await userEvent.type(screen.getByLabelText('Question posée'), '!')

    expect(nodeById('approval1')?.data).toMatchObject({ message: 'On garde ?!' })
  })

  /** A graph read off a file carries no `message` at all, and the field must still open. */
  it('opens the question of an approval that carries none', () => {
    const bare: GraphNode = {
      id: 'approval2',
      type: 'approval',
      position: { x: 0, y: 0 },
      data: {},
    }
    installGraph(DOCUMENT, { nodes: [bare], edges: [], inputKeys: [] })
    show(bare)

    expect(screen.getByLabelText('Question posée')).toHaveValue('')
  })

  it('offers no question field on a node that asks nothing', () => {
    show(TEXT)

    expect(screen.queryByLabelText('Question posée')).not.toBeInTheDocument()
  })

  // A generator's face is `ModelNodeFields`, which asks the catalogue and has its own suite.

  /**
   * `parseGraph` keeps `data` as it found it, so both of these come off a file unvalidated. A
   * `null` under `value` made `typeof … === 'object'` true and `.length` throw; an object under
   * `type` was handed to React as a child. Either crashed the whole panel into its boundary.
   */
  it('survives an asset node whose data a file made up', () => {
    installGraph(DOCUMENT, { nodes: [BAD_ASSET], edges: [], inputKeys: [] })
    show(BAD_ASSET)

    expect(screen.getByLabelText('Source')).toHaveValue('')
    expect(screen.getByLabelText('Titre')).toBeInTheDocument()
  })

  it('counts what a multiple asset node holds rather than typing into it', () => {
    installGraph(DOCUMENT, { nodes: [MANY_ASSETS], edges: [], inputKeys: [] })
    show(MANY_ASSETS)

    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.queryByLabelText('Source')).not.toBeInTheDocument()
  })

  /**
   * Without this gesture nothing in the studio ever writes `data.isOutput`, and the converter
   * compiles only the branches that reach a node carrying it: the flow would be empty, in silence.
   */
  describe('marking a node as the output of the workflow', () => {
    /**
     * An `llm` rather than a `model`, and the difference is only in what it drags: a generator's
     * face asks the catalogue and would need a query client here, while the field under test is
     * the same one on both — `canBeOutput` names three types and the converter reads all three.
     */
    const GENERATOR: GraphNode = {
      id: 'llm1',
      type: 'llm',
      position: { x: 0, y: 0 },
      data: {},
    }

    it('writes it into the node, through the history the canvas writes to', async () => {
      installGraph(DOCUMENT, { nodes: [GENERATOR], edges: [], inputKeys: [] })
      show(GENERATOR)

      await userEvent.click(screen.getByLabelText('Résultat de l’App'))

      const node = graphOf(useGraphs.getState(), DOCUMENT).nodes[0]
      expect(node?.data.isOutput).toBe(true)
      expect(historyOf(useGraphs.getState(), DOCUMENT).past).toHaveLength(1)
    })

    it('offers it on a node the converter reads it on', () => {
      installGraph(DOCUMENT, { nodes: [GENERATOR], edges: [], inputKeys: [] })
      show(GENERATOR)

      expect(screen.getByLabelText('Résultat de l’App')).toBeInTheDocument()
    })

    /**
     * The converter reads `isOutput` on `model`, `llm` and `forEachEnd`, and nowhere else. A
     * checkbox on a text node would be a promise the compiler does not keep — the field would be
     * written into the file and ignored, and the flow would still come back empty.
     */
    it.each([
      ['a text node', TEXT],
      ['a loop', LOOP],
    ])('does not offer it on %s, where it would be ignored', (_name, node) => {
      installGraph(DOCUMENT, { nodes: [node], edges: [], inputKeys: [] })
      show(node)

      expect(screen.queryByLabelText('Résultat de l’App')).not.toBeInTheDocument()
    })
  })
})
