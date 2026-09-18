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

const template = (id: string, name: string, attribution: string, url: string): SourceSpec => ({
  id,
  name,
  attribution,
  locator: { kind: 'template', template: url },
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
    'Project Gutenberg',
    'Project Gutenberg contributors',
    'https://www.gutenberg.org/ebooks/{id}',
  ),
  template('tat', 'Tatoeba', 'Tatoeba contributors', 'https://tatoeba.org/en/sentences/show/{id}'),
  // One entry per wiki rather than one for all of them, because the host differs per language
  // and a locator that needs two fields to resolve is not a locator.
  template(
    'dewiki',
    'German Wikipedia',
    'German Wikipedia contributors',
    'https://de.wikipedia.org/?curid={id}',
  ),
  template(
    'dewikisource',
    'German Wikisource',
    'German Wikisource contributors',
    'https://de.wikisource.org/?curid={id}',
  ),
  template(
    'tlwiki',
    'Tagalog Wikipedia',
    'Tagalog Wikipedia contributors',
    'https://tl.wikipedia.org/?curid={id}',
  ),
  {
    id: 'cc',
    name: 'Common Crawl',
    attribution: 'Common Crawl Foundation',
    locator: { kind: 'url' },
  },
]

const BY_ID = new Map(SOURCES.map((source) => [source.id, source]))

/** Looks a source up, refusing an unknown id rather than returning a hole. */
export function sourceFor(id: string): SourceSpec {
  const spec = BY_ID.get(id)
  if (spec === undefined) throw new RangeError(`no registered source "${id}"`)
  return spec
}
