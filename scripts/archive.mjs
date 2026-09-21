/**
 * Fetches a language's books from the Internet Archive, as a collection rather than a crawl.
 *
 * The drop lists all say the same thing: the stranded words are attested by a Wikipedia and one
 * other thing and need a third, and for literary vocabulary — ABALANZAR, АБАЖУРАМИ, ABAISSERAIT —
 * that third is books. German has a Gutenberg shelf and sits at 98%; Russian and Korean have none
 * and sit near 50%. That is the whole difference.
 *
 * Crawling literary archives was the wrong tool and it failed honestly: `lib.ru`, `zeno.org`,
 * `deutschestextarchiv.de` and `cervantesvirtual.com` predate sitemaps and returned nothing, and
 * half the "literary" domains that did answer turned out to be book *reviews* — modern journalism
 * in the same register as the newspapers they were meant to complement.
 *
 * The Archive is the opposite: bulk, permanent, and identified per work. A locator is an item id,
 * `https://archive.org/details/<id>` resolves forever, and the gatherer is nobody else on the
 * list. Its per-language book collections hold 74,000 Russian works and 236,000 German ones.
 *
 *   node scripts/archive.mjs ru russian 2000
 */
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { USER_AGENT } from '../dist/src/index.js'

const [tag, where, wanted = '1500'] = process.argv.slice(2)
if (tag === undefined || where === undefined) {
  throw new Error('usage: node scripts/archive.mjs <language tag> <collection or query> [count]')
}
// A bare name is a collection; anything with a field in it is a query. English needed the
// second: `booksbylanguage_english` holds 599 items while `americana` — the American Libraries
// scans — holds 2.7 million with text, and neither is Project Gutenberg.
const query = where.includes(':') ? where : `collection:${where}`

const OUT = join(new URL('..', import.meta.url).pathname, '.cache', 'raw', `archive-${tag}`)
mkdirSync(OUT, { recursive: true })
const already = new Set(readdirSync(OUT).map((name) => name.replace(/\.txt$/u, '')))

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Fetches and reads a body, or gives up on it.
 *
 * Reading the body has to be inside the guard, not outside. A connection dropped halfway through
 * a four-megabyte book throws `TypeError: terminated` from `.text()`, long after `fetch()`
 * resolved — which ended a two-thousand-book run at a hundred and fifteen. One unlucky item must
 * cost one item.
 */
const read = async (url, as) => {
  try {
    const answer = await fetch(url, { headers: { 'user-agent': USER_AGENT } })
    if (!answer.ok) return null
    return as === 'json' ? await answer.json() : await answer.text()
  } catch {
    return null
  }
}

// Only items that have extracted text, most-downloaded first: popularity is a rough but honest
// proxy for "a real book somebody scanned properly" rather than a stray upload.
const url =
  `https://archive.org/advancedsearch.php?q=` +
  `${encodeURIComponent(`${query} AND format:"DjVuTXT"`)}` +
  `&fl%5B%5D=identifier&sort%5B%5D=downloads+desc&rows=${String(Number(wanted) * 2)}&output=json`

const listed = await read(url, 'json')
if (listed === null) throw new Error('the Archive would not answer the search')
const ids = listed.response.docs.map((one) => one.identifier)
process.stderr.write(
  `${tag}: ${String(ids.length)} candidate items, ${String(already.size)} held\n`,
)

let saved = 0
let bytes = 0
for (const id of ids) {
  if (saved >= Number(wanted)) break
  if (already.has(id)) continue

  // The text file is not always named after the item, so the metadata says which it is.
  const meta = await read(`https://archive.org/metadata/${id}`, 'json')
  await wait(200)
  if (meta === null) continue
  const text = (meta.files ?? []).find((one) => one.format === 'DjVuTXT')
  if (text === undefined) continue

  const content = await read(
    `https://archive.org/download/${id}/${encodeURIComponent(text.name)}`,
    'text',
  )
  await wait(200)
  if (content === null) continue
  // A few kilobytes is a title page or a failed scan, not a book.
  if (content.length < 20_000) continue

  // Written under another name and renamed into place, because a build may be reading this
  // directory at the same time — Tagalog's was, while its downloader ran. A rename is atomic on
  // one filesystem, so a scan sees either no file or a whole one, never half a book. The same
  // hazard as a harvest appending to searched.tsv under a build, which has its own interlock;
  // this one is cheaper to make impossible than to coordinate.
  //
  // The directory can also go while this runs — retirement deleted French's out from under it
  // mid-fetch and the write died with ENOENT — so it is recreated rather than given up on.
  const written = join(OUT, `${id}.txt`)
  const partial = `${written}.part`
  try {
    writeFileSync(partial, content)
  } catch {
    mkdirSync(OUT, { recursive: true })
    writeFileSync(partial, content)
  }
  renameSync(partial, written)
  // The text file is rarely named after the item — none of twelve sampled were — so a citation
  // built from the id alone points at the catalogue page, which holds no word of the book. That
  // is the defect Gutenberg had, and verification would report every book absent. The name is
  // recorded here so a locator can name the text itself.
  appendFileSync(join(OUT, 'files.tsv'), `${id}\t${text.name}\n`)
  saved += 1
  bytes += content.length
  if (saved % 50 === 0) {
    process.stderr.write(`  ${String(saved)} books, ${(bytes / 1024 ** 2).toFixed(0)}MB\n`)
  }
}

process.stderr.write(
  `${tag}: ${String(saved)} books, ${(bytes / 1024 ** 2).toFixed(0)}MB in archive-${tag}/\n`,
)
