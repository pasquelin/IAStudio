import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SettingLine } from './SettingLine'

/**
 * Read through Vite rather than `node:fs`, like `design/spacing.test.ts`: the renderer has no
 * Node types, and the check has to live beside what it guards.
 */
const SOURCES: Record<string, string> = import.meta.glob('./*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
})

/**
 * The shell that was copied by hand into three files before this component existed. The inner
 * row it wraps is deliberately not checked: `flex items-center justify-between gap-4` is an
 * ordinary layout, and the search results of `SettingsWindow` use it inside a whole `<button>`
 * that no `<div>`-rendering line could wrap.
 */
const SHELL = 'border-base-300 flex flex-col gap-2 border-b py-3'

describe('a settings line', () => {
  it('puts the control next to the title, and the help under both', () => {
    render(
      <SettingLine title="Density" help={<p>How tight the controls sit</p>}>
        <button type="button">Comfort</button>
      </SettingLine>,
    )

    expect(screen.getByText('Density')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Comfort' })).toBeInTheDocument()
    expect(screen.getByText('How tight the controls sit')).toBeInTheDocument()
  })

  it('labels the control when it is given one to point at', () => {
    render(
      <SettingLine title="Density" labelFor="density">
        <input id="density" />
      </SettingLine>,
    )

    expect(screen.getByLabelText('Density')).toBeInTheDocument()
  })

  /** A line with nothing to stage must not show a dot that means "changed, not yet applied". */
  it('marks a staged value, and only a staged one', () => {
    const { rerender, container } = render(<SettingLine title="Density">{null}</SettingLine>)
    expect(container.querySelector('.bg-primary.invisible')).not.toBeNull()

    rerender(
      <SettingLine title="Density" staged stagedLabel="Modified">
        {null}
      </SettingLine>,
    )
    expect(container.querySelector('.bg-primary.invisible')).toBeNull()
  })

  /**
   * The point of the component, kept honest. The settings row, the action row and the shortcut
   * row carried these two strings to the character, and had drifted on what sat inside them —
   * only one showed the staged dot. A fourth copy would drift the same way.
   */
  it('is the only place in the settings that writes the shape of a line', () => {
    const writers = Object.entries(SOURCES)
      .filter(([path]) => !path.endsWith('.test.tsx'))
      .filter(([, source]) => source.includes(SHELL))
      .map(([path]) => path)

    expect(writers).toEqual(['./SettingLine.tsx'])
  })
})
