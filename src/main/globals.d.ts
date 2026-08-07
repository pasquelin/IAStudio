/** Injected by `define` in electron.vite.config.ts. Falls back to `dev` outside a checkout. */
declare const __COMMIT_HASH__: string

/**
 * Whether this build was made by the `dev` command. Injected by `define` rather than read from
 * `app.isPackaged`, which the dev run makes lie — see the note in electron.vite.config.ts.
 */
declare const __DEV__: boolean
