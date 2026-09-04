import { ToggleField } from '@/components/ToggleField'
import type { ExportDialogState } from '@/hooks/useExportDialogState'

const fixedChoice = (label: string) => (
  <ToggleField label={label} value disabled onChange={() => undefined} />
)

export function SceneGameExportDialogSafeOptions({ state }: { state: ExportDialogState }) {
  const { t } = state
  return (
    <>
      <h4 className="font-semibold">{t('game.export.safeTitle')}</h4>
      {fixedChoice(t('game.export.safeRuntime'))}
      {fixedChoice(t('game.export.instancing'))}
      {fixedChoice(t('game.export.batching'))}
      {fixedChoice(t('game.export.deduplication'))}
      {fixedChoice(t('game.export.geometryBuffers'))}
      {fixedChoice(t('game.export.losslessCompression'))}
      {fixedChoice(t('game.export.removeUnused'))}
    </>
  )
}
