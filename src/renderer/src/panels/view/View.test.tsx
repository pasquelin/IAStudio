import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { installDocument } from '@/stores/document-fixtures'
import { useDocuments } from '@/stores/documents'
import { useSkyboxViews, skyboxViewOf } from '@/stores/skyboxViews'
import { View } from './View'

describe('the View panel', () => {
  beforeEach(() => {
    useSkyboxViews.setState({ views: {} })
    installDocument('sky-1', 'skyboxes')
  })

  it('says so when no sky is in front, rather than offering controls over nothing', () => {
    useDocuments.setState({ activeId: null })
    render(<View />)

    expect(screen.getByText(/Ouvrez une skybox/)).toBeInTheDocument()
  })

  it('offers the four projections, with the armed one pressed', () => {
    render(<View />)

    expect(screen.getByRole('button', { name: '360°' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Croix' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('arms the projection that was picked', async () => {
    render(<View />)

    await userEvent.click(screen.getByRole('button', { name: 'Croix' }))

    expect(skyboxViewOf(useSkyboxViews.getState(), 'sky-1').view).toBe('cross')
  })

  it('sets the field of view', () => {
    render(<View />)

    fireEvent.change(screen.getByLabelText('Angle de vue'), { target: { value: '90' } })

    expect(skyboxViewOf(useSkyboxViews.getState(), 'sky-1').fieldOfView).toBe(90)
  })

  it('turns the test objects off', async () => {
    render(<View />)

    await userEvent.click(screen.getByLabelText('Objets de test'))

    expect(skyboxViewOf(useSkyboxViews.getState(), 'sky-1').probes).toBe(false)
  })

  // Two skies open at once must not share one lens.
  it('shows the settings of the document in front, not of another one', () => {
    useSkyboxViews.getState().set('sky-2', { fieldOfView: 120 })
    render(<View />)

    expect(skyboxViewOf(useSkyboxViews.getState(), 'sky-1').fieldOfView).not.toBe(120)
  })
})
