/**
 * The skins a settings screen shares. Beside `SettingList` rather than in it: a control reaching
 * back into the list that renders it closes a cycle, which `import-cycles.test.ts` holds at zero.
 */

/**
 * The column a run of settings keeps. Borrowed by the two screens no registry can express, so
 * their line ends where the lines above it do once the window is widened past the cap.
 */
export const SETTING_COLUMN = 'flex max-w-2xl flex-col'

/** The one `<select>` of these windows. Capped narrower than its row: a list of short words. */
export const SETTING_SELECT = 'select select-sm w-full max-w-xs'
