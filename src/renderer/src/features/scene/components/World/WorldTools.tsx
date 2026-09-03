import { mdiBrush, mdiBlur, mdiArrowCollapseDown } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { PropertySection } from '@/components/PropertySection'
import { SliderField } from '@/components/SliderField'
import { ToolButton } from '@/components/ToolButton'
import { setTerrainEditAlpha } from '@/engines/scene/reliefCommands'
import { TIP_TOP } from '@/helpers/tooltip'
import { sceneOf, useScenes } from '@/stores/scenes'
import { sceneViewOf, useSceneViews, type SculptTool } from '@/stores/sceneViews'

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

  return (
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
          onChange={alpha =>
            useScenes
              .getState()
              .runCommand(documentId, setTerrainEditAlpha(terrain.id, edit.id, alpha))
          }
          onReset={() =>
            useScenes.getState().runCommand(documentId, setTerrainEditAlpha(terrain.id, edit.id, 1))
          }
        />
      ) : null}
    </PropertySection>
  )
}
