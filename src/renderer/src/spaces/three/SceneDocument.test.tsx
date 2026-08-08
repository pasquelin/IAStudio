import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { addNode } from '@/engines/scene/commands'
import { meshNode } from '@/engines/scene/scene-fixtures'
import type { SceneNode } from '@/engines/scene/scene-state'
import { useDocuments } from '@/stores/documents'
import { clearScenes } from '@/stores/scene-fixtures'
import { sceneOf, useScenes } from '@/stores/scenes'
import { useSettings } from '@/stores/settings'
import { SceneDocument } from './SceneDocument'

const setDocumentTitle = vi.fn()

// Dockview owns the tabs and needs a layout engine; what matters here is what the space asks
// of it.
vi.mock('@/app/dockview-api', () => ({
  setDocumentTitle: (...args: unknown[]) => setDocumentTitle(...args),
}))

const setMode = vi.fn()
const frameSelection = vi.fn()
const configure = vi.fn()
const setSnapping = vi.fn()
const setSpace = vi.fn()

// jsdom has no WebGL context: the renderer is exercised by hand, not here. What this test
// covers is that the document wires the toolbar and the keyboard to the right calls.
vi.mock('@/engines/scene/SceneRenderer', () => ({
  SceneRenderer: class {
    mount = vi.fn()
    unmount = vi.fn()
    apply = vi.fn()
    dispose = vi.fn()
    setMotion = vi.fn()
    configure = configure
    setMode = setMode
    setSnapping = setSnapping
    setSpace = setSpace
    frameSelection = frameSelection
  },
}))

const box = meshNode('box-1')

/** A new document is born with three lights; only the meshes are what these tests count. */
function meshesOf(documentId: string): SceneNode[] {
  return sceneOf(useScenes.getState(), documentId).nodes.filter(node => node.type === 'mesh')
}

// Every block, not one of them: a describe that leaned on its neighbour's setup only passed
// because the store leaked, and `active` — which gates the whole keyboard — was one of the
// things it leaked.
beforeEach(() => {
  vi.clearAllMocks()
  clearScenes()
  useSettings.setState({ settings: DEFAULT_SETTINGS })
  // The descriptor, not just the id: a document restores itself through its kind, and
  // `WithDocument` is what guarantees one exists before this component ever renders.
  useDocuments.setState({
    documents: {
      'doc-1': { id: 'doc-1', kind: 'scene', workspace: '3d', title: 'Set dressing' },
    },
    activeId: 'doc-1',
  })
})

describe('SceneDocument', () => {
  it('renders the shared toolbar with the scene tools', () => {
    render(<SceneDocument documentId="doc-1" />)
    expect(screen.getByRole('button', { name: /Déplacer/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tourner/ })).toBeInTheDocument()
  })

  /**
   * A canvas React owns is reused across StrictMode's mount / unmount / mount, and the first
   * engine's `dispose` purges the one WebGL context the second one then draws into — a viewport
   * black for good. The engine makes its own canvas inside a plain host instead.
   */
  it('hands the renderer a host to fill, never a canvas of its own', () => {
    const { container } = render(<SceneDocument documentId="doc-1" />)
    expect(container.querySelector('canvas')).toBeNull()
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
    useScenes.getState().runCommand('doc-1', addNode(box))
    render(<SceneDocument documentId="doc-1" />)

    await userEvent.keyboard('{Delete}')
    expect(meshesOf('doc-1')).toHaveLength(0)
  })

  it('lets the keyboard alone while another tab is in front, since hidden tabs stay mounted', async () => {
    useDocuments.setState({ activeId: 'doc-2' })
    render(<SceneDocument documentId="doc-1" />)

    await userEvent.keyboard('{r}')
    expect(setMode).not.toHaveBeenCalledWith('rotate')
  })

  it('undoes through the toolbar', async () => {
    useScenes.getState().runCommand('doc-1', addNode(box))
    render(<SceneDocument documentId="doc-1" />)

    await userEvent.click(screen.getByRole('button', { name: /Annuler/ }))
    expect(meshesOf('doc-1')).toHaveLength(0)
  })

  it('opens a new document on a lit scene rather than a black viewport', () => {
    useDocuments.setState({
      documents: {
        'doc-fresh': { id: 'doc-fresh', kind: 'scene', workspace: '3d', title: 'Fresh' },
      },
    })
    render(<SceneDocument documentId="doc-fresh" />)
    const lights = sceneOf(useScenes.getState(), 'doc-fresh').nodes.filter(
      node => node.type === 'light',
    )
    expect(lights).toHaveLength(3)
  })

  it('does not reset a scene that is already open', () => {
    useScenes.getState().runCommand('doc-1', addNode(box))
    render(<SceneDocument documentId="doc-1" />)
    expect(meshesOf('doc-1')).toHaveLength(1)
  })

  it('disables undo when there is nothing to undo', () => {
    render(<SceneDocument documentId="doc-1" />)
    expect(screen.getByRole('button', { name: /Annuler/ })).toBeDisabled()
  })

  // Armed by default, and the one mode that leaves the gizmo off the selection.
  it('opens on the selection tool', () => {
    render(<SceneDocument documentId="doc-1" />)
    expect(setMode).toHaveBeenCalledWith('select')
  })

  it('adds the primitive chosen in the Add flyout, and undo removes it', async () => {
    render(<SceneDocument documentId="doc-1" />)

    await userEvent.hover(screen.getByRole('button', { name: /Ajouter/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /Cube/ }))

    expect(meshesOf('doc-1')).toHaveLength(1)
    expect(meshesOf('doc-1')[0]?.name).toBe('Box')

    await userEvent.click(screen.getByRole('button', { name: /Annuler/ }))
    expect(meshesOf('doc-1')).toHaveLength(0)
  })

  it('adds a light from the same flyout', async () => {
    render(<SceneDocument documentId="doc-1" />)

    await userEvent.hover(screen.getByRole('button', { name: /Ajouter/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /Projecteur/ }))

    const lights = sceneOf(useScenes.getState(), 'doc-1').nodes.filter(
      node => node.type === 'light',
    )
    expect(lights).toHaveLength(4)
  })

  it('adds nothing for a primitive that is not buildable yet', async () => {
    render(<SceneDocument documentId="doc-1" />)

    await userEvent.hover(screen.getByRole('button', { name: /Ajouter/ }))
    expect(await screen.findByRole('menuitem', { name: /Texte/ })).toBeDisabled()
    expect(meshesOf('doc-1')).toHaveLength(0)
  })
})

// Neither is a transform mode: they qualify one, and both are session state — a document that
// remembered its snapping would impose it on whoever opens it next.
describe('snapping and the coordinate frame', () => {
  it('opens with both off, so nothing is quietly constrained', () => {
    render(<SceneDocument documentId="doc-1" />)

    expect(setSnapping).toHaveBeenCalledWith(false)
    expect(setSpace).toHaveBeenCalledWith('world')
  })

  it('toggles snapping from the toolbar and back off on the next click', async () => {
    render(<SceneDocument documentId="doc-1" />)
    const button = screen.getByRole('button', { name: /Magnétisme/ })

    await userEvent.click(button)
    expect(setSnapping).toHaveBeenLastCalledWith(true)

    await userEvent.click(button)
    expect(setSnapping).toHaveBeenLastCalledWith(false)
  })

  it('toggles snapping on the bound key', async () => {
    render(<SceneDocument documentId="doc-1" />)

    await userEvent.keyboard('{m}')
    expect(setSnapping).toHaveBeenLastCalledWith(true)
  })

  it('swaps the coordinate frame from the toolbar', async () => {
    render(<SceneDocument documentId="doc-1" />)
    const button = screen.getByRole('button', { name: /Repère local/ })

    await userEvent.click(button)
    expect(setSpace).toHaveBeenLastCalledWith('local')

    await userEvent.click(button)
    expect(setSpace).toHaveBeenLastCalledWith('world')
  })

  it('swaps the coordinate frame on the bound key', async () => {
    render(<SceneDocument documentId="doc-1" />)

    await userEvent.keyboard('{l}')
    expect(setSpace).toHaveBeenLastCalledWith('local')
  })

  // Held down, not armed: turning snapping on must not disarm the transform mode.
  it('draws a toggle as pressed without unarming the tool', async () => {
    render(<SceneDocument documentId="doc-1" />)
    await userEvent.click(screen.getByRole('button', { name: /Tourner/ }))
    await userEvent.click(screen.getByRole('button', { name: /Magnétisme/ }))

    expect(screen.getByRole('button', { name: /Magnétisme/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: /Tourner/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('carries the snap steps into the engine with the rest of the viewport settings', () => {
    configure.mockClear()
    useSettings.setState({
      settings: { ...DEFAULT_SETTINGS, three: { ...DEFAULT_SETTINGS.three, snapRotate: 45 } },
    })

    render(<SceneDocument documentId="doc-1" />)

    expect(configure).toHaveBeenCalledWith(expect.objectContaining({ snapRotate: 45 }))
  })
})

describe('the viewport settings', () => {
  it('pushes them into the engine, which holds no truth of its own', () => {
    configure.mockClear()
    useSettings.setState({
      settings: { ...DEFAULT_SETTINGS, three: { ...DEFAULT_SETTINGS.three, flySpeed: 12 } },
    })

    render(<SceneDocument documentId="doc-1" />)

    expect(configure).toHaveBeenCalledWith(expect.objectContaining({ flySpeed: 12 }))
  })

  // The tab title was read imperatively and captured: a renamed document kept its old label
  // until the modified marker next flipped.
  it('follows a document renamed while its tab is open', async () => {
    render(<SceneDocument documentId="doc-1" />)

    await act(async () => {
      useDocuments.setState({
        documents: { 'doc-1': { id: 'doc-1', kind: 'scene', workspace: '3d', title: 'Renamed' } },
      })
    })

    expect(setDocumentTitle).toHaveBeenLastCalledWith('doc-1', 'Renamed', expect.any(Boolean))
  })
})
