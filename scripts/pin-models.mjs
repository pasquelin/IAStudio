/**
 * Fills the catalogue's blanks — byte counts, digests, revisions — in
 * `src/shared/domain/localModels.json`. Nothing here is typed by hand.
 *
 *     node scripts/pin-models.mjs               # every file still missing a digest
 *     node scripts/pin-models.mjs --all         # re-pin everything, after rotating a URL
 *     node scripts/pin-models.mjs --id qwen2.5-0.5b-instruct-q4
 *
 * `[M]` Read from the Hugging Face tree API rather than downloaded: an LFS entry publishes
 * `lfs.oid`, which IS the file's SHA-256, and `size`, its exact byte count — verified 2026-08-21
 * against `Qwen/Qwen2.5-0.5B-Instruct-GGUF`. Pinning the four assistant entries by download would
 * cost some fifteen gigabytes for figures the API states outright.
 *
 * 🛑 This does NOT make the digest a matter of trust. `fetchModelFile` still hashes every byte as
 * it arrives and refuses a file that does not match, so a wrong figure here costs a refused
 * install — never a bad file at the path a runtime loads from.
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CATALOGUE = join(ROOT, 'src', 'shared', 'domain', 'localModels.json')

/** `https://huggingface.co/<repo>/resolve/<revision>/<path>` — the only shape this pins. */
function partsOf(url) {
  const match = /^https:\/\/huggingface\.co\/(.+?)\/resolve\/([^/]+)\/(.+)$/.exec(url)
  if (!match) throw new Error(`not a Hugging Face resolve URL: ${url}`)

  return { repo: match[1], revision: match[2], path: match[3] }
}

async function fetched(url) {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok) throw new Error(`${url} answered ${response.status}`)
  return response
}

/**
 * Answers are memoised because a manifest names one repository many times: pinning the whole
 * catalogue asked 546 commits and 546 trees for 39 repositories and 177 folders.
 */
const answered = new Map()

async function json(url) {
  if (!answered.has(url))
    answered.set(
      url,
      fetched(url).then(response => response.json()),
    )
  return await answered.get(url)
}

/** The commit a branch points at, so a recorded digest stays true when the branch moves on. */
async function commitOf(repo, revision) {
  return (await json(`https://huggingface.co/api/models/${repo}/revision/${revision}`)).sha
}

/** Above this, a file without an `lfs` entry is a mistake to report rather than bytes to pull. */
const SMALL_ENOUGH = 8 * 1024 * 1024

async function digestOf(repo, revision, path) {
  const response = await fetched(`https://huggingface.co/${repo}/resolve/${revision}/${path}`)
  const digest = createHash('sha256')
  for await (const chunk of response.body) digest.update(chunk)

  return digest.digest('hex')
}

async function entryOf(repo, revision, path) {
  const folder = path.includes('/') ? `/${path.slice(0, path.lastIndexOf('/'))}` : ''
  const tree = await json(`https://huggingface.co/api/models/${repo}/tree/${revision}${folder}`)
  const found = tree.find(one => one.path === path)
  if (!found) throw new Error(`${path} is not in ${repo}@${revision}`)

  // A plain file has no `lfs`, and its `oid` is a GIT blob hash — not a SHA-256 of the contents.
  // Those are configs and vocabularies, so the digest is read off the bytes themselves.
  if (found.lfs) return { bytes: found.size, sha256: found.lfs.oid }
  if (found.size > SMALL_ENOUGH) throw new Error(`${path} is ${found.size} bytes and not LFS`)

  return { bytes: found.size, sha256: await digestOf(repo, revision, path) }
}

export async function pinModels({ all = false, id = null } = {}) {
  const catalogue = JSON.parse(readFileSync(CATALOGUE, 'utf8'))

  for (const [role, models] of Object.entries(catalogue)) {
    for (const model of models) {
      if (id && model.id !== id) continue

      let total = 0
      for (const file of model.files) {
        if (!all && file.sha256 !== '' && file.bytes !== 0) {
          total += file.bytes
          continue
        }

        const { repo, revision, path } = partsOf(file.url)
        const commit = await commitOf(repo, revision)
        const seen = await entryOf(repo, commit, path)

        file.bytes = seen.bytes
        file.sha256 = seen.sha256
        file.revision = commit
        file.url = `https://huggingface.co/${repo}/resolve/${commit}/${path}`
        total += seen.bytes

        console.log(`${role} · ${model.id} · ${path}`)
        console.log(`  ${seen.bytes} octets · ${seen.sha256} · ${commit}`)
      }

      model.diskBytes = total
    }
  }

  writeFileSync(CATALOGUE, `${JSON.stringify(catalogue, null, 2)}\n`)
  return catalogue
}

if (pathToFileURL(process.argv[1]).href === import.meta.url) {
  const idAt = process.argv.indexOf('--id')

  pinModels({ all: process.argv.includes('--all'), id: idAt > 0 ? process.argv[idAt + 1] : null })
    .then(() => console.log('localModels.json written'))
    .catch(error => {
      console.error(error.message)
      process.exit(1)
    })
}
