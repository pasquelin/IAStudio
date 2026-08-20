/**
 * The buttons of the settings window, as names alone.
 *
 * Apart from `settingsRegistry.ts`, which holds what each one READS on screen: that module carries
 * every setting of the studio and its help text, and `eager-graph.test.ts` keeps it out of the
 * opening chunk. The action catalogue needs the names to close a field over them, and would have
 * dragged the whole registry into the splash screen with it.
 */
export type SettingActionId =
  | 'advanced.openSettingsFile'
  | 'advanced.openLogFolder'
  | 'advanced.openDevtools'
  | 'advanced.copyMcpCommand'
  | 'advanced.installResolveBridge'
  | 'advanced.reset'

/** `settingsRegistry.test.ts` holds this to the registry, so neither can gain a row alone. */
export const SETTING_ACTION_IDS: readonly SettingActionId[] = [
  'advanced.openSettingsFile',
  'advanced.openLogFolder',
  'advanced.openDevtools',
  'advanced.copyMcpCommand',
  'advanced.installResolveBridge',
  'advanced.reset',
]
