import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { IDockviewPanelHeaderProps } from 'dockview-react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DocumentTab } from './DocumentTab'

const closeDocument = vi.fn((_id: string) => Promise.resolve(true))
const deleteDocument = vi.fn((_id: string) => Promise.resolve(true))
const openPanelIds = vi.fn(() => ['doc-1', 'doc-2'])

vi.mock('./document-io', () => ({
  closeDocument: (id: string) => closeDocument(id),
  deleteDocument: (id: string) => deleteDocument(id),
}))

vi.mock('./dockview-api', () => ({ openPanelIds: () => openPanelIds() }))

// The real one needs a layout engine; what this file is about is the cross and the menu hung
// beside it. `hideClose` is asserted on rather than assumed — it is what stops Dockview's own
// button from removing a panel behind the studio's back.
let defaultTabProps: Record<string, unknown> = {}
vi.mock('dockview-react', () => ({
  DockviewDefaultTab: (props: Record<string, unknown>) => {
    defaultTabProps = props
    return (
      <span
        data-testid="default-tab"
        // The mock takes its props untyped, so the handler comes back as `unknown`.
        onContextMenu={props.onContextMenu as React.MouseEventHandler}
      >
        tab
      </span>
    )
  },
}))

/** Only what the tab reads: its own id, off the panel api. */
const props = (id: string): IDockviewPanelHeaderProps =>
  ({ api: { id } }) as unknown as IDockviewPanelHeaderProps

beforeEach(() => {
  vi.clearAllMocks()
  defaultTabProps = {}
})

describe('a document tab', () => {
  it('hides Dockview’s own close button, which cannot ask about unsaved work', () => {
    render(<DocumentTab {...props('doc-1')} />)
    expect(defaultTabProps.hideClose).toBe(true)
  })

  it('closes through the studio, so unsaved work is asked about', async () => {
    render(<DocumentTab {...props('doc-1')} />)

    await userEvent.click(screen.getByRole('button', { name: 'Fermer l’onglet' }))
    expect(closeDocument).toHaveBeenCalledWith('doc-1')
  })

  // Dockview reads a click anywhere on a tab as "activate me"; the cross is not that.
  it('does not let the close click reach the tab underneath', async () => {
    const activate = vi.fn()
    render(
      <div onClick={activate}>
        <DocumentTab {...props('doc-1')} />
      </div>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Fermer l’onglet' }))
    expect(closeDocument).toHaveBeenCalledWith('doc-1')
    expect(activate).not.toHaveBeenCalled()
  })

  it('opens its menu on a right-click', async () => {
    render(<DocumentTab {...props('doc-1')} />)
    expect(screen.queryByRole('menu')).toBeNull()

    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByTestId('default-tab') })
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('offers to delete the document, which nothing else in the studio does', async () => {
    render(<DocumentTab {...props('doc-1')} />)
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByTestId('default-tab') })

    await userEvent.click(screen.getByRole('menuitem', { name: /Supprimer le document/ }))
    expect(deleteDocument).toHaveBeenCalledWith('doc-1')
  })

  // A cancel means "no to closing", not "no to this one tab".
  it('stops closing the others as soon as one is cancelled', async () => {
    openPanelIds.mockReturnValue(['doc-1', 'doc-2', 'doc-3'])
    closeDocument.mockResolvedValue(false)
    render(<DocumentTab {...props('doc-1')} />)
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByTestId('default-tab') })

    await userEvent.click(screen.getByRole('menuitem', { name: 'Fermer les autres onglets' }))
    expect(closeDocument).toHaveBeenCalledTimes(1)
    expect(closeDocument).toHaveBeenCalledWith('doc-2')
  })

  it('never closes the tab the menu was opened on', async () => {
    openPanelIds.mockReturnValue(['doc-1', 'doc-2', 'doc-3'])
    closeDocument.mockResolvedValue(true)
    render(<DocumentTab {...props('doc-1')} />)
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByTestId('default-tab') })

    await userEvent.click(screen.getByRole('menuitem', { name: 'Fermer les autres onglets' }))
    expect(closeDocument.mock.calls.flat()).toEqual(['doc-2', 'doc-3'])
  })

  it('greys out closing the others when there are none', async () => {
    openPanelIds.mockReturnValue(['doc-1'])
    render(<DocumentTab {...props('doc-1')} />)
    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByTestId('default-tab') })

    expect(screen.getByRole('menuitem', { name: 'Fermer les autres onglets' })).toBeDisabled()
  })
})
