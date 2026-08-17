import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SECOND } from '@shared/domain/time'
import { cameraShot } from '@/engines/scene/animation-fixtures'
import { cameraNodeFixture, meshNode } from '@/engines/scene/scene-fixtures'
import { EMPTY_SCENE, type SceneState } from '@/engines/scene/sceneState'
import type { SceneRenderer } from '@/engines/scene/SceneRenderer'
import { forgetSceneEngine, registerSceneEngine } from '@/stores/sceneEngines'
import { installScene } from '@/stores/scene-fixtures'
import { useSceneViews } from '@/stores/sceneViews'
import { CameraPreview } from './CameraPreview'

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

  // Selected is not on air: the badge is what says when the two happen to coincide.
  it('says ON AIR only while the shot of that camera covers the head', () => {
    install({
      nodes: [cameraNodeFixture('cam-a')],
      selectedIds: ['cam-a'],
      animation: {
        ...EMPTY_SCENE.animation,
        shots: [cameraShot('s1', { cameraId: 'cam-a', start: 2 * SECOND, duration: 2 * SECOND })],
      },
    })
    render(<CameraPreview documentId={DOCUMENT} />)

    expect(screen.queryByText('À l’antenne')).not.toBeInTheDocument()

    act(() => useSceneViews.getState().setPlayhead(DOCUMENT, 3 * SECOND))
    expect(screen.getByText('À l’antenne')).toBeInTheDocument()
  })

  it('grows to the whole view and comes back to its corner', async () => {
    install({ nodes: [cameraNodeFixture('cam-a')], selectedIds: ['cam-a'] })
    render(<CameraPreview documentId={DOCUMENT} />)

    await userEvent.click(screen.getByRole('button', { name: /Agrandir/ }))

    expect(useSceneViews.getState().views[DOCUMENT]?.previewSize).toBe('full')
    expect(setCameraPreview).toHaveBeenLastCalledWith('cam-a', expect.objectContaining({ x: 0 }))
  })
})
