import { app, BrowserWindow, Menu } from 'electron'
import { WORKSPACE_IDS } from '@shared/domain/workspace'
import { HOME_SURFACE, placementOf, type ToolId, type ToolSurface } from '@shared/domain/tool'
import {
  platformDefaults,
  type BindingOverrides,
  type MenuAbility,
  type MenuCheck,
} from '@shared/domain/command'
import { sameOrder } from '@shared/collections'
import { CHANNELS, EVENTS } from '@shared/ipc'
import { frontWindow, sendToFront } from '@main/ipc/broadcast'
import { handle } from '@main/ipc/handle'
import { isDevelopment } from '@main/environment'
import { followWindowLanguage, windowLanguage } from '@main/window/language'
import { toggleFullScreen } from '@main/window/controls'
import {
  openLicencesWindow,
  openManualWindow,
  openSettingsWindow,
  openUsageWindow,
} from '@main/window/windows'
import { isDocumentKind, type DocumentKind } from '@shared/domain/document'
import { menuTemplate } from './template'

/** Everything one window reported about itself, which is everything the menu draws from it. */
type WindowMenu = {
  surface: ToolSurface
  tools: readonly ToolId[]
  checked: readonly MenuCheck[]
  abilities: readonly MenuAbility[]
  kind: DocumentKind | null
}

/**
 * What each window reported. Per window and not per app: the menu is a single application-wide
 * object, so a second window in another space would otherwise decide what the first one is
 * offered. A window that announces nothing — the splash, the settings window — has no entry,
 * and the menu drops what only a workspace can do.
 *
 * One map for the four facts rather than one each: they arrive together, they are dropped
 * together, and a fifth fact must not mean a fifth map nobody remembers to clear.
 */
const reported = new Map<number, WindowMenu>()

/** What the menu currently shows, so a focus change that alters nothing rebuilds nothing. */
let shown: WindowMenu | null = null
/**
 * Remembered between builds: the menu is rebuilt whenever the focus moves between workspaces,
 * and that rebuild must not drop the user's remaps. The language is NOT remembered here — it is
 * read from `windowLanguage()`, so this menu and the native dialogs cannot answer differently.
 */
let overrides: BindingOverrides = {}

/** One reading of the front window, where four used to walk every window of the app in turn. */
function focusedMenu(): WindowMenu | null {
  const target = frontWindow()
  return (target && reported.get(target.webContents.id)) ?? null
}

/**
 * Native application menu. Together with the icon rails, it is one of the two ways back for a
 * tool removed with its close button — a panel closed with no way to reopen it would be lost.
 */
export function buildMenu(remapped: BindingOverrides = overrides): void {
  overrides = remapped
  shown = focusedMenu()

  const isMac = process.platform === 'darwin'
  const template = menuTemplate({
    language: windowLanguage(),
    workspace: shown?.surface ?? null,
    kind: shown?.kind ?? null,
    tools: shown?.tools ?? [],
    checked: shown?.checked ?? [],
    abilities: shown?.abilities ?? [],
    isMac,
    isDevelopment,
    // What this system ships under what the user remapped, exactly as the window reads them:
    // the menu would otherwise advertise ⌃⌘F on a machine whose full-screen key is F11.
    overrides: { ...platformDefaults(isMac), ...overrides },
    actions: {
      openSettings: () => void openSettingsWindow(),
      openLicences: () => void openLicencesWindow(),
      openManual: () => void openManualWindow(),
      openUsage: () => void openUsageWindow(),
      toggleFullScreen: () => toggleFullScreen(BrowserWindow.getFocusedWindow()),
      openTool: request => sendToFront(EVENTS.openTool, request),
      runCommand: command => sendToFront(EVENTS.menuCommand, command),
      addNode: request => sendToFront(EVENTS.sceneAdd, request),
      viewFrom: request => sendToFront(EVENTS.sceneView, request),
      setDisplay: request => sendToFront(EVENTS.sceneDisplay, request),
      exportScene: command => sendToFront(EVENTS.sceneExport, command),
      captureScene: command => sendToFront(EVENTS.sceneCapture, command),
      exportMaterial: command => sendToFront(EVENTS.materialExport, command),
      exportSkybox: command => sendToFront(EVENTS.skyboxExport, command),
    },
  })

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

/**
 * Rebuilt only when something the menu draws has actually changed.
 *
 * The comparison matters more than it did: ticks are published on every write of five stores,
 * and a scene being flown writes one of them on every frame. Without it, `setApplicationMenu`
 * would run sixty times a second.
 */
function rebuildIfStale(): void {
  if (!sameMenu(focusedMenu(), shown)) buildMenu()
}

function sameMenu(next: WindowMenu | null, drawn: WindowMenu | null): boolean {
  if (!next || !drawn) return next === drawn

  return (
    next.surface === drawn.surface &&
    sameOrder(next.tools, drawn.tools) &&
    sameOrder(next.checked, drawn.checked) &&
    sameOrder(next.abilities, drawn.abilities)
  )
}

/** Named rather than inline: the follower set dedupes by identity, so registering twice adds one. */
function rebuildInNewLanguage(): void {
  buildMenu()
}

/**
 * The menu shows what the focused window can do, and only that window knows which workspace it
 * is in. It announces the restored one on startup and again on every click of the space rail.
 */
export function registerMenuHandlers(): void {
  followWindowLanguage(rebuildInNewLanguage)

  handle(CHANNELS.windowWorkspace, (event, next, tools, checked, abilities, kind) => {
    // Checked against the registry: this is the only main-process state a renderer sets, and a
    // preload from an older build could name a surface this one has dropped.
    if (next !== HOME_SURFACE && !WORKSPACE_IDS.includes(next)) return
    // The three lists are defaulted for the same reason the surface is checked: an older preload
    // sends fewer arguments, and an `undefined` stored here throws in every later comparison —
    // freezing the menu on the next focus change rather than on this call.
    reported.set(event.sender.id, {
      surface: next,
      tools: (tools ?? []).filter(id => placementOf(id) !== null),
      checked: checked ?? [],
      abilities: abilities ?? [],
      // Same defaulting, same reason: an older preload sends nothing here.
      kind: kind && isDocumentKind(kind) ? kind : null,
    })
    rebuildIfStale()
  })

  app.on('browser-window-focus', rebuildIfStale)

  app.on('browser-window-created', (_event, window) => {
    // Captured now: after `closed` the web contents are gone and their id with them.
    const id = window.webContents.id
    window.on('closed', () => {
      reported.delete(id)
      rebuildIfStale()
    })
  })
}
