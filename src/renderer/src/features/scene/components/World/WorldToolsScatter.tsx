import { mdiAutoFix, mdiBrush, mdiClose, mdiEraser, mdiFormatPaint, mdiRefresh } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { AssetDropTarget } from '@/components/AssetDropTarget'
import { NumberField } from '@/components/NumberField'
import { PropertyLine } from '@/components/PropertyLine'
import { Row } from '@/components/Row'
import { PropertySection } from '@/components/PropertySection'
import { SelectField } from '@/components/SelectField'
import { SliderField } from '@/components/SliderField'
import { ToggleField } from '@/components/ToggleField'
import { ToolButton } from '@/components/ToolButton'
import {
  SCATTER_ALTITUDE,
  SCATTER_COLLISION_CAP,
  SCATTER_DENSITY,
  SCATTER_SCALE,
  SCATTER_SLOPE,
  SCATTER_SLOPE_ALIGN,
  SCATTER_SPACING,
  SCATTER_TILT,
  type ScatterLayer,
} from '@shared/domain/scene'
import { layerRegion } from '@shared/domain/scatterFollow'
import { scatterPosesOf } from '@shared/domain/scatterGenerate'
import { FLAT_SCATTER_GROUND } from '@shared/domain/scatterGround'
import {
  setScatterAssets,
  setScatterCollision,
  setScatterFollowRelief,
  setScatterMask,
  setScatterRules,
  setScatterSeed,
} from '@/engines/scene/scatterCommands'
import { deriveScatterMask } from '@/features/scene/deriveScatterMask'
import { TIP_LEFT, TIP_TOP } from '@/helpers/tooltip'
import { useScenes } from '@/stores/scenes'
import { sceneViewOf, useSceneViews } from '@/stores/sceneViews'

function collisionDemandOf(scatter: ScatterLayer): number {
  if (!scatter.collision) return 0
  return scatterPosesOf(scatter, layerRegion(scatter), FLAT_SCATTER_GROUND).length
}

export function WorldToolsScatter({
  documentId,
  scatter,
}: {
  documentId: string
  scatter: ScatterLayer
}) {
  const { t } = useTranslation()
  const run = useScenes.getState().runCommand
  const view = useSceneViews(state => sceneViewOf(state, documentId))
  const rules = scatter.rules
  const patch = (next: Partial<typeof rules>): void => {
    run(documentId, setScatterRules(scatter.id, { ...rules, ...next }))
  }
  const arm = (tool: 'paint' | 'paintGround'): void => {
    const views = useSceneViews.getState()
    if (view.sculptMode && view.sculptTool === tool) views.setSculptMode(documentId, false)
    else {
      views.setSculptTool(documentId, tool)
      views.setSculptMode(documentId, true)
    }
  }
  const collisionEstimate = collisionDemandOf(scatter)

  return (
    <PropertySection title={t('world.tools')} scId="world.scatterTools" defaultOpen>
      <div className="flex">
        <ToolButton
          icon={mdiFormatPaint}
          label={t('world.paintGround')}
          description={t('world.paintGroundHint')}
          tooltip={TIP_TOP}
          variant="bar"
          active={view.sculptMode && view.sculptTool === 'paintGround'}
          disabled={scatter.locked}
          onClick={() => arm('paintGround')}
        />
        <ToolButton
          icon={mdiBrush}
          label={t('world.paintMask')}
          description={t('world.paintScatterMaskHint')}
          tooltip={TIP_TOP}
          variant="bar"
          active={view.sculptMode && view.sculptTool === 'paint'}
          disabled={scatter.locked}
          onClick={() => arm('paint')}
        />
        <ToolButton
          icon={mdiEraser}
          label={t('world.clearMask')}
          description={t('world.clearMaskHint')}
          tooltip={TIP_TOP}
          variant="bar"
          disabled={scatter.locked || !scatter.mask}
          onClick={() => run(documentId, setScatterMask(scatter.id, undefined))}
        />
        <ToolButton
          icon={mdiAutoFix}
          label={t('world.generateAutomatically')}
          description={t('world.generateAutomaticallyHint')}
          tooltip={TIP_TOP}
          variant="bar"
          disabled={scatter.locked}
          onClick={() => void deriveScatterMask(documentId, scatter.id)}
        />
        <ToolButton
          icon={mdiRefresh}
          label={t('world.regenerate')}
          description={t('world.regenerateHint')}
          tooltip={TIP_TOP}
          variant="bar"
          disabled={scatter.locked}
          onClick={() => run(documentId, setScatterSeed(scatter.id, scatter.seed + 1))}
        />
      </div>
      <PropertyLine label={t('world.assets')} root="div">
        <div className="flex min-w-0 flex-col">
          {scatter.assets.map((entry, index) => (
            <Row
              key={entry.assetId}
              title={entry.assetId}
              actions={
                <NumberField
                  label={entry.assetId}
                  value={entry.weight}
                  min={0}
                  max={100}
                  step={0.1}
                  layout="inline"
                  onChange={weight =>
                    run(
                      documentId,
                      setScatterAssets(
                        scatter.id,
                        scatter.assets.map((asset, at) =>
                          at === index ? { ...asset, weight } : asset,
                        ),
                      ),
                    )
                  }
                  actions={
                    <ToolButton
                      icon={mdiClose}
                      label={t('world.removeAsset')}
                      tooltip={TIP_LEFT}
                      onClick={() =>
                        run(
                          documentId,
                          setScatterAssets(
                            scatter.id,
                            scatter.assets.filter(asset => asset.assetId !== entry.assetId),
                          ),
                        )
                      }
                    />
                  }
                />
              }
            />
          ))}
          <AssetDropTarget
            accepts={['mesh']}
            exclusive
            onDrop={asset =>
              run(
                documentId,
                setScatterAssets(scatter.id, [
                  ...scatter.assets.filter(entry => entry.assetId !== asset.id),
                  { assetId: asset.id, weight: 1 },
                ]),
              )
            }
            className="text-muted text-tiny min-w-0 rounded"
          >
            {t('world.dropAsset')}
          </AssetDropTarget>
        </div>
      </PropertyLine>
      <NumberField
        label={t('world.seed')}
        value={scatter.seed}
        min={0}
        max={2_147_483_647}
        step={1}
        onChange={seed => run(documentId, setScatterSeed(scatter.id, seed))}
        scId="world.seed"
      />
      <SliderField
        label={t('world.density')}
        value={rules.density}
        {...SCATTER_DENSITY}
        onChange={density => patch({ density })}
        scId="world.density"
      />
      <SliderField
        label={t('world.spacing')}
        value={rules.spacing}
        {...SCATTER_SPACING}
        onChange={spacing => patch({ spacing })}
        scId="world.spacing"
      />
      <SliderField
        label={t('world.minScale')}
        value={rules.minScale}
        {...SCATTER_SCALE}
        onChange={minScale => patch({ minScale })}
        scId="world.minScale"
      />
      <SliderField
        label={t('world.maxScale')}
        value={rules.maxScale}
        {...SCATTER_SCALE}
        onChange={maxScale => patch({ maxScale })}
        scId="world.maxScale"
      />
      <ToggleField
        label={t('world.randomRotation')}
        value={rules.randomRotation}
        onChange={randomRotation => patch({ randomRotation })}
        scId="world.randomRotation"
      />
      <SliderField
        label={t('world.slopeAlign')}
        value={rules.slopeAlign}
        {...SCATTER_SLOPE_ALIGN}
        onChange={slopeAlign => patch({ slopeAlign })}
        scId="world.slopeAlign"
      />
      <SliderField
        label={t('world.tilt')}
        value={rules.randomTilt}
        {...SCATTER_TILT}
        onChange={randomTilt => patch({ randomTilt })}
        scId="world.tilt"
      />
      <NumberField
        label={t('world.altitudeMin')}
        value={rules.altitudeMin}
        {...SCATTER_ALTITUDE}
        onChange={altitudeMin => patch({ altitudeMin })}
        scId="world.altitudeMin"
      />
      <NumberField
        label={t('world.altitudeMax')}
        value={rules.altitudeMax}
        {...SCATTER_ALTITUDE}
        onChange={altitudeMax => patch({ altitudeMax })}
        scId="world.altitudeMax"
      />
      <SliderField
        label={t('world.slopeMin')}
        value={rules.slopeMin}
        {...SCATTER_SLOPE}
        onChange={slopeMin => patch({ slopeMin })}
        scId="world.slopeMin"
      />
      <SliderField
        label={t('world.slopeMax')}
        value={rules.slopeMax}
        {...SCATTER_SLOPE}
        onChange={slopeMax => patch({ slopeMax })}
        scId="world.slopeMax"
      />
      <SelectField
        label={t('world.followRelief')}
        value={scatter.followRelief}
        options={[
          { value: 'none', label: t('world.followRelief_none') },
          { value: 'brush', label: t('world.followRelief_brush') },
          { value: 'layer', label: t('world.followRelief_layer') },
        ]}
        onChange={follow => run(documentId, setScatterFollowRelief(scatter.id, follow))}
        scId="world.followRelief"
      />
      <ToggleField
        label={t('world.collision')}
        value={scatter.collision}
        onChange={collision => run(documentId, setScatterCollision(scatter.id, collision))}
        scId="world.collision"
      />
      {scatter.collision && collisionEstimate > SCATTER_COLLISION_CAP ? (
        <p role="alert" className="text-warning text-tiny m-0">
          {t('world.collisionCapWarning', { cap: SCATTER_COLLISION_CAP })}
        </p>
      ) : null}
    </PropertySection>
  )
}
