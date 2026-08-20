import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { useSettings } from '@/stores/settings'
import { useSettingsDraft } from '@/stores/settingsDraft'
import { ModelFamilySettings } from './ModelFamilySettings'

vi.mock('@/hooks/useFamilyModels', () => ({
  useFamilyModels: () => [{ id: 'flux', name: 'Flux' }],
}))

beforeEach(() => {
  useSettings.setState({ settings: DEFAULT_SETTINGS })
  useSettingsDraft.setState({ pending: {}, touched: new Set() })
})

/** The dot the whole screen reads, hidden rather than unmounted — `SettingStagedDot`'s shape. */
const dotIsOn = (container: HTMLElement): boolean =>
  container.querySelector('.bg-primary.invisible') === null

describe('the default model of one family', () => {
  it('marks nothing as waiting for Apply while nothing has been staged', () => {
    const { container } = render(<ModelFamilySettings family="image" />)

    expect(dotIsOn(container)).toBe(false)
  })

  /**
   * The seven families share ONE staged branch — no path names a leaf of it — so reading the
   * buffer's presence marked every family modified as soon as any one of them was touched.
   */
  it('is not marked modified because another family was', () => {
    useSettingsDraft.setState({ pending: { generation: { defaultModels: { video: 'kling' } } } })
    const { container } = render(<ModelFamilySettings family="image" />)

    expect(dotIsOn(container)).toBe(false)
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('is marked modified when it is this family that was staged', () => {
    useSettingsDraft.setState({ pending: { generation: { defaultModels: { image: 'flux' } } } })
    const { container } = render(<ModelFamilySettings family="image" />)

    expect(dotIsOn(container)).toBe(true)
  })
})
