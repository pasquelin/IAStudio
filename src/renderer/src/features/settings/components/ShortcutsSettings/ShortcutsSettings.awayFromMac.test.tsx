import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { useSettings } from '@/stores/settings'
import { useSettingsDraft } from '@/stores/settingsDraft'
import { ShortcutsSettings } from './ShortcutsSettings'

/**
 * A file of its own for the one thing it changes: `stores/bindings.ts` reads the platform at
 * module scope, and every other renderer case runs on the macOS agent the setup pins.
 */
vi.mock('@/helpers/platform', () => ({ IS_MAC: false, isMacUserAgent: () => false }))

describe('the shortcuts screen away from macOS', () => {
  beforeEach(() => {
    useSettings.setState({ settings: DEFAULT_SETTINGS })
    useSettingsDraft.setState({ pending: {}, touched: new Set() })
  })

  /**
   * 🛑 The merge lived at the two places a binding is USED and at none of the places one is
   * SHOWN: this screen offered ⌃⌘F for a full screen the app answers F11 to.
   */
  it('shows the key this system ships, not the macOS one', () => {
    render(<ShortcutsSettings />)

    expect(screen.getByLabelText('Plein écran')).toHaveTextContent('F11')
  })
})
