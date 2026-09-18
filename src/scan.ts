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
export async function scan(
  source: string,
  documents: Iterable<Document> | AsyncIterable<Document>,
  candidates: ReadonlySet<string>,
  fold: (raw: string) => string,
): Promise<ScanResult> {
  // One entry per word, built up in place. Counting into one map and sampling into another
  // would leave the two to be recombined at the end against a key that must be in both — and a
  // fallback for a case that cannot arise is a branch no test can reach honestly.
  const hits = new Map<string, { count: number; locators: string[] }>()
  let tokens = 0

  for await (const document of documents) {
    for (const match of document.text.matchAll(TOKEN)) {
      const key = fold(match[0].normalize('NFC'))
      if (key.length < SHORTEST) continue
      tokens += 1
      if (!candidates.has(key)) continue

      const hit = hits.get(key)
      if (hit === undefined) {
        hits.set(key, { count: 1, locators: [document.locator] })
        continue
      }
      hit.count += 1
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
