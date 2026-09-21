/**
 * Finding text on the open web, a publisher at a time.
 *
 * The bulk collections — a Wikipedia, a Gutenberg, a Tatoeba — are a small and arbitrary set,
 * and for most of the world's languages they run out fast. Korean has no Leipzig package, no
 * Gutenberg shelf and no eBible translation; its whole supply of ready-made corpora is three
 * families, one of which is fifteen thousand sentences. Treating that as the ceiling was a
 * failure of imagination: Korean has newspapers, broadcasters, government gazettes, literary
 * archives and a parliament that publishes its proceedings, and every one of those is a
 * publisher, which under the family rule means every one of them is an independent voice.
 *
 * So this module does what a person would do. Given a domain, find the pages it publishes —
 * from its sitemap, or its feed — fetch some of them, and keep the text. Ten domains is ten
 * families, which is more than any language gets from the ready-made corpora.
 *
 * **Politeness is a correctness property here, not manners.** We are a guest on somebody's
 * server, fetching text they published for people to read, in order to cite them. So: robots.txt
 * is honoured, one request at a time per host with a pause between, a user agent that says who
 * we are and links to why, and a hard cap on how much of any one site we take. A harvest is a
 * few hundred pages from a site, once — not a crawl.
 */

/** Says who we are and where to complain, which is the least a crawler owes a server. */
export const USER_AGENT =
  'blinkered-attestation/1 (+https://playblinkered.com; word-list attestation; one request at a time)'

/** Between requests to one host. Slow on purpose: nothing here is urgent. */
export const POLITE_DELAY_MS = 1_000

/** Per host, per harvest. A few hundred pages is plenty to attest a tail. */
export const MAX_PAGES_PER_HOST = 300

/**
 * The paths a robots.txt forbids to everyone or to us.
 *
 * A deliberately small reading of the format: `Disallow` lines under a `User-agent` that applies
 * to us. It does not implement `Allow` overrides or wildcards, and it errs toward refusing —
 * a path we wrongly skip costs a page, and a path we wrongly fetch costs somebody's goodwill.
 */
export function disallowedPaths(robots: string, agent = 'blinkered-attestation'): string[] {
  const paths: string[] = []
  let applies = false
  for (const raw of robots.split('\n')) {
    const line = raw.replace(/#.*$/u, '').trim()
    if (line === '') continue
    const split = line.indexOf(':')
    if (split <= 0) continue
    const field = line.slice(0, split).trim().toLowerCase()
    const value = line.slice(split + 1).trim()

    if (field === 'user-agent') {
      applies = value === '*' || value.toLowerCase() === agent
      continue
    }
    if (field === 'disallow' && applies && value !== '') paths.push(value)
  }
  return paths
}

/** Whether robots.txt lets us have this URL. */
export function allowed(url: string, disallowed: readonly string[]): boolean {
  let path: string
  try {
    path = new URL(url).pathname
  } catch {
    return false
  }
  // A bare `/` disallows the whole site, which is a clear no rather than an edge case.
  return !disallowed.some((prefix) => path.startsWith(prefix))
}

/**
 * URLs out of a sitemap, whether it is a sitemap or an index of sitemaps.
 *
 * Regex rather than an XML parser, and the reason is the same as the wikitext stripper's: what
 * is wanted is every `<loc>`, the documents are machine-written and uniform, and a parser would
 * be a dependency for one tag.
 */
export function sitemapLinks(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gu)].map((match) => match[1] as string)
}

/** Whether a sitemap is an index pointing at further sitemaps rather than at pages. */
export function isSitemapIndex(xml: string): boolean {
  return /<sitemapindex[\s>]/u.test(xml)
}

/**
 * Article links out of an RSS or Atom feed.
 *
 * Both shapes, because publishers use both and the difference is not worth a caller knowing:
 * RSS puts the URL in `<link>` text, Atom in a `href` attribute.
 */
export function feedLinks(xml: string): string[] {
  const rss = [...xml.matchAll(/<link>\s*([^<\s]+)\s*<\/link>/gu)].map(
    (match) => match[1] as string,
  )
  const atom = [...xml.matchAll(/<link\b[^>]*\bhref="([^"]+)"/gu)].map(
    (match) => match[1] as string,
  )
  return [...new Set([...rss, ...atom])]
}

/**
 * Links out of an ordinary HTML page, made absolute against the page they were found on.
 *
 * The fallback for a publisher with no sitemap and no feed, which is most of the interesting
 * ones. Literary archives, university collections and national libraries — exactly the register
 * a news harvest cannot reach — were built before sitemaps were a habit, and five of the eight
 * Spanish literary domains tried here declare neither. Following links off the front page is what
 * a person would do.
 *
 * Fragments and query strings are dropped, because `/text?page=2#note` and `/text` are the same
 * document for our purposes and fetching both wastes a request on somebody's server.
 */
export function pageLinks(html: string, base: string): string[] {
  const found = new Set<string>()
  for (const match of html.matchAll(/<a\b[^>]*\bhref=["']([^"'#]+)["']/giu)) {
    const href = match[1] as string
    if (/^(?:mailto|javascript|tel):/iu.test(href)) continue
    try {
      const url = new URL(href, base)
      url.hash = ''
      found.add(url.toString())
    } catch {
      // A link that is not a URL relative to anything is not a page we can fetch.
    }
  }
  return [...found]
}

/**
 * Readable text out of an HTML page.
 *
 * Scripts and styles go first, because their contents are not prose and would otherwise be
 * counted as words — a page of JavaScript would attest `function` and `return` in every
 * language on earth. Then tags, then entities. What is left is close enough: the tokenizer only
 * wants words, and a stray menu item costs one word one spurious hit.
 */
export function readableText(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/giu, ' ')
    .replace(/<!--[\s\S]*?-->/gu, ' ')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/&nbsp;/giu, ' ')
    .replace(/&amp;/giu, '&')
    .replace(/&quot;/giu, '"')
    .replace(/&#(\d+);/gu, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&[a-z]+;/giu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
}
