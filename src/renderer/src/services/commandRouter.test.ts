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
  const stop = subscribeToCommands(id => heard.push(id) > 0)
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
  it('opens the settings window, and toggles full screen, through the main process', () => {
    const open = vi.fn(async () => {})
    const toggleFullScreen = vi.fn(async () => {})
    installFakeBridge({ settings: { open }, window: { toggleFullScreen } })

    expect(routeCommand('app.settings')).toBe('ran')
    expect(open).toHaveBeenCalledWith('general')

    expect(routeCommand('window.fullScreen')).toBe('ran')
    expect(toggleFullScreen).toHaveBeenCalled()
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

describe('the assistant', () => {
  it('takes the caret where the conversation already stands', () => {
    const focus = vi.fn()
    const drop = registerChatPanel({ focus })

    expect(routeCommand('app.assistant')).toBe('ran')
    expect(focus).toHaveBeenCalled()
    drop()
  })

  /**
   * 🛑 A settings window and a mirror hold neither host and no shell. Writing the docks store
   * there and answering "done" reported a gesture that could not have happened.
   */
  it('answers noSurface in a window that stages no conversation', () => {
    expect(routeCommand('app.assistant')).toBe('noSurface')
  })

  // A settings window and a mirror have no overlay: saying so beats reporting a window that
  // never opened.
  it('is refused in a window that shows none', () => {
    expect(routeCommand('app.assistant')).toBe('noSurface')
  })
})

describe('dictation, which the keyboard holds down', () => {
  /**
   * Started and stopped rather than HELD: outside push-to-talk `setHeld` acts on the press alone,
   * so the release asked for from here did nothing while the caller was told it ran.
   */
  it('starts when nothing is listening and stops when something is', () => {
    const start = vi.fn(() => Promise.resolve())
    const stop = vi.fn(() => Promise.resolve())
    useDictation.setState({ state: 'ready', start, stop })

    expect(routeCommand('app.dictate')).toBe('ran')
    expect(start).toHaveBeenCalled()

    useDictation.setState({ state: 'listening' })
    routeCommand('app.dictate')

    expect(stop).toHaveBeenCalled()
  })
})

describe('moving a space along the bar', () => {
  it('moves the one in front, and writes the new order', () => {
    const write = vi.fn(() => Promise.resolve(DEFAULT_SETTINGS))
    installFakeBridge({ settings: { write } })
    useLayouts.setState({ activeWorkspace: 'video' })

    expect(routeCommand('spaces.moveLeft')).toBe('ran')
    expect(write).toHaveBeenCalledWith({
      workspaces: { order: ['video', 'image', '3d', 'code', 'audio', 'materials', 'skyboxes'] },
    })
  })

  // Told apart from `noSurface`: the studio is showing exactly what the command names, and there
  // is simply nowhere left to move it.
  it('refuses rather than pretending, at the end of the bar', () => {
    useLayouts.setState({ activeWorkspace: 'image' })

    expect(routeCommand('spaces.moveLeft')).toBe('nothingToDo')
  })
})

/**
 * The point of the whole module, and the one thing no other case would catch: the schema of
 * `command.run` offers every id the registry declares, so an id nothing routes is a promise the
 * studio cannot keep. Fourteen of the hundred and twenty were in that state.
 */
describe('the registry as a whole', () => {
  /**
   * `global` and `spaces` have no surface to mount, so nothing ever arms them — `armCommandScope`
   * is called from `useShortcuts` alone, and every caller of that passes a document scope. The
   * bus can therefore never carry one, and `runHere` is the whole of their routing.
   *
   * Asked of the SCOPES rather than of the ids: a case is what makes a command runnable, and this
   * fails on the next `global` command added without one. Arming those two scopes to make the
   * sweep below pass would have hidden exactly that.
   */
  it('answers itself for every command no surface can take', () => {
    // `document.save` and `document.saveAs` want a tab, and the spaces one that can still move.
    useDocuments.setState({ activeId: 'doc-1' })
    useLayouts.setState({ activeWorkspace: 'video' })
    const drop = registerChatPanel({ focus: () => {} })

    const unrouted = COMMAND_REGISTRY.filter(
      descriptor => descriptor.scope === 'global' || descriptor.scope === 'spaces',
    ).filter(descriptor => routeCommand(descriptor.id) === 'noSurface')

    expect(unrouted.map(descriptor => descriptor.id)).toEqual([])
    drop()
  })

  it('leaves no command of a mounted surface that could not run', () => {
    const surfaceScopes = [
      ...new Set(
        COMMAND_REGISTRY.map(descriptor => descriptor.scope).filter(
          scope => scope !== 'global' && scope !== 'spaces',
        ),
      ),
    ]
    const disarms = surfaceScopes.map(scope => armCommandScope(scope))
    // A mounted surface both arms its scope AND listens: `ran` now says something ACTED, so a
    // scope armed with nobody behind it answers `nothingToDo` — which is not what this holds.
    const stopListening = subscribeToCommands(() => true)

    const stranded = COMMAND_REGISTRY.filter(descriptor =>
      surfaceScopes.some(scope => scope === descriptor.scope),
    ).filter(descriptor => routeCommand(descriptor.id) !== 'ran')

    stopListening()

    expect(stranded.map(descriptor => descriptor.id)).toEqual([])
    for (const disarm of disarms) disarm()
  })
})
