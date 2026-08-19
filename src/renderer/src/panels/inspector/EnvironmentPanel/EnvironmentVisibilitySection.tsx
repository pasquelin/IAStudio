import { useTranslation } from 'react-i18next'
import { Button } from '@/design/Button'
import { PropertySection } from '@/design/PropertySection'
import { QuietNote } from '@/design/QuietNote'
import { hideIn, isolating, NOTHING_ISOLATED, type Isolation } from '@/engines/scene/isolation'
import { toggledIsolation } from '@/engines/scene/sceneVisibility'
import type { SceneNode } from '@/engines/scene/sceneState'
import { sceneEngineOf } from '@/stores/sceneEngines'

export type EnvironmentVisibilitySectionProps = {
  documentId: string
  nodes: readonly SceneNode[]
  selectedIds: readonly string[]
  isolation: Isolation
  onIsolation: (isolation: Isolation) => void
}

/**
 * Framing, isolating and hiding, none of which touches the document: `SceneNode.visible` is
 * saved, undone and exported, so leaving an isolation restores exactly the state that went in —
 * the objects their author hid included. See `isolation.ts`.
 */
export function EnvironmentVisibilitySection({
  documentId,
  nodes,
  selectedIds,
  isolation,
  onIsolation,
}: EnvironmentVisibilitySectionProps) {
  const { t } = useTranslation()
  const chosen = selectedIds.length > 0
  const hiding = isolating(isolation)

  return (
    <PropertySection title={t('environment.visibility')} scId="visibility">
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!chosen}
          title={t('environment.focusHint')}
          onClick={() => sceneEngineOf(documentId)?.frameSelection()}
        >
          {t('environment.focus')}
        </Button>

        <Button
          // A toggle, the way every 3D package treats this key: the hand that pressed it to get
          // in is the hand that presses it to get out. The rule is `toggledIsolation`, which the
          // keyboard reaches through the same call.
          disabled={!chosen && !hiding}
          title={hiding ? t('environment.leaveIsolationHint') : t('environment.isolateHint')}
          onClick={() => onIsolation(toggledIsolation(isolation, nodes, selectedIds))}
        >
          {hiding ? t('environment.leaveIsolation') : t('environment.isolate')}
        </Button>

        <Button
          disabled={!chosen}
          title={t('environment.hideHint')}
          onClick={() => onIsolation(hideIn(isolation, selectedIds))}
        >
          {t('environment.hide')}
        </Button>

        <Button
          disabled={!hiding}
          title={t('environment.showAllHint')}
          onClick={() => onIsolation(NOTHING_ISOLATED)}
        >
          {t('environment.showAll')}
        </Button>
      </div>

      {!chosen && !hiding && <QuietNote>{t('environment.noSelection')}</QuietNote>}
      {isolation.only !== null && <QuietNote>{t('environment.isolating')}</QuietNote>}
    </PropertySection>
  )
}
