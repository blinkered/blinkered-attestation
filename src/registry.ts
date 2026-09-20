/**
 * Where an attestation points, how a short identifier becomes a link somebody can open, and who
 * gathered the collection it came from.
 *
 * The whole claim this project makes rests on a reader being able to check it. "SCHADE occurs in
 * three independent collections" is worth nothing if the three cannot be visited, so every source
 * has to answer one question: given a document you found a word in, what is the smallest durable
 * string that gets a person back to that document?
 *
 * Two answers, and the difference is the difference between a small evidence file and a large
 * one. A collection with stable per-document identifiers — a Wikipedia page id, a Gutenberg ebook
 * number, a Tatoeba sentence id — costs six or seven bytes a hit and expands through a template.
 * A crawled or fetched page has no such thing, so the locator is the URL itself and costs sixty.
 *
 * **Most source ids are derived rather than listed.** Fifty-one languages would otherwise mean a
 * hundred hand-written wiki entries, and the hundred-and-first would be the one with a typo in
 * its URL. `wiki:fr` and `ebible:deuelo` carry everything needed to build their own spec.
 */

/** How a locator turns back into something a person can open. */
export type LocatorKind =
  /** `{id}` is substituted; the stored locator is a short identifier. */
  | { readonly kind: 'template'; readonly template: string }
  /** The stored locator is already a URL. Costs more bytes; used where there is no id. */
  | { readonly kind: 'url' }

export interface SourceSpec {
  /**
   * Short, stable, and written into every evidence line. It is also the identity a language's
   * evidence is keyed by: renaming one invalidates every file that used it.
   */
  readonly id: string
  readonly name: string
  /** Who to credit. Recorded because we cite these collections, not because they license us. */
  readonly attribution: string
  readonly locator: LocatorKind
  /**
   * Who gathered it, which is not the same question as which collection it is.
   *
   * A Wikipedia and a Wikisource are two collections and one Wikimedia; five years of Leipzig
   * news are five collections and one crawler; three re-processings of Common Crawl are three
   * datasets and one web crawl. Counting any of those as three independent sightings would let a
   * word ship on a single organization's word, which is the thing the rule exists to prevent.
   */
  readonly family: string
  /**
   * Whether this collection's counts are worth ranking by. Everything ranks unless it says not.
   *
   * A collection assembled by looking for the words themselves is evidence that a word exists
   * and evidence of nothing else. Its token total is whatever the search happened to return, so
   * a rate taken against it would report the rarest words in the language as the commonest —
   * they are the only ones anybody looked for.
   */
  readonly ranks?: false
}

/**
 * Separators the evidence format spends, and which therefore cannot appear in a source id.
 *
 * A tab splits columns, a comma splits sources within a column, a space splits locators, and the
 * **first** colon splits a locator from its source. A colon later in the id is fine — `wiki:fr`
 * and `web:lemonde.fr` rely on it — which is why the locator parser splits once rather than on
 * every colon, and why only the other three characters are refused here.
 */
const RESERVED = /[\t, ]/u

/** Refuses a source that would corrupt the file format it is written into. */
export function validateSourceId(id: string): void {
  if (id === '') throw new Error('source id is empty')
  if (RESERVED.test(id)) throw new Error(`source id "${id}" contains a reserved character`)
}

/**
 * Turns a stored locator back into a URL.
 *
 * For a `url` source the locator is returned unchanged, which is not laziness: the stored string
 * genuinely is the answer, and pretending otherwise would mean inventing a template that expands
 * to its own input.
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

const urlSource = (id: string, family: string, name: string, attribution: string): SourceSpec => ({
  id,
  family,
  name,
  attribution,
  locator: { kind: 'url' },
})

/**
 * Suffixes under which anyone may register, so the name above them is the domain.
 *
 * Not the whole public suffix list, which is several thousand entries and a dependency. The risk
 * of a short list is one-directional and worth stating: a suffix we fail to recognise makes two
 * sites look like **one** family, which under-counts independence and loses words. The reverse —
 * splitting one owner into two families — would let a word ship on one site's word alone, and
 * only a suffix wrongly listed here could cause it.
 */
const MULTI_LABEL_SUFFIXES = new Set([
  'co.uk',
  'org.uk',
  'me.uk',
  'gov.uk',
  'ac.uk',
  'co.jp',
  'or.jp',
  'ne.jp',
  'ac.jp',
  'go.jp',
  'com.au',
  'net.au',
  'org.au',
  'edu.au',
  'gov.au',
  'com.br',
  'com.mx',
  'com.ar',
  'com.ph',
  'com.sg',
  'com.my',
  'com.tr',
  'com.cn',
  'com.tw',
  'com.hk',
  'co.kr',
  'or.kr',
  'go.kr',
  'co.in',
  'co.za',
  'co.nz',
  'com.pl',
  'com.ua',
  'com.vn',
  'co.id',
  'or.id',
  'go.id',
])

/**
 * The registrable domain of a URL: the thing a family is named after.
 *
 * Nick's rule, and it is the right cut. A subdomain is the same publisher — `blog.example.com`
 * and `shop.example.com` are one voice — while two domains are two, whoever happened to fetch
 * them. It is also what makes fetching pages worth doing: every new domain is a new family, so a
 * handful of sites can carry a word over the line that no single collection could.
 */
export function domainOf(url: string): string {
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    // Not a URL at all. Returned whole so it still groups consistently rather than vanishing
    // into one bucket with every other unparseable locator.
    return url.toLowerCase()
  }
  const labels = host.replace(/^www\./u, '').split('.')
  if (labels.length <= 2) return labels.join('.')
  const lastTwo = labels.slice(-2).join('.')
  return MULTI_LABEL_SUFFIXES.has(lastTwo) ? labels.slice(-3).join('.') : lastTwo
}

/** Sources whose id says everything needed to build their spec. */
const DERIVED: Readonly<Record<string, (rest: string) => SourceSpec>> = {
  wiki: (lang) =>
    template(
      `wiki:${lang}`,
      'wikimedia',
      `${lang}.wikipedia.org`,
      `${lang}.wikipedia.org contributors`,
      `https://${lang}.wikipedia.org/?curid={id}`,
    ),
  wikisource: (lang) =>
    template(
      `wikisource:${lang}`,
      'wikimedia',
      `${lang}.wikisource.org`,
      `${lang}.wikisource.org contributors`,
      `https://${lang}.wikisource.org/?curid={id}`,
    ),
  // Every Leipzig package is one family: five years of the same crawler is not five opinions.
  lz: (pkg) => urlSource(`lz:${pkg}`, 'leipzig', `Leipzig ${pkg}`, `Leipzig Corpora, ${pkg}`),
  ebible: (translation) =>
    template(
      `ebible:${translation}`,
      'ebible',
      `eBible ${translation}`,
      `eBible.org, ${translation}`,
      `https://ebible.org/${translation}/{id}.htm`,
    ),
  // One family per registrable domain, which is what makes the harvest able to clear a gap
  // rather than nibble at it. It attests; it does not rank.
  web: (domain) => ({
    ...urlSource(`web:${domain}`, domain, domain, `${domain}`),
    ranks: false,
  }),
}

/** Sources with nothing in their name to derive from. */
const FIXED: readonly SourceSpec[] = [
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
  // One family, deliberately. FineWeb-2, HPLT, mC4, CC-100 and NLLB are different datasets over
  // the same crawled web, and treating them as separate opinions is how Egyptian Arabic would
  // pass a rule it should fail.
  urlSource('fw2', 'commoncrawl', 'FineWeb-2', 'FineWeb-2, from Common Crawl'),
  urlSource('cc', 'commoncrawl', 'Common Crawl', 'Common Crawl Foundation'),
]

const BY_ID = new Map(FIXED.map((source) => [source.id, source]))

export const SOURCES: readonly SourceSpec[] = FIXED

/** Looks a source up, deriving it where the id says how, and refusing an id that says nothing. */
export function sourceFor(id: string): SourceSpec {
  const fixed = BY_ID.get(id)
  if (fixed !== undefined) return fixed

  const split = id.indexOf(':')
  if (split > 0) {
    const derive = DERIVED[id.slice(0, split)]
    const rest = id.slice(split + 1)
    if (derive !== undefined && rest !== '') return derive(rest)
  }
  throw new RangeError(`no registered source "${id}"`)
}
