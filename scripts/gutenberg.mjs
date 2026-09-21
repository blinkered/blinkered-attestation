/**
 * Fetches one language's Project Gutenberg shelf into the shared cache.
 *
 * Gutenberg is a different family from the Internet Archive and a much cleaner one: these are
 * proofread transcriptions rather than OCR, which is why the legibility floor was calibrated
 * against them — clean Gutenberg scores a median 52% known words and never below 36%, and the
 * worst Archive scan scored 1%.
 *
 * The shelf had been gathered by hand, which is why no script existed and why every shelf
 * vanished the first time a language was retired. Finnish has 3,681 texts, Dutch 1,114 and
 * Italian 1,109; that is worth a tool.
 *
 * One request a second, which is what Gutenberg asks for. It skips what it already has, so this
 * can be interrupted and run again.
 *
 *   node scripts/gutenberg.mjs it 1200
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { USER_AGENT } from '../dist/src/index.js'

const [tag, wanted = '2000', filed = tag] = process.argv.slice(2)
if (tag === undefined) {
  throw new Error('usage: node scripts/gutenberg.mjs <tag> [count] [catalogue language]')
}

const CACHE = join(new URL('..', import.meta.url).pathname, '.cache', 'raw')
const CATALOGUE = join(CACHE, 'pg_catalog.csv')
const OUT = join(CACHE, `gutenberg-${tag}`)
mkdirSync(OUT, { recursive: true })

if (!existsSync(CATALOGUE)) {
  throw new Error(`no catalogue at ${CATALOGUE} — fetch pg_catalog.csv first`)
}

/**
 * The catalogue is a CSV whose titles contain commas and quotes, so it is parsed rather than
 * split. Only what is needed: the id and the language column.
 */
function* rows(text) {
  let field = ''
  let row = []
  let quoted = false
  for (let at = 0; at < text.length; at += 1) {
    const ch = text[at]
    if (quoted) {
      if (ch === '"') {
        if (text[at + 1] === '"') {
          field += '"'
          at += 1
        } else quoted = false
      } else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field.replace(/\r$/u, ''))
      yield row
      row = []
      field = ''
    } else field += ch
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    yield row
  }
}

const catalogue = rows(readFileSync(CATALOGUE, 'utf8'))
const header = catalogue.next().value
const idAt = header.indexOf('Text#')
const typeAt = header.indexOf('Type')
const langAt = header.indexOf('Language')

// A book may list several languages; a bilingual edition is half another language and is not
// worth the contamination. Only texts filed under this language alone.
const ids = []
for (const row of catalogue) {
  if (row[typeAt] !== 'Text' || row[langAt] !== filed) continue
  ids.push(row[idAt])
}

const already = new Set(readdirSync(OUT).map((name) => name.replace(/\.txt$/u, '')))
const todo = ids.filter((id) => !already.has(id)).slice(0, Number(wanted))
process.stderr.write(
  `${tag}: ${String(ids.length)} texts in the catalogue, ${String(already.size)} already here, ` +
    `fetching ${String(todo.length)}\n`,
)

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
let got = 0
let missing = 0
for (const id of todo) {
  // The cache path, not the catalogue page: `/ebooks/{id}` is a listing and holds no word of the
  // book. This is the same mistake the Archive locators made and it is worth not repeating.
  const url = `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`
  let text = null
  try {
    const answer = await fetch(url, { headers: { 'user-agent': USER_AGENT } })
    if (answer.ok) text = await answer.text()
  } catch {
    text = null
  }
  await wait(1000)
  if (text === null || text.length < 2000) {
    missing += 1
    continue
  }
  // Written under a temporary name and renamed, so an interrupted fetch never leaves a half
  // book that a later run would treat as complete.
  const part = join(OUT, `.${id}.part`)
  writeFileSync(part, text)
  renameSync(part, join(OUT, `${id}.txt`))
  got += 1
  if (got % 50 === 0) process.stderr.write(`  ${String(got)} texts\n`)
}
process.stderr.write(`${tag}: ${String(got)} fetched, ${String(missing)} unavailable\n`)
