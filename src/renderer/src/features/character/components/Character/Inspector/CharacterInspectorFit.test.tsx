import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CharacterInspectorFit } from './CharacterInspectorFit'

const useCharacterFit = vi.hoisted(() => vi.fn())

vi.mock('@/hooks/useCharacterFit', () => ({ useCharacterFit }))

const chooseBackend = vi.fn()
const sample = {
  bounds: { min: { x: -0.3, y: 0, z: -0.2 }, max: { x: 0.3, y: 1.8, z: 0.2 } },
  points: new Float32Array(),
}

beforeEach(() => {
  chooseBackend.mockReset()
  useCharacterFit.mockReturnValue({
    t: (key: string) =>
      ({
        'inspector.characterKind': 'Type de personnage',
        'inspector.rigService': 'Service',
        'inspector.rigServiceLocal': 'Automatique — le studio',
        'inspector.rigCreate': 'Créer le squelette',
      })[key] ?? key,
    i18n: { language: 'fr' },
    kind: 'human',
    setKind: vi.fn(),
    plan: null,
    services: [],
    maxSize: undefined,
    bytes: 0,
    refusal: null,
    rigBackends: [{ backendId: 'make-it-animatable', name: 'Make-It-Animatable' }],
    selectedBackend: 'make-it-animatable',
    chooseBackend,
    needsDownload: false,
    failure: null,
    running: false,
    download: vi.fn(),
    useSimple: vi.fn(),
    fit: vi.fn(),
  })
})

describe('the Auto Rig selector', () => {
  it('shows the installed advanced backend and reflects the one currently chosen', () => {
    render(
      <CharacterInspectorFit assetId="asset" documentId="document" nodeId="node" sample={sample} />,
    )

    expect(screen.getByLabelText('Service')).toHaveValue('make-it-animatable')
    expect(screen.getByRole('option', { name: 'Make-It-Animatable' })).toBeInTheDocument()
  })

  it('lets the person switch back to the studio rigger from the same inspector', async () => {
    render(
      <CharacterInspectorFit assetId="asset" documentId="document" nodeId="node" sample={sample} />,
    )

    await userEvent.selectOptions(screen.getByLabelText('Service'), 'simple')

    expect(chooseBackend).toHaveBeenCalledWith('simple')
  })
})
