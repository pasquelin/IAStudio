import type { CommandId } from '@shared/domain/command'
import type { MotionId } from '@shared/domain/shortcut'
import { fireEvent, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { publishCommand } from '@/services/commandBus'
import { ShortcutsFixture } from './shortcuts-fixtures'
import { useShortcuts } from './useShortcuts'

const mount = (
  onCommand: (command: CommandId) => void,
  enabled = true,
  onMotionChange?: (held: Set<MotionId>) => void,
  documentId?: string,
  isFlying?: () => boolean,
) =>
  renderHook(
    () =>
      useShortcuts({ scope: 'scene', enabled, documentId, onCommand, onMotionChange, isFlying }),
    { wrapper: ShortcutsFixture },
  )

describe('useShortcuts', () => {
  it('fires the command bound to the pressed physical key', async () => {
    const onCommand = vi.fn()
    mount(onCommand)
    await userEvent.keyboard('{g}')
    expect(onCommand).toHaveBeenCalledWith('scene.translate')
  })

  it('fires once for a key held down, not once per auto-repeat', () => {
    const onCommand = vi.fn()
    mount(onCommand)

    fireEvent.keyDown(window, { code: 'KeyG' })
    fireEvent.keyDown(window, { code: 'KeyG', repeat: true })
    fireEvent.keyDown(window, { code: 'KeyG', repeat: true })

    expect(onCommand).toHaveBeenCalledTimes(1)
  })

  it('ignores a key typed into a text field', async () => {
    const onCommand = vi.fn()
    mount(onCommand)
    await userEvent.click(screen.getByLabelText('prompt'))
    await userEvent.keyboard('{g}')
    expect(onCommand).not.toHaveBeenCalled()
  })

  // A dropdown types too, and the shared guard is the only thing that knows it — a copy local to
  // this hook forgot it once already. Dispatched from the element rather than through focus, so
  // what this pins is the guard and not what jsdom does with focus on a `<select>`.
  it('ignores a key sent from a dropdown', () => {
    const onCommand = vi.fn()
    mount(onCommand)
    // Attached, because an orphan element's events never reach the `window` listener under test —
    // and removed after, because Testing Library's cleanup only owns what `render` created.
    const dropdown = document.body.appendChild(document.createElement('select'))
    onTestFinished(() => dropdown.remove())

    fireEvent.keyDown(dropdown, { code: 'KeyG' })

    expect(onCommand).not.toHaveBeenCalled()
  })

  // The platform copies a live selection from anywhere: taking ⌘C would leave the user no way
  // to copy the text they just highlighted.
  it('leaves ⌘C to the text the user has highlighted', () => {
    const onCommand = vi.fn()
    mount(onCommand)

    const selection = window.getSelection()
    selection?.selectAllChildren(screen.getByLabelText('prompt').parentElement as HTMLElement)
    fireEvent.keyDown(window, { code: 'KeyC', metaKey: true })

    expect(onCommand).not.toHaveBeenCalled()

    selection?.removeAllRanges()
    fireEvent.keyDown(window, { code: 'KeyC', metaKey: true })
    expect(onCommand).toHaveBeenCalledWith('scene.copy')
  })

  /**
   * Why the rule is per command and not "⌘ wins from a field": ⌘E merges a layer down, and a
   * layer is renamed in an `<input>` while its document stays the active tab. Firing it there
   * would flatten the layer mid-rename, and the ⌘Z reflex undoes the typing, not the merge.
   */
  it.each(['KeyG', 'KeyD', 'KeyZ', 'KeyV', 'KeyC'])(
    'leaves ⌘%s alone when the command has not declared it',
    code => {
      const onCommand = vi.fn()
      mount(onCommand)

      fireEvent.keyDown(screen.getByLabelText('prompt'), { code, metaKey: true })

      expect(onCommand).not.toHaveBeenCalled()
    },
  )

  // The motion branch now sits behind its own typing check rather than behind an early return:
  // flying while writing in a field would be the regression that restructuring could cause.
  it('registers no motion for a key typed into a field', () => {
    const onMotionChange = vi.fn()
    const { result } = mount(vi.fn(), true, onMotionChange, undefined, () => true)

    fireEvent.keyDown(screen.getByLabelText('prompt'), { code: 'KeyW' })

    expect([...result.current.heldMotion.current]).toEqual([])
    expect(onMotionChange).not.toHaveBeenCalled()
  })

  /**
   * The native menu fires a command, never a key — and on macOS the menu is what hears an
   * accelerator it declared, so the window never sees it. Both doors lead to the surface, or a
   * menu row does nothing: eleven of them did.
   */
  it('runs a command the menu published for its own scope', () => {
    const onCommand = vi.fn()
    mount(onCommand)

    publishCommand('scene.frame')

    expect(onCommand).toHaveBeenCalledWith('scene.frame')
  })

  // Two surfaces are mounted at once — a scene tab and an image tab — and the same command must
  // not run on both. The scope is what tells them apart.
  it('leaves alone a command belonging to another surface', () => {
    const onCommand = vi.fn()
    mount(onCommand)

    publishCommand('canvas.flatten')

    expect(onCommand).not.toHaveBeenCalled()
  })

  // A hidden tab stays mounted: it must not run what the tab in front was handed.
  it('ignores a published command while disabled', () => {
    const onCommand = vi.fn()
    mount(onCommand, false)

    publishCommand('scene.frame')

    expect(onCommand).not.toHaveBeenCalled()
  })

  /**
   * The one thing a key must never do, and the whole reason a sender may name a document: a
   * panel pinned to a background tab edits the document it SHOWS.
   */
  it('runs a command addressed to its document, hidden tab or not', () => {
    const onCommand = vi.fn()
    mount(onCommand, false, undefined, 'doc-1')

    publishCommand('scene.frame', 'doc-1')

    expect(onCommand).toHaveBeenCalledWith('scene.frame')
  })

  it('leaves alone a command addressed to another document, visible or not', () => {
    const onCommand = vi.fn()
    mount(onCommand, true, undefined, 'doc-1')

    publishCommand('scene.frame', 'doc-2')

    expect(onCommand).not.toHaveBeenCalled()
  })

  // Every surface holding no document at all — the explorer, a monitor. Addressed to a document,
  // the command is not theirs, and the tab in front is not a fallback.
  it('leaves alone an addressed command when it shows no document', () => {
    const onCommand = vi.fn()
    mount(onCommand)

    publishCommand('scene.frame', 'doc-1')

    expect(onCommand).not.toHaveBeenCalled()
  })

  it('stays silent when disabled', async () => {
    const onCommand = vi.fn()
    mount(onCommand, false)
    await userEvent.keyboard('{g}')
    expect(onCommand).not.toHaveBeenCalled()
  })

  it('tracks a held motion key and releases it', async () => {
    // One `setup()` instance, because a key held down is state: the direct `userEvent.keyboard`
    // starts from a blank keyboard every call and would silently skip the release.
    const user = userEvent.setup()
    const { result } = mount(vi.fn(), true, undefined, undefined, () => true)

    await user.keyboard('{w>}')
    expect([...result.current.heldMotion.current]).toEqual(['forward'])

    await user.keyboard('{/w}')
    expect([...result.current.heldMotion.current]).toEqual([])
  })

  it('holds the same direction from an arrow as from its letter', async () => {
    const user = userEvent.setup()
    const { result } = mount(vi.fn(), true, undefined, undefined, () => true)

    await user.keyboard('{ArrowUp>}')
    expect([...result.current.heldMotion.current]).toEqual(['forward'])

    await user.keyboard('{/ArrowUp}')
    expect([...result.current.heldMotion.current]).toEqual([])
  })

  // The boost key IS Shift, so its own keydown already carries `shiftKey` — read through
  // `signatureOf` it signed as `Shift+ShiftLeft` and matched nothing, leaving the boost setting
  // inert and every direction pressed under it dead.
  it('holds boost, and the direction pressed while it is held', async () => {
    const user = userEvent.setup()
    const { result } = mount(vi.fn(), true, undefined, undefined, () => true)

    await user.keyboard('{Shift>}')
    expect([...result.current.heldMotion.current]).toEqual(['boost'])

    await user.keyboard('{ArrowUp>}')
    expect([...result.current.heldMotion.current]).toEqual(['boost', 'forward'])
  })

  // A list is walked with the arrows, so this is the ordinary way to hold one: the flight must
  // not inherit a direction the user pressed to move through the outliner.
  it('takes no direction from a key held before the flight began', () => {
    const onMotionChange = vi.fn()
    let flying = false
    const { result } = mount(vi.fn(), true, onMotionChange, undefined, () => flying)

    fireEvent.keyDown(document.body, { code: 'ArrowDown' })
    expect([...result.current.heldMotion.current]).toEqual([])

    flying = true
    expect(onMotionChange).not.toHaveBeenCalled()
  })

  it('keeps a direction key from reaching anything downstream while flying', () => {
    const downstream = vi.fn()
    document.addEventListener('keydown', downstream)
    onTestFinished(() => document.removeEventListener('keydown', downstream))
    mount(vi.fn(), true, undefined, undefined, () => true)

    fireEvent.keyDown(document.body, { code: 'ArrowDown' })

    // An arrow the outliner still focused would answer scrolls the list out from under the
    // flight; the flight is what owns the key while the button is down.
    expect(downstream).not.toHaveBeenCalled()
  })

  // `KeyS` is both "back" and the scale gizmo, and nothing but the button down tells them apart.
  it('answers a shared key as a direction while flying, not as its command', () => {
    const onCommand = vi.fn()
    mount(onCommand, true, undefined, undefined, () => true)

    fireEvent.keyDown(document.body, { code: 'KeyS' })

    expect(onCommand).not.toHaveBeenCalled()
  })

  it('answers that same key as its command when no flight is under way', () => {
    const onCommand = vi.fn()
    mount(onCommand, true, undefined, undefined, () => false)

    fireEvent.keyDown(document.body, { code: 'KeyS' })

    expect(onCommand).toHaveBeenCalledWith('scene.scale')
  })

  /**
   * `DocumentNameDialog` shields the surfaces behind it with `stopPropagation` on a React
   * handler, which runs from the root container — ahead of `window` in bubble, behind it in
   * capture. Moving the command lookup to capture let `Delete` reach `scene.delete` from a
   * button inside an open dialog, where `isTyping` is false.
   */
  it('lets a surface shield what is behind it from a command key', () => {
    const onCommand = vi.fn()
    mount(onCommand, true)
    const shield = document.body.appendChild(document.createElement('div'))
    const inside = shield.appendChild(document.createElement('button'))
    shield.addEventListener('keydown', event => event.stopPropagation())
    onTestFinished(() => shield.remove())

    fireEvent.keyDown(inside, { code: 'Delete' })

    expect(onCommand).not.toHaveBeenCalled()
  })

  it('leaves a direction key to the rest of the window when no flight is under way', () => {
    const downstream = vi.fn()
    document.addEventListener('keydown', downstream)
    onTestFinished(() => document.removeEventListener('keydown', downstream))
    mount(vi.fn(), true, undefined, undefined, () => false)

    fireEvent.keyDown(document.body, { code: 'ArrowDown' })

    expect(downstream).toHaveBeenCalled()
  })

  it('drops every held key when the window loses focus', async () => {
    const user = userEvent.setup()
    const { result } = mount(vi.fn())

    await user.keyboard('{w>}')
    window.dispatchEvent(new Event('blur'))
    expect([...result.current.heldMotion.current]).toEqual([])
  })

  it('reports the held set when it changes, so nobody has to poll it every frame', async () => {
    const user = userEvent.setup()
    const onMotionChange = vi.fn()
    mount(vi.fn(), true, onMotionChange, undefined, () => true)

    await user.keyboard('{w>}')
    expect(onMotionChange).toHaveBeenCalledTimes(1)
    expect([...(onMotionChange.mock.lastCall?.[0] ?? [])]).toEqual(['forward'])

    await user.keyboard('{/w}')
    expect(onMotionChange).toHaveBeenCalledTimes(2)
    expect([...(onMotionChange.mock.lastCall?.[0] ?? [])]).toEqual([])
  })

  it('stays quiet while a held key repeats', async () => {
    const user = userEvent.setup()
    const onMotionChange = vi.fn()
    mount(vi.fn(), true, onMotionChange, undefined, () => true)

    await user.keyboard('{w>}')
    // Dispatched by hand: holding a key makes the platform repeat keydown without any keyup,
    // which `userEvent` will not reproduce — it releases between calls. The set never changes,
    // so neither should the reports.
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))
    expect(onMotionChange).toHaveBeenCalledTimes(1)
  })

  it('reports the release when the window loses focus', async () => {
    const user = userEvent.setup()
    const onMotionChange = vi.fn()
    mount(vi.fn(), true, onMotionChange, undefined, () => true)

    await user.keyboard('{w>}')
    onMotionChange.mockClear()
    window.dispatchEvent(new Event('blur'))
    expect(onMotionChange).toHaveBeenCalledTimes(1)
    expect([...(onMotionChange.mock.lastCall?.[0] ?? [])]).toEqual([])
  })

  // A held command is heard by the window, so a surface must not also fire it as a tap — the
  // press would run the command and the hold at once.
  it('leaves a held command to the hook that holds it', () => {
    const onCommand = vi.fn()
    mount(onCommand)

    fireEvent.keyDown(window, { code: 'KeyD', altKey: true })

    expect(onCommand).not.toHaveBeenCalled()
  })
})
