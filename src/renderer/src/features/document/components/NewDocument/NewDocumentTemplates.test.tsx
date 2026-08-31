import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  SCENE_TEMPLATE_GROUPS,
  SCENE_TEMPLATE_IDS,
  TEMPLATES_BY_GROUP,
} from '@shared/domain/sceneTemplate'
import { NewDocumentTemplates } from './NewDocumentTemplates'

describe('NewDocumentTemplates', () => {
  it('offers every template the studio knows, on one row per group', () => {
    render(<NewDocumentTemplates value="basic" onChange={() => {}} />)

    expect(screen.getAllByRole('button')).toHaveLength(SCENE_TEMPLATE_IDS.length)
  })

  it('answers with the template that was pressed', async () => {
    const onChange = vi.fn()
    render(<NewDocumentTemplates value="basic" onChange={onChange} />)

    await userEvent.click(screen.getByRole('button', { name: 'Studio photo' }))

    expect(onChange).toHaveBeenCalledWith('photoStudio')
  })

  it('marks the chosen one and no other', () => {
    render(<NewDocumentTemplates value="archvis" onChange={() => {}} />)

    expect(screen.getByRole('button', { name: 'Architecture' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Vide' })).toHaveAttribute('aria-pressed', 'false')
  })

  // Tailwind reads its classes off the source, so the grid cannot be composed from the count —
  // and a ninth template added to a group would silently wrap onto a second row instead.
  it('gives each group as many columns as it holds templates', () => {
    render(<NewDocumentTemplates value="basic" onChange={() => {}} />)
    const lists = screen.getAllByRole('list')

    expect(lists).toHaveLength(SCENE_TEMPLATE_GROUPS.length)
    SCENE_TEMPLATE_GROUPS.forEach((group, at) => {
      expect(lists[at]?.className).toContain(`grid-cols-${TEMPLATES_BY_GROUP[group].length}`)
    })
  })
})
