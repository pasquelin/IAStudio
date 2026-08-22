import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { SceneRenderer } from '@/engines/scene/SceneRenderer'
import { useSceneViews } from '@/stores/sceneViews'
import { SceneClock } from './SceneClock'

describe('SceneClock', () => {
  it('pushes the head once the engine exists, not before', () => {
    const setPlayhead = vi.fn()
    const renderer = { setPlayhead, setPreview: vi.fn() } as unknown as SceneRenderer
    useSceneViews.getState().setPlayhead('doc-1', 12_000)

    const { container, rerender } = render(
      <SceneClock documentId="doc-1" duration={1_000_000} renderer={null} />,
    )

    expect(container).toBeEmptyDOMElement()
    expect(setPlayhead).not.toHaveBeenCalled()

    rerender(<SceneClock documentId="doc-1" duration={1_000_000} renderer={renderer} />)

    expect(setPlayhead).toHaveBeenCalledWith(12_000)
  })
})
