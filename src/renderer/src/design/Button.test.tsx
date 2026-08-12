import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './Button'

describe('Button', () => {
  // Inside a form, a button without an explicit type submits it — rarely what the caller meant.
  it('does not submit unless it is asked to', () => {
    render(<Button>Generate</Button>)

    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })

  it('submits when it is', () => {
    render(<Button type="submit">Generate</Button>)

    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit')
  })

  it('calls back when clicked', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Generate</Button>)

    await userEvent.click(screen.getByRole('button'))

    expect(onClick).toHaveBeenCalledOnce()
  })

  /**
   * The hover of the primary variant, held here because nothing else can: `tokens.test.ts` refuses
   * an ALPHA of the accent and measures the token, but a hover simply deleted would redden
   * neither. The pair is what the batch of 2026-08-12 bought — an alpha let the surface through
   * and lightened the button on the light theme, at 3.52:1 for its own label.
   */
  it('hovers the primary variant on a token rather than through the fill', () => {
    render(<Button variant="primary">Generate</Button>)

    expect(screen.getByRole('button')).toHaveClass('hover:bg-accent-hover')
  })

  it('stays silent while disabled', async () => {
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Generate
      </Button>,
    )

    await userEvent.click(screen.getByRole('button'))

    expect(onClick).not.toHaveBeenCalled()
  })
})
