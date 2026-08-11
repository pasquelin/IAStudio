import { render, screen } from '@testing-library/react'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import { PROBLEM_KEY, RUN_STATE_KEY } from './adapter'
import { GRAPH_NODE_TYPES } from './GraphNodes'

/**
 * A node as React Flow hands it over: `data` is the only slot it gives, so both the run state and
 * the compiler's refusal ride down inside it.
 */
function draw(data: Record<string, unknown>, selected = false) {
  const TextNode = GRAPH_NODE_TYPES.text
  const props = { id: 'text1', type: 'text', data, selected } as unknown as NodeProps

  return render(
    <ReactFlowProvider>
      <TextNode {...props} />
    </ReactFlowProvider>,
  )
}

/** The shell is the outermost element the node draws — where the border lives. */
const shellOf = (container: HTMLElement): Element | null => container.firstElementChild

describe('a node the compiler refuses', () => {
  /**
   * The border is the whole visible half of the refusal, and it had no test at all: a first review
   * measured that deleting the `border-danger` arm left every gate green.
   */
  it('draws its border in the danger tone', () => {
    const { container } = draw({ value: 'a knight', [PROBLEM_KEY]: true })

    expect(shellOf(container)?.className).toContain('border-danger')
  })

  it('draws the plain border when the refusal is not about it', () => {
    const { container } = draw({ value: 'a knight', [PROBLEM_KEY]: false })

    expect(shellOf(container)?.className).toContain('border-border')
    expect(shellOf(container)?.className).not.toContain('border-danger')
  })

  /**
   * Selection wins the border, and that is deliberate — but it must not take the refusal off the
   * node with it, or the information is gone at the very moment the user clicks to fix it.
   */
  it('keeps saying it is blamed while it is selected', () => {
    const { container } = draw({ value: 'a knight', [PROBLEM_KEY]: true }, true)

    expect(shellOf(container)?.className).toContain('border-accent')
    expect(screen.getByRole('img', { name: 'Le refus porte sur ce nœud' })).toBeTruthy()
  })

  /** A red edge says nothing to a screen reader, and the status line is not on the node. */
  it('names the refusal in words, not in colour alone', () => {
    draw({ value: 'a knight', [PROBLEM_KEY]: true })

    expect(screen.getByRole('img', { name: 'Le refus porte sur ce nœud' })).toBeTruthy()
  })

  it('says nothing of the sort on a node no refusal points at', () => {
    draw({ value: 'a knight', [PROBLEM_KEY]: false })

    expect(screen.queryByRole('img', { name: 'Le refus porte sur ce nœud' })).toBeNull()
  })

  /**
   * The two marks are separate channels on purpose: a refusal is not a failed run — nothing has
   * run — so a node can carry one, the other, or both without either speaking for the other.
   */
  it('carries a refusal and a run state at once, each saying its own thing', () => {
    draw({
      value: 'a knight',
      [PROBLEM_KEY]: true,
      [RUN_STATE_KEY]: { status: 'failed', failure: 'no-model' },
    })

    expect(screen.getByRole('img', { name: 'Le refus porte sur ce nœud' })).toBeTruthy()
    expect(screen.getByText('sans modèle')).toBeTruthy()
  })

  /**
   * A node's state is READ, never announced: one live region per node meant twenty of them talking
   * over each other on a graph of twenty. The canvas carries the one that speaks — this badge is
   * plain text, found by walking the node.
   */
  it('states what it is doing without claiming a live region of its own', () => {
    const { container } = draw({
      value: 'a knight',
      [RUN_STATE_KEY]: { status: 'running' },
    })

    expect(screen.getByText('en cours')).toBeTruthy()
    expect(container.querySelector('[role="status"]')).toBeNull()
    expect(container.querySelector('[aria-live]')).toBeNull()
  })
})
