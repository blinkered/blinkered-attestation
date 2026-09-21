/**
 * Reading a collection and writing down what it saw.
 *
 * One function does the counting for every source, because the differences between a Tatoeba
 * export, a wiki dump and a crawl are all differences about how to get documents out of a file
 * — not about what to do with the words once you have them. So each reader yields `Document`s
 * and this does the rest.
 *
 * **The fold has to be the game's own.** A corpus token only attests a word if it lands on the
 * same key the shipped list is written under, and that mapping is neither obvious nor uniform:
 * German ß folds to SS while Ä stays Ä, Turkish needs its own locale or ILIK and İLİK merge,
 * and Greek drops the tonos only when upper-casing. Re-deriving any of that here would produce
 * a second fold that agreed with the first until it quietly did not, so `@blinkered/engine`
 * supplies it and this module only applies it.
 */

/** A thing a locator can point at: one sentence, one page, one crawled document. */
export interface Document {
  /** Stored verbatim in the evidence file, under this source's id. */
  readonly locator: string
  readonly text: string
}

export interface Hit {
  readonly count: number
  readonly locators: readonly string[]
}

export interface ScanResult {
  readonly source: string
  /**
   * Playable tokens seen, which is the denominator a rate is taken against.
   *
   * Counted the way Blinkered counts coverage: tokens of three folded characters or more. One-
   * and two-letter words are half of any corpus and none of them is playable here, so counting
   * them would push every collection's rates down by the same uninformative factor.
   */
  readonly tokens: number
  readonly hits: ReadonlyMap<string, Hit>
}

/**
 * Letters, marks, and the apostrophes that sit inside a word rather than between two.
 *
 * The same expression Blinkered's corpus counter uses, and for the same reason: a token rule
 * that disagreed with the one the candidates were built from would attest the wrong strings.
 */
const TOKEN = /\p{L}[\p{L}\p{M}'’]*/gu

/** Below this a token is not a word this game can deal, so it is not part of the denominator. */
const SHORTEST = 3

const SAMPLES = 2

/**
 * Async so that one implementation serves every reader.
 *
 * A Tatoeba export fits in memory and a Wikipedia dump does not, so the readers that matter are
 * streams. `for await` consumes a plain array just as happily as a stream, so making this async
 * costs the in-memory case nothing and saves a second copy of the counting logic — which is the
 * copy that would have drifted.
 */
/**
 * How much of a document has to be words of the language before it counts as one.
 *
 * Scanned books come as OCR, and OCR fails in a way that looks like text. An English book run
 * through a Cyrillic model produces РКЕРА СЕ for PREFACE — pure Cyrillic, plausible shape,
 * meaning nothing. One such book in the evidence attests a hundred words that nobody ever wrote.
 *
 * The test is the share of a document's tokens that are words this language's list already
 * proposes. That is not circular: it does not decide whether a word is real, only whether a
 * document is legible enough to be evidence about anything. Clean Gutenberg text scores a median
 * of 52% in Spanish and French and never below 36%; the Russian OCR that caused this scored 1%.
 */
export async function scan(
  source: string,
  documents: Iterable<Document> | AsyncIterable<Document>,
  candidates: ReadonlySet<string>,
  fold: (raw: string) => string,
  legible = 0,
): Promise<ScanResult> {
  // One entry per word, built up in place. Counting into one map and sampling into another
  // would leave the two to be recombined at the end against a key that must be in both — and a
  // fallback for a case that cannot arise is a branch no test can reach honestly.
  const hits = new Map<string, { count: number; locators: string[] }>()
  let tokens = 0

  for await (const document of documents) {
    // Read the document into its own tally first, so an illegible one can be dropped whole. A
    // filter that let its tokens into the denominator would still be letting OCR noise decide
    // how common every other word is.
    const found = new Map<string, number>()
    let counted = 0
    let known = 0
    for (const match of document.text.matchAll(TOKEN)) {
      const key = fold(match[0].normalize('NFC'))
      if (key.length < SHORTEST) continue
      counted += 1
      if (!candidates.has(key)) continue
      known += 1
      found.set(key, (found.get(key) ?? 0) + 1)
    }
    if (legible > 0 && counted > 0 && known / counted < legible) continue

    tokens += counted
    for (const [key, count] of found) {
      const hit = hits.get(key)
      if (hit === undefined) {
        hits.set(key, { count, locators: [document.locator] })
        continue
      }
      hit.count += count
      // Distinct documents only. Two samples pointing at the same page prove one sighting
      // twice, which is the opposite of what a second sample is for.
      if (hit.locators.length < SAMPLES && !hit.locators.includes(document.locator)) {
        hit.locators.push(document.locator)
      }
    }
  }

  return { source, tokens, hits }
}

/**
 * The first `count` documents of a collection, for the cases where scanning all of it is not
 * worth the wall-clock.
 *
 * Japanese is why this exists. Every other language scans its corpora directly; Japanese has to
 * go through a morphological analyser first, and Sudachi reading a 2.2GB Wikipedia is hours of
 * work for a curve that has flattened long before the end. A few hundred thousand articles
 * attest a language's ordinary vocabulary perfectly well, and the drop list says plainly whether
 * that was enough.
 *
 * Recorded in the language's own sources file, so a reader can see the list was cut and by how
 * much rather than wondering why Japanese looks thin.
 */
export async function* take(
  documents: Iterable<Document> | AsyncIterable<Document>,
  count: number,
): AsyncGenerator<Document> {
  let taken = 0
  for await (const document of documents) {
    if (taken >= count) return
    taken += 1
    yield document
  }
}

/**
 * Scans harvested pages as one collection per registrable domain.
 *
 * This is what makes fetching pages worth the trouble. A single `search` source would be one
 * family however many sites it drew on, so a word found on five unrelated news sites would still
 * be one sighting. Split by domain and those are five families, which is both truer and the only
 * way the harvest can carry a word over the line rather than nudge it.
 *
 * Everything is held in memory, which is right for this collection and nothing else: a harvest
 * is a few thousand pages by construction. The bulk collections stream.
 */
export async function scanByDomain(
  documents: Iterable<Document> | AsyncIterable<Document>,
  candidates: ReadonlySet<string>,
  fold: (raw: string) => string,
  domainOf: (locator: string) => string,
): Promise<ScanResult[]> {
  const byDomain = new Map<string, Document[]>()
  for await (const document of documents) {
    const domain = domainOf(document.locator)
    const held = byDomain.get(domain)
    if (held === undefined) byDomain.set(domain, [document])
    else held.push(document)
  }

  const results: ScanResult[] = []
  for (const [domain, documents_] of byDomain) {
    results.push(await scan(`web:${domain}`, documents_, candidates, fold))
  }
  // Sorted, so a rebuild over an unchanged harvest produces the same evidence file.
  return results.sort((left, right) => left.source.localeCompare(right.source))
}

/**
 * Folds several collections' results into one word-keyed view.
 *
 * Returned sorted by key so that everything downstream — the evidence file, the diff a reviewer
 * reads — is deterministic without anyone having to remember to sort it.
 */
export function merge(results: readonly ScanResult[]): {
  readonly totals: ReadonlyMap<string, number>
  readonly words: ReadonlyMap<
    string,
    { source: string; count: number; locators: readonly string[] }[]
  >
} {
  const totals = new Map<string, number>()
  const words = new Map<string, { source: string; count: number; locators: readonly string[] }[]>()

  for (const result of results) {
    totals.set(result.source, result.tokens)
    for (const [key, hit] of result.hits) {
      const found = words.get(key) ?? []
      found.push({ source: result.source, count: hit.count, locators: hit.locators })
      words.set(key, found)
    }
  }
  return { totals, words: new Map([...words].sort(([left], [right]) => left.localeCompare(right))) }
}
