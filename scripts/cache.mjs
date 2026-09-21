/**
 * What the shared cache holds, and which language each part of it belongs to.
 *
 * Disk is the binding constraint here, not time: the cache runs past eighty gigabytes and a
 * language's dumps are tens of gigabytes apiece. So the question "what can I delete" comes up
 * often, and answering it by eye is how German's entire Leipzig corpus nearly went — grepping
 * `sources.mjs` for cache paths misses every collection reached through a helper, which is most
 * of them.
 *
 * Every source declares `needs`, the path it will read. That is the authoritative answer and it
 * cannot drift from what the build actually opens, because the build uses the same field to
 * decide whether the collection is present at all. So this asks the modules, not the text.
 *
 *   node scripts/cache.mjs
 */
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const HERE = new URL('..', import.meta.url).pathname
const SIBLINGS = join(HERE, '..')
const CACHE = join(HERE, '.cache', 'raw')
const PREFIX = 'blinkered-dictionary-'

/** Every path any language says it needs, and who says so. */
const wanted = new Map()
for (const name of readdirSync(SIBLINGS).filter((entry) => entry.startsWith(PREFIX))) {
  const tag = name.slice(PREFIX.length)
  let module
  try {
    module = await import(join(SIBLINGS, name, 'sources.mjs'))
  } catch {
    // A language whose sources will not load tells us nothing about the cache, and refusing to
    // report the rest because of it would make this useless exactly when it is needed.
    continue
  }
  // Each repository reaches the cache through its own `.cache/raw` symlink, so `needs` is an
  // absolute path under *that* repository and never under this one. What matters is the first
  // segment after `.cache/raw/`: a Leipzig package names a directory full of files.
  for (const source of module.SOURCES ?? []) {
    if (source.needs === undefined) continue
    const after = source.needs.split('/.cache/raw/')[1]
    if (after === undefined) continue
    const top = after.split('/')[0]
    wanted.set(top, [...(wanted.get(top) ?? []), tag])
  }
}

const sizeOf = (path) => {
  const info = statSync(path)
  if (info.isFile()) return info.size
  let total = 0
  for (const entry of readdirSync(path)) total += sizeOf(join(path, entry))
  return total
}

// Answering "nothing is claimed" because every module failed to load would be an instruction to
// delete the entire cache. Better to say nothing at all.
if (wanted.size === 0) {
  throw new Error('no language declared anything it needs — refusing to call the cache unclaimed')
}

const gb = (bytes) => `${(bytes / 1024 ** 3).toFixed(2)} GB`
const rows = readdirSync(CACHE)
  .map((name) => ({ name, bytes: sizeOf(join(CACHE, name)), by: wanted.get(name) ?? [] }))
  .sort((left, right) => right.bytes - left.bytes)

let claimed = 0
let loose = 0
for (const row of rows) {
  if (row.by.length > 0) claimed += row.bytes
  else loose += row.bytes
  process.stdout.write(
    `  ${gb(row.bytes).padStart(9)}  ${row.name.padEnd(30)} ` +
      `${row.by.length === 0 ? 'unclaimed' : row.by.join(' ')}\n`,
  )
}
process.stdout.write(
  `\n  ${gb(claimed)} claimed by a language, ${gb(loose)} unclaimed.\n` +
    '  Unclaimed is safe to delete. Claimed is not, even for a language already committed: ' +
    'a rebuild needs every collection back.\n',
)

// Unclaimed usually means leftovers. It can also mean a language is not reading a collection it
// paid to download, and that fault is silent everywhere else: German sat at 98.4% with 778 books
// it never opened, because its source object had been pasted inside the LEIPZIG array of package
// names and the build skipped `lz:[object Object]` with a warning nobody reads. Tagalog was the
// same fault with no source declared at all.
//
// Comparing what a language declares against what its evidence holds does not find either one. A
// broken source un-declares itself — `SOURCES` drops anything whose path is missing — so there is
// nothing left to compare. The disk is the one record the fault cannot erase, which is why this
// is the check, and why it can be made to fail rather than merely print.
if (process.argv.includes('--strict') && loose > 0) {
  process.stdout.write('\n  --strict: something on disk is read by nobody.\n')
  process.exitCode = 1
}
