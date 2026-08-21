import type { Translations } from '../fr'
import type * as frActivity from '../fr/activity.json'
import type * as frAi from '../fr/ai.json'
import type * as frAssets from '../fr/assets.json'
import type * as frAssistant from '../fr/assistant.json'
import type * as frCommands from '../fr/commands.json'
import type * as frCommon from '../fr/common.json'
import type * as frEnvironment from '../fr/environment.json'
import type * as frFileInfo from '../fr/fileInfo.json'
import type * as frGit from '../fr/git.json'
import type * as frImage from '../fr/image.json'
import type * as frInspector from '../fr/inspector.json'
import type * as frModels from '../fr/models.json'
import type * as frScene from '../fr/scene.json'
import type * as frSettings from '../fr/settings.json'
import type * as frShell from '../fr/shell.json'
import type * as frTexture from '../fr/texture.json'
import type * as frUsage from '../fr/usage.json'
import activity from './activity.json'
import ai from './ai.json'
import assets from './assets.json'
import assistant from './assistant.json'
import commands from './commands.json'
import common from './common.json'
import environment from './environment.json'
import fileInfo from './fileInfo.json'
import git from './git.json'
import image from './image.json'
import inspector from './inspector.json'
import models from './models.json'
import scene from './scene.json'
import settings from './settings.json'
import shell from './shell.json'
import texture from './texture.json'
import usage from './usage.json'

/** The roots a section is responsible for, read off its French twin rather than listed here. */
type Section<Roots extends keyof Translations> = Pick<Translations, Roots>

/**
 * Each section is checked against its French twin as it is merged. The whole bundle is checked
 * at once by `TRANSLATIONS` too, but that error points at a 1700-key object; these ones name the
 * section a key was forgotten in, which is what a reader needs to fix it.
 *
 * The roots come from the French files rather than being spelled out here. A list written by
 * hand goes stale the day a root is added to a French section and not to its line, and the check
 * then falls back — in silence — to the imprecise one it exists to replace. Measured on a
 * mutation: derived, a new French root fails at its section; listed, it only failed globally.
 */
export const en = {
  ...(activity satisfies Section<keyof typeof frActivity>),
  ...(ai satisfies Section<keyof typeof frAi>),
  ...(assets satisfies Section<keyof typeof frAssets>),
  ...(assistant satisfies Section<keyof typeof frAssistant>),
  ...(commands satisfies Section<keyof typeof frCommands>),
  ...(common satisfies Section<keyof typeof frCommon>),
  ...(environment satisfies Section<keyof typeof frEnvironment>),
  ...(fileInfo satisfies Section<keyof typeof frFileInfo>),
  ...(git satisfies Section<keyof typeof frGit>),
  ...(image satisfies Section<keyof typeof frImage>),
  ...(inspector satisfies Section<keyof typeof frInspector>),
  ...(models satisfies Section<keyof typeof frModels>),
  ...(scene satisfies Section<keyof typeof frScene>),
  ...(settings satisfies Section<keyof typeof frSettings>),
  ...(shell satisfies Section<keyof typeof frShell>),
  ...(texture satisfies Section<keyof typeof frTexture>),
  ...(usage satisfies Section<keyof typeof frUsage>),
}
