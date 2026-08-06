import type { StudioBridge } from '@shared/ipc'

declare global {
  /**
   * Set by `contextBridge.exposeInMainWorld('studio', …)`. Declared as a global rather than as
   * a `Window` augmentation: the project convention forbids `interface`, and only interface
   * declaration merging can extend `Window`.
   */
  var studio: StudioBridge
}

export {}
