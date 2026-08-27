import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { IDockviewHeaderActionsProps } from 'dockview-react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { workspaceById } from '@/helpers/workspaces'
import { useDocuments } from '@/stores/documents'
import { DocumentOverflow } from './DocumentOverflow'

const ROOM = 100
const TAB = 40

const setActive = vi.fn()

/** A strip with room for two tabs, holding one per id: those in `cut` start past the edge. */
function headerProps(ids: string[], cut: string[]): IDockviewHeaderActionsProps {
  const strip = document.createElement('div')
  strip.getBoundingClientRect = () => new DOMRect(0, 0, ROOM, 0)
  Object.defineProperty(strip, 'clientWidth', { value: ROOM })
  // The scroll extent follows the children, as a real strip's does — the hook reads it before it
  // reads a single box, and a strip that never overflows never cuts anything.
  Object.defineProperty(strip, 'scrollWidth', { get: () => ROOM + cut.length * TAB })
  const panelOf = new Map<Element, { id: string }>()

  ids.forEach((id, index) => {
    const tab = document.createElement('div')
    const left = cut.includes(id) ? ROOM : index * TAB
    tab.getBoundingClientRect = () => new DOMRect(left, 0, TAB, 0)
    panelOf.set(tab, { id })
    strip.append(tab)
  })

  // `as`: the component reads four members of a Dockview group, and building the real one needs
  // a whole dock.
  return {
    group: {
      model: {
        tabsListElement: strip,
        getPanelForTab: (tab: Element) => panelOf.get(tab),
      },
    },
    panels: ids.map(id => ({ id, title: `Onglet ${id}`, api: { setActive: () => setActive(id) } })),
  } as unknown as IDockviewHeaderActionsProps
}

const openDocuments = (...titles: string[]): void => {
  useDocuments.setState({
    documents: Object.fromEntries(
      titles.map((title, index) => [
        `doc-${index + 1}`,
        {
          id: `doc-${index + 1}`,
          kind: 'scene',
          title,
          workspace: '3d',
          path: `documents/${title}.gltf`,
        },
      ]),
    ),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  useDocuments.setState({ documents: {}, activeId: null, recent: {} })
})

describe('the tab strip’s overflow menu', () => {
  it('stays away while the strip holds every tab', () => {
    openDocuments('Niveau', 'Décor')
    render(<DocumentOverflow {...headerProps(['doc-1', 'doc-2'], [])} />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('counts the tabs the strip has cut, in its name and beside its glyph', () => {
    openDocuments('Niveau', 'Décor', 'Ciel')
    render(<DocumentOverflow {...headerProps(['doc-1', 'doc-2', 'doc-3'], ['doc-2', 'doc-3'])} />)

    expect(screen.getByRole('button', { name: '2 onglets masqués' })).toHaveTextContent('2')
  })

  it('names the hidden documents, each under the glyph of its section', async () => {
    openDocuments('Niveau', 'Décor', 'Ciel')
    render(<DocumentOverflow {...headerProps(['doc-1', 'doc-2', 'doc-3'], ['doc-2', 'doc-3'])} />)

    await userEvent.click(screen.getByRole('button'))

    expect(screen.getAllByRole('menuitem').map(row => row.textContent)).toEqual(['Décor', 'Ciel'])
    expect(screen.getByRole('menuitem', { name: 'Décor' }).querySelector('path')).toHaveAttribute(
      'd',
      workspaceById('3d').icon,
    )
  })

  it('brings the chosen document to the front', async () => {
    openDocuments('Niveau', 'Décor', 'Ciel')
    render(<DocumentOverflow {...headerProps(['doc-1', 'doc-2', 'doc-3'], ['doc-2', 'doc-3'])} />)

    await userEvent.click(screen.getByRole('button'))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Ciel' }))

    expect(setActive).toHaveBeenCalledWith('doc-3')
  })

  // A single row is no menu — `useHoverFlyout` refuses to open one — so the click has to act.
  it('goes straight to the document when only one tab is hidden', async () => {
    openDocuments('Niveau', 'Décor')
    render(<DocumentOverflow {...headerProps(['doc-1', 'doc-2'], ['doc-2'])} />)

    await userEvent.click(screen.getByRole('button'))

    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()
    expect(setActive).toHaveBeenCalledWith('doc-2')
  })

  /**
   * A panel the restored layout outlived is precisely the one to reach and close, so it keeps its
   * place in the count and in the list — under the name the tab itself carries.
   */
  it('still lists a hidden tab whose document the window has not heard of', async () => {
    render(<DocumentOverflow {...headerProps(['doc-1', 'doc-2', 'doc-3'], ['doc-2', 'doc-3'])} />)

    await userEvent.click(screen.getByRole('button', { name: '2 onglets masqués' }))

    expect(screen.getAllByRole('menuitem').map(row => row.textContent)).toEqual([
      'Onglet doc-2',
      'Onglet doc-3',
    ])
  })
})
