import { mkdir, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { APP_NAME } from '@shared/constants'

/**
 * The one door DaVinci Resolve leaves open, and it is not an API this side can call.
 *
 * Measured 2026-08-19 on Resolve 21.0.4.5 free: no outside process reaches the scripting API —
 * the free edition answers nothing on it — but a `.lua` dropped in the Utility folder appears
 * under Workspace ▸ Scripts WITHOUT a restart, and is re-read on every run. Removing one is NOT
 * seen live, which is why uninstalling says to restart.
 */

const SCRIPT_FILE = `${APP_NAME}.lua`

/**
 * Where Resolve looks, per user. `Fusion/Scripts/Utility` rather than `Comp` or `Tool`: those
 * two are offered only while a composition is open, and this one runs from the edit page.
 */
export function resolveScriptFolder(home = homedir()): string {
  return join(
    home,
    'Library',
    'Application Support',
    'Blackmagic Design',
    'DaVinci Resolve',
    'Fusion',
    'Scripts',
    'Utility',
  )
}

export const resolveScriptPath = (home = homedir()): string =>
  join(resolveScriptFolder(home), SCRIPT_FILE)

/**
 * The script itself. It imports a timeline the studio wrote into the project that is OPEN, which
 * is the whole of what this bridge does — Resolve owns the pool, the page and the undo stack.
 *
 * Lua rather than Python: Resolve ships its own Lua and needs nothing installed, where the Python
 * door wants an interpreter of a version the user has to match.
 */
export function resolveScriptText(): string {
  return `-- ${APP_NAME} bridge. Written by the application; edit at your own risk.
-- Workspace > Scripts > ${APP_NAME}

local resolve = Resolve()
if not resolve then
  print("This script has to run from inside DaVinci Resolve.")
  return
end

local manager = resolve:GetProjectManager()
local project = manager and manager:GetCurrentProject()
if not project then
  print("Open a project first: an import needs somewhere to land.")
  return
end

local media = resolve:GetMediaStorage()
local chosen = media and media:RevealInStorage("")

local ui = fu and fu.UIManager
local dispatcher = ui and bmd.UIDispatcher(ui)
if not dispatcher then
  print("No window manager: run this from Workspace > Scripts.")
  return
end

local window = dispatcher:AddWindow(
  { ID = "${APP_NAME}Import", WindowTitle = "${APP_NAME}", Geometry = { 200, 200, 520, 120 } },
  ui:VGroup{
    ID = "root",
    ui:Label{ Text = "Pick the edit ${APP_NAME} wrote (.otio, .edl, .fcpxml, .xml)." },
    ui:HGroup{
      ui:Button{ ID = "pick", Text = "Choose a file…" },
      ui:Button{ ID = "close", Text = "Close" },
    },
  }
)

local items = window:GetItems()

function window.On.close.Clicked(ev)
  dispatcher:ExitLoop()
end

function window.On.${APP_NAME}Import.Close(ev)
  dispatcher:ExitLoop()
end

function window.On.pick.Clicked(ev)
  local picked = fu:RequestFile("", "", {
    FReqB_SeqGather = false,
    FReqS_Title = "Import an edit",
    FReqS_Filter = "Edits (*.otio *.edl *.fcpxml *.xml)|*.otio;*.edl;*.fcpxml;*.xml",
  })
  if not picked then return end

  local timeline = project:ImportTimelineFromFile(picked)
  if timeline then
    print("Imported " .. timeline:GetName())
  else
    print("Resolve refused that file. Its media may be missing from the pool.")
  end
end

window:Show()
dispatcher:RunLoop()
window:Hide()
`
}

/**
 * Writes the script where Resolve reads it, and answers the path.
 *
 * The caller is expected to have ASKED: this drops a file into another application's folder on
 * somebody's machine, which is the one thing in this repository that leaves its own sandbox.
 */
export async function installResolveScript(home = homedir()): Promise<string> {
  await mkdir(resolveScriptFolder(home), { recursive: true })
  await writeFile(resolveScriptPath(home), resolveScriptText(), 'utf8')
  return resolveScriptPath(home)
}
