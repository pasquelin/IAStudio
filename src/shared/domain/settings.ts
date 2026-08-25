import type { LanguagePreference } from '../i18n/languages'
// From the model module rather than from the registry: `shellActions.ts` reads this file, and the
// registry reads it back — `import-cycles.test.ts` holds that count at zero.
import type { AiRoleId, RoleProvider } from './aiRole'
import { type AssistantModel, DEFAULT_ASSISTANT_MODEL } from './assistantModel'
import { ASSISTANT_STEPS_DEFAULT } from './assistantSteps'
import type { BindingOverrides } from './command'
import type { DictationMode } from './dictation'
import type { ApiFailure } from './failure'
import type { LocalModel } from './localModel'
import { DEFAULT_HOME_SECTIONS, type HomeSectionSetting } from './home'
import type { RecentProject } from './project'
import { WORKSPACE_IDS, type WorkspaceId } from './workspace'
import type { DisplayUnit, HelperVisibility, ShadowQuality, ViewportQuality } from './scene'

/**
 * Spelled exactly as Electron's `nativeTheme.themeSource`, which takes these three words: the
 * main process assigns the setting straight across, with no table in between to fall behind.
 */
export type Theme = 'dark' | 'light' | 'system'

/** What `system` resolves to. The attribute on the root element carries one of these two. */
export type ResolvedTheme = 'dark' | 'light'

export type Density = 'compact' | 'comfortable'
export type AssetBackend = 'local' | 'cloud'

/**
 * How much the log says, from nothing to everything. Ordered from quietest to loudest, which is
 * what lets a threshold be a simple comparison rather than a table.
 */
export type LogVerbosity = 'silent' | 'error' | 'warn' | 'info'

export const LOG_VERBOSITIES: readonly LogVerbosity[] = ['silent', 'error', 'warn', 'info']

/** What happens when the application opens with no file to show. */
export type StartupBehaviour = 'lastProject' | 'nothing'

export const STARTUP_BEHAVIOURS: readonly StartupBehaviour[] = ['lastProject', 'nothing']

/** The values beside the types: the registry's options and zod both enumerate them from here. */
export const THEMES: readonly Theme[] = ['dark', 'light', 'system']
export const DENSITIES: readonly Density[] = ['comfortable', 'compact']

/**
 * The daisyUI theme names, which are also what `data-theme` carries: daisyUI selects a theme by
 * matching that attribute against the name declared in `index.css`. Written once here so the
 * stylesheet, the renderer that publishes the attribute and the tests all read the same word.
 */
export const THEME_ATTRIBUTE: Record<ResolvedTheme, string> = {
  dark: 'iastudio-dark',
  light: 'iastudio-light',
}

/** What a finished generation does with a document that is already open. */
export type LandingChoice = 'ask' | 'document' | 'newTab'

export const LANDING_CHOICES: readonly LandingChoice[] = ['ask', 'document', 'newTab']

/**
 * Settings the renderer may read. API credentials NEVER appear here: the renderer asks
 * whether it is authenticated, not what the key is — see spec § 9.
 */
export type Settings = {
  general: {
    language: LanguagePreference
    startup: StartupBehaviour
    /**
     * Whether an open document is written back on its own while it is being worked on.
     *
     * A kind whose capture is too costly to run on a timer opts out whatever this says, and says
     * so itself — `autosaves` in the renderer's document registry.
     */
    autosave: boolean
  }
  /**
   * The home screen. `sections` carries the user's own order and what they chose to hide;
   * `domain/home.ts` owns what a section is, and which of them may never be hidden.
   */
  home: {
    enabled: boolean
    /**
     * Whether the news band reads the hub. The one outward call the studio makes for something
     * other than a model or a job, so it is a setting rather than a fact.
     */
    news: boolean
    sections: HomeSectionSetting[]
  }
  /**
   * The bar of spaces. `order` is the user's own, reconciled against what this build declares
   * by `workspaceOrder` — a stored order is a photograph of the spaces that existed the day it
   * was written, and the registry order is only what an untouched bar falls back to.
   */
  workspaces: {
    order: WorkspaceId[]
  }
  appearance: {
    theme: Theme
    density: Density
    /** Overrides `--color-accent`. The theme's own accent when left unset. */
    accent?: string
    /** Multiplies the interface's base size. 1 is what the design was drawn at. */
    fontScale: number
    reduceMotion: boolean
  }
  generation: {
    concurrentJobs: number
    maxRetries: number
    /**
     * Where a finished generation goes when a document of its kind is already open: into that
     * document, into a tab of its own, or the question. With nothing open there is nothing to
     * ask — it opens.
     */
    landing: LandingChoice
    /**
     * Whether an asset arriving without a useful name gets described on its own.
     *
     * The one place the studio spends creative units without being asked, which is why it is
     * the one that can be turned off.
     */
    captionArrivals: boolean
  }
  storage: {
    backend: AssetBackend
    projectsFolder?: string
    lastProject?: string
    /** Session state like `lastProject`, and replicated with it — see `domain/project.ts`. */
    recentProjects: RecentProject[]
    /**
     * Which account each project works under, by folder — see `planProjectAccount`.
     *
     * Its own branch rather than a field on `recentProjects`: that list is session state, bounded
     * to twelve and evicted by opening date, and `forget` empties an entry whenever an opening
     * FAILS. A project on a drive that was not plugged in would have come back on someone else's
     * key, in silence, which is the one thing this exists to prevent.
     *
     * Nothing prunes it, and `forget` deliberately leaves it alone for that same reason — pruning
     * on the path an opening failed on is exactly the defect above. It grows by one short line per
     * project ever opened, which is the cost of not losing a choice the user made.
     */
    projectAccounts: Record<string, string>
  }
  /**
   * Which provider serves each AI role — see `docs/ci/adr/ADR-21-…`.
   *
   * `roles` is the default that follows the person; `projectRoles` is what one project overrides,
   * BY FOLDER, exactly as `storage.projectAccounts` already does for the account. Kept out of
   * `.project.json`, which ADR-21 § D asked for and its amendment of 21/08 reversed: an account id
   * is minted locally, so half the scope could never travel anyway.
   *
   * Both are partial. An absent role is none: `providerFor` answers nothing until the person
   * picks, so an account on file never spends on its own.
   */
  ai: {
    roles: Partial<Record<AiRoleId, RoleProvider>>
    projectRoles: Record<string, Partial<Record<AiRoleId, RoleProvider>>>
    /**
     * The models the person supplied themselves — rank 3 of ADR-20, and the ONE place they live.
     *
     * A manifest apiece rather than a path apiece: what a GGUF header answers is read once, at the
     * moment they point at the file, and a header re-read on every compose would open every one of
     * their files on every assistant turn.
     */
    ownModels: LocalModel[]
  }
  /**
   * The 3D workspace. A branch of its own rather than nested under a `spaces` one: every branch
   * of `Settings` is one level deep, which is what lets the store merge a write by spreading —
   * a nested branch would be replaced wholesale by a write touching one of its leaves.
   */
  three: {
    showGrid: boolean
    /** Extent of the ground grid, in metres. */
    gridSize: number
    /** Metres per second while flying the viewport camera. */
    flySpeed: number
    /** What holding the boost key multiplies the fly speed by. */
    boostFactor: number
    /** Vertical field of view, in degrees. */
    fieldOfView: number
    /**
     * The steps snapping moves by, when it is on. Whether it is on is a session thing — the
     * toolbar toggles it per document — but how coarse it is belongs to the person, not to the
     * moment. Nothing here is applied while snapping is off.
     */
    snapTranslate: number
    /** In degrees, like the inspector: radians are stored, never typed. */
    snapRotate: number
    snapScale: number
    /**
     * How big the transform handles are drawn, as a share of what `TransformControls` calls 1.
     * Their size on SCREEN stays constant whatever the distance — that is the control's own
     * doing, and what every 3D application does — so this is how much of the screen they take.
     */
    gizmoSize: number
    /** Whether a surface snap turns what it lays down to match the slope it lands on. */
    snapSurfaceAlign: boolean
    /** Metres a surface snap leaves between what it lays down and what it landed on. */
    snapSurfaceOffset: number
    /** Whether shadow maps are drawn at all — a depth pass per casting light, and the way out of it. */
    shadows: boolean
    /** How soft a shadow edge is. Which objects throw one is a property of the node. */
    shadowQuality: ShadowQuality
    /** Side of the square map each casting light allocates. Doubling it costs four times as much. */
    shadowMapSize: number
    /** How finely the same frame is drawn. It moves `pixelRatio`, and never the assets. */
    quality: ViewportQuality
    /** How much of a family of working aids is drawn — see `HelperVisibility`. */
    lightHelpers: HelperVisibility
    cameraHelpers: HelperVisibility
    boundingBoxes: HelperVisibility
    /** Whether each object's own axes are drawn at its pivot. */
    origins: boolean
    normals: boolean
    /** How long a drawn normal is, in scene units. */
    normalLength: number
    /** Whether what the scene costs is read out over the viewport. */
    stats: boolean
    /** The unit lengths are WRITTEN in. One scene unit stays one metre whatever this says. */
    units: DisplayUnit
  }
  shortcuts: {
    /**
     * Only the commands the user actually remapped. A command added by a new version arrives
     * with its own default and needs no migration; a remap of one since removed is ignored.
     */
    overrides: BindingOverrides
  }
  advanced: {
    /** How much the log says. `silent` keeps the terminal clean; `debug` keeps everything. */
    logLevel: LogVerbosity
  }
  media: {
    /**
     * An ffmpeg binary to use instead of the one on the PATH. Absent is the normal case: the
     * bundled binary, then the PATH — see `resolveFfmpeg`. Without any of them, importing
     * still works and the interface says what it cannot do.
     */
    ffmpegPath?: string
  }
  /**
   * Version control over the PROJECT folder — never over the repository the studio is built from.
   */
  git: {
    /**
     * A git binary to use instead of the one on the PATH, on the model of `media.ffmpegPath`.
     * Absent is the normal case. simple-git REFUSES a path holding a space — which is where the
     * default Windows install puts it — and the studio then answers as it does for no git at all.
     */
    binary?: string
    /**
     * Who commits. Absent means "whatever `git config user.name` says", which is the right
     * answer for anyone who already uses git on this machine — and the wrong one to overwrite.
     */
    userName?: string
    userEmail?: string
  }
  /** Talking to the studio instead of driving it — see `domain/assistant.ts`. */
  assistant: {
    /**
     * Which language model works out what a sentence meant.
     *
     * A preference rather than a constant because the four differ by a factor of nearly four in
     * price — measured, see `AssistantModel` — and because a request the cheapest one fumbles is
     * usually answered by the next one up. Changed from the assistant's own panel rather than
     * from this screen: the moment one wants a better model is the moment one is mid-sentence,
     * and opening the preferences to get there loses the sentence.
     */
    model: AssistantModel
    /**
     * The model each cloud is talked to with, by cloud id. Free text: every cloud names its own,
     * and a list written here would be stale the week after. Absent means what the cloud declares.
     */
    cloudModels: Record<string, string>
    /**
     * 🛑 How many times ONE sentence may send the model back to work — the ceiling on a chain.
     *
     * A request like "open it, adjust it, put it in the scene" is several actions whose inputs
     * are only known once the one before has answered, so the assistant asks again with what it
     * learned. Each of those is a BILLED round trip, and a model that keeps re-running the same
     * action would spend without end: this is the one thing between a chain and a runaway.
     *
     * Reached, the assistant stops and says so rather than pretending it finished.
     */
    steps: number
  }
  /**
   * The same actions the assistant runs, offered to a client outside the application — see
   * `main/mcp/`.
   *
   * Off unless asked for, and that is the setting's whole reason to exist: it opens a port on
   * the machine. Nothing about it survives a launch either — the port is whichever was free and
   * the token is new — so turning it on is a decision taken again each time it matters.
   */
  mcp: {
    enabled: boolean
    /**
     * What an outside client may do WITHOUT the question on screen.
     *
     * Everything off and zero by default, which is the studio as it was before this existed: a
     * client that finds nothing armed is asked about, exactly as it always has been. Nothing else
     * in the studio may write this branch — see `settingsHandlers`, which refuses it: a delegation
     * a client could grant itself would be no delegation at all.
     *
     * By LEVEL rather than by action name, and deliberately: the level is the axis the question
     * already speaks in, and a hundred and forty-six checkboxes is not an interface.
     *
     * This one: moving, renaming, binning, and whatever rewrites the working copy.
     */
    delegateFiles: boolean
    /** Uploading a picture, which then stays in the library. */
    delegateAsset: boolean
    /** Publishing off this machine. Nothing here takes that back. */
    delegateRemote: boolean
    /**
     * Creative units this window may spend unasked before it starts asking again. Zero asks about
     * every spend, which is the default.
     *
     * A number rather than a switch, because money is bounded by an amount and not by a yes: a
     * spend the API declines to price is never delegated, whatever this holds — an unknown cost
     * is an unbounded one.
     */
    delegateBudget: number
  }
  /** Speaking a prompt instead of typing it. Everything runs on this machine — see `domain/dictation.ts`. */
  dictation: {
    enabled: boolean
    mode: DictationMode
    /** Silence that closes a segment, in milliseconds. Longer suits someone who pauses to think. */
    silenceMs: number
    /**
     * How often the segment in flight is decoded again to show a preview. The model is not a
     * streaming one, so a preview costs a full decode of what has been said so far; `0` turns
     * previews off and leaves only the text of each closed segment.
     */
    previewMs: number
    /** Inference threads. More is faster up to a point, and every one of them is a core taken. */
    threads: number
    /** Minutes of silence after which the engine is dropped, returning around 700 MB. `0` keeps it. */
    idleUnloadMinutes: number
    /** A model folder to read instead of the downloaded one. Absent is the normal case. */
    modelFolder?: string
    /**
     * The microphone to record from. Absent means the system default, which is what most people
     * want and what survives plugging a headset in and out.
     */
    inputDeviceId?: string
  }
}

/**
 * The defaults, and the only place they are written: `defaultAt` reads them through a path, so
 * the registry describes settings without restating what they start at. A fresh install is
 * exactly this.
 */
export const DEFAULT_SETTINGS: Settings = {
  general: { language: 'system', startup: 'lastProject', autosave: true },
  home: { enabled: true, news: true, sections: [...DEFAULT_HOME_SECTIONS] },
  workspaces: { order: [...WORKSPACE_IDS] },
  appearance: { theme: 'dark', density: 'comfortable', fontScale: 1, reduceMotion: false },
  generation: { concurrentJobs: 3, maxRetries: 4, captionArrivals: true, landing: 'ask' },
  // Empty on a fresh install, and that is the point: no choice made means the local side is
  // taken wherever it can serve, so the studio works before anyone has an account.
  ai: { roles: {}, projectRoles: {}, ownModels: [] },
  three: {
    showGrid: true,
    gridSize: 20,
    flySpeed: 4,
    boostFactor: 3,
    fieldOfView: 60,
    snapTranslate: 0.5,
    snapRotate: 15,
    snapScale: 0.1,
    gizmoSize: 0.5,
    snapSurfaceAlign: true,
    snapSurfaceOffset: 0,
    shadows: true,
    shadowQuality: 'soft',
    shadowMapSize: 2048,
    quality: 'balanced',
    // `selected` and not `all`: a directional light draws a line clear across the scene and a
    // frustum reaches its camera's far plane, so three lamps shown at once is a viewport nobody
    // can read. Anyone who wants them all says so.
    lightHelpers: 'selected',
    cameraHelpers: 'selected',
    boundingBoxes: 'off',
    origins: false,
    normals: false,
    normalLength: 0.2,
    stats: true,
    units: 'm',
  },
  storage: { backend: 'local', recentProjects: [], projectAccounts: {} },
  shortcuts: { overrides: {} },
  advanced: { logLevel: 'info' },
  media: {},
  git: {},
  assistant: { model: DEFAULT_ASSISTANT_MODEL, cloudModels: {}, steps: ASSISTANT_STEPS_DEFAULT },
  mcp: {
    enabled: false,
    delegateFiles: false,
    delegateAsset: false,
    delegateRemote: false,
    delegateBudget: 0,
  },
  dictation: {
    enabled: true,
    mode: 'pushToTalk',
    silenceMs: 600,
    previewMs: 700,
    threads: 2,
    idleUnloadMinutes: 10,
  },
}

/** Derived, so a section added to `Settings` is writable without being restated here. */
export type PartialSettings = { [K in keyof Settings]?: Partial<Settings[K]> }

/**
 * The branches, read off the defaults rather than listed: a section added to `Settings` shows
 * up here on its own, which is what `mergePartial` needs in order not to drop it.
 */
const BRANCHES: readonly (keyof Settings)[] = Object.keys(DEFAULT_SETTINGS).filter(
  (key): key is keyof Settings => key in DEFAULT_SETTINGS,
)

/**
 * Accumulates one write onto another, one branch deep — which is the whole depth of `Settings`.
 *
 * Not the same thing as the store's `merge`, which completes a partial onto a full `Settings`
 * and therefore has the compiler check that no branch is missing. This one accumulates two
 * partials, where an absent branch is normal: it is what an editing buffer is made of.
 */
export function mergePartial(base: PartialSettings, next: PartialSettings): PartialSettings {
  const merged: PartialSettings = { ...base }

  for (const branch of BRANCHES) {
    if (next[branch]) merged[branch] = { ...base[branch], ...next[branch] }
  }

  return merged
}

export type AuthState =
  | {
      authenticated: true
      /**
       * The project this key opens onto, once the library has named it — there is no endpoint
       * that would simply say, so it is learned from the first assets that come back.
       *
       * Absent means "not known yet", which every reader treats as "do not judge ownership"
       * rather than as a mismatch.
       */
      ownerId?: string
    }
  | { authenticated: false; reason: ApiFailure }

/**
 * Sections of the settings window, named so any surface can ask for one of them — a panel that
 * has just said the API key is missing is expected to lead to where it is typed.
 *
 * Sub-sections are part of the union rather than made up by the screen: an id the shared type
 * does not know is refused by the IPC, so `settings.open('generation.image')` would fail on a
 * name the navigation happily displayed.
 */
export type SettingsSectionId =
  | 'general'
  | 'account'
  | 'appearance'
  | 'generation'
  | 'ai'
  | 'ai.image'
  | 'ai.video'
  | 'ai.3d'
  | 'ai.audio'
  | 'ai.texture'
  | 'ai.skybox'
  | 'ai.upscale'
  | 'ai.background-removal'
  | 'ai.vectorization'
  | 'spaces'
  | 'spaces.three'
  | 'shortcuts'
  | 'dictation'
  | 'media'
  | 'git'
  | 'mcp'
  | 'storage'
  | 'advanced'

export const SETTINGS_SECTION_IDS: readonly SettingsSectionId[] = [
  'general',
  'account',
  'appearance',
  'generation',
  'ai',
  'ai.image',
  'ai.video',
  'ai.3d',
  'ai.audio',
  'ai.texture',
  'ai.skybox',
  'ai.upscale',
  'ai.background-removal',
  'ai.vectorization',
  'spaces',
  'spaces.three',
  'shortcuts',
  'dictation',
  'media',
  'git',
  'mcp',
  'storage',
  'advanced',
]

/**
 * The section travels to the settings window inside the URL fragment its renderer reads, so
 * what a renderer sends is checked against the list rather than trusted — see invariant 1.
 */
export function isSettingsSection(value: unknown): value is SettingsSectionId {
  return SETTINGS_SECTION_IDS.some(candidate => candidate === value)
}

/** URL fragment that tells the shared bundle it is rendering the settings window. */
export const SETTINGS_ROUTE = 'settings'

/**
 * The route the settings window loads, section included. Written by the main process and read
 * by the renderer, so both sides live here: a fragment built in one place and parsed in
 * another is a contract nothing checks.
 */
export function settingsRoute(section?: SettingsSectionId): string {
  return section ? `${SETTINGS_ROUTE}/${section}` : SETTINGS_ROUTE
}

export function isSettingsRoute(hash: string): boolean {
  const route = hash.replace(/^#/, '')
  return route === SETTINGS_ROUTE || route.startsWith(`${SETTINGS_ROUTE}/`)
}

/** The section named by the fragment, `null` for a route naming none or naming an unknown. */
export function sectionFromRoute(hash: string): SettingsSectionId | null {
  const section = hash.split('/')[1]
  return isSettingsSection(section) ? section : null
}

/**
 * Where the window opens when nothing names a section — its own ⌘, shortcut included. The top
 * of the list, which is what a settings window is expected to do; a panel that needs the API
 * key names `account` itself.
 */
export const DEFAULT_SETTINGS_SECTION: SettingsSectionId = 'general'
