import { useTranslation } from 'react-i18next'
import type { ModelSummary } from '@shared/domain/model'
import { useAiModels } from '@/stores/aiModels'
import { useBytes } from '@/hooks/useBytes'

/**
 * Asked before the weights are fetched, because the figures are the person's business: some of
 * these downloads are tens of gigabytes, and they come from the publisher rather than from us.
 *
 * DaisyUI here and not `design/`: this is the application speaking as an application, which is
 * the one place `CLAUDE.md` reserves for it.
 */
export function ModelDownloadDialog({
  model,
  onClose,
}: {
  model: ModelSummary
  onClose: () => void
}) {
  const { t } = useTranslation()
  const bytes = useBytes()
  const installAiModel = useAiModels(state => state.installAiModel)

  return (
    <div className="modal modal-open" role="dialog" aria-label={t('models.downloadThis')}>
      <div className="modal-box">
        <h3 className="text-lg font-semibold">{t('models.downloadThis')}</h3>
        <p className="py-4">
          {t('models.downloadThisHint', {
            // Data, not a word of the interface: a model is called what its publisher calls it.
            name: model.name,
            size: model.diskBytes === undefined ? '—' : bytes(model.diskBytes),
          })}
        </p>
        <div className="modal-action">
          <button type="button" className="btn" onClick={onClose}>
            {t('actions.cancel')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              void installAiModel(model.id)
              onClose()
            }}
          >
            {t('models.download')}
          </button>
        </div>
      </div>
    </div>
  )
}
