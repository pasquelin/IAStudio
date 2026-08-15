import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { createSkyboxContent, type SkyboxContent } from '@shared/domain/skybox'
import { installDocument, installDocuments } from '@/stores/document-fixtures'
import { useDocuments } from '@/stores/documents'
import { installSkybox } from '@/stores/skybox-fixtures'
import { skyboxHistoryOf, skyboxOf, useSkyboxes } from '@/stores/skyboxes'
import { Skybox } from './Skybox'

const sky = (content: Partial<SkyboxContent> = {}): SkyboxContent => ({
  ...createSkyboxContent(),
  ...content,
})

beforeEach(() => {
  useDocuments.setState({ documents: {}, activeId: null })
  useSkyboxes.setState({ states: {}, histories: {}, saved: {} })
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

  // A tab in front with nothing written for it still grades: `skyboxOf` falls back to the default.
  it('falls back to the default sky for a tab the store has never written', () => {
    installDocument('doc-1', 'skyboxes')

    render(<Skybox />)

    const written = createSkyboxContent().sun.elevation
    expect(screen.getByLabelText('Élévation')).toHaveValue(String(written))
  })

  /**
   * Read-only, and empty rather than absent: an imported sky was produced by nothing this studio
   * knows, and a section that disappeared would read as "this build lost the panel".
   */
  it('leaves what produced the sky blank when nothing did', async () => {
    installSkybox('doc-1')
    render(<Skybox />)

    await userEvent.click(screen.getByRole('button', { name: /Génération/ }))

    expect(screen.getByLabelText('Modèle')).toHaveValue('')
    expect(screen.getByLabelText('Prompt')).toHaveValue('')
    expect(screen.getByLabelText('Graine')).toHaveValue('')
  })

  it('names what produced the sky, so a result can be traced back', async () => {
    installSkybox(
      'doc-1',
      sky({
        generation: { modelId: 'model_sky', modelLabel: 'Scenario Skybox Flux.1', prompt: 'dusk' },
      }),
    )
    render(<Skybox />)

    await userEvent.click(screen.getByRole('button', { name: /Génération/ }))

    expect(screen.getByLabelText('Modèle')).toHaveValue('Scenario Skybox Flux.1')
    expect(screen.getByLabelText('Prompt')).toHaveValue('dusk')
  })

  // Zero is a seed like any other, and `??` on a number is where that gets lost.
  it('writes the seed out even when it is zero', async () => {
    installSkybox(
      'doc-1',
      sky({ generation: { modelId: 'model_sky', modelLabel: 'Flux', prompt: 'dusk', seed: 0 } }),
    )
    render(<Skybox />)

    await userEvent.click(screen.getByRole('button', { name: /Génération/ }))

    expect(screen.getByLabelText('Graine')).toHaveValue('0')
  })

  // Every control is a uniform: what the document holds is what the control shows.
  it('shows the values the document holds', () => {
    installSkybox('doc-1', sky({ sun: { ...createSkyboxContent().sun, elevation: 0.7 } }))

    render(<Skybox />)

    expect(screen.getByLabelText('Élévation')).toHaveValue('0.7')
  })

  it('writes a moved control into the document it belongs to', () => {
    installSkybox('doc-1')
    render(<Skybox />)

    fireEvent.change(screen.getByLabelText('Élévation'), { target: { value: '0.4' } })

    expect(skyboxOf(useSkyboxes.getState(), 'doc-1').sun.elevation).toBeCloseTo(0.4)
  })

  // The three families of control write through three different commands; one each.
  it('writes the environment and the grading the same way', () => {
    installSkybox('doc-1')
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
    installSkybox('doc-1')
    render(<Skybox />)
    const slider = screen.getByLabelText('Élévation')

    fireEvent.pointerDown(slider)
    fireEvent.change(slider, { target: { value: '0.2' } })
    fireEvent.change(slider, { target: { value: '0.3' } })
    fireEvent.pointerUp(slider)

    expect(skyboxHistoryOf(useSkyboxes.getState(), 'doc-1').past).toHaveLength(1)
  })

  /**
   * And CLOSES it, which a second drag cannot prove: `beginGesture` resets the merge key, so a
   * gesture left open is invisible until an edit arrives WITHOUT one — and that edit would then
   * collapse into the drag before it. The map holding those keys is module-scope and no teardown
   * clears it, so an unclosed gesture also outlives the case that opened it.
   */
  it('ends the gesture, so an edit outside a drag is its own entry', () => {
    installSkybox('doc-1')
    render(<Skybox />)
    const slider = screen.getByLabelText('Élévation')

    fireEvent.pointerDown(slider)
    fireEvent.change(slider, { target: { value: '0.2' } })
    fireEvent.pointerUp(slider)

    fireEvent.change(slider, { target: { value: '0.5' } })

    expect(skyboxHistoryOf(useSkyboxes.getState(), 'doc-1').past).toHaveLength(2)
  })

  /**
   * A FORM of code, not a scene anyone reaches: the id is captured once, above the closures, so
   * a handler that re-read the front tab would write elsewhere. On screen the panel re-renders
   * before a pointer gets anywhere, which is also why the front tab can be swapped here without
   * the render reflowing — the case holds the capture, and nothing about switching tabs.
   */
  it('captures its document id rather than re-reading the front tab in a handler', () => {
    installSkybox('doc-1')
    render(<Skybox />)

    installDocuments({ 'doc-1': 'skyboxes', 'doc-2': 'skyboxes' }, 'doc-2')
    fireEvent.change(screen.getByLabelText('Élévation'), { target: { value: '0.4' } })

    expect(skyboxOf(useSkyboxes.getState(), 'doc-1').sun.elevation).toBeCloseTo(0.4)
  })
})
