/**
 * Where an attestation points, and how a short identifier becomes a link somebody can open.
 *
 * The whole claim this project makes rests on a reader being able to check it. "SCHADE occurs
 * in three independent collections" is worth nothing if the three cannot be visited, so every
 * source registered here has to answer one question: given a document you found a word in,
 * what is the smallest durable string that gets a person back to that document?
 *
 * Two answers, and the difference is the difference between a small evidence file and a large
 * one. A collection with stable per-document identifiers — a Wikipedia page id, a Gutenberg
 * ebook number, a Tatoeba sentence id — costs six or seven bytes a hit and expands through a
 * template. A web crawl has no such thing, so the locator is the page URL itself and costs
 * sixty. Both are legitimate; only one is cheap, and the registry records which is which so
 * nobody has to guess from the data.
 */

/** How a locator turns back into something a person can open. */
export type LocatorKind =
  /** `{id}` is substituted; the stored locator is a short identifier. */
  | { readonly kind: 'template'; readonly template: string }
  /** The stored locator is already a URL. Costs more bytes; used where there is no id. */
  | { readonly kind: 'url' }

export interface SourceSpec {
  /**
   * Short, stable, and written into every evidence line, so it is worth keeping to three or
   * four characters. It is also the identity a language's evidence is keyed by: renaming one
   * invalidates every file that used it, which is why `SOURCES` is append-mostly.
   */
  readonly id: string
  readonly name: string
  /** Who to credit. Recorded because we cite these collections, not because they license us. */
  readonly attribution: string
  readonly locator: LocatorKind
  /**
   * Who gathered it, which is not the same question as which collection it is.
   *
   * A wiki dump and a Wikisource dump are two collections and one Wikimedia; five years of
   * Leipzig news are five collections and one crawler. Counting those as three independent
   * sightings would let a word clear the rule on the word of a single organization, which is
   * the thing the rule exists to prevent. Families are compared, not ids, when the question is
   * whether the evidence is really independent.
   */
  readonly family: string
  /**
   * Whether this collection's counts are worth ranking by. Everything ranks unless it says not.
   *
   * A collection assembled by searching for the words themselves is evidence that a word exists
   * and evidence of nothing else. Its token total is whatever the search happened to return, so
   * a rate taken against it would say that the rarest words in the language are the commonest —
   * they are the only ones that were searched for. It attests; it does not rank.
   */
  readonly ranks?: false
}

/**
 * Separators the evidence format spends, and which therefore cannot appear in a source id.
 *
 * A tab splits columns, a comma splits the sources within a column, and a colon splits a
 * locator from its source. A space splits locators from each other. An id carrying any of them
 * would parse as two fields and the parser would not notice, which is the failure worth
 * refusing up front rather than debugging later.
 */
const RESERVED = /[\t,: ]/u

/** Refuses a source that would corrupt the file format it is written into. */
export function validateSourceId(id: string): void {
  if (id === '') throw new Error('source id is empty')
  if (RESERVED.test(id)) throw new Error(`source id "${id}" contains a reserved character`)
}

/**
 * Turns a stored locator back into a URL.
 *
 * For a `url` source the locator is returned unchanged, which is not laziness: the stored
 * string genuinely is the answer, and pretending otherwise would mean inventing a template
 * that expands to its own input.
 */
export function expandLocator(spec: SourceSpec, locator: string): string {
  if (spec.locator.kind === 'url') return locator
  return spec.locator.template.replace('{id}', locator)
}

const template = (
  id: string,
  family: string,
  name: string,
  attribution: string,
  url: string,
): SourceSpec => ({ id, family, name, attribution, locator: { kind: 'template', template: url } })

const web = (id: string, family: string, name: string, attribution: string): SourceSpec => ({
  id,
  family,
  name,
  attribution,
  locator: { kind: 'url' },
})

/**
 * The collections we cite, and the shorthand each is cited by.
 *
 * Deliberately a flat list rather than a per-language one. Which sources cover which language
 * is a fact about the language and belongs in that language's own repository; what belongs
 * here is only the promise that `gut:21034` means the same thing everywhere it is written.
 */
export const SOURCES: readonly SourceSpec[] = [
  template(
    'gut',
    'gutenberg',
    'Project Gutenberg',
    'Project Gutenberg contributors',
    'https://www.gutenberg.org/ebooks/{id}',
  ),
  template(
    'tat',
    'tatoeba',
    'Tatoeba',
    'Tatoeba contributors',
    'https://tatoeba.org/en/sentences/show/{id}',
  ),

  // One entry per wiki rather than one for all of them, because the host differs per language
  // and a locator that needs two fields to resolve is not a locator. All one family: a
  // Wikipedia and a Wikisource are two collections and one Wikimedia.
  template(
    'dewiki',
    'wikimedia',
    'German Wikipedia',
    'German Wikipedia contributors',
    'https://de.wikipedia.org/?curid={id}',
  ),
  template(
    'dewikisource',
    'wikimedia',
    'German Wikisource',
    'German Wikisource contributors',
    'https://de.wikisource.org/?curid={id}',
  ),
  template(
    'tlwiki',
    'wikimedia',
    'Tagalog Wikipedia',
    'Tagalog Wikipedia contributors',
    'https://tl.wikipedia.org/?curid={id}',
  ),
  template(
    'tlwikisource',
    'wikimedia',
    'Tagalog Wikisource',
    'Tagalog Wikisource contributors',
    'https://tl.wikisource.org/?curid={id}',
  ),

  // Leipzig resolves a sentence through two index files to the page it came from, so the URL
  // is stored whole rather than as an id nobody could expand without the package in hand.
  // Every package is one family: five years of the same crawler is not five opinions.
  web('lznews', 'leipzig', 'Leipzig, German news 2024', 'Leipzig Corpora, deu_news_2024_1M'),
  web('lznews23', 'leipzig', 'Leipzig, German news 2023', 'Leipzig Corpora, deu_news_2023_1M'),
  web('lznews22', 'leipzig', 'Leipzig, German news 2022', 'Leipzig Corpora, deu_news_2022_1M'),
  web('lznews21', 'leipzig', 'Leipzig, German news 2021', 'Leipzig Corpora, deu_news_2021_1M'),
  web(
    'lzcrawl18',
    'leipzig',
    'Leipzig, German newscrawl 2018',
    'Leipzig Corpora, deu_newscrawl-public_2018_1M',
  ),
  web('lzweb', 'leipzig', 'Leipzig, German web 2021', 'Leipzig Corpora, deu-de_web_2021_1M'),
  web(
    'lzwebat',
    'leipzig',
    'Leipzig, Austrian German web 2019',
    'Leipzig Corpora, deu-at_web_2019_1M',
  ),

  template(
    'ebiblede',
    'ebible',
    'German Bible (Elberfelder 1905)',
    'eBible.org, Elberfelder 1905',
    'https://ebible.org/deuelo/{id}.htm',
  ),
  template(
    'ebibletl',
    'ebible',
    'Tagalog Bible (tglulb)',
    'eBible.org, Tagalog Unlocked Literal Bible',
    'https://ebible.org/tglulb/{id}.htm',
  ),

  web('cc', 'commoncrawl', 'Common Crawl', 'Common Crawl Foundation'),
  web('fw2', 'commoncrawl', 'FineWeb-2', 'FineWeb-2, from Common Crawl'),

  // Pages found by searching for the word itself and then checked for it, which is how the
  // last few hundred words of a language get attested once the bulk collections are exhausted.
  { ...web('search', 'search', 'Web search', "the page's own publisher"), ranks: false },
]

const BY_ID = new Map(SOURCES.map((source) => [source.id, source]))

/** Looks a source up, refusing an unknown id rather than returning a hole. */
export function sourceFor(id: string): SourceSpec {
  const spec = BY_ID.get(id)
  if (spec === undefined) throw new RangeError(`no registered source "${id}"`)
  return spec
}
