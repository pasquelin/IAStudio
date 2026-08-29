/** The folders of this machine a briefing names, in the spelling `project.create` takes. */
const NAMED: readonly ['home', 'desktop', 'documents', 'downloads'] = [
  'home',
  'desktop',
  'documents',
  'downloads',
]

// 🛑 English names over the machine's OWN paths: a French window shows "Téléchargements" for a
// folder spelled `Downloads`, and a model told the displayed name builds a path nothing follows.
export function machineFolders(pathOf: (name: (typeof NAMED)[number]) => string): string {
  // 🛑 `app.getPath` THROWS where a folder cannot be named — a Linux box with no xdg-user-dirs —
  // and this runs on every turn: unguarded, one missing folder loses the sentence, not the line.
  const named = NAMED.flatMap(name => {
    try {
      return [`${name}: ${pathOf(name)}`]
    } catch {
      return []
    }
  })

  return named.join('\n')
}
