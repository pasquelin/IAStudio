import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { dragTransfer } from '@/helpers/drag-fixtures'
import { useSettings } from '@/stores/settings'
import { TitleBar } from './TitleBar'

/** `classList`, never `className`: `FOCUS_RING` already carries a `focus-visible:ring-accent`. */
function pill(name: string): HTMLElement {
  return screen.getByRole('button', { name })
}

function labels(): string[] {
  return screen.getAllByRole('button').map(button => button.textContent ?? '')
}

/** One transfer for the whole gesture, as the platform hands it: the drop reads what the start wrote. */
function drag(from: string, onto: string): void {
  const dataTransfer = dragTransfer()
  fireEvent.dragStart(pill(from), { dataTransfer })
  fireEvent.dragOver(pill(onto), { dataTransfer })
  fireEvent.drop(pill(onto), { dataTransfer })
}

describe('TitleBar', () => {
  beforeEach(() => {
    useSettings.setState({ settings: structuredClone(DEFAULT_SETTINGS) })
  })

  it('draws the spaces in the order the settings carry', () => {
    useSettings.setState({
      settings: { ...DEFAULT_SETTINGS, workspaces: { order: ['audio', 'image'] } },
    })

    render(<TitleBar activeWorkspace="image" onWorkspace={vi.fn()} />)

    expect(labels()[0]).toBe('Audio')
  })

  it('switches workspace on a plain click, as it always did', () => {
    const onWorkspace = vi.fn()
    render(<TitleBar activeWorkspace="image" onWorkspace={onWorkspace} />)

    fireEvent.click(pill('Audio'))

    expect(onWorkspace).toHaveBeenCalledWith('audio')
  })

  it('writes the new order when a space is dropped on another', () => {
    const write = vi.fn(async () => undefined)
    useSettings.setState({ write })
    render(<TitleBar activeWorkspace="image" onWorkspace={vi.fn()} />)

    drag('Image', 'Audio')

    expect(write).toHaveBeenCalledWith({
      workspaces: { order: ['video', '3d', 'audio', 'image', 'textures', 'skyboxes', 'graph'] },
    })
  })

  it('writes nothing when a space is dropped on itself', () => {
    const write = vi.fn(async () => undefined)
    useSettings.setState({ write })
    render(<TitleBar activeWorkspace="image" onWorkspace={vi.fn()} />)

    drag('Image', 'Image')

    expect(write).not.toHaveBeenCalled()
  })

  /**
   * `preventDefault` on dragover is what tells the platform a drop is welcome. Answering yes to
   * a drag the bar cannot read is how it would swallow a file dropped from the desktop.
   */
  it('refuses a drag that carries no space of ours', () => {
    render(<TitleBar activeWorkspace="image" onWorkspace={vi.fn()} />)

    const accepted = !fireEvent.dragOver(pill('Audio'), { dataTransfer: dragTransfer() })

    expect(accepted).toBe(false)
  })

  // The dragged pill is not a place it can land: `drop` refuses it, so lighting it up would
  // promise a gesture that never happens.
  it('does not offer itself as a target while it is the one being dragged', () => {
    render(<TitleBar activeWorkspace="image" onWorkspace={vi.fn()} />)
    const dataTransfer = dragTransfer()
    fireEvent.dragStart(pill('Image'), { dataTransfer })

    fireEvent.dragOver(pill('Image'), { dataTransfer })

    expect(pill('Image').classList.contains('ring-accent')).toBe(false)
  })

  // `dragleave` fires on the way into the pill's own icon. Reading `relatedTarget` is what
  // separates leaving the pill from moving about inside it.
  it('keeps the target lit when the pointer crosses into its own icon', () => {
    render(<TitleBar activeWorkspace="image" onWorkspace={vi.fn()} />)
    const dataTransfer = dragTransfer()
    fireEvent.dragStart(pill('Image'), { dataTransfer })
    fireEvent.dragOver(pill('Audio'), { dataTransfer })

    const icon = pill('Audio').querySelector('svg')
    fireEvent.dragLeave(pill('Audio'), { relatedTarget: icon })

    expect(pill('Audio').classList.contains('ring-accent')).toBe(true)
  })

  it('drops the highlight when the pointer leaves without releasing', () => {
    render(<TitleBar activeWorkspace="image" onWorkspace={vi.fn()} />)
    const dataTransfer = dragTransfer()
    fireEvent.dragStart(pill('Image'), { dataTransfer })
    fireEvent.dragOver(pill('Audio'), { dataTransfer })
    expect(pill('Audio').classList.contains('ring-accent')).toBe(true)

    fireEvent.dragLeave(pill('Audio'), { relatedTarget: document.body })

    expect(pill('Audio').classList.contains('ring-accent')).toBe(false)
  })

  /**
   * A drop needs a pointer that can hold a button down while it travels. These two gestures are
   * what the same reordering looks like to a keyboard (2.1.1) and to a pointer that cannot drag
   * (2.5.7) — and before them the bar had no other path at all, the setting being a dedicated one
   * the preferences screen does not draw.
   */
  it('moves the focused space with Alt and an arrow', () => {
    const write = vi.fn(async () => undefined)
    useSettings.setState({ write })
    render(<TitleBar activeWorkspace="image" onWorkspace={vi.fn()} />)

    fireEvent.keyDown(pill('Image'), { key: 'ArrowRight', code: 'ArrowRight', altKey: true })

    expect(write).toHaveBeenCalledWith({
      workspaces: { order: ['video', 'image', '3d', 'audio', 'textures', 'skyboxes', 'graph'] },
    })
  })

  // The bare arrows belong to whoever walks the bar; taking them would be taking a gesture.
  it('leaves a bare arrow alone', () => {
    const write = vi.fn(async () => undefined)
    useSettings.setState({ write })
    render(<TitleBar activeWorkspace="image" onWorkspace={vi.fn()} />)

    fireEvent.keyDown(pill('Image'), { key: 'ArrowRight', code: 'ArrowRight' })

    expect(write).not.toHaveBeenCalled()
  })

  /**
   * It was the studio's one keyboard gesture written outside the command registry: invisible to
   * the shortcuts screen, and beyond anything `shortcuts.overrides` could say.
   */
  it('follows a remap of the reordering command', () => {
    const write = vi.fn(async () => undefined)
    useSettings.setState({
      write,
      settings: {
        ...structuredClone(DEFAULT_SETTINGS),
        shortcuts: { overrides: { 'spaces.moveRight': 'Alt+KeyL' } },
      },
    })
    render(<TitleBar activeWorkspace="image" onWorkspace={vi.fn()} />)

    fireEvent.keyDown(pill('Image'), { key: 'l', code: 'KeyL', altKey: true })

    expect(write).toHaveBeenCalledWith({
      workspaces: { order: ['video', 'image', '3d', 'audio', 'textures', 'skyboxes', 'graph'] },
    })
  })

  it('drops the default once it has been remapped away', () => {
    const write = vi.fn(async () => undefined)
    useSettings.setState({
      write,
      settings: {
        ...structuredClone(DEFAULT_SETTINGS),
        shortcuts: { overrides: { 'spaces.moveRight': 'Alt+KeyL' } },
      },
    })
    render(<TitleBar activeWorkspace="image" onWorkspace={vi.fn()} />)

    fireEvent.keyDown(pill('Image'), { key: 'ArrowRight', code: 'ArrowRight', altKey: true })

    expect(write).not.toHaveBeenCalled()
  })

  // Announced as well as heard: a reader told about a chord the remap has moved is told wrong.
  it('announces the chord it currently answers to', () => {
    useSettings.setState({
      settings: {
        ...structuredClone(DEFAULT_SETTINGS),
        shortcuts: { overrides: { 'spaces.moveRight': 'Alt+KeyL' } },
      },
    })
    render(<TitleBar activeWorkspace="image" onWorkspace={vi.fn()} />)

    expect(pill('Image')).toHaveAttribute('aria-keyshortcuts', 'Alt+ArrowLeft Alt+KeyL')
  })

  it('writes nothing at the ends of the bar', () => {
    const write = vi.fn(async () => undefined)
    useSettings.setState({ write })
    render(<TitleBar activeWorkspace="image" onWorkspace={vi.fn()} />)

    fireEvent.keyDown(pill('Image'), { key: 'ArrowLeft', code: 'ArrowLeft', altKey: true })

    expect(write).not.toHaveBeenCalled()
  })

  it('offers the same move in a menu, for a pointer that cannot drag', async () => {
    const write = vi.fn(async () => undefined)
    useSettings.setState({ write })
    render(<TitleBar activeWorkspace="image" onWorkspace={vi.fn()} />)

    fireEvent.contextMenu(pill('Image'))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Déplacer à droite' }))

    expect(write).toHaveBeenCalledWith({
      workspaces: { order: ['video', 'image', '3d', 'audio', 'textures', 'skyboxes', 'graph'] },
    })
  })

  it('disables the move the end of the bar refuses', () => {
    render(<TitleBar activeWorkspace="image" onWorkspace={vi.fn()} />)

    fireEvent.contextMenu(pill('Image'))

    expect(screen.getByRole('menuitem', { name: 'Déplacer à gauche' })).toBeDisabled()
  })

  it('says what each move does rather than reading the row back', () => {
    render(<TitleBar activeWorkspace="image" onWorkspace={vi.fn()} />)

    fireEvent.contextMenu(pill('Image'))

    const left = screen.getByRole('menuitem', { name: 'Déplacer à gauche' })
    expect(left).toHaveAttribute(
      'data-tooltip-content',
      'Place cet espace avant son voisin de gauche dans la barre',
    )
    expect(left).not.toHaveAttribute('aria-label')
    expect(screen.getByRole('menuitem', { name: 'Déplacer à droite' })).toHaveAttribute(
      'data-tooltip-content',
      'Place cet espace après son voisin de droite dans la barre',
    )
  })

  // The order changes, the focus does not move, and the label does not change: without this the
  // gesture succeeds in silence for anyone reading the screen rather than looking at it.
  it('says where the space landed', () => {
    render(<TitleBar activeWorkspace="image" onWorkspace={vi.fn()} />)

    fireEvent.keyDown(pill('Image'), { key: 'ArrowRight', code: 'ArrowRight', altKey: true })

    expect(screen.getByRole('status')).toHaveTextContent('Image en position 2 sur 7')
  })

  /**
   * Said aloud and never seen, so the grammar has to hold on its own. The sentence used to end
   * on a past participle — « {{label}} déplacé » — which a screen reader pronounced as « Image
   * déplacé » and « Vidéo déplacé »: three of the seven space names are feminine, and English
   * hides the problem because « moved » never agrees. The wording carries no participle now.
   */
  it('says it without an agreement French would have to make', () => {
    render(<TitleBar activeWorkspace="video" onWorkspace={vi.fn()} />)

    fireEvent.keyDown(pill('Vidéo'), { key: 'ArrowRight', code: 'ArrowRight', altKey: true })

    expect(screen.getByRole('status')).toHaveTextContent('Vidéo en position 3 sur 7')
  })

  /**
   * The home covers the spaces rather than being one of them, and the bar says so by rendering
   * it before the loop. Letting it be dragged would ask what "first" means for a button that is
   * always first.
   */
  it('leaves the home out of the reordering, and only the home', () => {
    render(<TitleBar activeWorkspace="image" onWorkspace={vi.fn()} onHome={vi.fn()} home />)

    expect(pill('Accueil')).not.toHaveAttribute('draggable', 'true')
    expect(pill('Image')).toHaveAttribute('draggable', 'true')
  })

  it('does not let a space be dropped on the home', () => {
    const write = vi.fn(async () => undefined)
    useSettings.setState({ write })
    render(<TitleBar activeWorkspace="image" onWorkspace={vi.fn()} onHome={vi.fn()} home />)

    drag('Image', 'Accueil')

    expect(write).not.toHaveBeenCalled()
  })
})
