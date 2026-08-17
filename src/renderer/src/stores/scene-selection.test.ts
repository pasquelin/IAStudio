import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { addNode } from '@/engines/scene/commands'
import { meshNode } from '@/engines/scene/scene-fixtures'
import { EMPTY_SCENE } from '@/engines/scene/sceneState'
import { installDocuments } from './document-fixtures'
import { useDocuments } from './documents'
import { connectSceneSelection } from './scene-selection'
import { useScenes } from './scenes'
import { useSelection } from './selection'

/** Two scenes side by side, since half of what this connector decides is WHICH one is answered. */
function twoScenes(activeId: string): void {
  useScenes.setState({
    states: { 'doc-1': EMPTY_SCENE, 'doc-2': EMPTY_SCENE },
    histories: {},
    saved: {},
  })
  installDocuments({ 'doc-1': '3d', 'doc-2': '3d' }, activeId)
}

const kind = (): string => useSelection.getState().selection.kind

describe('what points the inspector at a scene', () => {
  let stop = (): void => {}

  beforeEach(() => {
    useSelection.getState().selectAssets(['asset-1'])
    stop = connectSceneSelection()
  })

  afterEach(() => {
    stop()
    useSelection.getState().clear()
    useDocuments.setState({ documents: {}, activeId: null })
  })

  /**
   * The command, not the click — an import selects the model it just put down, and that path never
   * goes through `selectIn`. Left alone, the panel described the asset that was dropped while the
   * outliner highlighted the node it had become.
   */
  it('follows a selection a command made, not only one a pointer made', () => {
    twoScenes('doc-1')

    useScenes.getState().runCommand('doc-1', addNode(meshNode('box-1')))

    expect(useSelection.getState().selection).toEqual({
      kind: 'node',
      ownerId: 'doc-1',
      ids: [],
    })
  })

  // A 3D generation lands in the tab it was launched from, which is rarely the one being looked
  // at. Answered there, it would take the panel off whatever its owner was editing.
  it('says nothing for a scene that is not the tab in front', () => {
    twoScenes('doc-2')

    useScenes.getState().runCommand('doc-1', addNode(meshNode('box-1')))

    expect(kind()).toBe('asset')
  })

  /**
   * The other half of that rule, and without it the filter above only moves the defect: what a
   * background tab selected has to be answered the moment that tab comes forward.
   */
  it('answers a tab brought forward over what it had already selected', () => {
    twoScenes('doc-2')
    useScenes.getState().runCommand('doc-1', addNode(meshNode('box-1')))
    expect(kind()).toBe('asset')

    installDocuments({ 'doc-1': '3d', 'doc-2': '3d' }, 'doc-1')

    expect(kind()).toBe('node')
  })

  // A tab with nothing picked has nothing to say, and clearing there would take the panel off
  // whatever was picked in another panel.
  it('leaves the panel alone when the tab brought forward has nothing selected', () => {
    twoScenes('doc-2')

    installDocuments({ 'doc-1': '3d', 'doc-2': '3d' }, 'doc-1')

    expect(kind()).toBe('asset')
  })

  it('stops answering once undone', () => {
    twoScenes('doc-1')
    stop()

    useScenes.getState().runCommand('doc-1', addNode(meshNode('box-1')))

    expect(kind()).toBe('asset')
  })
})
