import { beforeEach, describe, expect, it, vi } from 'vitest'
import { COMMAND_REGISTRY, type CommandId } from '@shared/domain/command'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { registerChatPanel } from '@/assistant/chatPanel'
import { installFakeBridge } from '@/services/fakeBridge'
import { armCommandScope, subscribeToCommands } from '@/services/commandBus'
import { useDictation } from '@/stores/dictation'
import { useDocuments } from '@/stores/documents'
import { useLayouts } from '@/stores/layouts'
import { useProject } from '@/stores/project'
import { useSettings } from '@/stores/settings'
import { routeCommand } from './commandRouter'

const saveDocument = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))
const saveDocumentAs = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))
const importOtioz = vi.hoisted(() => vi.fn())

vi.mock('@/app/documentIo', () => ({ saveDocument, saveDocumentAs }))
vi.mock('@/app/otioImport', () => ({ importOtioz }))

const createPicked = vi.fn()
const openPicked = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  installFakeBridge()
  useProject.setState({ createPicked, openPicked })
  useSettings.setState({ settings: DEFAULT_SETTINGS })
  useLayouts.setState({ activeWorkspace: 'image', home: false })
  useDocuments.setState({ activeId: null })
})

/** What the bus heard while one command was routed. */
function published(command: CommandId): { verdict: string; heard: CommandId[] } {
  const heard: CommandId[] = []
  const stop = subscribeToCommands(id => heard.push(id))
  const verdict = routeCommand(command)
  stop()
  return { verdict, heard }
}

describe('a command that belongs to a surface', () => {
  it('reaches the bus once something is mounted for its scope', () => {
    const disarm = armCommandScope('explorer')

    expect(published('explorer.undo')).toEqual({ verdict: 'ran', heard: ['explorer.undo'] })
    disarm()
  })

  /**
   * The scope decides, and nothing else. `explorer` and `spaces` used to be compared against the
   * workspace in front, which can never carry either: ten commands the tool schema offers were
   * refused whatever the studio was showing, and no test said so.
   */
  it('is refused, not dropped, while nothing is mounted for its scope', () => {
    expect(published('explorer.undo')).toEqual({ verdict: 'noSurface', heard: [] })
  })

  it('does not reach a scope that is not its own', () => {
    const disarm = armCommandScope('canvas')

    expect(published('scene.frame')).toEqual({ verdict: 'noSurface', heard: [] })
    disarm()
  })
})

describe('a command the application performs itself', () => {
  it('opens the settings window', () => {
    expect(routeCommand('app.settings')).toBe('ran')
  })

  it('toggles full screen', () => {
    expect(routeCommand('window.fullScreen')).toBe('ran')
  })

  it('picks a folder for a new project', () => {
    expect(routeCommand('project.new')).toBe('ran')
    expect(createPicked).toHaveBeenCalled()
  })

  it('imports a montage, which has no document to belong to', () => {
    expect(routeCommand('montage.import')).toBe('ran')
    expect(importOtioz).toHaveBeenCalled()
  })

  it('saves the tab in front, and refuses when there is none', () => {
    expect(routeCommand('document.save')).toBe('noSurface')
    expect(saveDocument).not.toHaveBeenCalled()

    useDocuments.setState({ activeId: 'doc-1' })

    expect(routeCommand('document.save')).toBe('ran')
    expect(saveDocument).toHaveBeenCalledWith('doc-1')
  })
})

describe('the assistant’s own window', () => {
  it('is toggled while it is mounted', () => {
    const toggle = vi.fn()
    const drop = registerChatPanel({ toggle })

    expect(routeCommand('app.assistant')).toBe('ran')
    expect(toggle).toHaveBeenCalled()
    drop()
  })

  // A settings window and a mirror have no overlay: saying so beats reporting a window that
  // never opened.
  it('is refused in a window that shows none', () => {
    expect(routeCommand('app.assistant')).toBe('noSurface')
  })
})

describe('dictation, which the keyboard holds down', () => {
  it('starts when nothing is listening and stops when something is', () => {
    const setHeld = vi.fn(() => Promise.resolve())
    useDictation.setState({ state: 'ready', setHeld })

    expect(routeCommand('app.dictate')).toBe('ran')
    expect(setHeld).toHaveBeenCalledWith(true)

    useDictation.setState({ state: 'listening' })
    routeCommand('app.dictate')

    expect(setHeld).toHaveBeenLastCalledWith(false)
  })
})

describe('moving a space along the bar', () => {
  it('moves the one in front, and writes the new order', () => {
    const write = vi.fn(() => Promise.resolve(DEFAULT_SETTINGS))
    installFakeBridge({ settings: { write } })
    useLayouts.setState({ activeWorkspace: 'video' })

    expect(routeCommand('spaces.moveLeft')).toBe('ran')
    expect(write).toHaveBeenCalledWith({
      workspaces: { order: ['video', 'image', '3d', 'audio', 'textures', 'skyboxes'] },
    })
  })

  it('refuses rather than pretending, at the end of the bar', () => {
    useLayouts.setState({ activeWorkspace: 'image' })

    expect(routeCommand('spaces.moveLeft')).toBe('noSurface')
  })
})

/**
 * The point of the whole module, and the one thing no other case would catch: the schema of
 * `command.run` offers every id the registry declares, so an id nothing routes is a promise the
 * studio cannot keep. Fourteen of the hundred and twenty were in that state.
 */
describe('the registry as a whole', () => {
  it('leaves no command that could not run whatever the studio is showing', () => {
    const scopes = new Set(COMMAND_REGISTRY.map(descriptor => descriptor.scope))
    const disarms = [...scopes].map(scope => armCommandScope(scope))
    useDocuments.setState({ activeId: 'doc-1' })
    const drop = registerChatPanel({ toggle: () => {} })
    // The space at the end of the bar cannot move that way, which is a fact of the order rather
    // than of the routing — asked from the other end, both moves answer.
    useLayouts.setState({ activeWorkspace: 'video' })

    const stranded = COMMAND_REGISTRY.map(descriptor => descriptor.id).filter(
      id => routeCommand(id) !== 'ran',
    )

    expect(stranded).toEqual([])
    drop()
    for (const disarm of disarms) disarm()
  })
})
