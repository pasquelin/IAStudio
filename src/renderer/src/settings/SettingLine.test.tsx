import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SettingLine } from './SettingLine'

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
})
