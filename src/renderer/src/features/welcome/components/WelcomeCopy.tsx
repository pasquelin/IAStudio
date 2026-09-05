import { WINDOW_CAPTION } from '@/components/windowStyles'

/**
 * The words of a slide. The mark used to open it and now stands in `WelcomeMasthead`, above the
 * carousel: it belongs to the window, not to any one step of it.
 */
export function WelcomeCopy({ title, body }: { title: string; body: string }) {
  return (
    <div className="mb-5 flex flex-col items-center text-center">
      <h1 className="mb-2 text-lg font-semibold tracking-tight">{title}</h1>
      <p className={WINDOW_CAPTION}>{body}</p>
    </div>
  )
}
