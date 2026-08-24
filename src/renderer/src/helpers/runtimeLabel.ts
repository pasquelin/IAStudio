import { LOCAL_RUNTIME } from '@shared/domain/model'

/**
 * Where a model runs, on screen — this machine, or the cloud that serves it.
 *
 * One answer, like `roleLabel` beside it: the closed picker and its open rows say it, and two
 * spellings of the same sentence are free to disagree.
 */
export function runtimeLabel(runsOn: string, translate: (key: string) => string): string {
  return runsOn === LOCAL_RUNTIME
    ? translate('models.runsLocally')
    : translate(`aiClouds.${runsOn}`)
}
