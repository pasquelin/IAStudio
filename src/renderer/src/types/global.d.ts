import type { PontStudio } from '@shared/ipc'

declare global {
  /**
   * Posé par `contextBridge.exposeInMainWorld('studio', …)`. Déclaré en global plutôt
   * qu'en augmentation de `Window` : la convention du projet interdit `interface`, et
   * seul le declaration merging d'interface permet d'étendre `Window`.
   */
  var studio: PontStudio
}

export {}
