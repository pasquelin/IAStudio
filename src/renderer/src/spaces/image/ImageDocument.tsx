import { Toolbar } from '@/design/Toolbar'
import { IMAGE_TOOLS } from './image-tools'

/** A blank page and its bar. The layer engine is a lot of its own — see the spec § 8.4. */
export function ImageDocument() {
  return (
    <div className="relative size-full bg-white">
      <Toolbar className="absolute top-2 left-2" tools={[...IMAGE_TOOLS]} onTool={() => {}} />
    </div>
  )
}
