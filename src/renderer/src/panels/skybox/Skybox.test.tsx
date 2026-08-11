import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { createSkyboxContent, type SkyboxContent } from '@shared/domain/skybox'
import { installDocument } from '@/stores/document-fixtures'
import { useDocuments } from '@/stores/documents'
import { historyOf, skyboxOf, useSkyboxes } from '@/stores/skyboxes'
import { Skybox } from './Skybox'

/** One sky in front, its content posed as the store holds it — `states` keyed by document. */
function open(content: Partial<SkyboxContent> = {}): void {
  installDocument('doc-1', 'skyboxes')
  useSkyboxes.setState({
    states: { 'doc-1': { ...createSkyboxContent(), ...content } },
    histories: {},
  })
}

beforeEach(() => {
  useDocuments.setState({ documents: {}, activeId: null })
  useSkyboxes.setState({ states: {}, histories: {} })
})

describe('the skybox panel', () => {
  /**
   * The panel belongs to a workspace, but the document in the centre may be of another kind —
   * grading a sequence means nothing, so it says so rather than showing sliders bound to nothing.
   */
  it('says there is nothing to grade when no sky is in front', () => {
    render(<Skybox />)

    expect(screen.getByText('Ouvrez une skybox pour la régler.')).toBeInTheDocument()
  })

  /**
   * The other half of that guard cannot be reached, and it is not dead code: `skyboxOf` is
   * `states[id] ?? defaultState` (`stores/document-store.ts`), so a tab in front always has a
   * content — even one the store has never written. `!content` is what TYPE-CHECKING needs,
   * since the selector must return `null` for the no-tab case rather than derive a fresh object
   * per render, which is the re-render loop `ActivityList` was once caught in.
   */
  it('falls back to the default sky for a tab the store has never written', () => {
    installDocument('doc-1', 'skyboxes')

    render(<Skybox />)

    expect(screen.getByLabelText('Élévation')).toBeInTheDocument()
  })

  it('offers the sun once a sky is open', () => {
    open()

    render(<Skybox />)

    expect(screen.getByLabelText('Élévation')).toBeInTheDocument()
  })

  /**
   * Read-only, and empty rather than absent: an imported sky was produced by nothing this studio
   * knows, and a section that disappeared would read as "this build lost the panel".
   */
  it('leaves what produced the sky blank when nothing did', async () => {
    open()
    render(<Skybox />)

    await userEvent.click(screen.getByRole('button', { name: /Génération/ }))

    expect(screen.getByLabelText('Modèle')).toHaveValue('')
    expect(screen.getByLabelText('Prompt')).toHaveValue('')
    expect(screen.getByLabelText('Graine')).toHaveValue('')
  })

  it('names what produced the sky, so a result can be traced back', async () => {
    open({
      generation: { modelId: 'model_sky', modelLabel: 'Scenario Skybox Flux.1', prompt: 'dusk' },
    })
    render(<Skybox />)

    await userEvent.click(screen.getByRole('button', { name: /Génération/ }))

    expect(screen.getByLabelText('Modèle')).toHaveValue('Scenario Skybox Flux.1')
    expect(screen.getByLabelText('Prompt')).toHaveValue('dusk')
    // The seed is the one field a generation may omit, and zero is a seed like any other.
    expect(screen.getByLabelText('Graine')).toHaveValue('')
  })

  /**
   * What the panel is for: every control is a uniform, so a slider moved has to reach the
   * document rather than a local state the next render would drop.
   */
  it('writes a moved control into the document it belongs to', () => {
    open()
    render(<Skybox />)

    fireEvent.change(screen.getByLabelText('Élévation'), { target: { value: '0.4' } })

    expect(skyboxOf(useSkyboxes.getState(), 'doc-1').sun.elevation).toBeCloseTo(0.4)
  })

  // The three families of control write through three different commands; one each.
  it('writes the environment and the grading the same way', () => {
    open()
    render(<Skybox />)

    fireEvent.click(screen.getByLabelText('Afficher le fond'))
    fireEvent.change(screen.getByLabelText('Exposition'), { target: { value: '0.5' } })

    const content = skyboxOf(useSkyboxes.getState(), 'doc-1')
    expect(content.environment.showBackground).toBe(false)
    expect(content.adjustments.exposure).toBeCloseTo(0.5)
  })

  /**
   * A drag is one undo entry, not one per frame — the panel opens the gesture on pointer-down
   * and closes it on pointer-up, and the store collapses what happens between.
   */
  it('groups a drag into a single gesture', () => {
    open()
    render(<Skybox />)
    const slider = screen.getByLabelText('Élévation')

    fireEvent.pointerDown(slider)
    fireEvent.change(slider, { target: { value: '0.2' } })
    fireEvent.change(slider, { target: { value: '0.3' } })
    fireEvent.pointerUp(slider)

    expect(historyOf(useSkyboxes.getState(), 'doc-1').past).toHaveLength(1)
  })

  it('writes the seed out when the generation carried one', async () => {
    open({
      generation: { modelId: 'model_sky', modelLabel: 'Flux', prompt: 'dusk', seed: 0 },
    })
    render(<Skybox />)

    await userEvent.click(screen.getByRole('button', { name: /Génération/ }))

    expect(screen.getByLabelText('Graine')).toHaveValue('0')
  })
})
