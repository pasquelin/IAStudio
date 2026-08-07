import { app, BrowserWindow, Menu } from 'electron'
import { WORKSPACE_IDS, type WorkspaceId } from '@shared/domain/workspace'
import type { BindingOverrides } from '@shared/domain/command'
import { DEFAULT_LANGUAGE, type Language } from '@shared/i18n'
import { CHANNELS, EVENTS } from '@shared/ipc'
import { handle } from '@main/ipc/handle'
import { toggleFullScreen } from '@main/window/controls'
import { openSettingsWindow } from '@main/window/windows'
import { menuTemplate } from './template'

/**
 * The native menu belongs to the focused window. Broadcasting would run ⌘N in every window at
 * once — the very "two windows holding the same document" trap listed in CLAUDE.md.
 *
 * On macOS the app outlives its last window, so the menu stays usable with nothing focused;
 * we fall back to the first live window rather than dropping the command in silence. The
 * splash is skipped by `isFocusable`: it has no bridge, so a command sent there is lost.
 */
function applicationWindows(): BrowserWindow[] {
  return BrowserWindow.getAllWindows().filter(window => window.isFocusable())
}

function focusedWindow(): BrowserWindow | null {
  const target = BrowserWindow.getFocusedWindow() ?? applicationWindows()[0]
  return target && !target.isDestroyed() ? target : null
}

function sendToFocused(channel: string, payload: unknown): void {
  focusedWindow()?.webContents.send(channel, payload)
}

/**
 * Which workspace each window is showing. Per window and not per app: the menu is a single
 * application-wide object, so a second window in another space would otherwise decide what the
 * first one is offered. A window that announces nothing — the splash, the settings window —
 * has no entry, and the menu drops what only a workspace can do.
 */
const workspaces = new Map<number, WorkspaceId>()

/** What the menu currently shows, so a focus change that alters nothing rebuilds nothing. */
let shown: WorkspaceId | null = null
let language: Language = DEFAULT_LANGUAGE
/**
 * Remembered between builds, like the language: the menu is rebuilt whenever the focus moves
 * between workspaces, and that rebuild must not drop the user's remaps.
 */
let overrides: BindingOverrides = {}

function focusedWorkspace(): WorkspaceId | null {
  const target = focusedWindow()
  return target ? (workspaces.get(target.webContents.id) ?? null) : null
}

/**
 * Native application menu. Together with the icon rails, it is one of the two ways back for a
 * tool removed with its close button — a panel closed with no way to reopen it would be lost.
 */
export function buildMenu(next: Language = language, remapped: BindingOverrides = overrides): void {
  language = next
  overrides = remapped
  shown = focusedWorkspace()

  const template = menuTemplate({
    language,
    workspace: shown,
    isMac: process.platform === 'darwin',
    isPackaged: app.isPackaged,
    overrides,
    actions: {
      openSettings: () => void openSettingsWindow(),
      toggleFullScreen: () => toggleFullScreen(BrowserWindow.getFocusedWindow()),
      openTool: request => sendToFocused(EVENTS.openTool, request),
      runCommand: command => sendToFocused(EVENTS.menuCommand, command),
      addNode: request => sendToFocused(EVENTS.sceneAdd, request),
    },
  })

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function rebuildIfStale(): void {
  if (focusedWorkspace() !== shown) buildMenu()
}

/**
 * The menu shows what the focused window can do, and only that window knows which workspace it
 * is in. It announces the restored one on startup and again on every click of the space rail.
 */
export function registerMenuHandlers(): void {
  handle(CHANNELS.windowWorkspace, (event, next) => {
    // Checked against the registry: this is the only main-process state a renderer sets, and a
    // preload from an older build could name a workspace this one has dropped.
    if (!WORKSPACE_IDS.includes(next)) return
    workspaces.set(event.sender.id, next)
    rebuildIfStale()
  })

  app.on('browser-window-focus', rebuildIfStale)

  app.on('browser-window-created', (_event, window) => {
    // Captured now: after `closed` the web contents are gone and their id with them.
    const id = window.webContents.id
    window.on('closed', () => {
      workspaces.delete(id)
      rebuildIfStale()
    })
  })
}
