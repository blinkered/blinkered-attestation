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
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { USER_AGENT } from '../dist/src/index.js'

const [tag, collection, wanted = '1500'] = process.argv.slice(2)
if (tag === undefined || collection === undefined) {
  throw new Error('usage: node scripts/archive.mjs <language tag> <archive collection> [count]')
}

const OUT = join(new URL('..', import.meta.url).pathname, '.cache', 'raw', `archive-${tag}`)
mkdirSync(OUT, { recursive: true })
const already = new Set(readdirSync(OUT).map((name) => name.replace(/\.txt$/u, '')))

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const get = async (url) => {
  try {
    const answer = await fetch(url, { headers: { 'user-agent': USER_AGENT } })
    return answer.ok ? answer : null
  } catch {
    return null
  }
}

// Only items that have extracted text, most-downloaded first: popularity is a rough but honest
// proxy for "a real book somebody scanned properly" rather than a stray upload.
const query =
  `https://archive.org/advancedsearch.php?q=` +
  `collection%3A${collection}+AND+format%3A%22DjVuTXT%22` +
  `&fl%5B%5D=identifier&sort%5B%5D=downloads+desc&rows=${String(Number(wanted) * 2)}&output=json`

const listed = await get(query)
if (listed === null) throw new Error('the Archive would not answer the search')
const ids = (await listed.json()).response.docs.map((one) => one.identifier)
process.stderr.write(
  `${tag}: ${String(ids.length)} candidate items, ${String(already.size)} held\n`,
)

let saved = 0
let bytes = 0
for (const id of ids) {
  if (saved >= Number(wanted)) break
  if (already.has(id)) continue

  // The text file is not always named after the item, so the metadata says which it is.
  const meta = await get(`https://archive.org/metadata/${id}`)
  await wait(200)
  if (meta === null) continue
  const files = (await meta.json()).files ?? []
  const text = files.find((one) => one.format === 'DjVuTXT')
  if (text === undefined) continue

  const body = await get(`https://archive.org/download/${id}/${encodeURIComponent(text.name)}`)
  await wait(200)
  if (body === null) continue
  const content = await body.text()
  // A few kilobytes is a title page or a failed scan, not a book.
  if (content.length < 20_000) continue

  writeFileSync(join(OUT, `${id}.txt`), content)
  saved += 1
  bytes += content.length
  if (saved % 50 === 0) {
    process.stderr.write(`  ${String(saved)} books, ${(bytes / 1024 ** 2).toFixed(0)}MB\n`)
  }
}

process.stderr.write(
  `${tag}: ${String(saved)} books, ${(bytes / 1024 ** 2).toFixed(0)}MB in archive-${tag}/\n`,
)
