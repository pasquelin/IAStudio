import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AA_NON_TEXT, contrastRatio } from '@shared/domain/color'
import { SECOND } from '@shared/domain/time'
import stylesheet from '@/index.css?raw'
import { cameraShot } from '@/engines/scene/animation-fixtures'
import { cameraNodeFixture, meshNode } from '@/engines/scene/scene-fixtures'
import { EMPTY_SCENE, type SceneState } from '@/engines/scene/sceneState'
import type { SceneRenderer } from '@/engines/scene/SceneRenderer'
import { forgetSceneEngine, registerSceneEngine } from '@/stores/sceneEngines'
import { installScene } from '@/stores/scene-fixtures'
import { useSceneViews } from '@/stores/sceneViews'
import { CameraPreview } from './CameraPreview'
import source from './CameraPreview.tsx?raw'

const DOCUMENT = 'doc-1'

const setCameraPreview = vi.fn()

/** Only the one call this component makes — the rest of an engine needs a GPU. */
function installEngine(): void {
  registerSceneEngine(DOCUMENT, { setCameraPreview } as unknown as SceneRenderer)
}

function install(state: Partial<SceneState>): void {
  installScene(DOCUMENT, { ...EMPTY_SCENE, ...state })
  useSceneViews.setState({ views: {} })
  installEngine()
}

afterEach(() => {
  forgetSceneEngine(DOCUMENT)
  setCameraPreview.mockClear()
})

describe('the camera preview', () => {
  it('shows nothing at all until a camera is selected', () => {
    install({ nodes: [meshNode('box')], selectedIds: ['box'] })
    render(<CameraPreview documentId={DOCUMENT} />)

    expect(screen.queryByText('Camera A')).not.toBeInTheDocument()
    expect(setCameraPreview).toHaveBeenLastCalledWith(null, null)
  })

  it('names the selected camera, and hands the engine the rectangle it draws into', () => {
    install({ nodes: [cameraNodeFixture('Camera A')], selectedIds: ['Camera A'] })
    render(<CameraPreview documentId={DOCUMENT} />)

    expect(screen.getByText('Camera A')).toBeInTheDocument()
    expect(setCameraPreview).toHaveBeenLastCalledWith(
      'Camera A',
      expect.objectContaining({ width: expect.any(Number) }),
    )
  })

  /**
   * Selected is not on air, and the badge is what says when the two coincide. Two cameras, since
   * with one the film falls back to it — `activeCameraAt` decides here as it does everywhere.
   */
  it('says ON AIR only while this camera is the one a render would look through', () => {
    install({
      nodes: [cameraNodeFixture('cam-a'), cameraNodeFixture('cam-b')],
      selectedIds: ['cam-b'],
      animation: {
        ...EMPTY_SCENE.animation,
        shots: [cameraShot('s1', { cameraId: 'cam-b', start: 2 * SECOND, duration: 2 * SECOND })],
      },
    })
    render(<CameraPreview documentId={DOCUMENT} />)

    // At zero no shot covers the head, so the first camera of the document has the film.
    expect(screen.queryByText('À l’antenne')).not.toBeInTheDocument()

    act(() => useSceneViews.getState().setPlayhead(DOCUMENT, 3 * SECOND))
    expect(screen.getByText('À l’antenne')).toBeInTheDocument()
  })

  /**
   * The RING, not the border, and that is the whole point. Measured 18/08 against the #33363b
   * viewport: `border` is 1,00:1, `panel` 1,44 and pure black 1,73 — the viewport sits lighter
   * than every surface of the studio, so NO dark grey can reach the 3:1 WCAG 1.4.11 asks of a
   * glyph that informs. The dark border is what the eye reads as a frame of this app; the ring
   * inside it is what makes the frame exist at all.
   */
  it('draws a frame that can be told from the viewport it sits on', () => {
    const token = /ring-([a-z-]+)/.exec(source)?.[1] ?? ''
    const tokenOf = (name: string): string =>
      /--color-[a-z0-9-]+:\s*(#[0-9a-fA-F]{6})/.exec(
        stylesheet.slice(stylesheet.indexOf(`--color-${name}:`)),
      )?.[1] ?? ''

    expect(contrastRatio(tokenOf(token), tokenOf('viewport'))).toBeGreaterThanOrEqual(AA_NON_TEXT)
    // A WIDTH as well as a colour, and this half was learnt the hard way: `ring-muted` alone
    // draws nothing at all — Tailwind needs `ring-1` for a ring to exist — and this very guard
    // read the colour, found it contrasted, and passed on a frame that had no ring on screen.
    expect(source).toMatch(/ring-\d/)
  })

  it('grows to the whole view and comes back to its corner', async () => {
    install({ nodes: [cameraNodeFixture('cam-a')], selectedIds: ['cam-a'] })
    render(<CameraPreview documentId={DOCUMENT} />)

    await userEvent.click(screen.getByRole('button', { name: /Agrandir/ }))

    expect(useSceneViews.getState().views[DOCUMENT]?.previewSize).toBe('full')
    expect(setCameraPreview).toHaveBeenLastCalledWith('cam-a', expect.objectContaining({ x: 0 }))
  })
})
