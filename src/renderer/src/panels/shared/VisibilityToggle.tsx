import { mdiEye, mdiEyeOffOutline } from '@mdi/js'
import { ToolButton } from '@/design/ToolButton'
import { TIP_RIGHT } from '@/helpers/tooltip'

export type VisibilityToggleProps = {
  visible: boolean
  label: string
  description?: string
  onToggle: () => void
}

/**
 * The eye that hides a row's subject, wherever the row lives. Written once because the guard is
 * the subtle part: `Tree` selects its row on pointer down and `Collection` on click, so an eye
 * that stopped only one of them would steal the selection in the other list.
 */
export function VisibilityToggle({ visible, label, description, onToggle }: VisibilityToggleProps) {
  return (
    <ToolButton
      icon={visible ? mdiEye : mdiEyeOffOutline}
      label={label}
      description={description}
      tooltip={TIP_RIGHT}
      variant="header"
      onPointerDown={event => event.stopPropagation()}
      onClick={event => {
        event.stopPropagation()
        onToggle()
      }}
    />
  )
}
