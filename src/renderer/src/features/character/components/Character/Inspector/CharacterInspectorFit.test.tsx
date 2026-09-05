import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CharacterInspectorFit } from './CharacterInspectorFit'

const useCharacterFit = vi.hoisted(() => vi.fn())

vi.mock('@/hooks/useCharacterFit', () => ({ useCharacterFit }))

const chooseBackend = vi.fn()
const setMiaOptions = vi.fn()
const sample = {
  bounds: { min: { x: -0.3, y: 0, z: -0.2 }, max: { x: 0.3, y: 1.8, z: 0.2 } },
  points: new Float32Array(),
}

beforeEach(() => {
  chooseBackend.mockReset()
  setMiaOptions.mockReset()
  useCharacterFit.mockReturnValue({
    t: (key: string) =>
      ({
        'inspector.characterKind': 'Type de personnage',
        'inspector.rigService': 'Service',
        'inspector.rigServiceLocal': 'Automatique — le studio',
        'inspector.rigCreate': 'Créer le squelette',
        'inspector.rigRegenerate': 'Régénérer le squelette',
        'inspector.autoRigFingers': 'Doigts',
        'inspector.autoRigFingerDetailed': 'Détaillés',
        'inspector.autoRigFingerSimplified': 'Simplifiés',
        'inspector.autoRigUseSurfaceNormals': 'Utiliser les normales de surface',
        'inspector.autoRigUseSurfaceNormalsHint': 'Améliore la séparation des poids.',
        'inspector.autoRigWeightPostProcessing': 'Nettoyer les influences',
        'inspector.autoRigMiaSettingsHint': 'Ces réglages seront utilisés au prochain calcul.',
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
    miaOptions: { fingers: 'detailed', useSurfaceNormals: false, weightPostProcessing: true },
    setMiaOptions,
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

  it('shows MIA quality settings and can regenerate an existing rig', async () => {
    render(
      <CharacterInspectorFit
        assetId="asset"
        documentId="document"
        nodeId="node"
        sample={sample}
        hasRig
      />,
    )

    await userEvent.selectOptions(screen.getByLabelText('Doigts'), 'simplified')
    await userEvent.click(screen.getByLabelText('Utiliser les normales de surface'))
    await userEvent.click(screen.getByLabelText('Nettoyer les influences'))

    expect(screen.getByRole('button', { name: 'Régénérer le squelette' })).toBeInTheDocument()
    expect(setMiaOptions).toHaveBeenCalledWith({
      fingers: 'simplified',
      useSurfaceNormals: false,
      weightPostProcessing: true,
    })
    expect(setMiaOptions).toHaveBeenCalledWith({
      fingers: 'detailed',
      useSurfaceNormals: true,
      weightPostProcessing: true,
    })
    expect(setMiaOptions).toHaveBeenCalledWith({
      fingers: 'detailed',
      useSurfaceNormals: false,
      weightPostProcessing: false,
    })
  })

  it('presents MIA setting help as compact informational alerts', () => {
    render(
      <CharacterInspectorFit assetId="asset" documentId="document" nodeId="node" sample={sample} />,
    )

    for (const text of [
      'Améliore la séparation des poids.',
      'Ces réglages seront utilisés au prochain calcul.',
    ]) {
      expect(screen.getByText(text)).toHaveClass('alert', 'alert-info', 'alert-soft', 'text-tiny')
    }
  })
})
