import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { AssetType } from '@shared/domain/asset'
import { ENVIRONMENT_KINDS, STUDIO_ENVIRONMENT, type EnvironmentRef } from '@shared/domain/scene'
import { LinkField } from '@/design/LinkField/LinkField'
import { SelectField } from '@/design/SelectField'
import { environmentOfKind } from '@/engines/scene/sceneWorld'
import { openAssetById } from '@/helpers/openAsset'
import { HINT_LEFT } from '@/helpers/tooltip'
import { useDocumentOptions } from '@/hooks/useDocumentOptions'
import { useProjectPictures } from '@/hooks/useProjectPictures'
import { choicesOf } from '../unionChoices'
import { EnvironmentChoiceSky } from './EnvironmentChoiceSky'

const SKIES: readonly AssetType[] = ['skybox']

export type EnvironmentChoiceProps = {
  environment: EnvironmentRef
  onChange: (environment: EnvironmentRef) => void
}

/**
 * What lights a viewport: nothing of the project, one PICTURE, or a sky DOCUMENT it follows.
 * Shared by the two surfaces that ask it — the 3D space adds two dials of its own around it.
 */
export function EnvironmentChoice({ environment, onChange }: EnvironmentChoiceProps) {
  const { t } = useTranslation()
  const pictures = useProjectPictures(SKIES)
  const sources = useMemo(() => choicesOf(ENVIRONMENT_KINDS, 'environment.source_', t), [t])

  const skies = useDocumentOptions('skybox')

  const picture = environment.kind === 'skybox' ? environment.assetId : null
  const sky = environment.kind === 'sky' ? environment.documentId : null

  return (
    <>
      <SelectField
        label={t('environment.source')}
        scId="environment.source"
        value={environment.kind}
        options={sources.options}
        onChange={kind => onChange(environmentOfKind(kind, { pictures, skies }))}
        hint={HINT_LEFT(sources.hintOf(environment.kind))}
      />

      {sky === null ? (
        /* Shown under the studio as well as under a picture, and NOT only under « an image »: this
           slot is the one drop target a viewport has for a sky, and a fresh document opens on the
           studio — hiding it there left no way at all to drag one in. */
        <LinkField
          label={t('inspector.sky')}
          value={picture}
          options={pictures}
          onChange={assetId => onChange(assetId ? { kind: 'skybox', assetId } : STUDIO_ENVIRONMENT)}
          emptyLabel={t('inspector.studio')}
          missingLabel={t('inspector.missingSky')}
          clearLabel={t('inspector.clearSky')}
          clearHint={t('inspector.clearSkyHint')}
          // A sky and nothing else: the slot lights up for what it can actually hold, so a drag
          // across the panel says where it may land before the hand commits to it.
          accepts={SKIES}
          open={{
            label: t('inspector.openSky'),
            hint: t('inspector.openSkyHint'),
            run: () => openAssetById(picture),
          }}
          scId="scene.environment"
        />
      ) : (
        <EnvironmentChoiceSky
          documentId={sky}
          options={skies}
          pictures={pictures}
          onChange={documentId =>
            onChange(documentId ? { kind: 'sky', documentId } : STUDIO_ENVIRONMENT)
          }
        />
      )}
    </>
  )
}
