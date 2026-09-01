/** The folders of this machine a briefing names, spelled as the disk spells them. */
const NAMED: readonly ['home', 'desktop', 'documents', 'downloads'] = [
  'home',
  'desktop',
  'documents',
  'downloads',
]

// 🛑 English names over the machine's OWN paths: a French window shows "Téléchargements" for a
// folder spelled `Downloads`, and a model told the displayed name builds a path nothing follows.
export function machineFolders(
  pathOf: (name: (typeof NAMED)[number]) => string,
  projects: string | undefined,
): string {
  // 🛑 `app.getPath` THROWS where a folder cannot be named — a Linux box with no xdg-user-dirs —
  // and this runs on every turn: unguarded, one missing folder loses the sentence, not the line.
  const named = NAMED.flatMap(name => {
    try {
      return [`${name}: ${pathOf(name)}`]
    } catch {
      return []
    }
  })

  // 🛑 First, and the one that matters: it is where THIS person keeps projects — the folder they
  // set, or the one holding the last project they made. Absent on a machine that has neither.
  return (projects ? [`projects: ${projects}`, ...named] : named).join('\n')
}
