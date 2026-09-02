/** The unsubscribe a project connection answers with, awaited where a teardown cannot be async. */
export async function leaveProject(leaving: Promise<() => void>): Promise<void> {
  // Swallowed with a reason: the window is going away, and a project read that never answered has
  // nothing left to unsubscribe from.
  try {
    ;(await leaving)()
  } catch {
    /* the connection never landed */
  }
}
