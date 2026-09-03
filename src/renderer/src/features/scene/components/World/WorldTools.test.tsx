import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { reliefLayer, terrainEditLayer } from '@shared/domain/scene'
import { createDefaultScene } from '@/engines/scene/defaultScene'
import { installScene } from '@/stores/scene-fixtures'
import { sceneViewOf, useSceneViews } from '@/stores/sceneViews'
import { WorldPanel } from './WorldPanel'

function sceneWithTerrain() {
  const scene = createDefaultScene()
  return {
    ...scene,
    world: {
      ...scene.world,
      layers: [
        reliefLayer(
          { assetId: 'h' },
          {
            id: 'island',
            name: 'Island',
            edits: [terrainEditLayer({ id: 'hills', name: 'Hills' })],
          },
        ),
      ],
    },
  }
}

describe('WorldTools sculpt session', () => {
  beforeEach(() => {
    useSceneViews.setState({ views: {} })
    installScene('doc-1', sceneWithTerrain())
    useSceneViews.getState().setArmedRelief('doc-1', { terrainId: 'island', editId: 'hills' })
  })

  it('turns sculpt on and drops pose mode if it was on', async () => {
    useSceneViews.getState().setPoseMode('doc-1', true)
    render(<WorldPanel />)

    await userEvent.click(screen.getByRole('button', { name: 'Sculpter' }))

    const view = sceneViewOf(useSceneViews.getState(), 'doc-1')
    expect(view.sculptMode).toBe(true)
    expect(view.poseMode).toBe(false)
  })

  it('turns sculpt off again on the next press, restoring pose as a choice', async () => {
    render(<WorldPanel />)
    await userEvent.click(screen.getByRole('button', { name: 'Sculpter' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sculpter' }))

    expect(sceneViewOf(useSceneViews.getState(), 'doc-1').sculptMode).toBe(false)
  })
})
