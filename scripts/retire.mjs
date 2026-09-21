/**
 * Retires a language's collections: checks the evidence can stand without them, then deletes
 * them from the shared cache.
 *
 * Deleting ninety gigabytes rests on one claim — that the recorded evidence is as good as the
 * text it came from. That claim is true only once the evidence records each collection's token
 * total, which is the denominator every rate needs. Before that it is false, and a language whose
 * evidence is still version 1 would come back from a rebuild smaller and quieter.
 *
 * So this refuses unless:
 *
 *  - the evidence records a token total for every source the language declares,
 *  - the repository is clean, so the evidence being relied on is the evidence that is pushed,
 *  - and `COLLECTIONS.md` exists, which is the pointer back to every download.
 *
 * It then deletes only what no other language claims. The shared cache is shared.
 *
 *   node scripts/retire.mjs de
 *   node scripts/retire.mjs de --dry-run
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { readEvidence } from '../dist/src/index.js'

const [tag, ...flags] = process.argv.slice(2)
if (tag === undefined) throw new Error('usage: node scripts/retire.mjs <language> [--dry-run]')
const dryRun = flags.includes('--dry-run')

const HERE = new URL('..', import.meta.url).pathname
const SIBLINGS = join(HERE, '..')
const CACHE = join(HERE, '.cache', 'raw')
const PREFIX = 'blinkered-dictionary-'
const root = join(SIBLINGS, `${PREFIX}${tag}`)

const refuse = (why) => {
  throw new Error(`will not retire ${tag}'s collections: ${why}`)
}

if (!existsSync(root)) refuse('no such repository')
if (!existsSync(join(root, 'COLLECTIONS.md'))) refuse('no COLLECTIONS.md — nothing points back')

const dirty = execFileSync('git', ['-C', root, 'status', '--porcelain'], {
  encoding: 'utf8',
}).trim()
if (dirty !== '') refuse(`uncommitted changes:\n${dirty}`)

const evidence = readEvidence(root)
if (evidence.totals.size === 0) {
  refuse('its evidence records no token totals, so a rebuild could not rank without rescanning')
}

const { SOURCES } = await import(join(root, 'sources.mjs'))
const missing = SOURCES.filter((source) => !evidence.totals.has(source.id)).map((one) => one.id)
if (missing.length > 0) refuse(`the evidence has no total for ${missing.join(', ')}`)

/** What every language needs, so the shared cache is not cut out from under one of them. */
const claims = new Map()
for (const name of readdirSync(SIBLINGS).filter((one) => one.startsWith(PREFIX))) {
  const other = name.slice(PREFIX.length)
  let module
  try {
    module = await import(join(SIBLINGS, name, 'sources.mjs'))
  } catch {
    // A language whose sources will not load cannot be shown to be safe, so nothing is deleted
    // on its behalf and nothing is deleted that it might have claimed.
    refuse(`${other}'s sources.mjs will not load, so its claims are unknown`)
  }
  for (const source of module.SOURCES ?? []) {
    if (source.needs === undefined) continue
    const top = source.needs.split('/.cache/raw/')[1]?.split('/')[0]
    if (top === undefined) continue
    claims.set(top, [...(claims.get(top) ?? []), other])
  }
}

const sizeOf = (path) => {
  const info = statSync(path)
  if (info.isFile()) return info.size
  let total = 0
  for (const entry of readdirSync(path)) total += sizeOf(join(path, entry))
  return total
}

const mine = [...claims]
  .filter(([, langs]) => langs.length > 0 && langs.every((one) => one === tag))
  .map(([file]) => file)
  .filter((file) => existsSync(join(CACHE, file)))
  // Books are exempt while they are still being gathered. Retirement asks "can the evidence
  // stand without this", and for a finished collection the answer is yes — but a collection
  // still growing is not finished, and deleting it mid-fetch throws away the next rebuild's
  // gain and sends the downloader back to the start. French lost three hundred books this way,
  // one minute after they earned it seventeen points.
  .filter((file) => !file.startsWith('archive-'))

let freed = 0
for (const file of mine) {
  const bytes = sizeOf(join(CACHE, file))
  freed += bytes
  process.stdout.write(`  ${(bytes / 1024 ** 3).toFixed(2).padStart(6)} GB  ${file}\n`)
  if (!dryRun) rmSync(join(CACHE, file), { recursive: true, force: true })
}

const shared = [...claims]
  .filter(([, langs]) => langs.includes(tag) && langs.some((one) => one !== tag))
  .map(([file, langs]) => `${file} (also ${langs.filter((one) => one !== tag).join(', ')})`)
if (shared.length > 0) process.stdout.write(`  kept, claimed by others: ${shared.join(', ')}\n`)

process.stdout.write(
  `${dryRun ? 'would free' : 'freed'} ${(freed / 1024 ** 3).toFixed(2)} GB; ` +
    `${tag} rebuilds from ${String(evidence.totals.size)} recorded collections\n`,
)
