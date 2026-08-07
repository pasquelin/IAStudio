import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addObject } from '@/engines/scene/commands'
import { IDENTITY_TRANSFORM, type SceneObject } from '@/engines/scene/scene-state'
import { sceneOf, useScenes } from '@/stores/scenes'
import { SceneDocument } from './SceneDocument'

const setMode = vi.fn()
const frameSelection = vi.fn()

// jsdom has no WebGL context: the renderer is exercised by hand, not here. What this test
// covers is that the document wires the toolbar and the keyboard to the right calls.
vi.mock('@/engines/scene/SceneRenderer', () => ({
  SceneRenderer: class {
    mount = vi.fn()
    unmount = vi.fn()
    apply = vi.fn()
    dispose = vi.fn()
    setMotion = vi.fn()
    setMode = setMode
    frameSelection = frameSelection
  },
}))

const box: SceneObject = { id: 'box-1', kind: 'box', name: 'Box', transform: IDENTITY_TRANSFORM }

describe('SceneDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useScenes.setState({ states: {}, histories: {} })
  })

  it('renders the shared toolbar with the scene tools', () => {
    render(<SceneDocument documentId="doc-1" />)
    expect(screen.getByRole('button', { name: /Déplacer/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tourner/ })).toBeInTheDocument()
  })

  it('switches the gizmo mode when a tool is clicked', async () => {
    render(<SceneDocument documentId="doc-1" />)
    await userEvent.click(screen.getByRole('button', { name: /Tourner/ }))
    expect(setMode).toHaveBeenCalledWith('rotate')
  })

  it('switches the gizmo mode on the bound key', async () => {
    render(<SceneDocument documentId="doc-1" />)
    await userEvent.keyboard('{r}')
    expect(setMode).toHaveBeenCalledWith('rotate')
  })

  it('deletes the selected object on the bound key', async () => {
    useScenes.getState().runCommand('doc-1', addObject(box))
    render(<SceneDocument documentId="doc-1" />)

    await userEvent.keyboard('{Delete}')
    expect(sceneOf(useScenes.getState(), 'doc-1').objects).toHaveLength(0)
  })

  it('undoes through the toolbar', async () => {
    useScenes.getState().runCommand('doc-1', addObject(box))
    render(<SceneDocument documentId="doc-1" />)

    await userEvent.click(screen.getByRole('button', { name: /Annuler/ }))
    expect(sceneOf(useScenes.getState(), 'doc-1').objects).toHaveLength(0)
  })

  it('disables undo when there is nothing to undo', () => {
    render(<SceneDocument documentId="doc-1" />)
    expect(screen.getByRole('button', { name: /Annuler/ })).toBeDisabled()
  })
})
