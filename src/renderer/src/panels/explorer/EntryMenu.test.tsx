import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NO_BREAK_SPACE } from '@shared/i18n/typography'
import { installFakeBridge } from '@/services/fake-bridge'
import { EntryMenu } from './EntryMenu'
import type { FolderNode } from './use-folder-tree'

const NODE: FolderNode = {
  id: 'documents/poster.scimg',
  path: 'documents/poster.scimg',
  name: 'poster.scimg',
  kind: 'file',
  parentId: 'documents',
}

const open = (): void => {
  installFakeBridge()
  render(
    <EntryMenu
      node={NODE}
      at={{ x: 10, y: 10 }}
      openInTab={false}
      onRename={vi.fn()}
      onClose={vi.fn()}
    />,
  )
}

describe('EntryMenu', () => {
  it('says what each row does to the file on disk, not to the row', () => {
    open()

    const said = (name: string): string | null =>
      screen.getByRole('menuitem', { name }).getAttribute('data-tooltip-content')

    expect(said('Révéler dans le dossier')).toBe(
      'Ouvre le dossier du système de fichiers, le fichier sélectionné',
    )
    expect(said('Renommer')).toBe('Change le nom du fichier sur le disque, pas seulement à l’écran')
    expect(said('Mettre à la corbeille')).toBe(
      `Envoie le fichier à la corbeille du système${NO_BREAK_SPACE}; rien n’est effacé tout de suite`,
    )
  })

  it('leaves the visible labels to answer for themselves', () => {
    open()

    // An `aria-label` over a visible label replaces it for a screen reader (WCAG 2.5.3).
    for (const row of screen.getAllByRole('menuitem')) {
      expect(row).not.toHaveAttribute('aria-label')
    }
  })
})
