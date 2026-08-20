/**
 * The name a script drives a control by, prefixed by what the thing IS — `section:transform`
 * folds, `field:transform.position.x` takes a value. `pilotable.test.ts` holds every handle of
 * the window to one of the two.
 */
export const fieldHandle = (id: string): string => `field:${id}`

export const sectionHandle = (id: string): string => `section:${id}`
