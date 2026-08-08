import { useTranslation } from 'react-i18next'
import { NumberField } from '@/design/NumberField'
import { PropertyGroup } from '@/design/PropertyGroup'
import { PropertyRow } from '@/design/PropertyRow'
import { SliderField } from '@/design/SliderField'
import { CONTROL } from '@/design/styles'
import { BLEND_MODES, isGroup, type BlendMode, type Layer } from '@/engines/canvas/canvas-state'
import {
  setLayerBlend,
  setLayerClipped,
  setLayerFillOpacity,
  setLayerLocks,
  setLayerOpacity,
  setLayerTransform,
} from '@/engines/canvas/commands'
import { cn } from '@/helpers/cn'
import { useCanvases } from '@/stores/canvases'

export type LayerInspectorProps = { documentId: string; layer: Layer }

/** Radians are what the engine turns and what a document stores; nobody types in them. */
const PER_RADIAN = 180 / Math.PI

/** Which padlock each row opens, in the order the row of them reads. */
const PADLOCKS: readonly ('pixels' | 'position' | 'alpha')[] = ['pixels', 'position', 'alpha']

/**
 * One layer, read out and edited. Its own section rather than the scene's `TransformSection`:
 * a layer turns in a plane and skews, a node turns in three axes and does not — the two share a
 * word and nothing else.
 */
export function LayerInspector({ documentId, layer }: LayerInspectorProps) {
  const { t } = useTranslation()
  const run = (command: Parameters<ReturnType<typeof useCanvases.getState>['runCommand']>[1]) =>
    useCanvases.getState().runCommand(documentId, command)

  const { transform } = layer
  const move = (changes: Partial<typeof transform>): void =>
    run(setLayerTransform(layer.id, { ...transform, ...changes }))

  return (
    <>
      <PropertyGroup title={t('inspector.layer')}>
        <PropertyRow label={t('inspector.name')}>{layer.name}</PropertyRow>
        <PropertyRow label={t('inspector.kind')}>
          {t(`inspector.layerKind_${layer.kind}`)}
        </PropertyRow>
      </PropertyGroup>

      <PropertyGroup title={t('inspector.compositing')}>
        <PropertyRow label={t('inspector.blend')}>
          {/*
            A native select, as `CollectionBar` uses one: sixteen rows in a flyout would be a
            menu to scroll, and the OS list is already keyboard-reachable and searchable.
          */}
          <select
            aria-label={t('inspector.blend')}
            value={layer.blend}
            onChange={event => run(setLayerBlend(layer.id, asBlendMode(event.target.value)))}
            className={cn(CONTROL, 'text-text bg-surface w-full rounded px-1 text-[11px]')}
          >
            {BLEND_MODES.map(mode => (
              <option key={mode} value={mode}>
                {t(`blend.${mode}`)}
              </option>
            ))}
          </select>
        </PropertyRow>

        <SliderField
          label={t('inspector.opacity')}
          value={layer.opacity}
          min={0}
          max={1}
          step={0.01}
          onChange={value => run(setLayerOpacity(layer.id, value))}
        />
        {/* Distinct from the one above: it fades the pixels and leaves the effects drawn around
            them alone. No layer effect exists yet, so today the two simply multiply. */}
        <SliderField
          label={t('inspector.fillOpacity')}
          value={layer.fillOpacity}
          min={0}
          max={1}
          step={0.01}
          onChange={value => run(setLayerFillOpacity(layer.id, value))}
        />

        <PropertyRow label={t('inspector.clipped')}>
          <input
            type="checkbox"
            aria-label={t('inspector.clipped')}
            checked={layer.clipped}
            onChange={event => run(setLayerClipped(layer.id, event.target.checked))}
          />
        </PropertyRow>
      </PropertyGroup>

      <PropertyGroup title={t('inspector.locks')}>
        {PADLOCKS.map(padlock => (
          <PropertyRow key={padlock} label={t(`inspector.lock_${padlock}`)}>
            <input
              type="checkbox"
              aria-label={t(`inspector.lock_${padlock}`)}
              checked={layer.locked[padlock]}
              onChange={event =>
                run(setLayerLocks(layer.id, { ...layer.locked, [padlock]: event.target.checked }))
              }
            />
          </PropertyRow>
        ))}
      </PropertyGroup>

      {/* A group has no pixels of its own, but it does have a place: it carries its children. */}
      <PropertyGroup title={t('inspector.transform')}>
        <NumberField
          label={t('inspector.x')}
          value={transform.x}
          step={1}
          onChange={value => move({ x: value })}
        />
        <NumberField
          label={t('inspector.y')}
          value={transform.y}
          step={1}
          onChange={value => move({ y: value })}
        />
        <NumberField
          label={t('inspector.rotation')}
          value={transform.rotation * PER_RADIAN}
          step={1}
          onChange={value => move({ rotation: value / PER_RADIAN })}
        />
        <NumberField
          label={t('inspector.scaleX')}
          value={transform.scaleX}
          step={0.1}
          onChange={value => move({ scaleX: value })}
        />
        <NumberField
          label={t('inspector.scaleY')}
          value={transform.scaleY}
          step={0.1}
          onChange={value => move({ scaleY: value })}
        />
        {isGroup(layer) && (
          <PropertyRow label={t('inspector.children')}>{layer.children.length}</PropertyRow>
        )}
      </PropertyGroup>
    </>
  )
}

/** The select hands back a string; only the sixteen the state declares are ones. */
function asBlendMode(value: string): BlendMode {
  return BLEND_MODES.find(mode => mode === value) ?? 'normal'
}
