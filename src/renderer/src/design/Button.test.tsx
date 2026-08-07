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
