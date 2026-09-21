/**
 * Fills in the text filename for books fetched before the name was being recorded.
 *
 * A locator has to name the text. `archive.org/details/<id>` is the catalogue page and holds no
 * word of the book, so a citation built from the id alone fails verification for a reason that
 * has nothing to do with the sighting — the same defect Gutenberg had.
 */
import { appendFileSync, existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { USER_AGENT } from '../dist/src/index.js'

const tag = process.argv[2]
if (tag === undefined) throw new Error('usage: node scripts/archive-names.mjs <language>')
const dir = join(new URL('..', import.meta.url).pathname, '.cache', 'raw', `archive-${tag}`)
const manifest = join(dir, 'files.tsv')

const known = new Set(
  existsSync(manifest)
    ? readFileSync(manifest, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => line.split('\t')[0])
    : [],
)
const ids = readdirSync(dir)
  .filter((name) => name.endsWith('.txt'))
  .map((name) => name.replace(/\.txt$/u, ''))
  .filter((id) => !known.has(id))

process.stderr.write(`${tag}: ${String(ids.length)} books need their text filename\n`)
let found = 0
for (const id of ids) {
  try {
    const answer = await fetch(`https://archive.org/metadata/${id}`, {
      headers: { 'user-agent': USER_AGENT },
    })
    if (!answer.ok) continue
    const text = ((await answer.json()).files ?? []).find((one) => one.format === 'DjVuTXT')
    if (text === undefined) continue
    appendFileSync(manifest, `${id}\t${text.name}\n`)
    found += 1
  } catch {
    // One unanswered item costs one item.
  }
  await new Promise((resolve) => setTimeout(resolve, 120))
}
process.stderr.write(`${tag}: recorded ${String(found)}\n`)
