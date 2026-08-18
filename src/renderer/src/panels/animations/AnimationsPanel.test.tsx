import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { modelNodeFixture } from '@/engines/scene/scene-fixtures'
import { EMPTY_SCENE } from '@/engines/scene/sceneState'
import { useDocuments } from '@/stores/documents'
import { useModelClips } from '@/stores/modelClips'
import { installScene } from '@/stores/scene-fixtures'
import { installFakeBridge } from '@/services/fakeBridge'
import { AnimationsPanel } from './AnimationsPanel'
import { ANIMATION_DRAG_TYPE } from './dragged'

const DOCUMENT = 'doc-1'

/** A model in front, holding the clips its own file brought. */
function withCharacter(clips: readonly string[]): void {
  const node = modelNodeFixture('perso')
  installScene(DOCUMENT, { ...EMPTY_SCENE, nodes: [node], selectedIds: [node.id] })
  useModelClips.getState().report(DOCUMENT, node.id, clips)
}

describe('the animations panel', () => {
  beforeEach(() => {
    installFakeBridge()
    useDocuments.setState({ activeId: DOCUMENT })
    useModelClips.setState({ clips: {}, rigs: {} })
    installScene(DOCUMENT, EMPTY_SCENE)
  })

  it('says what to do when there is nothing to play yet', async () => {
    render(<AnimationsPanel />)

    await waitFor(() => expect(screen.getByText(/Aucune animation/)).toBeInTheDocument())
  })

  it('lists the clips the character in front brought', async () => {
    withCharacter(['NlaTrack', 'run'])
    render(<AnimationsPanel />)

    await waitFor(() => expect(screen.getByText('NlaTrack')).toBeInTheDocument())
    expect(screen.getByText('run')).toBeInTheDocument()
  })

  it('lists the animations shipped with the app, by their folder name', async () => {
    installFakeBridge({
      animations: { list: () => Promise.resolve([{ name: 'walk', thumbnail: false }]) },
    })
    render(<AnimationsPanel />)

    await waitFor(() => expect(screen.getByText('walk')).toBeInTheDocument())
  })

  // Dragged by its NAME and nothing else: the band writes that name into the document, and a
  // path off this machine would name a file the next one has not got.
  it('hands the band the folder name when a shipped animation is dragged', async () => {
    installFakeBridge({
      animations: { list: () => Promise.resolve([{ name: 'walk', thumbnail: false }]) },
    })
    render(<AnimationsPanel />)
    await waitFor(() => expect(screen.getByText('walk')).toBeInTheDocument())

    const carried = new Map<string, string>()
    screen
      .getByText('walk')
      .closest('[draggable]')
      ?.dispatchEvent(
        Object.assign(new Event('dragstart', { bubbles: true }), {
          dataTransfer: { setData: (type: string, value: string) => void carried.set(type, value) },
        }),
      )

    expect(JSON.parse(carried.get(ANIMATION_DRAG_TYPE) ?? 'null')).toEqual({
      kind: 'bundled',
      name: 'walk',
    })
  })

  // The drag is what puts a block on a lane, so a row that carries nothing is a row that does
  // nothing — and nothing on screen would say so.
  it('hands the band what it needs when a row is dragged', async () => {
    withCharacter(['NlaTrack'])
    render(<AnimationsPanel />)
    await waitFor(() => expect(screen.getByText('NlaTrack')).toBeInTheDocument())

    const carried = new Map<string, string>()
    const row = screen.getByText('NlaTrack').closest('[draggable]')
    row?.dispatchEvent(
      Object.assign(new Event('dragstart', { bubbles: true }), {
        dataTransfer: { setData: (type: string, value: string) => void carried.set(type, value) },
      }),
    )

    expect(JSON.parse(carried.get(ANIMATION_DRAG_TYPE) ?? 'null')).toEqual({
      kind: 'embedded',
      clip: 'NlaTrack',
    })
  })

  it('leaves the rows of a character out when what is in front is not one', async () => {
    withCharacter(['NlaTrack'])
    installScene(DOCUMENT, { ...EMPTY_SCENE, selectedIds: [] })
    render(<AnimationsPanel />)

    await waitFor(() => expect(screen.getByText(/Aucune animation/)).toBeInTheDocument())
  })
})
