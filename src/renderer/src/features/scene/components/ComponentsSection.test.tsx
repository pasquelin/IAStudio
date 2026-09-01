import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { newComponent } from '@shared/domain/componentRegistry'
import { emptyHistory, run, undo } from '@/engines/core/history'
import type { Command } from '@/engines/core/history'
import { meshNode } from '@/engines/scene/scene-fixtures'
import { EMPTY_SCENE, nodeById, type SceneState } from '@/engines/scene/sceneState'
import type { SceneEdit } from '@/hooks/useSceneEdit'
import { useCode } from '@/stores/code'
import { ComponentsSection } from './ComponentsSection'

const sceneWith = (components?: SceneState['nodes'][number]['components']): SceneState => ({
  ...EMPTY_SCENE,
  nodes: [components === undefined ? meshNode('a') : { ...meshNode('a'), components }],
})

function show(state: SceneState) {
  const ran: Command<SceneState>[] = []
  const edit: SceneEdit = {
    run: command => ran.push(command),
    apply: vi.fn(),
    gesture: { onGestureStart: vi.fn(), onGestureEnd: vi.fn() },
  }
  const node = nodeById(state, 'a')
  if (!node) throw new Error('no node')
  render(<ComponentsSection node={node} edit={edit} />)

  return ran
}

describe('what the selected object does while the game runs', () => {
  it('says so when the object does nothing yet', () => {
    show(sceneWith())

    expect(screen.getByText('Cet objet ne fait rien pendant la partie.')).toBeInTheDocument()
  })

  /** The lot's own criterion: add one from the panel, ⌘Z takes it back. */
  it('adds a component the object had not got, and gives it back on undo', async () => {
    const ran = show(sceneWith())

    await userEvent.click(screen.getByRole('button', { name: 'Ajouter un composant' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Santé' }))

    const [command] = ran
    if (!command) throw new Error('nothing ran')

    const [added, history] = run(sceneWith(), emptyHistory<SceneState>(), command)
    expect(nodeById(added, 'a')?.components).toEqual([newComponent('Health')])
    expect(undo(added, history)[0]).toEqual(sceneWith())
  })

  it('draws one row per field the descriptor declares', () => {
    show(sceneWith([newComponent('Movement')]))

    expect(screen.getByText('Mouvement')).toBeInTheDocument()
    expect(screen.getByLabelText('Vitesse')).toBeInTheDocument()
    expect(screen.getByLabelText('Distance')).toBeInTheDocument()
  })

  it('takes off what the object carries', async () => {
    const ran = show(sceneWith([newComponent('Health')]))

    await userEvent.click(screen.getByRole('button', { name: 'Détacher' }))
    const [command] = ran
    if (!command) throw new Error('nothing ran')

    expect(nodeById(command.apply(sceneWith([newComponent('Health')])), 'a')?.components).toEqual(
      [],
    )
  })

  /**
   * 🛑 The rows come from the FILE, not from the component: a script that gained a setting shows
   * it the moment it is saved, and the component carries only the value.
   */
  it('shows a row per setting the script declares', () => {
    useCode.setState({
      files: {
        'script:Walk.ts': {
          script: 'script:Walk.ts',
          saved: '',
          source: 'export default defineScript({ props: { speed: 4 }, onUpdate() {} })',
        },
      },
    })

    show(sceneWith([{ type: 'Script', script: 'script:Walk.ts', props: { speed: 9 } }]))

    expect(screen.getByLabelText('speed')).toHaveValue('9')
  })

  /** A setting the inspector never touched answers the author's own default. */
  it('falls back to what the author wrote when the component carries nothing', () => {
    useCode.setState({
      files: {
        'script:Walk.ts': {
          script: 'script:Walk.ts',
          saved: '',
          source: 'export default defineScript({ props: { speed: 4 }, onUpdate() {} })',
        },
      },
    })

    show(sceneWith([{ type: 'Script', script: 'script:Walk.ts' }]))

    expect(screen.getByLabelText('speed')).toHaveValue('4')
  })
})
