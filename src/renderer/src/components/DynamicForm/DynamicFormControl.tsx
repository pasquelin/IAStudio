import { mdiDiceMultipleOutline } from '@mdi/js'
import { useRef, type ReactNode } from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import type { FieldDescriptor } from '@shared/domain/model'
import { cn } from '@/helpers/cn'
import { TIP_LEFT } from '@/helpers/tooltip'
import { useModelText } from '@/hooks/useModelText'
import { AssetDropField } from '../AssetDropField'
import { AssetDropList } from '../AssetDropList'
import { fieldHandle } from '../scHandle'
import { CHECKBOX, FIELD, FIELD_FILL } from '../styles'
import { ToolButton } from '../ToolButton'

export type DynamicFormControlProps = {
  field: FieldDescriptor
  /** The control's own id, so the form's label can name it without wrapping it. */
  id: string
  registration: UseFormRegisterReturn
  /** What the form opens on for this field — the preset when there is one, the default if not. */
  initial: unknown
  onRoll: () => void
  /** What the form hangs in this field, or nothing. Only a long text box has room for one. */
  accessory?: ReactNode
}

export function DynamicFormControl({
  field,
  id,
  registration,
  initial,
  onRoll,
  accessory,
}: DynamicFormControlProps) {
  const { t } = useTranslation()
  const say = useModelText()
  const box = useRef<HTMLTextAreaElement | null>(null)

  /**
   * The model's own key for this input, which is the only name that does not move: the label is
   * a sentence the Scenario API writes, and the `id` beside it comes from `useId` — `:r7:` names
   * nothing a script could work out. This is the form a client most wants to fill.
   */
  const handle = fieldHandle(`generation.${field.key}`)

  // Before the kinds: a repeated field is a LIST of one of them, and every list is dropped the
  // same way. `image` is the only kind repeated today; a second one lands here rather than in a
  // case of its own.
  if (field.repeated) {
    return (
      <AssetDropList
        id={id}
        registration={registration}
        initial={
          Array.isArray(initial) ? initial.filter(one => typeof one === 'string') : undefined
        }
        placeholder={t('generation.dropViews')}
        scId={`generation.${field.key}`}
      />
    )
  }

  switch (field.kind) {
    case 'longText':
      // The box is the FRAME: it resizes, and the text takes what is left of it. The strip is
      // stacked UNDER the text rather than laid over it — laid over, it covered the foot of the
      // scrollbar, which four rows grow as soon as a prompt runs long. `overflow-hidden` is what
      // makes a div resizable at all, and it keeps the text inside the frame's corners.
      return (
        <div className={cn(FIELD, 'flex h-auto resize-y flex-col overflow-hidden p-0')}>
          <textarea
            id={id}
            data-sc={handle}
            rows={4}
            className="min-h-0 w-full flex-1 resize-none bg-transparent px-2 py-1"
            {...registration}
            ref={element => {
              registration.ref(element)
              box.current = element
            }}
          />

          {accessory && (
            /**
             * The strip HOLDS the caret in the box, and that is what makes everything it carries
             * work: dictation writes wherever the caret is, so a button that took the focus left
             * the sentence with no field to land in — and a form carries three boxes at times.
             *
             * The `focus()` is what the test measures, and it is enough on its own. The
             * `preventDefault` spares the round trip it would otherwise repair — the box blurs,
             * the button takes the focus, the click gives it back — which nothing here can see
             * but a scrolled panel and a lost selection would.
             *
             * The padding is the text's own, so the microphone lines up with the words above it.
             * The resize grip shares that corner: it is reached from the very edge, the button
             * from anywhere else on it.
             */
            <div
              className="flex items-center justify-end gap-2 px-2 pb-1"
              onMouseDown={event => event.preventDefault()}
              onClick={() => box.current?.focus()}
            >
              {accessory}
            </div>
          )}
        </div>
      )

    case 'boolean':
      return (
        <input
          id={id}
          data-sc={handle}
          type="checkbox"
          // 🛑 `CHECKBOX` like every other box of the studio: composed by hand here, it wore the
          // BROWSER's accent — measured `auto` against the token's `#346ef2` — and no pointer.
          className={cn(CHECKBOX, 'size-4 shrink-0')}
          {...registration}
        />
      )

    case 'choice':
      return (
        <select id={id} data-sc={handle} className={FIELD} {...registration}>
          {!field.required && <option value="" />}
          {field.options?.map(option => (
            <option key={option.value} value={option.value}>
              {say(option.label)}
            </option>
          ))}
        </select>
      )

    // A run of this same service, named by its id. Nothing has run yet — or the window has not
    // been told — and it falls back to the plain box, which takes an id pasted by hand.
    case 'task':
      if (!field.options || field.options.length === 0) break

      return (
        <select id={id} data-sc={handle} className={FIELD} {...registration}>
          {!field.required && <option value="" />}
          {field.options.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )

    case 'color':
      return (
        <input
          id={id}
          data-sc={handle}
          type="color"
          className={cn(FIELD, 'px-1')}
          {...registration}
        />
      )

    case 'seed':
      return (
        <div className="flex items-center gap-2">
          <input id={id} data-sc={handle} type="number" className={FIELD_FILL} {...registration} />
          <ToolButton
            icon={mdiDiceMultipleOutline}
            label={t('generation.randomSeed')}
            tooltip={TIP_LEFT}
            onClick={onRoll}
          />
        </div>
      )

    case 'number':
    case 'integer':
      return (
        <input
          id={id}
          data-sc={handle}
          type="number"
          step={field.step ?? (field.kind === 'integer' ? 1 : 'any')}
          min={field.min}
          max={field.max}
          className={FIELD}
          {...registration}
        />
      )

    case 'image':
    case 'mesh':
      return (
        <AssetDropField
          id={id}
          registration={registration}
          initial={typeof initial === 'string' && initial ? initial : undefined}
          placeholder={t(field.kind === 'mesh' ? 'generation.dropModel' : 'generation.dropPicture')}
          // The model's own key for this input — never translated, which is what a handle must be.
          scId={`generation.${field.key}`}
        />
      )

    default:
      break
  }

  // An unknown kind renders as a plain input rather than making the form disappear — CLAUDE.md,
  // invariant 5. A `task` with nothing to offer yet lands here too.
  return <input id={id} data-sc={handle} type="text" className={FIELD} {...registration} />
}
