import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import type { SceneExportCommand } from '@shared/ipc'
import { PANE_TOOLBAR } from '@/design/styles'
import { forgetReportedFailures } from '@/services/diagnostics'
import { fakeMenu } from '@/helpers/menu-fixtures'
import { bridgeWatchingLogs, installFakeBridge } from '@/services/fake-bridge'
import { addNode } from '@/engines/scene/commands'
import { meshNode } from '@/engines/scene/scene-fixtures'
import type { SceneNode } from '@/engines/scene/scene-state'
import { useAssets } from '@/stores/assets'
import { useDocuments } from '@/stores/documents'
import { useSceneViews, sceneViewOf } from '@/stores/scene-views'
import { clearScenes } from '@/stores/scene-fixtures'
import { sceneOf, selectIn, useScenes } from '@/stores/scenes'
import { useSettings } from '@/stores/settings'
import type { SceneRendererOptions } from '@/engines/scene/SceneRenderer'
import { bonesOfNode, clipsOfNode, useModelClips } from '@/stores/model-clips'
import { IDENTITY_TRANSFORM } from '@/engines/scene/scene-state'
import { DISPLAY_MODES } from '@shared/domain/scene'
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
const setProjection = vi.fn()
const setDisplayModes = vi.fn()
const activePane = vi.fn(() => 0)
const setSkeletons = vi.fn()
const setPoseMode = vi.fn()
const setPickedBone = vi.fn()
const setQuadView = vi.fn()
const setPaneViews = vi.fn()
const setPlayhead = vi.fn()
const refreshTextures = vi.fn()
/** Every engine built, so a test can fire the callbacks the real one would. */
const built = vi.hoisted((): SceneRendererOptions[] => [])
const viewFrom = vi.fn()
// At module scope like the others, so a test can make the encoding itself refuse: the exporters
// throw on a texture they cannot write, and that is the half no bridge failure stands in for.
const exportTo = vi.fn(() => Promise.resolve(new Uint8Array([103, 108, 84, 70])))

// jsdom has no WebGL context: the renderer is exercised by hand, not here. What this test
// covers is that the document wires the toolbar and the keyboard to the right calls.
vi.mock('@/engines/scene/SceneRenderer', () => ({
  SceneRenderer: class {
    constructor(options: unknown) {
      built.push(options as SceneRendererOptions)
    }

    mount = vi.fn()
    unmount = vi.fn()
    apply = vi.fn()
    dispose = vi.fn()
    setMotion = vi.fn()
    configure = configure
    setMode = setMode
    setSnapping = setSnapping
    setSpace = setSpace
    setProjection = setProjection
    setDisplayModes = setDisplayModes
    activePane = activePane
    setSkeletons = setSkeletons
    setPoseMode = setPoseMode
    setPickedBone = setPickedBone
    setQuadView = setQuadView
    setPaneViews = setPaneViews
    setPlayhead = setPlayhead
    refreshTextures = refreshTextures
    viewFrom = viewFrom
    frameSelection = frameSelection
    exportTo = exportTo
  },
}))

const box = meshNode('box-1')

const moved = (x: number) => ({
  ...IDENTITY_TRANSFORM,
  position: { x, y: 0, z: 0 },
})

/** A new document is born with three lights; only the meshes are what most of these tests count. */
function meshesOf(documentId: string): SceneNode[] {
  return nodesOf(documentId).filter(node => node.type === 'mesh')
}

function nodesOf(documentId: string): SceneNode[] {
  return [...sceneOf(useScenes.getState(), documentId).nodes]
}

// Every block, not one of them: a describe that leaned on its neighbour's setup only passed
// because the store leaked, and `active` — which gates the whole keyboard — was one of the
// things it leaked.
beforeEach(() => {
  vi.clearAllMocks()
  built.length = 0
  useModelClips.setState({ clips: {}, bones: {} })
  // The export tests install a bridge; without this it would answer for the ones that follow.
  vi.unstubAllGlobals()
  // A report is said once per subject and the set lives at module scope: a second test on the
  // same pair would otherwise watch a channel that has already had its say.
  forgetReportedFailures()
  clearScenes()
  useSceneViews.setState({ views: {} })
  useSettings.setState({ settings: DEFAULT_SETTINGS })
  // The descriptor, not just the id: a document restores itself through its kind, and
  // `WithDocument` is what guarantees one exists before this component ever renders.
  useDocuments.setState({
    documents: {
      'doc-1': {
        id: 'doc-1',
        kind: 'scene',
        workspace: '3d',
        title: 'Set dressing',
        fileName: 'Set dressing.scene',
      },
    },
    activeId: 'doc-1',
  })
})

describe('SceneDocument', () => {
  it('renders the shared toolbar with the scene tools', () => {
    render(<SceneDocument documentId="doc-1" />)
    expect(screen.getByRole('button', { name: /Déplacer/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Pivoter/ })).toBeInTheDocument()
  })

  /**
   * Read from the design system rather than written here: the image space and the graph put their
   * bar in the same corner, and a copy of the inset is a copy that goes stale on its own.
   */
  it('places its bar where every space places it', () => {
    render(<SceneDocument documentId="doc-1" />)
    expect(screen.getByRole('toolbar')).toHaveClass(PANE_TOOLBAR)
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
    await userEvent.click(screen.getByRole('button', { name: /Pivoter/ }))
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

  // Through the key rather than a button: the bar drew its own pair until the Edit menu was
  // made the one place a history lives.
  it('undoes through the keyboard', async () => {
    useScenes.getState().runCommand('doc-1', addNode(box))
    render(<SceneDocument documentId="doc-1" />)

    await userEvent.keyboard('{Meta>}{z}{/Meta}')
    expect(meshesOf('doc-1')).toHaveLength(0)
  })

  it('opens a new document on a lit scene rather than a black viewport', () => {
    useDocuments.setState({
      documents: {
        'doc-fresh': {
          id: 'doc-fresh',
          kind: 'scene',
          workspace: '3d',
          title: 'Fresh',
          fileName: 'Fresh.scene',
        },
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

  it('draws no history button of its own', () => {
    render(<SceneDocument documentId="doc-1" />)
    expect(screen.queryByRole('button', { name: /Annuler/ })).not.toBeInTheDocument()
  })

  // Armed by default, and the one mode that leaves the gizmo off the selection.
  it('opens on the selection tool', () => {
    render(<SceneDocument documentId="doc-1" />)
    expect(setMode).toHaveBeenCalledWith('select')
  })

  /**
   * Adding is the native Add menu's now, not the bar's — `useNativeMenu` covers the row, and
   * `useAddNode` what it builds. What is left to say here is that the bar offers no second way.
   */
  it('offers no add button of its own', () => {
    render(<SceneDocument documentId="doc-1" />)
    expect(screen.queryByRole('button', { name: /Ajouter/ })).not.toBeInTheDocument()
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
    await userEvent.click(screen.getByRole('button', { name: /Pivoter/ }))
    await userEvent.click(screen.getByRole('button', { name: /Magnétisme/ }))

    expect(screen.getByRole('button', { name: /Magnétisme/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: /Pivoter/ })).toHaveAttribute('aria-pressed', 'true')
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
        documents: {
          'doc-1': {
            id: 'doc-1',
            kind: 'scene',
            workspace: '3d',
            title: 'Renamed',
            fileName: 'Renamed.scene',
          },
        },
      })
    })

    expect(setDocumentTitle).toHaveBeenLastCalledWith('doc-1', 'Renamed', expect.any(Boolean))
  })
})

describe('how the scene is looked at', () => {
  // On the key rather than a button: the row moved to the native View menu, which ticks it.
  it('swaps the projection on the key', async () => {
    render(<SceneDocument documentId="doc-1" />)

    await userEvent.keyboard('{o}')

    expect(setProjection).toHaveBeenCalledWith('orthographic')
  })

  it('swaps it back on the second press', async () => {
    render(<SceneDocument documentId="doc-1" />)

    await userEvent.keyboard('{o}')
    await userEvent.keyboard('{o}')

    expect(setProjection).toHaveBeenLastCalledWith('perspective')
  })

  // The button wears the mode it draws, so it is the mode's own name that names it.
  it('changes what the viewport draws from the flyout', async () => {
    render(<SceneDocument documentId="doc-1" />)

    await userEvent.hover(screen.getByRole('button', { name: /Rendu/ }))
    await userEvent.click(await screen.findByRole('menuitemradio', { name: /^Filaire/ }))

    expect(setDisplayModes).toHaveBeenLastCalledWith(['wireframe'], false)
  })

  it('cycles through every mode on the bound key, and comes back round', async () => {
    render(<SceneDocument documentId="doc-1" />)

    const seen: string[] = []
    for (let press = 0; press < DISPLAY_MODES.length; press += 1) {
      await userEvent.keyboard('{z}')
      const [modes] = setDisplayModes.mock.lastCall ?? []
      seen.push(String(modes))
    }

    // Starting from shaded, one press per mode lands on each of the others and returns.
    expect(seen).toEqual([...DISPLAY_MODES.slice(1), DISPLAY_MODES[0]].map(String))
  })

  it('reads the edges as quads on the bound key, and back as triangles', async () => {
    render(<SceneDocument documentId="doc-1" />)

    await userEvent.keyboard('{Shift>}{W}{/Shift}')
    expect(setDisplayModes).toHaveBeenLastCalledWith(['shaded'], true)

    await userEvent.keyboard('{Shift>}{W}{/Shift}')
    expect(setDisplayModes).toHaveBeenLastCalledWith(['shaded'], false)
  })

  /** Four views, four answers: the key lands on the one the pointer is over, and on no other. */
  it('changes only the view the pointer is over', async () => {
    activePane.mockReturnValue(2)
    render(<SceneDocument documentId="doc-1" />)

    await userEvent.keyboard('{z}')

    expect(setDisplayModes).toHaveBeenLastCalledWith(['shaded', 'shaded', 'wireframe'], false)
    expect(sceneViewOf(useSceneViews.getState(), 'doc-1').displays[0]).toBe('shaded')
  })

  // Session state, per document: two scenes side by side are two points of view.
  it('leaves the view of another document alone', async () => {
    render(<SceneDocument documentId="doc-1" />)
    await userEvent.keyboard('{o}')

    expect(sceneViewOf(useSceneViews.getState(), 'doc-2').projection).toBe('perspective')
  })
})

describe('exporting the scene', () => {
  /** The menu is what asks for an export; this is the hand that pulls its lever. */
  function bridgeThatExports(exported: () => Promise<string | null>) {
    let ask: ((command: SceneExportCommand) => void) | null = null

    const watched = bridgeWatchingLogs({
      menu: {
        onSceneExport: callback => {
          ask = callback
          return () => {}
        },
      },
      scene: { export: exported },
    })

    return { ...watched, ask: () => ask?.({ format: 'glb', scope: 'scene' }) }
  }

  it('hands the encoded scene over under the document title', async () => {
    const exported = vi.fn(() => Promise.resolve('set.glb'))
    const bridge = bridgeThatExports(exported)
    render(<SceneDocument documentId="doc-1" />)

    await act(async () => bridge.ask())

    expect(exported).toHaveBeenCalledWith(expect.objectContaining({ name: 'Set dressing' }))
  })

  // Nothing awaits the export: a refused write would otherwise look exactly like a dismissed
  // dialog, which is how a failed save goes unnoticed.
  it('records a write the disk refused', async () => {
    const bridge = bridgeThatExports(() => Promise.reject(new Error('read-only volume')))
    render(<SceneDocument documentId="doc-1" />)

    await act(async () => bridge.ask())

    expect(bridge.report).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'scene.export',
        message: expect.stringContaining('read-only volume'),
      }),
    )
  })

  /**
   * The other half, and the one no bridge failure covers: `GLTFExporter` and `USDZExporter` throw
   * on a compressed texture, which the KTX2 loader makes an ordinary thing for an imported model
   * to wear. Left outside the guard, that rejection reached nobody and the menu click did nothing.
   */
  it('records an encoding the exporter refused', async () => {
    exportTo.mockRejectedValueOnce(new Error('setTextureUtils() must be called'))
    const bridge = bridgeThatExports(() => Promise.resolve('set.glb'))
    render(<SceneDocument documentId="doc-1" />)

    await act(async () => bridge.ask())

    expect(bridge.report).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'scene.export',
        message: expect.stringContaining('setTextureUtils'),
      }),
    )
  })
  it('shows the bones of a rigged model on the bound key, and hides them again', async () => {
    render(<SceneDocument documentId="doc-1" />)

    await userEvent.keyboard('{b}')
    expect(setSkeletons).toHaveBeenLastCalledWith(true)

    await userEvent.keyboard('{b}')
    expect(setSkeletons).toHaveBeenLastCalledWith(false)
  })

  it('splits the viewport in four on the bound key, and puts it back', async () => {
    render(<SceneDocument documentId="doc-1" />)

    await userEvent.keyboard('{Shift>}{Q}{/Shift}')
    expect(setQuadView).toHaveBeenLastCalledWith(true)

    await userEvent.keyboard('{Shift>}{Q}{/Shift}')
    expect(setQuadView).toHaveBeenLastCalledWith(false)
  })
})

/**
 * The engine cannot see the catalogue, and the id a texture slot points at does not move when ⌘S
 * rewrites the picture behind it. Without this the scene showed the image an edit replaced until
 * something rebuilt the engine.
 */
describe('SceneDocument and a picture edited elsewhere', () => {
  it('tells the engine to ask again for its maps when the shelf is re-read', () => {
    render(<SceneDocument documentId="doc-1" />)
    refreshTextures.mockClear()

    act(() => useAssets.setState({ items: [] }))

    expect(refreshTextures).toHaveBeenCalled()
  })

  it('hands the engine a way to read what the catalogue knows of a picture', () => {
    render(<SceneDocument documentId="doc-1" />)

    expect(built.at(-1)?.assetVersion?.('never-heard-of')).toBeUndefined()
  })
})

describe('SceneDocument and the timeline over the scene', () => {
  it('tells the engine where the head stands, and never the other way round', () => {
    render(<SceneDocument documentId="doc-1" />)
    // Inside `act`: the effect that pushes it runs on the render the store change causes.
    act(() => useSceneViews.getState().setPlayhead('doc-1', 1.5))

    expect(setPlayhead).toHaveBeenLastCalledWith(1.5)
  })

  it('reports the bones a model brought, so a track can name one', () => {
    render(<SceneDocument documentId="doc-1" />)
    const options = built.at(-1)
    options?.onBones?.('perso', ['spine', 'arm.L'])

    expect(bonesOfNode(useModelClips.getState(), 'doc-1', 'perso')).toEqual(['spine', 'arm.L'])
  })

  it('reports the clips too, and forgets both when the viewport goes', () => {
    const { unmount } = render(<SceneDocument documentId="doc-1" />)
    const options = built.at(-1)
    options?.onClips?.('perso', ['walk'], { walk: 2 })
    expect(clipsOfNode(useModelClips.getState(), 'doc-1', 'perso')).toEqual(['walk'])

    // The names came out of files that viewport parsed; nothing outside it can answer for them.
    unmount()
    expect(clipsOfNode(useModelClips.getState(), 'doc-1', 'perso')).toEqual([])
  })

  it('writes a plain move while auto-key is off', () => {
    useScenes.getState().runCommand('doc-1', addNode(box))
    render(<SceneDocument documentId="doc-1" />)

    built.at(-1)?.onTransform([{ id: 'box-1', transform: moved(3) }])

    expect(nodesOf('doc-1').find(node => node.id === 'box-1')?.transform.position.x).toBe(3)
  })
})

describe('SceneDocument and a node right-clicked in the viewport', () => {
  /**
   * What decides that a right-click WAS a click — brief, still, and no motion key held — lives in
   * the engine, which needs a WebGL context and a ray to exercise: it is checked on screen rather
   * than here. This covers the half a test can reach: the document raises the menu it reports.
   */
  it('raises the node menu the viewport reports, without a rename it could not open', async () => {
    const menu = fakeMenu()
    installFakeBridge({ menu: menu.bridge })
    useScenes.getState().runCommand('doc-1', addNode(box))
    render(<SceneDocument documentId="doc-1" />)

    built.at(-1)?.onContextMenu?.('box-1')

    await vi.waitFor(() => expect(menu.labels()).toContain('Supprimer'))
    expect(menu.labels()).not.toContain('Renommer l’objet')
  })

  /**
   * The outliner arms its row on pointer down; the right button of a viewport flies the camera,
   * so nothing has armed anything here. Without this the rows would act on whatever was selected
   * before — the menu deletes a selection, never the node it was raised on.
   */
  it('selects the node it was raised on', () => {
    useScenes.getState().runCommand('doc-1', addNode(box))
    render(<SceneDocument documentId="doc-1" />)

    built.at(-1)?.onContextMenu?.('box-1')

    expect(sceneOf(useScenes.getState(), 'doc-1').selectedIds).toEqual(['box-1'])
  })

  // The other half of the same rule: a right-click on one of six must not shrink it to one.
  it('leaves a selection the node already belongs to', () => {
    useScenes.getState().runCommand('doc-1', addNode(box))
    useScenes.getState().runCommand('doc-1', addNode(meshNode('box-2')))
    render(<SceneDocument documentId="doc-1" />)
    selectIn('doc-1', ['box-1', 'box-2'])

    built.at(-1)?.onContextMenu?.('box-1')

    expect(sceneOf(useScenes.getState(), 'doc-1').selectedIds).toEqual(['box-1', 'box-2'])
  })
})

describe('SceneDocument and the pose mode', () => {
  it('turns the pose mode on with the bound key, and back off', async () => {
    render(<SceneDocument documentId="doc-1" />)

    await userEvent.keyboard('{p}')
    expect(setPoseMode).toHaveBeenLastCalledWith(true)

    await userEvent.keyboard('{p}')
    expect(setPoseMode).toHaveBeenLastCalledWith(false)
  })

  it('holds the bone the viewport picked, so the gizmo can aim at it', async () => {
    render(<SceneDocument documentId="doc-1" />)
    await userEvent.keyboard('{p}')

    await act(async () => built.at(-1)?.onSelectBone?.({ nodeId: 'perso', bone: 'Arm.L' }))

    expect(sceneViewOf(useSceneViews.getState(), 'doc-1').pickedBone).toEqual({
      nodeId: 'perso',
      bone: 'Arm.L',
    })
  })

  it('lets go of the bone when the mode is left, so nothing keeps holding it', async () => {
    render(<SceneDocument documentId="doc-1" />)
    await userEvent.keyboard('{p}')
    await act(async () => built.at(-1)?.onSelectBone?.({ nodeId: 'perso', bone: 'Arm.L' }))

    await userEvent.keyboard('{p}')

    expect(sceneViewOf(useSceneViews.getState(), 'doc-1').pickedBone).toBeNull()
    expect(setPickedBone).toHaveBeenLastCalledWith(null)
  })
})
