import { mdiCreationOutline } from '@mdi/js'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakeBridge } from '@/services/fakeBridge'
import { useProject } from '@/stores/project'
import { NoProject } from './NoProject'

const settled = (): void => useProject.setState({ project: null, known: true })

beforeEach(() => {
  vi.clearAllMocks()
  useProject.setState({ project: null, known: false })
  installFakeBridge({})
})

describe('a panel that needs a project and has none', () => {
  it('says why this panel needs one, in its own words', () => {
    settled()
    render(<NoProject icon={mdiCreationOutline} message="Ouvrez un projet pour générer." />)

    expect(screen.getByText('Ouvrez un projet pour générer.')).toBeInTheDocument()
  })

  it('offers both ways to get one', () => {
    settled()
    render(<NoProject icon={mdiCreationOutline} message="Ouvrez un projet pour générer." />)

    expect(screen.getByRole('button', { name: 'Ouvrir un projet' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Créer un projet' })).toBeInTheDocument()
  })

  it.each([
    ['Ouvrir un projet', 'openPicked'],
    ['Créer un projet', 'createPicked'],
  ])('%s picks a folder', async (label, gesture) => {
    settled()
    const picked = vi.fn(() => Promise.resolve())
    useProject.setState({ [gesture]: picked })

    render(<NoProject icon={mdiCreationOutline} message="Ouvrez un projet." />)
    await userEvent.click(screen.getByRole('button', { name: label }))

    expect(picked).toHaveBeenCalled()
  })

  /**
   * `project` starts `null` and means "not asked yet" until `known` turns. The studio reopens
   * the last project on launch, so a panel that took that first `null` for an answer offered to
   * create a project to someone who already had one — for as long as the reopening took.
   */
  it('says nothing before the main process has answered', () => {
    render(<NoProject icon={mdiCreationOutline} message="Ouvrez un projet pour générer." />)

    expect(screen.queryByText('Ouvrez un projet pour générer.')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('waits out loud rather than drawing nothing', () => {
    render(<NoProject icon={mdiCreationOutline} message="Ouvrez un projet pour générer." />)

    expect(screen.getByText('Chargement…')).toBeInTheDocument()
  })
})
