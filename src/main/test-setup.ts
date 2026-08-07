// `__DEV__` and `__COMMIT_HASH__` are injected by `define` in electron.vite.config.ts. Vitest's
// own `define` does not reach modules loaded through the SSR transform, which is how the main
// process is tested — so they are assigned here, where the node project actually runs.
Object.assign(globalThis, { __DEV__: true, __COMMIT_HASH__: 'test' })
