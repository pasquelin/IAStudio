import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  GEOMETRY_SIMPLIFICATIONS,
  NO_LOSSY_OPTIMIZATION,
  TEXTURE_COMPRESSIONS,
  TEXTURE_REDUCTIONS,
  hasVisualChanges,
  type GeometrySimplification,
  type LossyOptimization,
  type TextureCompression,
  type TextureReduction,
} from '@shared/domain/gameExport'
import { SelectField, type SelectOption } from '@/components/SelectField'
import { Spinner } from '@/components/Spinner'
import { ToggleField } from '@/components/ToggleField'
import { WindowButton } from '@/components/WindowButton'
import { formatBytes, formatDecimal } from '@/helpers/format'
import { useGameExportDialog } from '@/hooks/useGameExportDialog'
import { documentById, useDocuments } from '@/stores/documents'
import { sceneEngineOf } from '@/stores/sceneEngines'
import { estimatedLossyImpact, type OptimizationPlan } from '@/engines/scene/worldAnalyzer'
import { exportGameProject } from '@/game/gameExportCompiler'
import { Dialog } from '@/features/shell/components/Dialog'

const fixedChoice = (label: string) => (
  <ToggleField label={label} value disabled onChange={() => undefined} />
)

export function SceneGameExportDialogBody({ documentId }: { documentId: string }) {
  const { t, i18n } = useTranslation()
  const close = useGameExportDialog(state => state.close)
  const title = useDocuments(state => documentById(state, documentId)?.title ?? '')
  const [options, setOptions] = useState<LossyOptimization>(NO_LOSSY_OPTIMIZATION)
  const [plan, setPlan] = useState<OptimizationPlan | null>(null)
  const [exporting, setExporting] = useState(false)
  const [failed, setFailed] = useState(false)
  const exportController = useRef<AbortController | null>(null)
  const geometryOptions = useMemo(
    () => choices(GEOMETRY_SIMPLIFICATIONS, value => t(`game.export.quality.${value}`)),
    [t],
  )
  const textureCompressionOptions = useMemo(
    () => choices(TEXTURE_COMPRESSIONS, value => t(`game.export.quality.${value}`)),
    [t],
  )
  const textureReductionOptions = useMemo(
    () => choices(TEXTURE_REDUCTIONS, value => t(`game.export.reduction.${value}`)),
    [t],
  )

  useEffect(() => {
    let active = true
    const engine = sceneEngineOf(documentId)
    if (!engine) return
    const analyze = async (): Promise<void> => {
      try {
        const measured = await engine.analyzeWorldOptimization()
        if (active) setPlan(measured)
      } catch {
        if (active) setFailed(true)
      }
    }
    void analyze()
    return () => {
      active = false
    }
  }, [documentId])

  const number = (value: number): string => formatDecimal(value, i18n.language, { digits: 0 })
  const bytes = (value: number): string =>
    formatBytes(value, unit => t(`units.${unit}`), i18n.language)
  const lossyImpact = plan ? estimatedLossyImpact(plan, options) : null
  const submit = async (): Promise<void> => {
    const controller = new AbortController()
    exportController.current = controller
    setExporting(true)
    setFailed(false)
    let succeeded: boolean
    try {
      const outcome = await exportGameProject({
        entryScene: title,
        lossyOptimization: options,
        signal: controller.signal,
      })
      succeeded = outcome.ok
    } catch {
      succeeded = false
    }
    exportController.current = null
    if (controller.signal.aborted) return
    setExporting(false)
    if (succeeded) close()
    else setFailed(true)
  }
  const cancel = (): void => {
    exportController.current?.abort()
    close()
  }

  return (
    <Dialog
      title={t('game.export.title')}
      actions={
        <>
          <WindowButton size="dialog" variant="secondary" onClick={cancel}>
            {t('actions.cancel')}
          </WindowButton>
          <WindowButton size="dialog" disabled={!plan || exporting} onClick={() => void submit()}>
            {t('game.export.action')}
          </WindowButton>
        </>
      }
    >
      {!plan && !failed ? (
        <Spinner label={t('optimization.analyzing')} />
      ) : (
        <>
          <h4 className="font-semibold">{t('game.export.safeTitle')}</h4>
          {fixedChoice(t('game.export.safeRuntime'))}
          {fixedChoice(t('game.export.instancing'))}
          {fixedChoice(t('game.export.batching'))}
          {fixedChoice(t('game.export.deduplication'))}
          {fixedChoice(t('game.export.geometryBuffers'))}
          {fixedChoice(t('game.export.losslessCompression'))}
          {fixedChoice(t('game.export.removeUnused'))}
          <h4 className="font-semibold">{t('game.export.visualTitle')}</h4>
          <ToggleField
            label={t('game.export.generateLods')}
            value={options.generateLods}
            onChange={generateLods => setOptions(current => ({ ...current, generateLods }))}
          />
          <SelectField
            label={t('game.export.geometryLabel')}
            value={options.geometrySimplification}
            options={geometryOptions}
            scId="game.export.geometry"
            onChange={(geometrySimplification: GeometrySimplification) =>
              setOptions(current => ({ ...current, geometrySimplification }))
            }
          />
          <SelectField
            label={t('game.export.compressionLabel')}
            value={options.textureCompression}
            options={textureCompressionOptions}
            scId="game.export.compression"
            onChange={(textureCompression: TextureCompression) =>
              setOptions(current => ({ ...current, textureCompression }))
            }
          />
          <SelectField
            label={t('game.export.reductionLabel')}
            value={options.textureReduction}
            options={textureReductionOptions}
            scId="game.export.reduction"
            onChange={(textureReduction: TextureReduction) =>
              setOptions(current => ({ ...current, textureReduction }))
            }
          />
          {plan && (
            <dl>
              <dt>{t('game.export.currentSceneMeasured')}</dt>
              <dd>{t('optimization.drawCalls', { value: number(plan.measured.draws) })}</dd>
              <dd>{t('optimization.triangles', { value: number(plan.measured.triangles) })}</dd>
              <dd>{t('optimization.geometry', { value: bytes(plan.measured.geometryBytes) })}</dd>
              <dd>{t('optimization.images', { value: bytes(plan.measured.textureBytes) })}</dd>
              <dt>{t('game.export.currentSceneEstimated')}</dt>
              <dd>
                {t('optimization.drawCallResult', {
                  before: number(plan.estimated.drawCallsBefore),
                  after: number(plan.estimated.drawCallsAfter),
                })}
              </dd>
              <dd>
                {t('game.export.triangleResult', {
                  before: number(plan.measured.triangles),
                  after: number(lossyImpact?.trianglesAfter ?? plan.measured.triangles),
                })}
              </dd>
              <dd>
                {t('game.export.geometryResult', {
                  before: bytes(plan.measured.geometryBytes),
                  after: bytes(lossyImpact?.geometryBytesAfter ?? plan.measured.geometryBytes),
                })}
              </dd>
              <dd>
                {t('game.export.imageResult', {
                  before: bytes(plan.measured.textureBytes),
                  after: bytes(lossyImpact?.textureBytesAfter ?? plan.measured.textureBytes),
                })}
              </dd>
              <dd>
                {t(
                  hasVisualChanges(options)
                    ? 'game.export.visualChangesPossible'
                    : 'game.export.visualChangesNone',
                )}
              </dd>
            </dl>
          )}
          {failed && <p role="alert">{t('game.export.failed')}</p>}
        </>
      )}
    </Dialog>
  )
}

function choices<V extends string>(
  values: readonly V[],
  labelOf: (value: V) => string,
): readonly SelectOption<V>[] {
  return values.map(value => ({ value, label: labelOf(value) }))
}
