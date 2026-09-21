/**
 * The evidence file: what we saw, where we saw it, and enough of a pointer to go and check.
 *
 * This file *is* the claim. A word list asserts that SCHADE is a German word; this asserts why
 * we believe it, in a form somebody can disagree with. That is the whole difference between
 * shipping a dictionary somebody else curated and shipping a list we can account for, so the
 * format is designed around being read by a sceptic rather than around being compact — though
 * it is compact, because a sceptic will not read 750MB either.
 *
 * ```
 * #blinkered/attestations/2 language=de words=2 sources=3 built=2026-09-18 digest=…
 * #tokens cc=1173847076 dewiki=221483630 gut=4183929
 * SCHADE	cc,dewiki,gut	412,88,7	cc:https://…/artikel dewiki:9912847 gut:21034
 * ABSEITS	cc,dewiki	130,12	cc:https://…/spiel dewiki:7740221
 * ```
 *
 * Four columns: the word, the sources that attest it, how many hits in each, and a sample
 * locator or two per source. Sources are sorted and counts are written in the same order, so a
 * rebuild over unchanged evidence produces identical bytes and a diff means something changed.
 *
 * **The `#tokens` line is what makes the collections disposable.** Ranking is occurrences per
 * million, so it needs each collection's total token count as a denominator. Version 1 computed
 * that number, used it, and threw it away — which meant every rebuild had to re-read twenty-four
 * gigabytes of Wikipedia to recover a number it had already had. Recording it turns this file
 * into the complete record of a scan: what was seen, where, and out of how much. The dump can
 * then be deleted, and a later build that adds a family reuses these lines instead of reading
 * the text again.
 *
 * Version 1 files parse, with no totals. They cannot be ranked without rescanning, which is the
 * state every language was in before this.
 */

/** One collection's testimony about one word. */
export interface Attestation {
  /** A registered source id; see `registry.ts`. */
  readonly source: string
  /** How many times the word was seen in this collection. */
  readonly count: number
  /**
   * Where to look, at most `SAMPLES_PER_SOURCE` of them.
   *
   * One sample can be a fluke — a scanning error, a foreign-language quotation, a page that
   * happens to list dictionary headwords. Two is a pattern. More than two is the regenerable
   * index's job and not this file's, because the point here is to let somebody check the
   * claim, not to reproduce the search.
   */
  readonly locators: readonly string[]
}

export interface WordEvidence {
  /** The folded key, exactly as the shipped word list spells it. */
  readonly word: string
  /** Sorted by source id, so the file is deterministic. */
  readonly attestations: readonly Attestation[]
}

export interface EvidenceFile {
  readonly language: string
  /** ISO date the evidence was gathered. Collections move; a claim without a date is weaker. */
  readonly built: string
  readonly words: readonly WordEvidence[]
  readonly digest: string
  /**
   * Playable tokens each collection held, which is the denominator of every rate.
   *
   * Empty for a version 1 file, which recorded no totals and therefore cannot be re-ranked
   * without re-reading the collections themselves.
   */
  readonly totals: ReadonlyMap<string, number>
}

export const SAMPLES_PER_SOURCE = 2

const HEADER = '#blinkered/attestations/'
const VERSION = 2
/** The line that records how much text each collection held. */
const TOKENS = '#tokens '

/**
 * A content digest of the body, so a word list can name the evidence it was built from.
 *
 * FNV-1a over two 32-bit lanes. Deliberately the same construction Blinkered's word lists use
 * (`digestOf` in `packages/words/src/pipeline.ts`) so the two kinds of file can be compared by
 * eye, and deliberately copied rather than imported: twelve pure lines are not worth a
 * dependency between two repositories that are otherwise independent.
 */
export function digestOf(body: string): string {
  let low = 0x811c9dc5
  let high = 0x01000193
  for (let at = 0; at < body.length; at += 1) {
    const code = body.charCodeAt(at)
    low = Math.imul(low ^ code, 0x01000193)
    high = Math.imul(high ^ (code + at), 0x85ebca6b)
  }
  const hex = (value: number): string => (value >>> 0).toString(16).padStart(8, '0')
  return hex(low) + hex(high)
}

function line(evidence: WordEvidence): string {
  const sorted = [...evidence.attestations].sort((left, right) =>
    left.source.localeCompare(right.source),
  )
  const sources = sorted.map((attestation) => attestation.source).join(',')
  const counts = sorted.map((attestation) => String(attestation.count)).join(',')
  const locators = sorted
    .flatMap((attestation) =>
      attestation.locators.slice(0, SAMPLES_PER_SOURCE).map((locator) => {
        // The format spends spaces separating locators, so one cannot contain a space: it would
        // split in two and each half would be read as a citation. Two thirds of Internet Archive
        // filenames have spaces in them, so this is a live hazard rather than a theoretical one,
        // and a corrupted citation is worse than a refused build.
        if (locator.includes(' ')) {
          throw new Error(`${evidence.word} has a locator with a space in it: ${locator}`)
        }
        return `${attestation.source}:${locator}`
      }),
    )
    .join(' ')
  return `${evidence.word}\t${sources}\t${counts}\t${locators}`
}

export function formatEvidence(
  language: string,
  built: string,
  words: readonly WordEvidence[],
  totals: ReadonlyMap<string, number> = new Map(),
): string {
  const sources = new Set(
    words.flatMap((word) => word.attestations.map((attestation) => attestation.source)),
  )
  // Sorted, so a rebuild over unchanged evidence produces identical bytes.
  const counted = [...totals]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([source, tokens]) => `${source}=${String(tokens)}`)
    .join(' ')
  const tokens = counted === '' ? '' : `${TOKENS}${counted}\n`
  const body = `${tokens}${words.map(line).join('\n')}\n`
  const head =
    `${HEADER}${String(VERSION)} language=${language} words=${String(words.length)} ` +
    `sources=${String(sources.size)} built=${built}`
  // Over the body alone, which now includes the totals: the header carries the digest, so
  // hashing the header would make the value depend on itself.
  return `${head} digest=${digestOf(body)}\n${body}`
}

function fields(head: string): Map<string, string> {
  const found = new Map<string, string>()
  for (const field of head
    .replace(/^#blinkered\/attestations\/\d+/u, '')
    .trim()
    .split(/\s+/u)) {
    const split = field.indexOf('=')
    if (split > 0) found.set(field.slice(0, split), field.slice(split + 1))
  }
  return found
}

/**
 * Reads an evidence file back, strictly.
 *
 * Strict for the same reason Blinkered's word list parser is: a truncated download and a dev
 * server's index page both look like text, and evidence that silently parsed as nothing would
 * be worse than an error — it would be a claim we could no longer support without knowing it.
 */
export function parseEvidence(text: string): EvidenceFile {
  const lines = text.split('\n')
  // `split` always yields at least one element, so there is always a header to look at.
  const head = lines[0] as string
  if (!head.startsWith(HEADER)) throw new Error('not a Blinkered attestation file')

  const found = fields(head)
  const language = found.get('language') ?? ''
  const expected = Number(found.get('words'))

  const rest = lines.slice(1)
  // Version 2 records each collection's token total on the line after the header. A version 1
  // file has none, and parses into an empty map rather than failing: its words are still
  // evidence, it just cannot be re-ranked without rescanning.
  const totals = new Map<string, number>()
  const counted = rest[0]?.startsWith(TOKENS) === true
  if (counted) {
    for (const field of (rest[0] as string).slice(TOKENS.length).trim().split(/\s+/u)) {
      const split = field.lastIndexOf('=')
      if (split <= 0) throw new Error(`attestations for "${language}" have a malformed total`)
      const tokens = Number(field.slice(split + 1))
      if (!Number.isInteger(tokens) || tokens < 0) {
        throw new Error(`attestations for "${language}" have a non-numeric total`)
      }
      totals.set(field.slice(0, split), tokens)
    }
  }

  const entries = rest.slice(counted ? 1 : 0).filter((entry) => entry !== '')
  if (!Number.isInteger(expected) || entries.length !== expected) {
    throw new Error(`attestations for "${language}" are truncated or mislabelled`)
  }

  const words = entries.map((entry) => parseLine(entry, language))
  return {
    language,
    built: found.get('built') ?? '',
    words,
    digest: found.get('digest') ?? '',
    totals,
  }
}

function parseLine(entry: string, language: string): WordEvidence {
  const columns = entry.split('\t')
  if (columns.length < 3) {
    throw new Error(`attestations for "${language}" have a malformed line: ${entry}`)
  }
  // Length-checked above. The fourth column is optional: a word every source saw without a
  // recorded sample writes an empty one, and a hand-edited file may omit it entirely.
  const word = columns[0] as string
  const sources = columns[1] as string
  const counts = columns[2] as string
  const locators = columns[3] ?? ''

  // An empty sources column means no collection saw this word, which is a finding worth
  // recording rather than an absence. `''.split(',')` yields one empty string rather than none,
  // so without this a word nothing attests parses as one attestation from a source called ""
  // — which then fails conformance twice over, for naming an unregistered source and for
  // citing no document. Found by running the conformance check against a real build.
  const ids = sources === '' ? [] : sources.split(',')
  const numbers = counts === '' ? [] : counts.split(',')
  // The one invariant worth checking on every line. Sources and counts are two lists written
  // in the same order, and nothing else in the file would notice them drifting apart.
  if (ids.length !== numbers.length) {
    throw new Error(
      `"${word}" in ${language} has ${String(ids.length)} sources and ` +
        `${String(numbers.length)} counts`,
    )
  }

  // A locator is `<source>:<rest>`, and the source id may itself contain colons — `wiki:fr`,
  // `web:lemonde.fr`. Splitting on the first colon would file `wiki:fr:12345` under `wiki`, so
  // the prefix is matched against the sources this line already declares, longest first. That
  // keeps the format readable and needs no separator that a URL might contain.
  const byLength = [...ids].sort((left, right) => right.length - left.length)
  const sampled = new Map<string, string[]>()
  for (const locator of locators === '' ? [] : locators.split(' ')) {
    const id = byLength.find((source) => locator.startsWith(`${source}:`))
    if (id === undefined) {
      throw new Error(`"${word}" in ${language} has a malformed locator: ${locator}`)
    }
    sampled.set(id, [...(sampled.get(id) ?? []), locator.slice(id.length + 1)])
  }

  const attestations = ids.map((id, at) => {
    const count = Number(numbers[at])
    if (!Number.isInteger(count) || count < 0) {
      throw new Error(`"${word}" in ${language} has a non-numeric count for ${id}`)
    }
    return { source: id, count, locators: sampled.get(id) ?? [] }
  })
  return { word, attestations }
}
