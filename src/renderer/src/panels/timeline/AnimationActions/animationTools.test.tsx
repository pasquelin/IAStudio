import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { Toolbar } from '@/design/Toolbar/Toolbar'
import { meshNode } from '@/engines/scene/scene-fixtures'
import { cameraNode } from '@/engines/scene/nodeFactory'
import { EMPTY_SCENE } from '@/engines/scene/sceneState'
import { installScene } from '@/stores/scene-fixtures'
import { sceneHistoryOf, sceneOf, useScenes } from '@/stores/scenes'
import { useSceneViews } from '@/stores/sceneViews'
import { animationTools, runAnimationTool, type AnimationToolsInput } from './animationTools'

const DOCUMENT = 'doc-1'

const sheet = () => sceneOf(useScenes.getState(), DOCUMENT).animation.sheet

const withScene = (selectedIds: string[], band: string[] = []) => {
  installScene(DOCUMENT, {
    ...EMPTY_SCENE,
    nodes: [meshNode('house'), meshNode('walker')],
    selectedIds,
    animation: { ...EMPTY_SCENE.animation, sheet: band },
  })
}

const inputOf = (): AnimationToolsInput => {
  const scene = sceneOf(useScenes.getState(), DOCUMENT)
  return { nodes: scene.nodes, selectedIds: scene.selectedIds, animation: scene.animation }
}

const toolOf = (id: string) => animationTools(inputOf()).find(tool => tool.id === id)

/** The bar as the panel's title row mounts it, so a click goes through the real button. */
const bar = () =>
  render(
    <Toolbar
      orientation="horizontal"
      label="Outils"
      tools={animationTools(inputOf())}
      onTool={id => runAnimationTool(DOCUMENT, id)}
    />,
  )

const button = () => screen.getByRole('button', { name: /Ajouter à la bande/ })

/*
 * The door into animating anything: a band that shows only what somebody put there needs a way
 * to put something there, or nothing can ever be keyed. It reads the SELECTION rather than
 * offering a list — a map of 8 000 objects is not one anybody scrolls through.
 */
describe('putting the selection on the band', () => {
  beforeEach(() => {
    withScene(['walker'])
    useSceneViews.setState({ views: {} })
  })

  it('puts what is selected on the band', async () => {
    bar()
    await userEvent.click(button())

    expect(sheet()).toEqual(['walker'])
  })

  it('costs one undo, and gives the band back as it was', async () => {
    bar()
    await userEvent.click(button())
    const { past } = sceneHistoryOf(useScenes.getState(), DOCUMENT)
    expect(past).toHaveLength(1)

    useScenes.getState().undo(DOCUMENT)

    expect(sheet()).toEqual([])
  })
})

describe('what the bar refuses', () => {
  it('is off when nothing is selected — there is nothing to put anywhere', () => {
    withScene([])

    expect(toolOf('sheet')?.disabled).toBe(true)
  })

  it('is off when the selection is already on the band', () => {
    withScene(['walker'], ['walker'])

    expect(toolOf('sheet')?.disabled).toBe(true)
  })

  it('refuses the key while nothing at all is animated', () => {
    withScene(['walker'])

    expect(toolOf('key')?.disabled).toBe(true)
  })

  /** The shot says WHY it is off: a scene of meshes has no camera to put on air. */
  it('asks for a camera when what is selected is not one', () => {
    withScene(['walker'])

    expect(toolOf('shot')?.disabled).toBe(true)
    expect(toolOf('shot')?.descriptionKey).toBe('animation.addShotNeedsCamera')
  })
})

/**
 * The gauge and the placement the three buttons carried by hand before the registry held them:
 * a panel's title bar draws a 14px glyph, and a bar hung on it tips downwards or covers the
 * surface above. Neither is visible to jsdom, and neither has any other guard.
 */
describe('where the bar is hung', () => {
  it('draws on the panel header rather than in the floating bar gauge', () => {
    withScene(['walker'])

    expect(animationTools(inputOf()).map(tool => tool.variant)).toEqual([
      'header',
      'header',
      'header',
    ])
  })

  it('hangs its tooltips below the row, as its neighbours do', () => {
    withScene(['walker'])

    expect(animationTools(inputOf()).every(tool => tool.tip !== undefined)).toBe(true)
  })

  it('acts rather than arms, so none of the three announces a pressed state', () => {
    withScene(['walker'])

    expect(animationTools(inputOf()).every(tool => tool.acts === true)).toBe(true)
  })
})

/**
 * The head is READ at the click, never subscribed to: this glyph draws nothing from it, and
 * subscribing repainted the whole title bar on every frame of playback.
 */
describe('opening a shot', () => {
  it('opens it wherever the head stands when the click happens', async () => {
    const camera = cameraNode()
    installScene(DOCUMENT, { ...EMPTY_SCENE, nodes: [camera], selectedIds: [camera.id] })
    useSceneViews.setState({ views: {} })
    bar()

    useSceneViews.getState().setPlayhead(DOCUMENT, 2_000_000)
    await userEvent.click(screen.getByRole('button', { name: /Mettre cette caméra/ }))

    const [shot] = sceneOf(useScenes.getState(), DOCUMENT).animation.shots
    expect(shot?.start).toBe(2_000_000)
  })
})
