import { render, screen } from '@testing-library/react'
import type { DockviewApi, DockviewGroupPanel, IWatermarkPanelProps } from 'dockview-react'
import { beforeEach, describe, expect, it } from 'vitest'
import { aiOverview, roleRow } from '@shared/domain/aiOverview-fixtures'
import { ASSISTANT_ROLE } from '@shared/domain/aiRole'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { installFakeBridge } from '@/services/fakeBridge'
import { useAiModels } from '@/stores/aiModels'
import { useAssistant } from '@/stores/assistant'
import { useDictation } from '@/stores/dictation'
import { useSettings } from '@/stores/settings'
import { DocumentsIdle } from './DocumentsIdle'

/** The manager, with the assistant served by a cloud or by nothing at all. */
const served = (by: 'cloud' | null) =>
  aiOverview({
    roles: [
      roleRow({
        role: ASSISTANT_ROLE,
        provider: by === null ? null : { kind: 'cloud', providerId: 'scenario' },
      }),
    ],
  })

/** What Dockview hands a watermark. `group` is set only on the per-group mount. */
const watermark = (group?: DockviewGroupPanel): IWatermarkPanelProps => ({
  // Never read: the component branches on `group` alone, and a real api needs a live Dockview.
  containerApi: {} as DockviewApi,
  group,
})

beforeEach(() => {
  useAiModels.setState({ overview: null })
  useAssistant.setState({ open: false, turns: [], busy: false, asked: null, draft: '' })
  useSettings.setState({ settings: DEFAULT_SETTINGS })
  useDictation.setState({ partial: '', state: 'idle' })
  installFakeBridge()
})

describe('the empty centre', () => {
  it('talks, once something serves the assistant', () => {
    useAiModels.setState({ overview: served('cloud') })
    render(<DocumentsIdle {...watermark()} />)

    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('does not call for a model before the manager has answered', () => {
    render(<DocumentsIdle {...watermark()} />)

    expect(screen.getByText(/Aucun document ouvert/)).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('steps aside while the modal holds the conversation', () => {
    useAiModels.setState({ overview: served('cloud') })
    useAssistant.setState({ open: true })
    const { container } = render(<DocumentsIdle {...watermark()} />)

    expect(container).toBeEmptyDOMElement()
  })

  /**
   * Dockview mounts this factory per EMPTY GROUP as well as for the centre, and two of them would
   * be two fields writing one draft. `group` is the only thing that tells them apart.
   */
  it('stays a plain message when it fills a group rather than the centre', () => {
    useAiModels.setState({ overview: served('cloud') })
    render(<DocumentsIdle {...watermark({} as DockviewGroupPanel)} />)

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
})
