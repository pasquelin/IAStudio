/**
 * Le temps GPU d'une frame WebGL2, par `EXT_disjoint_timer_query_webgl2`.
 *
 * 🛑 Une seule requête TIME_ELAPSED peut être en vol : la spec interdit de les imbriquer. On en
 * ouvre donc une par frame, et on relit celles qui ont fini quelques frames plus tard — le
 * résultat n'est jamais disponible pendant la frame qui l'a demandé.
 */
export function createGlTimer(gl) {
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2')
  if (!ext) return null

  const pending = []
  const free = []
  let open = null

  return {
    begin() {
      if (open) return
      open = free.pop() ?? gl.createQuery()
      gl.beginQuery(ext.TIME_ELAPSED_EXT, open)
    },
    end() {
      if (!open) return
      gl.endQuery(ext.TIME_ELAPSED_EXT)
      pending.push(open)
      open = null
    },
    /** Les millisecondes GPU des frames terminées depuis le dernier appel. */
    collect() {
      const out = []
      // Un GPU « disjoint » a été préempté : tous les résultats en vol sont faux, pas seulement
      // le dernier. On les jette plutôt que de publier un nombre inventé.
      if (gl.getParameter(ext.GPU_DISJOINT_EXT)) {
        for (const query of pending.splice(0)) free.push(query)
        return out
      }
      while (pending.length > 0) {
        const query = pending[0]
        if (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) break
        out.push(gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6)
        free.push(pending.shift())
      }
      return out
    },
    dispose() {
      for (const query of [...pending, ...free]) gl.deleteQuery(query)
    },
  }
}
