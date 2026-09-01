/**
 * Contrôle les règles que les trois vitrines doivent tenir ENSEMBLE.
 *
 * Écrit après coup, parce que les écarts se trouvaient à l'œil, un par un, et toujours
 * par quelqu'un d'autre : une ancre qui ne visait aucune section, deux liens du même nom
 * menant ailleurs l'un de l'autre, un libellé différent d'un dépôt à l'autre pour le même
 * lien. Chacun était évident une fois montré, et invisible tant qu'aucune machine ne le
 * cherchait.
 *
 * Il lit le GABARIT et les dictionnaires, pas le site bâti : rien à compiler, donc il peut
 * entrer dans `pnpm validate` sans rien coûter.
 *
 * CE FICHIER EST PARTAGÉ À L'IDENTIQUE par map3D, panels et IA Studio. Les règles valent
 * pour les trois ; ce qui est propre à un dépôt vient de `repo.config.json`.
 *
 *   node scripts/check-site.mjs
 */
import { readFile, readdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const SITE = join(ROOT, 'site')

const repo = JSON.parse(await readFile(join(ROOT, 'repo.config.json'), 'utf8'))
const gabarit = await readFile(join(SITE, 'template.html'), 'utf8')

const langues = []
for (const f of (await readdir(join(SITE, 'i18n'))).filter((n) => n.endsWith('.json')).sort()) {
  langues.push(JSON.parse(await readFile(join(SITE, 'i18n', f), 'utf8')))
}
const defaut = langues.find((l) => l.meta.lang === (repo.site.defaultLang ?? 'en'))

const lookup = (dict, chemin) => chemin.split('.').reduce((n, k) => (n == null ? undefined : n[k]), dict)

/** Rend les `{{clés}}` d'un fragment avec le dictionnaire par défaut, pour lire le texte réel. */
const rendu = (texte) =>
  texte.replace(/\{\{([\w.]+)\}\}/g, (_, cle) => {
    const valeur = lookup(defaut, cle)
    return typeof valeur === 'string' ? valeur : ''
  })

const nu = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()

const griefs = []

/* ------------------------------------------------------------------ les liens */
/* Le gabarit est rendu EN ENTIER avant d'être lu : un lien peut vivre dans un
   dictionnaire — les mentions légales en portent plusieurs — et ne jamais apparaître
   dans le gabarit. Ne lire que celui-ci laisserait ces liens hors du contrôle. */
const page = rendu(gabarit)
const liens = [...page.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a\s*>/g)].map((m) => ({
  href: m[1],
  texte: nu(m[2]),
}))

/* Un libellé, une destination. Deux liens qui disent le même mot et mènent ailleurs sont
   une énigme pour le lecteur — c'est arrivé avec « GitHub », qui désignait à la fois le
   dépôt et un profil. */
const parLibelle = new Map()
for (const { href, texte } of liens) {
  if (!texte) continue
  if (!parLibelle.has(texte)) parLibelle.set(texte, new Set())
  parLibelle.get(texte).add(href)
}
for (const [texte, cibles] of parLibelle) {
  if (cibles.size > 1) {
    griefs.push(`« ${texte} » mène à ${cibles.size} endroits différents :\n      ${[...cibles].join('\n      ')}`)
  }
}

/* Le dépôt s'appelle « GitHub » et mène au dépôt de CE projet, sur les trois vitrines. */
const DEPOT = `https://github.com/${repo.repo}`
const versDepot = liens.filter((l) => l.href === DEPOT || l.href === `${DEPOT}/`)
if (versDepot.length === 0) {
  griefs.push(`aucun lien vers le dépôt (${DEPOT}).`)
} else if (!versDepot.some((l) => l.texte === 'GitHub')) {
  griefs.push(`le lien vers le dépôt ne s'appelle pas « GitHub » mais « ${versDepot[0].texte} ».`)
}

/* Ce que chaque vitrine doit offrir, où qu'elle le range. */
for (const [quoi, motif] of [
  ['le changelog', /\/CHANGELOG\.md/],
  ['la licence', /\/LICENSE(\b|$)/],
  ['la documentation', /\/docs\//],
]) {
  if (!liens.some((l) => motif.test(l.href))) griefs.push(`aucun lien vers ${quoi}.`)
}

/* ------------------------------------------------------- les ancres internes */
/* Une ancre qui ne vise aucune section est un lien mort que rien ne signale : le
   navigateur ne bouge pas, et personne ne sait pourquoi. */
const ids = new Set([...page.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]))
for (const { href } of liens) {
  if (!href.startsWith('#') || href === '#') continue
  if (!ids.has(href.slice(1))) griefs.push(`l'ancre ${href} ne vise aucune section du gabarit.`)
}

/* --------------------------------------------------------- les clés du gabarit */
/* Le moteur les vérifie au rendu ; ici on le sait avant d'avoir bâti, et sans les
   variables que le moteur fabrique lui-même. */
const FOURNIES = new Set([
  'lang', 'dir', 'docs', 'root', 'version', 'alternates', 'langSwitch', 'jsonld', 'ogLocale', 'localeAlternates',
])
for (const [, cle] of gabarit.matchAll(/\{\{([\w.]+)\}\}/g)) {
  if (FOURNIES.has(cle)) continue
  if (lookup(defaut, cle) === undefined) griefs.push(`le gabarit demande « ${cle} », absent du dictionnaire de référence.`)
}

/* --------------------------------------------------------------- les langues */
if (langues.length < 2) griefs.push(`une seule langue : la vitrine n'est pas traduite.`)
for (const l of langues) {
  if (!l.meta.flag) griefs.push(`le dictionnaire « ${l.meta.lang} » n'a pas de pavillon.`)
}

/* ------------------------------------------------------------------- verdict */
if (griefs.length > 0) {
  console.error('Contrôle de la vitrine en échec :\n')
  for (const grief of griefs) console.error(`  · ${grief}`)
  process.exit(1)
}

console.log(
  `Vitrine contrôlée — ${liens.length} liens, ${parLibelle.size} libellés distincts, ` +
    `${ids.size} ancres, ${langues.length} langues.`,
)
