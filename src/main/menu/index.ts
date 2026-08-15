import { app, BrowserWindow, Menu } from 'electron'
import { WORKSPACE_IDS } from '@shared/domain/workspace'
import { HOME_SURFACE, placementOf, type ToolId, type ToolSurface } from '@shared/domain/tool'
import type { BindingOverrides, MenuCheck } from '@shared/domain/command'
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
import { menuTemplate } from './template'

/**
 * Which surface each window is showing. Per window and not per app: the menu is a single
 * application-wide object, so a second window in another space would otherwise decide what the
 * first one is offered. A window that announces nothing — the splash, the settings window —
 * has no entry, and the menu drops what only a workspace can do.
 */
const workspaces = new Map<number, ToolSurface>()

/** The panels each window reported it can open. Same per-window reasoning as `workspaces`. */
const availableTools = new Map<number, readonly ToolId[]>()

/** The rows each window reported as ticked. Same per-window reasoning again. */
const checkedRows = new Map<number, readonly MenuCheck[]>()

/** What the menu currently shows, so a focus change that alters nothing rebuilds nothing. */
let shown: ToolSurface | null = null
let shownTools: readonly ToolId[] = []
let shownChecks: readonly MenuCheck[] = []
/**
 * Remembered between builds: the menu is rebuilt whenever the focus moves between workspaces,
 * and that rebuild must not drop the user's remaps. The language is NOT remembered here — it is
 * read from `windowLanguage()`, so this menu and the native dialogs cannot answer differently.
 */
let overrides: BindingOverrides = {}

function focusedWorkspace(): ToolSurface | null {
  const target = frontWindow()
  return target ? (workspaces.get(target.webContents.id) ?? null) : null
}

function focusedTools(): readonly ToolId[] {
  const target = frontWindow()
  return (target && availableTools.get(target.webContents.id)) || []
}

function focusedChecks(): readonly MenuCheck[] {
  const target = frontWindow()
  return (target && checkedRows.get(target.webContents.id)) || []
}

/**
 * Native application menu. Together with the icon rails, it is one of the two ways back for a
 * tool removed with its close button — a panel closed with no way to reopen it would be lost.
 */
export function buildMenu(remapped: BindingOverrides = overrides): void {
  overrides = remapped
  shown = focusedWorkspace()
  shownTools = focusedTools()
  shownChecks = focusedChecks()

  const template = menuTemplate({
    language: windowLanguage(),
    workspace: shown,
    tools: shownTools,
    checked: shownChecks,
    isMac: process.platform === 'darwin',
    isDevelopment,
    overrides,
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
      exportTexture: command => sendToFront(EVENTS.textureExport, command),
      exportSkybox: command => sendToFront(EVENTS.skyboxExport, command),
    },
  })

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

/** Generic, so a call cannot quietly compare the tools of one window to the ticks of another. */
function sameList<T extends string>(next: readonly T[], shownList: readonly T[]): boolean {
  return next.length === shownList.length && next.every((id, index) => id === shownList[index])
}

/**
 * Rebuilt only when something the menu draws has actually changed.
 *
 * The comparison matters more than it did: ticks are published on every write of five stores,
 * and a scene being flown writes one of them on every frame. Without it, `setApplicationMenu`
 * would run sixty times a second.
 */
function rebuildIfStale(): void {
  if (
    focusedWorkspace() !== shown ||
    !sameList(focusedTools(), shownTools) ||
    !sameList(focusedChecks(), shownChecks)
  ) {
    buildMenu()
  }
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

  handle(CHANNELS.windowWorkspace, (event, next, tools, checked) => {
    // Checked against the registry: this is the only main-process state a renderer sets, and a
    // preload from an older build could name a surface this one has dropped.
    if (next !== HOME_SURFACE && !WORKSPACE_IDS.includes(next)) return
    workspaces.set(event.sender.id, next)
    availableTools.set(
      event.sender.id,
      tools.filter(id => placementOf(id) !== null),
    )
    checkedRows.set(event.sender.id, checked)
    rebuildIfStale()
  })

  app.on('browser-window-focus', rebuildIfStale)

  app.on('browser-window-created', (_event, window) => {
    // Captured now: after `closed` the web contents are gone and their id with them.
    const id = window.webContents.id
    window.on('closed', () => {
      workspaces.delete(id)
      availableTools.delete(id)
      checkedRows.delete(id)
      rebuildIfStale()
    })
  })
}
