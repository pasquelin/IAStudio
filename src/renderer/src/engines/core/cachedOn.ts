/**
 * One derived value per object, kept while that object lives.
 *
 * The identity IS the key: every edit of a document replaces the object it touches, so the same
 * object is a value that has not changed. Written once because three frame-path caches spelled
 * the same four lines — the cameras of a scene, the rank of each camera's line, and the curve a
 * rail describes.
 */
export function cachedOn<K extends object, V>(store: WeakMap<K, V>, key: K, make: () => V): V {
  const held = store.get(key)
  if (held !== undefined) return held

  const made = make()
  store.set(key, made)
  return made
}
