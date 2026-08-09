import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import type { GraphHandleInput, GraphHandleOutput } from '@shared/domain/graph'
import { InputPorts, OutputPorts } from './NodePorts'

const inputs = (handles: readonly GraphHandleInput[]) =>
  render(
    <ReactFlowProvider>
      <InputPorts handles={handles} />
    </ReactFlowProvider>,
  )

const outputs = (handles: readonly GraphHandleOutput[]) =>
  render(
    <ReactFlowProvider>
      <OutputPorts handles={handles} />
    </ReactFlowProvider>,
  )

/**
 * A port is named by the workflow, which speaks the same English the generation form does —
 * so it goes through the same dictionary rather than a second one.
 */
describe('what a port is called', () => {
  it('is said in French when the studio knows the word', () => {
    inputs([{ id: 'in-1', label: 'Video' }])

    expect(screen.getByText('Vidéo')).toBeDefined()
  })

  it('is said on an output too', () => {
    outputs([{ id: 'out-1', name: 'Mask', type: 'image' }])

    expect(screen.getByText('Masque')).toBeDefined()
  })

  it('keeps the word the workflow chose when nobody translated it', () => {
    inputs([{ id: 'in-2', label: 'Karras sigmas' }])

    expect(screen.getByText('Karras sigmas')).toBeDefined()
  })

  // A polymorphic port draws the types it accepts, and those are not words anyone translates.
  it('leaves the accepted types alone when the port has no name', () => {
    inputs([{ id: 'in-3', type: ['image', 'video'] }])

    expect(screen.getByText('image · video')).toBeDefined()
  })
})
