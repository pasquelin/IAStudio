import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { EVERYTHING_SNAPPED, NOTHING_SNAPPED } from '@shared/domain/snap'
import type { SceneExportCommand } from '@shared/ipc'
import { PANE_TOOLBAR } from '@/components/styles'
import { forgetReportedFailures } from '@/services/diagnostics'
import { fakeMenu } from '@/helpers/menu-fixtures'
import { bridgeWatchingLogs, installFakeBridge } from '@/services/fakeBridge'
import { addNode } from '@/engines/scene/commands'
import { meshNode, pathNodeFixture, rigStateFixture } from '@/engines/scene/scene-fixtures'
import type { SceneNode } from '@/engines/scene/sceneState'
import { useAssets } from '@/stores/assets'
import { useDocuments } from '@/stores/documents'
import { useSceneViews, sceneViewOf } from '@/stores/sceneViews'
import { clearScenes } from '@/stores/scene-fixtures'
import { sceneOf, selectIn, useScenes } from '@/stores/scenes'
import { useSettings } from '@/stores/settings'
import type { SceneRendererOptions } from '@/engines/scene/SceneRenderer'
import { bonesOfNode, clipsOfNode, rigOfNode, useModelFiles } from '@/stores/modelFiles'
import { IDENTITY_TRANSFORM } from '@/engines/scene/sceneState'
import { DISPLAY_MODES } from '@shared/domain/scene'
import { SceneDocument } from './SceneDocument'

const setDocumentTitle = vi.fn()

// Dockview owns the tabs and needs a layout engine; what matters here is what the space asks
// of it.
vi.mock('@/app/dockviewApi', () => ({
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
const setIsolation = vi.fn()
const setPoseMode = vi.fn()
const setPickedBone = vi.fn()
const setPickedPathPoint = vi.fn()
const setQuadView = vi.fn()
const setPaneViews = vi.fn()
const setPlayhead = vi.fn()
const setPreview = vi.fn()
const refreshTextures = vi.fn()
/** Every engine built, so a test can fire the callbacks the real one would. */
const built = vi.hoisted((): SceneRendererOptions[] => [])
/** The engines themselves, for the one fact a case has to state rather than fire: the flight. */
const engines = vi.hoisted((): { flying: boolean }[] => [])
const viewFrom = vi.fn()
const setNavigating = vi.fn()
// At module scope like the others, so a test can make the encoding itself refuse: the exporters
// throw on a texture they cannot write, and that is the half no bridge failure stands in for.
const exportTo = vi.fn(() => Promise.resolve(new Uint8Array([103, 108, 84, 70])))

// jsdom has no WebGL context: the renderer is exercised by hand, not here. What this test
// covers is that the document wires the toolbar and the keyboard to the right calls.
vi.mock('@/engines/scene/SceneRenderer', () => ({
  SceneRenderer: class {
    constructor(options: unknown) {
      built.push(options as SceneRendererOptions)
      engines.push(this)
    }

    mount = vi.fn()
    unmount = vi.fn()
    apply = vi.fn()
    dispose = vi.fn()
    setMotion = vi.fn()
    setNavigating = setNavigating
    /** The right button, which no case here holds down — the two that need it set it themselves. */
    flying = false
    configure = configure
    setMode = setMode
    setSnapping = setSnapping
    setSpace = setSpace
    setProjection = setProjection
    setDisplayModes = setDisplayModes
    activePane = activePane
    setSkeletons = setSkeletons
    setIsolation = setIsolation
    setPoseMode = setPoseMode
    setPickedBone = setPickedBone
    setPickedPathPoint = setPickedPathPoint
    setCameraPreview = vi.fn()
    setQuadView = setQuadView
    setPaneViews = setPaneViews
    setPlayhead = setPlayhead
    setPreview = setPreview
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
  useModelFiles.setState({ clips: {}, rigs: {} })
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
        path: 'documents/Set dressing.gltf',
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
  // Two bars live over this viewport since the snap bar arrived, and only one of them is the
  // tool column. The snap bar names itself; the column is found by the orientation it declares.
  it('places its bar where every space places it', () => {
    render(<SceneDocument documentId="doc-1" />)
    const column = screen
      .getAllByRole('toolbar')
      .find(bar => bar.getAttribute('aria-orientation') === 'vertical')

    expect(column).toHaveClass(PANE_TOOLBAR)
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
          path: 'documents/Fresh.gltf',
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
   * The gesture the space was missing: a camera, a sprite, a caption and a rail had no panel to
   * be added from, no key, and a right-click that only answers over a node — the native Add menu,
   * three levels deep, was the whole of it.
   */
  it('adds a camera from the bar, which nothing else could reach', async () => {
    render(<SceneDocument documentId="doc-1" />)

    await userEvent.hover(screen.getByRole('button', { name: 'Ajouter un objet' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Caméra' }))

    expect(sceneOf(useScenes.getState(), 'doc-1').nodes.some(node => node.type === 'camera')).toBe(
      true,
    )
  })

  it('offers one button per family a scene grows by', () => {
    render(<SceneDocument documentId="doc-1" />)

    for (const name of ['Ajouter une maille', 'Ajouter une lumière', 'Ajouter un objet']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
  })
})

// Neither is a transform mode: they qualify one, and both are session state — a document that
// remembered its snapping would impose it on whoever opens it next.
describe('snapping and the coordinate frame', () => {
  it('opens with both off, so nothing is quietly constrained', () => {
    render(<SceneDocument documentId="doc-1" />)

    expect(setSnapping).toHaveBeenCalledWith(NOTHING_SNAPPED)
    expect(setSpace).toHaveBeenCalledWith('world')
  })

  it('arms navigation from the toolbar, and gives the pointer back on the next click', async () => {
    render(<SceneDocument documentId="doc-1" />)
    const button = screen.getByRole('button', { name: /Naviguer/ })

    await userEvent.click(button)
    expect(setNavigating).toHaveBeenLastCalledWith(true)

    await userEvent.click(button)
    expect(setNavigating).toHaveBeenLastCalledWith(false)
  })

  // Full accent says « this is what is being acted on », and only one thing ever is.
  it('arms navigation INSTEAD of the transform tool', async () => {
    render(<SceneDocument documentId="doc-1" />)
    expect(screen.getByRole('button', { name: /Sélectionner/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await userEvent.click(screen.getByRole('button', { name: /Naviguer/ }))

    expect(screen.getByRole('button', { name: /Naviguer/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Sélectionner/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  /**
   * `useShortcuts` only swallows the MOTION keys, so `G` reaches the dispatch mid-flight. Left
   * alone, the gizmo changed under a captured pointer while the bar went on showing Naviguer.
   */
  it('leaves navigation when a transform tool is armed on its key', async () => {
    render(<SceneDocument documentId="doc-1" />)
    await userEvent.click(screen.getByRole('button', { name: /Naviguer/ }))
    expect(setNavigating).toHaveBeenLastCalledWith(true)

    await userEvent.keyboard('{g}')

    expect(setMode).toHaveBeenLastCalledWith('translate')
    expect(setNavigating).toHaveBeenLastCalledWith(false)
  })

  // The pointer is captured while it is armed, and a captured pointer over a tab nobody is
  // looking at would fly a scene out of sight.
  it('disarms navigation when another tab comes to the front', async () => {
    const { rerender } = render(<SceneDocument documentId="doc-1" />)
    await userEvent.click(screen.getByRole('button', { name: /Naviguer/ }))
    expect(setNavigating).toHaveBeenLastCalledWith(true)

    useDocuments.setState({ activeId: 'doc-2' })
    rerender(<SceneDocument documentId="doc-1" />)

    expect(setNavigating).toHaveBeenLastCalledWith(false)
  })

  // The magnet of the vertical bar is a master switch since the snap bar split the four apart:
  // one press turns everything off, the next gives back exactly what was on.
  it('toggles every snap from the toolbar and back off on the next click', async () => {
    render(<SceneDocument documentId="doc-1" />)
    const button = screen.getByRole('button', { name: /Tous les magnétismes/ })

    await userEvent.click(button)
    expect(setSnapping).toHaveBeenLastCalledWith(EVERYTHING_SNAPPED)

    await userEvent.click(button)
    expect(setSnapping).toHaveBeenLastCalledWith(NOTHING_SNAPPED)
  })

  it('toggles every snap on the bound key', async () => {
    render(<SceneDocument documentId="doc-1" />)

    await userEvent.keyboard('{m}')
    expect(setSnapping).toHaveBeenLastCalledWith(EVERYTHING_SNAPPED)
  })

  // Reaching for a step IS asking for that snap: leaving the choice inert cost a second click on
  // every first use. Where this bar parts from Unreal — arbitrage d'Alban.
  it('arms a snap by choosing its step, without a second click', async () => {
    render(<SceneDocument documentId="doc-1" />)

    // Hovered, not clicked: the menu opens on the way in, and a click there would put it away.
    await userEvent.hover(screen.getByRole('button', { name: /Pas de la grille/ }))
    await userEvent.click(screen.getByRole('radio', { name: '1 m' }))

    expect(setSnapping).toHaveBeenLastCalledWith({ ...NOTHING_SNAPPED, translate: true })
  })

  // The whole point of the snap bar: one kind arms without the other three following it.
  it('arms one snap alone from the snap bar', async () => {
    render(<SceneDocument documentId="doc-1" />)

    await userEvent.click(screen.getByRole('button', { name: 'Magnétisme de grille' }))

    expect(setSnapping).toHaveBeenLastCalledWith({ ...NOTHING_SNAPPED, translate: true })
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
    await userEvent.click(screen.getByRole('button', { name: /Tous les magnétismes/ }))

    expect(screen.getByRole('button', { name: /Tous les magnétismes/ })).toHaveAttribute(
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

// They used to be four wide buttons in the inspector, framing duplicating the bar's own. What
// matters is that the bar reaches the SAME rules — `sceneVisibility` holds them, and it is what
// makes leaving an isolation the very press that entered it.
describe('the visibility tools', () => {
  /** They act on a SELECTION, and the bar greys them out without one. */
  const withChosenBox = (): void => {
    useScenes.getState().runCommand('doc-1', addNode(box))
    selectIn('doc-1', ['box-1'])
  }

  // `acts` is what would take the pressed state away, so the toggle is asserted where it shows
  // rather than on the descriptor's own flag.
  it('isolates what is chosen, and gives the scene back on the second press', async () => {
    withChosenBox()
    render(<SceneDocument documentId="doc-1" />)

    await userEvent.click(screen.getByRole('button', { name: /Isoler/ }))
    expect(sceneViewOf(useSceneViews.getState(), 'doc-1').isolation.only).not.toBeNull()

    // The word follows the state: armed, the button offers the way OUT — it would otherwise
    // read « Isolate » over a scene that is already isolated.
    const armed = screen.getByRole('button', { name: /Rétablir la vue/ })
    expect(armed).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(armed)
    expect(sceneViewOf(useSceneViews.getState(), 'doc-1').isolation.only).toBeNull()
    expect(screen.getByRole('button', { name: /Isoler/ })).toHaveAttribute('aria-pressed', 'false')
  })

  // Hiding arms the same button, since `isolating` counts a hidden node too — so the word has
  // to follow there as well, or it offers to isolate what it is about to reveal.
  it('offers the way out after a plain hide, never « isolate » over it', async () => {
    withChosenBox()
    render(<SceneDocument documentId="doc-1" />)

    await userEvent.click(screen.getByRole('button', { name: /Masquer/ }))

    expect(screen.getByRole('button', { name: /Rétablir la vue/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Isoler/ })).not.toBeInTheDocument()
  })

  it('hides the selection without touching what the document holds', async () => {
    withChosenBox()
    render(<SceneDocument documentId="doc-1" />)

    await userEvent.click(screen.getByRole('button', { name: /Masquer/ }))

    expect(sceneViewOf(useSceneViews.getState(), 'doc-1').isolation.hidden.size).toBeGreaterThan(0)
    expect(sceneOf(useScenes.getState(), 'doc-1').nodes.every(node => node.visible)).toBe(true)
  })

  it('gives everything back with show all', async () => {
    withChosenBox()
    render(<SceneDocument documentId="doc-1" />)
    await userEvent.click(screen.getByRole('button', { name: /Masquer/ }))
    // Stated before the second click: zero is also the value this starts on, so asserting it
    // at the end alone would pass with both buttons doing nothing at all.
    expect(sceneViewOf(useSceneViews.getState(), 'doc-1').isolation.hidden.size).toBe(1)

    await userEvent.click(screen.getByRole('button', { name: /Tout afficher/ }))

    expect(sceneViewOf(useSceneViews.getState(), 'doc-1').isolation.hidden.size).toBe(0)
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
            path: 'documents/Renamed.gltf',
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

  /**
   * The transport lives HERE rather than in the timeline panel, which is a tool window one may
   * close: a character has to keep walking in the viewport with no band on screen. Nothing else
   * asserts it — remove the hook and every other test of the studio stays green.
   */
  it('runs the head itself, so closing the timeline panel never stops playback', async () => {
    render(<SceneDocument documentId="doc-1" />)
    act(() => useSceneViews.getState().setPlaying('doc-1', true))

    await waitFor(() =>
      expect(sceneViewOf(useSceneViews.getState(), 'doc-1').playhead).toBeGreaterThan(0),
    )
    act(() => useSceneViews.getState().setPlaying('doc-1', false))
  })

  it('reports the bones a model brought, so a track can name one', () => {
    render(<SceneDocument documentId="doc-1" />)
    const options = built.at(-1)
    options?.onRig?.('perso', rigStateFixture(['spine', 'arm.L']))

    expect(bonesOfNode(useModelFiles.getState(), 'doc-1', 'perso')).toEqual(['spine', 'arm.L'])
  })

  it('reports what the model turned out to be, which is what the inspector answers with', () => {
    render(<SceneDocument documentId="doc-1" />)
    const options = built.at(-1)
    options?.onRig?.('perso', rigStateFixture(['spine']))

    expect(rigOfNode(useModelFiles.getState(), 'doc-1', 'perso')?.status).toBe('skinnedMesh')
  })

  it('reports the clips too, and forgets both when the viewport goes', () => {
    const { unmount } = render(<SceneDocument documentId="doc-1" />)
    const options = built.at(-1)
    options?.onClips?.('perso', ['walk'], { walk: 2 })
    expect(clipsOfNode(useModelFiles.getState(), 'doc-1', 'perso')).toEqual(['walk'])

    // The names came out of files that viewport parsed; nothing outside it can answer for them.
    unmount()
    expect(clipsOfNode(useModelFiles.getState(), 'doc-1', 'perso')).toEqual([])
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

  /**
   * The void is not nothing to say: it is where a scene GROWS. Before this, a right-click that
   * hit no node answered with no menu at all, and ⇧A was a key nothing on screen named.
   */
  it('offers what a scene can receive where the click hit no node', async () => {
    const menu = fakeMenu()
    installFakeBridge({ menu: menu.bridge })
    render(<SceneDocument documentId="doc-1" />)

    built.at(-1)?.onContextMenu?.(null)

    await vi.waitFor(() => expect(menu.labels()).toContain('Ajouter une maille'))
    expect(menu.labels()).not.toContain('Supprimer')
  })

  it('opens the same rows on the key that names them', async () => {
    const menu = fakeMenu()
    installFakeBridge({ menu: menu.bridge })
    render(<SceneDocument documentId="doc-1" />)

    await userEvent.keyboard('{Shift>}{A}{/Shift}')

    await vi.waitFor(() => expect(menu.labels()).toContain('Ajouter une maille'))
  })

  /**
   * That key is also boost-strafe-left, and the held set cannot tell the two apart — Shift is
   * down either way. A native menu takes the focus with it, so the keyups that would end the
   * flight go to the menu and the boost stays held.
   */
  it('opens nothing on that key while the camera is flying', async () => {
    const menu = fakeMenu()
    installFakeBridge({ menu: menu.bridge })
    render(<SceneDocument documentId="doc-1" />)
    const engine = engines.at(-1)
    if (engine) engine.flying = true

    await userEvent.keyboard('{Shift>}{A}{/Shift}')

    expect(menu.raised).toEqual([])
  })

  // The rows are what a scene GAINS, so choosing one puts it there — the same door the bar uses.
  it('adds the kind whose row was chosen', async () => {
    const menu = fakeMenu()
    menu.picks('Cube')
    installFakeBridge({ menu: menu.bridge })
    render(<SceneDocument documentId="doc-1" />)

    built.at(-1)?.onContextMenu?.(null)

    // A default scene already holds its lights, so what this reads is what the menu ADDED.
    await vi.waitFor(() =>
      expect(
        sceneOf(useScenes.getState(), 'doc-1').nodes.filter(node => node.type === 'mesh'),
      ).toHaveLength(1),
    )
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

describe('SceneDocument and a point posed on a rail', () => {
  const at = (x: number) => ({ x, y: 0, z: 0 })

  const pointsOf = (): number[] => {
    const node = nodesOf('doc-1').find(candidate => candidate.id === 'rail')
    return node?.type === 'path' ? node.path.points.map(point => point.x) : []
  }

  const installRail = (): void => {
    act(() =>
      useScenes
        .getState()
        .runCommand('doc-1', addNode(pathNodeFixture('rail', { points: [at(0), at(10), at(20)] }))),
    )
  }

  it('poses the point in the stretch the viewport names, and nowhere else', async () => {
    render(<SceneDocument documentId="doc-1" />)
    installRail()

    await act(async () => built.at(-1)?.onAddPathPoint?.('rail', 0))

    expect(pointsOf()).toEqual([0, 5, 10, 20])
  })

  /**
   * Picked on the way, so the point one just made is the point one drags: nothing on screen says
   * the gesture is in two steps, and a knob posed and left unheld would be that second step.
   */
  it('picks the point it just posed', async () => {
    render(<SceneDocument documentId="doc-1" />)
    installRail()

    await act(async () => built.at(-1)?.onAddPathPoint?.('rail', 0))

    expect(sceneViewOf(useSceneViews.getState(), 'doc-1').pickedPathPoint).toEqual({
      nodeId: 'rail',
      index: 1,
    })
  })

  it('costs one undo entry, which puts the rail back as it was', async () => {
    render(<SceneDocument documentId="doc-1" />)
    installRail()

    await act(async () => built.at(-1)?.onAddPathPoint?.('rail', 0))
    act(() => useScenes.getState().undo('doc-1'))

    expect(pointsOf()).toEqual([0, 10, 20])
  })

  it('lays an aimed point past the last one, click after click', async () => {
    render(<SceneDocument documentId="doc-1" />)
    installRail()

    await act(async () => built.at(-1)?.onAppendPathPoint?.('rail', at(30)))
    await act(async () => built.at(-1)?.onAppendPathPoint?.('rail', at(40)))

    expect(pointsOf()).toEqual([0, 10, 20, 30, 40])
  })

  /** The gizmo has to sit on the point just laid, or a run of clicks would drag the first one. */
  it('picks the end it just laid rather than the end it started from', async () => {
    render(<SceneDocument documentId="doc-1" />)
    installRail()

    await act(async () => built.at(-1)?.onAppendPathPoint?.('rail', at(30)))

    expect(sceneViewOf(useSceneViews.getState(), 'doc-1').pickedPathPoint).toEqual({
      nodeId: 'rail',
      index: 3,
    })
  })

  it('costs one undo entry per click, so a trajectory unwinds point by point', async () => {
    render(<SceneDocument documentId="doc-1" />)
    installRail()

    await act(async () => built.at(-1)?.onAppendPathPoint?.('rail', at(30)))
    await act(async () => built.at(-1)?.onAppendPathPoint?.('rail', at(40)))
    act(() => useScenes.getState().undo('doc-1'))

    expect(pointsOf()).toEqual([0, 10, 20, 30])
  })
})
