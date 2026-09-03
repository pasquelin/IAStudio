import { mdiBrush, mdiBlur, mdiArrowCollapseDown, mdiFormatPaint, mdiLayers } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { MenuButton } from '@/components/MenuButton'
import { MenuRow } from '@/components/MenuRow'
import { PropertySection } from '@/components/PropertySection'
import { SliderField } from '@/components/SliderField'
import { ToolButton } from '@/components/ToolButton'
import { setTerrainEditAlpha, setTerrainEditMask } from '@/engines/scene/reliefCommands'
import { HINT_RIGHT, TIP_RIGHT, TIP_TOP } from '@/helpers/tooltip'
import { sceneOf, useScenes } from '@/stores/scenes'
import { sceneViewOf, useSceneViews, type SculptTool } from '@/stores/sceneViews'
import type { ReliefMask } from '@shared/domain/relief'

const AMOUNT = { min: 0.01, max: 1, step: 0.01, value: 0.1 }
const FALLOFF = { min: 0, max: 1, step: 0.05, value: 0 }
const RADIUS = { min: 0.1, max: 50, step: 0.1, value: 2 }

/** Contextual sculpt tools for the armed terrain or edit. */
export function WorldTools({ documentId }: { documentId: string }) {
  const { t } = useTranslation()
  const armed = useSceneViews(state => sceneViewOf(state, documentId).armedRelief)
  const sculptMode = useSceneViews(state => sceneViewOf(state, documentId).sculptMode)
  const sculptTool = useSceneViews(state => sceneViewOf(state, documentId).sculptTool)
  const amount = useSceneViews(state => sceneViewOf(state, documentId).sculptAmount)
  const falloff = useSceneViews(state => sceneViewOf(state, documentId).sculptFalloff)
  const radius = useSceneViews(state => sceneViewOf(state, documentId).sculptRadius)

  const armTool = (tool: SculptTool): void => {
    const views = useSceneViews.getState()
    if (sculptMode && sculptTool === tool) {
      views.setSculptMode(documentId, false)
      return
    }
    views.setSculptTool(documentId, tool)
    views.setSculptMode(documentId, true)
  }

  const layers = useScenes(state => sceneOf(state, documentId).world.layers)
  const terrain = layers.find(layer => layer.kind === 'relief' && layer.id === armed?.terrainId)
  const edit =
    terrain?.kind === 'relief' ? terrain.edits.find(one => one.id === armed?.editId) : undefined

  if (!armed || !terrain) return null

  const run = useScenes.getState().runCommand
  const setMask = (mask: ReliefMask | undefined): void => {
    if (!edit) return
    run(documentId, setTerrainEditMask(terrain.id, edit.id, mask))
  }
  const heightMask = edit?.mask?.kind === 'height' ? edit.mask : undefined
  const slopeMask = edit?.mask?.kind === 'slope' ? edit.mask : undefined
  const maskKind = edit?.mask?.kind
  const maskLabel =
    maskKind === 'painted'
      ? t('world.maskPainted')
      : maskKind === 'height'
        ? t('world.maskHeight')
        : maskKind === 'slope'
          ? t('world.maskSlope')
          : t('world.maskNone')

  return (
    <>
      <PropertySection title={t('world.tools')} scId="world.tools" defaultOpen>
        <div className="flex">
          <ToolButton
            icon={mdiBrush}
            label={t('world.sculpt')}
            description={t('world.sculptHint')}
            tooltip={TIP_TOP}
            variant="bar"
            active={sculptMode && sculptTool === 'raise'}
            onClick={() => armTool('raise')}
          />
          <ToolButton
            icon={mdiBlur}
            label={t('world.smooth')}
            description={t('world.smoothHint')}
            tooltip={TIP_TOP}
            variant="bar"
            active={sculptMode && sculptTool === 'smooth'}
            onClick={() => armTool('smooth')}
          />
          <ToolButton
            icon={mdiArrowCollapseDown}
            label={t('world.flatten')}
            description={t('world.flattenHint')}
            tooltip={TIP_TOP}
            variant="bar"
            active={sculptMode && sculptTool === 'flatten'}
            onClick={() => armTool('flatten')}
          />
        </div>
        <SliderField
          label={t('world.falloff')}
          scId="world.falloff"
          value={falloff}
          min={FALLOFF.min}
          max={FALLOFF.max}
          step={FALLOFF.step}
          onChange={value => useSceneViews.getState().setSculptFalloff(documentId, value)}
          onReset={() => useSceneViews.getState().setSculptFalloff(documentId, FALLOFF.value)}
        />
        <SliderField
          label={t('world.radius')}
          scId="world.radius"
          value={radius}
          min={RADIUS.min}
          max={RADIUS.max}
          step={RADIUS.step}
          onChange={value => useSceneViews.getState().setSculptRadius(documentId, value)}
          onReset={() => useSceneViews.getState().setSculptRadius(documentId, RADIUS.value)}
        />
        <SliderField
          label={t('world.amount')}
          scId="world.amount"
          value={amount}
          min={AMOUNT.min}
          max={AMOUNT.max}
          step={AMOUNT.step}
          onChange={value => useSceneViews.getState().setSculptAmount(documentId, value)}
          onReset={() => useSceneViews.getState().setSculptAmount(documentId, AMOUNT.value)}
        />
        {edit ? (
          <SliderField
            label={t('world.alpha')}
            scId="world.alpha"
            value={edit.alpha}
            min={-1}
            max={1}
            step={0.05}
            onChange={alpha => run(documentId, setTerrainEditAlpha(terrain.id, edit.id, alpha))}
            onReset={() => run(documentId, setTerrainEditAlpha(terrain.id, edit.id, 1))}
          />
        ) : null}
      </PropertySection>
      {edit ? (
        <PropertySection title={t('world.mask')} scId="world.mask" defaultOpen>
          <MenuButton
            icon={mdiLayers}
            label={maskLabel}
            description={t('world.maskHint')}
            tooltip={TIP_RIGHT}
            variant="bar"
            rowCount={4}
            opensOnClick
            rows={close => (
              <>
                <MenuRow
                  label={t('world.maskNone')}
                  checked={!edit.mask}
                  tick="on-off"
                  tip={HINT_RIGHT(t('world.maskNoneHint'))}
                  onSelect={() => {
                    setMask(undefined)
                    close()
                  }}
                />
                <MenuRow
                  label={t('world.maskPainted')}
                  checked={edit.mask?.kind === 'painted'}
                  tick="on-off"
                  tip={HINT_RIGHT(t('world.maskPaintedHint'))}
                  onSelect={() => {
                    setMask({ kind: 'painted', weights: { chunks: [] } })
                    close()
                  }}
                />
                <MenuRow
                  label={t('world.maskHeight')}
                  checked={edit.mask?.kind === 'height'}
                  tick="on-off"
                  tip={HINT_RIGHT(t('world.maskHeightHint'))}
                  onSelect={() => {
                    setMask({
                      kind: 'height',
                      min: terrain.elevation.min,
                      max: terrain.elevation.max,
                    })
                    close()
                  }}
                />
                <MenuRow
                  label={t('world.maskSlope')}
                  checked={edit.mask?.kind === 'slope'}
                  tick="on-off"
                  tip={HINT_RIGHT(t('world.maskSlopeHint'))}
                  onSelect={() => {
                    setMask({ kind: 'slope', min: 0, max: 90 })
                    close()
                  }}
                />
              </>
            )}
          />
          {edit.mask?.kind === 'painted' ? (
            <ToolButton
              icon={mdiFormatPaint}
              label={t('world.paintMask')}
              description={t('world.paintMaskHint')}
              tooltip={TIP_TOP}
              variant="bar"
              active={sculptMode && sculptTool === 'paint'}
              onClick={() => armTool('paint')}
            />
          ) : null}
          {heightMask ? (
            <>
              <SliderField
                label={t('world.maskMin')}
                scId="world.maskHeightMin"
                value={heightMask.min}
                min={terrain.elevation.min}
                max={terrain.elevation.max}
                step={1}
                onChange={min => setMask({ kind: 'height', min, max: heightMask.max })}
                onReset={() =>
                  setMask({ kind: 'height', min: terrain.elevation.min, max: heightMask.max })
                }
              />
              <SliderField
                label={t('world.maskMax')}
                scId="world.maskHeightMax"
                value={heightMask.max}
                min={terrain.elevation.min}
                max={terrain.elevation.max}
                step={1}
                onChange={max => setMask({ kind: 'height', min: heightMask.min, max })}
                onReset={() =>
                  setMask({ kind: 'height', min: heightMask.min, max: terrain.elevation.max })
                }
              />
            </>
          ) : null}
          {slopeMask ? (
            <>
              <SliderField
                label={t('world.maskMin')}
                scId="world.maskSlopeMin"
                value={slopeMask.min}
                min={0}
                max={90}
                step={1}
                onChange={min => setMask({ kind: 'slope', min, max: slopeMask.max })}
                onReset={() => setMask({ kind: 'slope', min: 0, max: slopeMask.max })}
              />
              <SliderField
                label={t('world.maskMax')}
                scId="world.maskSlopeMax"
                value={slopeMask.max}
                min={0}
                max={90}
                step={1}
                onChange={max => setMask({ kind: 'slope', min: slopeMask.min, max })}
                onReset={() => setMask({ kind: 'slope', min: slopeMask.min, max: 90 })}
              />
            </>
          ) : null}
        </PropertySection>
      ) : null}
    </>
  )
}
