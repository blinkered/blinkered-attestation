/**
 * Getting documents out of the shapes collections actually arrive in.
 *
 * Every reader answers the same question — what is one document, and what is the smallest
 * string that points back at it — and answers it differently, because that is the only thing
 * collections genuinely differ about. Tatoeba numbers every sentence. A wiki dump numbers every
 * page. A crawl numbers nothing and has to carry URLs.
 *
 * Each one is split in two: a generator over lines, which holds all the reasoning and can be
 * tested with an array, and a thin wrapper that opens the file. The parsing is where the bugs
 * are, so the parsing is the part that must not need a 6GB fixture to exercise.
 */

import { spawn } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { asyncBufferFromFile, parquetMetadataAsync, parquetReadObjects } from 'hyparquet'
import type { Document } from './scan.js'

type Lines = Iterable<string> | AsyncIterable<string>

/**
 * Tatoeba's per-language export: `id<TAB>lang<TAB>text`, one sentence a line.
 *
 * The id is the whole point of using it. A sentence id resolves to a page showing that exact
 * sentence, so an attestation here is as checkable as evidence gets — which matters most for
 * the languages where every other collection is thin.
 */
export async function* tatoebaRows(lines: Lines): AsyncGenerator<Document> {
  for await (const line of lines) {
    if (line === '') continue
    const columns = line.split('\t')
    // Three columns or it is not a sentence row. A short row means a truncated download, and
    // reading it as an empty sentence would quietly understate the collection rather than fail.
    if (columns.length < 3) continue
    yield { locator: columns[0] as string, text: columns[2] as string }
  }
}

export function tatoebaDocuments(path: string): AsyncGenerator<Document> {
  return tatoebaRows(createInterface({ input: createReadStream(path), crlfDelay: Infinity }))
}

/** Only namespace zero is an article; everything else is talk pages and project bookkeeping. */
const ARTICLE = 0

/**
 * Pages out of a MediaWiki `pages-articles` dump.
 *
 * The page id is captured rather than the revision id, because `?curid=` points at the page as
 * it stands — which is what somebody checking the claim wants to see — and does not rot the
 * next time the page is edited.
 */
export async function* wikiPages(lines: Lines): AsyncGenerator<Document> {
  let pageId: string | null = null
  let namespace: number | null = null
  let seenId = false
  let held: string[] = []
  let inText = false

  for await (const line of lines) {
    if (line.includes('<page>')) {
      pageId = null
      namespace = null
      seenId = false
      held = []
      inText = false
      continue
    }

    if (inText) {
      const close = line.indexOf('</text>')
      if (close === -1) {
        held.push(line)
      } else {
        held.push(line.slice(0, close))
        inText = false
        if (namespace === ARTICLE && pageId !== null) {
          yield { locator: pageId, text: strip(held.join('\n')) }
        }
      }
      continue
    }

    // The first <id> inside a page is the page's own. Later ones belong to the revision and to
    // whoever made it, so the flag is doing more work here than the tag is.
    if (!seenId) {
      const id = /<id>(\d+)<\/id>/u.exec(line)
      if (id !== null) {
        pageId = id[1] as string
        seenId = true
        continue
      }
    }
    const ns = /<ns>(-?\d+)<\/ns>/u.exec(line)
    if (ns !== null) {
      namespace = Number(ns[1])
      continue
    }

    const open = /<text\b[^>]*>/u.exec(line)
    if (open === null) continue
    const from = open.index + open[0].length
    const close = line.indexOf('</text>', from)
    if (close === -1) {
      held = [line.slice(from)]
      inText = true
    } else if (namespace === ARTICLE && pageId !== null) {
      yield { locator: pageId, text: strip(line.slice(from, close)) }
    }
  }
}

/**
 * Streams a bz2 dump through a decompressor.
 *
 * The smallest of these is a few hundred megabytes compressed and the largest several gigabytes,
 * none of it wanted twice, so it goes through a pipe rather than into memory.
 */
export async function* wikiDocuments(path: string): AsyncGenerator<Document> {
  const bunzip = spawn('bzip2', ['-dc', path], { stdio: ['ignore', 'pipe', 'inherit'] })
  const lines = createInterface({ input: bunzip.stdout, crlfDelay: Infinity })
  yield* wikiPages(lines)

  await new Promise<void>((resolve, reject) => {
    bunzip.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`bzip2 exited ${String(code)}`))
    })
    bunzip.on('error', reject)
  })
}

/**
 * A directory of plain-text books, one file per book, named by the identifier that locates it.
 *
 * Project Gutenberg's shape, and the reason it is worth the thousands of small requests it
 * takes to assemble: a Gutenberg number is permanent, and published books are a register that
 * a curated sentence bank and an encyclopedia between them do not reach.
 */
export async function* fileDocuments(
  files: Iterable<{ readonly locator: string; readonly path: string }>,
  read: (path: string) => Promise<string>,
): AsyncGenerator<Document> {
  for (const file of files) yield { locator: file.locator, text: await read(file.path) }
}

/**
 * A Leipzig corpus package: one sentence per line, cited by the page it was taken from.
 *
 * Leipzig ships the citation in pieces — `sentences.txt` has the text, `inv_so.txt` maps a
 * sentence to a source, `sources.txt` maps a source to a URL and a date — so the URL is
 * resolved here and stored whole. Two hops at read time beats an evidence file nobody can check
 * without first downloading a 200MB package to resolve it against.
 *
 * **Sentences with no source are skipped, not counted.** Only 454,000 of the million sentences
 * in `deu_news_2024_1M` resolve to a URL; `inv_so.txt` simply has no row for the rest. Counting
 * a sighting we could never cite would put a number in the evidence file that the locator
 * column cannot support, which is the one kind of dishonesty this format exists to prevent.
 * Losing half a collection is the cheaper mistake.
 */
export async function* leipzigSentences(
  lines: Lines,
  urlFor: ReadonlyMap<string, string>,
): AsyncGenerator<Document> {
  for await (const line of lines) {
    const split = line.indexOf('\t')
    if (split <= 0) continue
    const url = urlFor.get(line.slice(0, split))
    if (url === undefined) continue
    yield { locator: url, text: line.slice(split + 1) }
  }
}

/**
 * Builds the sentence-to-URL map from a package's two index files.
 *
 * Both are small enough to hold: the largest is 710,000 rows, and the alternative is a random
 * seek per sentence.
 */
export function leipzigLocators(invSo: string, sources: string): ReadonlyMap<string, string> {
  const urlOf = new Map<string, string>()
  for (const line of sources.split('\n')) {
    const columns = line.split('\t')
    if (columns.length >= 2) urlOf.set(columns[0] as string, columns[1] as string)
  }
  const bySentence = new Map<string, string>()
  for (const line of invSo.split('\n')) {
    const columns = line.split('\t')
    if (columns.length < 2) continue
    const url = urlOf.get(columns[1] as string)
    if (url !== undefined) bySentence.set(columns[0] as string, url)
  }
  return bySentence
}

/**
 * A FineWeb-2 parquet shard: web documents, each carrying the URL it was crawled from.
 *
 * The reason this reader exists at all is Tagalog. Its own Leipzig packages repeat Wikipedia,
 * CC-100 has volume but no document ids of any kind, and OpenSubtitles is where the candidates
 * came from — so the web is the only fourth family available, and FineWeb-2 is the only form of
 * it that says which page each document was.
 *
 * Read a row group at a time rather than whole. A shard is three to five gigabytes and the rows
 * are wanted once each, in order.
 */
export interface CrawlRow {
  readonly text?: string
  readonly url?: string
}

/**
 * Crawl rows to documents, cited by the page each was crawled from.
 *
 * A row with no URL is skipped rather than counted. An attestation that cannot be checked is the
 * one thing this project does not ship, and a count the locator column cannot support is worse
 * than a slightly smaller collection — the same trade Leipzig makes, for the same reason.
 */
export function* crawlRows(rows: Iterable<CrawlRow>): Generator<Document> {
  for (const row of rows) {
    if (row.url === undefined || row.url === '' || row.text === undefined || row.text === '') {
      continue
    }
    yield { locator: row.url, text: row.text }
  }
}

export async function* fineweb2Documents(
  path: string,
  rowsPerBatch = 20_000,
): AsyncGenerator<Document> {
  const file = await asyncBufferFromFile(path)
  // The row count comes from the footer rather than from a batch coming back empty, so the loop
  // has a condition that can actually be false. A `for(;;)` that only ever leaves through a
  // `return` leaves an exit no test can reach, which is a coverage hole standing in for a
  // design one.
  const total = Number((await parquetMetadataAsync(file)).num_rows)
  for (let from = 0; from < total; from += rowsPerBatch) {
    const rows = (await parquetReadObjects({
      file,
      columns: ['text', 'url'],
      rowStart: from,
      rowEnd: Math.min(from + rowsPerBatch, total),
    })) as CrawlRow[]
    yield* crawlRows(rows)
  }
}

const GUTENBERG_START = /^\*\*\*+ ?START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK.*$/mu
const GUTENBERG_END = /^\*\*\*+ ?END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK.*$/mu

/**
 * The book, without the licence wrapped around it.
 *
 * Every Project Gutenberg file opens and closes with the same few hundred words of English
 * boilerplate. Left in, it is markup that repeats on every document — the same failure the wiki
 * stripper exists to prevent, and worse here, because a German collection would end up attesting
 * ANYONE, ANYWHERE and RESTRICTIONS a couple of thousand times each and rank them as common
 * German.
 *
 * A file with no start marker is **skipped rather than used whole**. All 2,382 German books
 * carry one, so a file without one is not a book in an older format, it is a file we have
 * misunderstood — and admitting boilerplate is a worse outcome than losing one book out of
 * thousands.
 */
export function gutenbergBody(text: string): string {
  const start = GUTENBERG_START.exec(text)
  if (start === null) return ''
  const from = start.index + start[0].length
  const end = GUTENBERG_END.exec(text)
  return end === null || end.index < from ? text.slice(from) : text.slice(from, end.index)
}

/**
 * Turns wikitext into something close enough to prose.
 *
 * Not a wikitext parser and it does not need to be. What it must get right is the markup that
 * would otherwise be counted as words — template names, link targets, HTML tags, and the
 * headings every article repeats — because those are what collect thousands of false hits. A
 * stray template parameter surviving costs one word one spurious hit; a template name surviving
 * puts a non-word into the dictionary.
 */
function strip(wikitext: string): string {
  return (
    wikitext
      .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gu, ' ')
      .replace(/<[^>]+>/gu, ' ')
      .replace(/\{\{[\s\S]*?\}\}/gu, ' ')
      .replace(/\{\|[\s\S]*?\|\}/gu, ' ')
      // A piped link shows its right-hand side; an unpiped one shows its target.
      .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/gu, '$1')
      .replace(/^[=]{2,}.*$/gmu, ' ')
      .replace(/&[a-z]+;/gu, ' ')
      .replace(/https?:\/\/\S+/gu, ' ')
  )
}
