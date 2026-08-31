import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { createSkyboxContent, type SkyboxContent } from '@shared/domain/skybox'
import { installDocument } from '@/stores/document-fixtures'
import { useDocuments } from '@/stores/documents'
import { installSkybox } from '@/stores/skybox-fixtures'
import { skyboxHistoryOf, skyboxOf, useSkyboxes } from '@/stores/skyboxes'
import { SkyboxInspector } from './SkyboxInspector'

const sky = (content: Partial<SkyboxContent> = {}): SkyboxContent => ({
  ...createSkyboxContent(),
  ...content,
})

beforeEach(() => {
  useDocuments.setState({ documents: {}, activeId: null })
})

/**
 * What a read-only property row shows, found from its name. The word sits inside `PropertyLabel`,
 * which truncates in a span of its own — so the value is the label's next sibling, not the
 * word's.
 */
/** The whole property line a control stands on, which is where its reset stands too. */
function lineOf(name: string): HTMLElement {
  const line = screen.getByLabelText(name).closest('label')
  if (!line) throw new Error(`no property line for ${name}`)
  return line
}

function valueOf(name: string): Element | null {
  return screen.getByText(name).closest('span')?.parentElement?.nextElementSibling ?? null
}

describe('the skybox face of the inspector', () => {
  // A tab in front with nothing written for it still grades: `skyboxOf` falls back to the default.
  it('falls back to the default sky for a tab the store has never written', () => {
    installDocument('doc-1', 'skyboxes')

    render(<SkyboxInspector documentId="doc-1" />)

    const written = createSkyboxContent().sun.elevation
    expect(screen.getByLabelText('Élévation')).toHaveValue(String(written))
  })

  /**
   * Read-only, and empty rather than absent: an imported sky was produced by nothing this studio
   * knows, and a section that disappeared would read as "this build lost the panel".
   */
  it('leaves what produced the sky blank when nothing did', async () => {
    installSkybox('doc-1')
    render(<SkyboxInspector documentId="doc-1" />)

    await userEvent.click(screen.getByRole('button', { name: /Génération/ }))

    expect(valueOf('Modèle')).toBeEmptyDOMElement()
    expect(valueOf('Prompt')).toBeEmptyDOMElement()
    expect(valueOf('Graine')).toBeEmptyDOMElement()
  })

  it('names what produced the sky, so a result can be traced back', async () => {
    installSkybox(
      'doc-1',
      sky({
        generation: { modelId: 'model_sky', modelLabel: 'Scenario Skybox Flux.1', prompt: 'dusk' },
      }),
    )
    render(<SkyboxInspector documentId="doc-1" />)

    await userEvent.click(screen.getByRole('button', { name: /Génération/ }))

    expect(screen.getByText('Scenario Skybox Flux.1')).toBeInTheDocument()
    expect(screen.getByText('dusk')).toBeInTheDocument()
  })

  // Zero is a seed like any other, and `??` on a number is where that gets lost.
  it('writes the seed out even when it is zero', async () => {
    installSkybox(
      'doc-1',
      sky({ generation: { modelId: 'model_sky', modelLabel: 'Flux', prompt: 'dusk', seed: 0 } }),
    )
    render(<SkyboxInspector documentId="doc-1" />)

    await userEvent.click(screen.getByRole('button', { name: /Génération/ }))

    expect(valueOf('Graine')).toHaveTextContent('0')
  })

  // Every control is a uniform: what the document holds is what the control shows.
  it('shows the values the document holds', () => {
    installSkybox('doc-1', sky({ sun: { ...createSkyboxContent().sun, elevation: 0.7 } }))

    render(<SkyboxInspector documentId="doc-1" />)

    expect(screen.getByLabelText('Élévation')).toHaveValue('0.7')
  })

  /**
   * Every slider of this face offers a reset, and none was covered. It goes through the same
   * setter as a drag, which is what makes ⌘Z take it back the way it takes a drag back.
   */
  it('puts the sun back where it started, and undoes like any other edit', async () => {
    installSkybox('doc-1', sky({ sun: { ...createSkyboxContent().sun, elevation: 0.7 } }))
    render(<SkyboxInspector documentId="doc-1" />)

    await userEvent.click(within(lineOf('Élévation')).getByRole('button'))

    expect(skyboxOf(useSkyboxes.getState(), 'doc-1').sun.elevation).toBeCloseTo(Math.PI / 6)

    useSkyboxes.getState().undo('doc-1')

    expect(skyboxOf(useSkyboxes.getState(), 'doc-1').sun.elevation).toBeCloseTo(0.7)
  })

  it('leaves the reset of a sun at its default inert', () => {
    installSkybox('doc-1')
    render(<SkyboxInspector documentId="doc-1" />)

    expect(within(lineOf('Élévation')).getByRole('button')).toBeDisabled()
  })

  it('writes a moved control into the document it belongs to', () => {
    installSkybox('doc-1')
    render(<SkyboxInspector documentId="doc-1" />)

    fireEvent.change(screen.getByLabelText('Élévation'), { target: { value: '0.4' } })

    expect(skyboxOf(useSkyboxes.getState(), 'doc-1').sun.elevation).toBeCloseTo(0.4)
  })

  // The three families of control write through three different commands; one each.
  it('writes the environment and the grading the same way', () => {
    installSkybox('doc-1')
    render(<SkyboxInspector documentId="doc-1" />)

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
    render(<SkyboxInspector documentId="doc-1" />)
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
    render(<SkyboxInspector documentId="doc-1" />)
    const slider = screen.getByLabelText('Élévation')

    fireEvent.pointerDown(slider)
    fireEvent.change(slider, { target: { value: '0.2' } })
    fireEvent.pointerUp(slider)

    fireEvent.change(slider, { target: { value: '0.5' } })

    expect(skyboxHistoryOf(useSkyboxes.getState(), 'doc-1').past).toHaveLength(2)
  })
})
