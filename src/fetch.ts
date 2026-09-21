/**
 * Fetching a publisher's pages, politely, and turning them into documents.
 *
 * The logic this rests on is in `web.ts` and is testable without a network. What is here is the
 * part that touches somebody else's server, and it is deliberately slow: one request at a time,
 * a pause between, robots.txt honoured, and a cap on how much of any one site is taken. A
 * harvest is a few hundred pages from a site, once, to cite them.
 */

import { domainOf } from './registry.js'
import type { Document } from './scan.js'
import {
  MAX_PAGES_PER_HOST,
  POLITE_DELAY_MS,
  USER_AGENT,
  allowed,
  disallowedPaths,
  feedLinks,
  isSitemapIndex,
  pageLinks,
  readableText,
  sitemapLinks,
} from './web.js'

/** Reads a URL as text, or returns null if it is not there. Injectable, so tests need no net. */
export type Get = (url: string) => Promise<string | null>

/** The real one. Everything else in this module takes a `Get` so it can be exercised offline. */
export const httpGet: Get = async (url) => {
  try {
    const response = await fetch(url, {
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml,text/xml' },
      redirect: 'follow',
    })
    if (!response.ok) return null
    return await response.text()
  } catch {
    // A host that refuses, times out or serves nonsense is a host we do without. One unreachable
    // publisher must not end a harvest that has nine others to visit.
    return null
  }
}

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Where a site says its pages are.
 *
 * Asked in the order a site is most likely to answer: the sitemap named by robots.txt, then the
 * conventional locations, then a feed. A publisher that answers none of these is skipped rather
 * than crawled — following links from a homepage is a different and far ruder activity.
 */
export const DISCOVERY_PATHS: readonly string[] = [
  '/sitemap.xml',
  '/sitemap_index.xml',
  '/sitemap-index.xml',
  '/news-sitemap.xml',
  '/rss',
  '/rss.xml',
  '/feed',
  '/feed.xml',
  '/atom.xml',
]

export interface SiteHarvest {
  readonly domain: string
  readonly urls: readonly string[]
  readonly disallowed: readonly string[]
}

/**
 * Finds a publisher's pages and what it has asked us not to touch.
 *
 * Sitemap indexes are followed one level, which is where the day's articles live on a news site.
 * Going deeper would mean walking an archive going back decades for no gain: a few hundred
 * recent pages attest a language's ordinary vocabulary perfectly well.
 */
export async function discover(
  domain: string,
  get: Get = httpGet,
  limit = MAX_PAGES_PER_HOST,
  delayMs = POLITE_DELAY_MS,
): Promise<SiteHarvest> {
  const registrable = domainOf(`https://${domain}/`)
  const robots = await get(`https://${domain}/robots.txt`)
  const disallowed = robots === null ? [] : disallowedPaths(robots)

  // A sitemap named in robots.txt is the site's own answer and beats any guess.
  const declared = (robots ?? '')
    .split('\n')
    .map((line) => /^\s*sitemap:\s*(\S+)/iu.exec(line)?.[1])
    .filter((found): found is string => found !== undefined)

  const found: string[] = []
  for (const candidate of [
    ...declared,
    ...DISCOVERY_PATHS.map((path) => `https://${domain}${path}`),
  ]) {
    if (found.length >= limit) break
    const body = await get(candidate)
    await wait(delayMs)
    if (body === null) continue

    if (isSitemapIndex(body)) {
      for (const child of sitemapLinks(body).slice(0, 5)) {
        if (found.length >= limit) break
        const leaf = await get(child)
        await wait(delayMs)
        if (leaf !== null) found.push(...sitemapLinks(leaf))
      }
      continue
    }
    found.push(...sitemapLinks(body), ...feedLinks(body))
  }

  // Nothing declared and nothing at the conventional places. That is not a dead site — it is an
  // older one, and older is exactly the register a news harvest cannot reach. Five of the eight
  // Spanish literary archives tried here have neither a sitemap nor a feed, including the two
  // largest. So read the front page and follow what it links to, one level, which is what a
  // person would do and is bounded by the same limit as everything else.
  if (found.length === 0) {
    const front = await get(`https://${domain}/`)
    await wait(delayMs)
    if (front !== null) found.push(...pageLinks(front, `https://${domain}/`))
  }

  const urls = [...new Set(found)]
    .filter((url) => url.startsWith('https://') || url.startsWith('http://'))
    // A sitemap lists every file a site has, not only its articles: its own sitemaps, its
    // images, and — this cost Tagalog a harvest — its stylesheets. A minified CSS file read as
    // prose yields BASE, STYLE, NORMAL, RIGHT, TOP, WHITE, BLACK, which are ordinary words in
    // more than one language and were duly recorded as sightings.
    .filter(
      (url) =>
        !/\.(?:xml|jpe?g|png|gif|svg|webp|avif|ico|mp4|mp3|pdf|zip|css|m?js|json|woff2?|ttf|eot)(?:\?|$)/iu.test(
          url,
        ),
    )
    // This publisher's own pages, and nobody else's. A feed names the stylesheets and fonts a
    // page loads as readily as the article, and French's harvest came back with three pages from
    // a font CDN — which then appeared in its saturation curve as an independent family called
    // `typekit.net`. A family is a publisher, so a page has to be the publisher's.
    .filter((url) => domainOf(url) === registrable)
    .filter((url) => allowed(url, disallowed))
    .slice(0, limit)

  return { domain, urls, disallowed }
}

/**
 * Fetches the pages found, one at a time, and yields each as a document cited by its own URL.
 *
 * A page that will not load is skipped silently. A page that loads but holds almost no text is
 * skipped too: a cookie wall or an error page is not evidence of anything, and counting one
 * would put a number in the evidence file that its locator cannot support.
 */
export async function* sitePages(
  harvest: SiteHarvest,
  get: Get = httpGet,
  shortest = 200,
  delayMs = POLITE_DELAY_MS,
): AsyncGenerator<Document> {
  for (const url of harvest.urls) {
    const html = await get(url)
    await wait(delayMs)
    if (html === null) continue
    // We asked a website for a page. A response with no markup in it at all is a stylesheet, a
    // script or a data file that slipped past the extension filter, and reading it as prose
    // attests whatever keywords its syntax happens to share with the language.
    if (!/<[a-z!/][^>]*>/iu.test(html)) continue
    const text = readableText(html)
    if (text.length < shortest) continue
    yield { locator: url, text }
  }
}

/**
 * Every page from every publisher given, in order.
 *
 * One domain at a time rather than in parallel, which is slower and is the point: concurrency
 * here would mean hammering several servers at once to save an afternoon of something nobody is
 * waiting on.
 */
export async function* harvestSites(
  domains: readonly string[],
  get: Get = httpGet,
  limit = MAX_PAGES_PER_HOST,
  delayMs = POLITE_DELAY_MS,
): AsyncGenerator<Document> {
  for (const domain of domains) {
    yield* sitePages(await discover(domain, get, limit, delayMs), get, undefined, delayMs)
  }
}
