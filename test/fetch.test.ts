import { describe, expect, it } from 'vitest'
import { discover, harvestSites, httpGet, sitePages } from '../src/fetch.js'
import type { Get } from '../src/fetch.js'
import type { Document } from '../src/scan.js'

/** A pretend web. Everything in `fetch.ts` takes a `Get`, so none of this touches a network. */
const web =
  (pages: Record<string, string>): Get =>
  async (url) =>
    pages[url] ?? null

async function collect(documents: AsyncGenerator<Document>): Promise<Document[]> {
  const found: Document[] = []
  for await (const document of documents) found.push(document)
  return found
}

const article = (body: string): string =>
  `<html><body><p>${body.repeat(Math.ceil(400 / body.length))}</p></body></html>`

describe('discovering what a publisher has', () => {
  it('prefers the sitemap robots.txt names over any guess', async () => {
    const get = web({
      'https://hani.co.kr/robots.txt': 'User-agent: *\nSitemap: https://hani.co.kr/news.xml',
      'https://hani.co.kr/news.xml': '<urlset><url><loc>https://hani.co.kr/a</loc></url></urlset>',
    })
    expect((await discover('hani.co.kr', get, undefined, 0)).urls).toEqual(['https://hani.co.kr/a'])
  })

  it('keeps the publisher’s own pages and drops everybody else’s', async () => {
    // A feed names the fonts and scripts a page loads as readily as the article. French's harvest
    // came back with three pages from a font CDN, which then appeared in its saturation curve as
    // an independent family called `typekit.net`. A family is a publisher.
    const get = web({
      'https://lemonde.fr/robots.txt': 'User-agent: *\nSitemap: https://lemonde.fr/s.xml',
      'https://lemonde.fr/s.xml':
        '<urlset>' +
        '<url><loc>https://www.lemonde.fr/a</loc></url>' +
        '<url><loc>https://use.typekit.net/xyz</loc></url>' +
        '<url><loc>https://video.lemonde.fr/b</loc></url>' +
        '</urlset>',
    })
    const found = await discover('lemonde.fr', get, undefined, 0)
    // A subdomain of the publisher is still the publisher; a font CDN is not.
    expect(found.urls).toEqual(['https://www.lemonde.fr/a', 'https://video.lemonde.fr/b'])
  })

  it('falls back to the conventional locations when robots.txt names none', async () => {
    const get = web({
      'https://khan.co.kr/robots.txt': 'User-agent: *',
      'https://khan.co.kr/sitemap.xml':
        '<urlset><url><loc>https://khan.co.kr/b</loc></url></urlset>',
    })
    expect((await discover('khan.co.kr', get, undefined, 0)).urls).toEqual(['https://khan.co.kr/b'])
  })

  it('follows an index of sitemaps one level down to the pages', async () => {
    const get = web({
      'https://yna.co.kr/robots.txt': 'User-agent: *',
      'https://yna.co.kr/sitemap.xml':
        '<sitemapindex><sitemap><loc>https://yna.co.kr/s1.xml</loc></sitemap></sitemapindex>',
      'https://yna.co.kr/s1.xml': '<urlset><url><loc>https://yna.co.kr/c</loc></url></urlset>',
    })
    expect((await discover('yna.co.kr', get, undefined, 0)).urls).toEqual(['https://yna.co.kr/c'])
  })

  it('reads a feed where a site publishes one instead', async () => {
    const get = web({
      'https://pressian.com/robots.txt': 'User-agent: *',
      'https://pressian.com/rss': '<rss><item><link>https://pressian.com/d</link></item></rss>',
    })
    expect((await discover('pressian.com', get, undefined, 0)).urls).toEqual([
      'https://pressian.com/d',
    ])
  })

  it('leaves out what robots.txt forbids', async () => {
    const get = web({
      'https://x.kr/robots.txt': 'User-agent: *\nDisallow: /admin',
      'https://x.kr/sitemap.xml':
        '<urlset><url><loc>https://x.kr/ok</loc></url><url><loc>https://x.kr/admin/p</loc></url></urlset>',
    })
    expect((await discover('x.kr', get, undefined, 0)).urls).toEqual(['https://x.kr/ok'])
  })

  it('leaves out images, archives and nested sitemaps a sitemap also lists', async () => {
    const get = web({
      'https://x.kr/robots.txt': 'User-agent: *',
      'https://x.kr/sitemap.xml':
        '<urlset><url><loc>https://x.kr/a</loc></url><url><loc>https://x.kr/p.jpg</loc></url>' +
        '<url><loc>https://x.kr/s2.xml</loc></url></urlset>',
    })
    expect((await discover('x.kr', get, undefined, 0)).urls).toEqual(['https://x.kr/a'])
  })

  it('takes no more than it was asked for, however much a site lists', async () => {
    const many = Array.from(
      { length: 50 },
      (_, at) => `<url><loc>https://x.kr/${String(at)}</loc></url>`,
    )
    const get = web({
      'https://x.kr/robots.txt': 'User-agent: *',
      'https://x.kr/sitemap.xml': `<urlset>${many.join('')}</urlset>`,
    })
    expect((await discover('x.kr', get, 5, 0)).urls).toHaveLength(5)
  })

  it('stops following an index once it has enough, however many children it lists', async () => {
    const get = web({
      'https://big.kr/robots.txt': 'User-agent: *',
      'https://big.kr/sitemap.xml':
        '<sitemapindex><sitemap><loc>https://big.kr/s1.xml</loc></sitemap>' +
        '<sitemap><loc>https://big.kr/s2.xml</loc></sitemap></sitemapindex>',
      'https://big.kr/s1.xml':
        '<urlset><url><loc>https://big.kr/a</loc></url><url><loc>https://big.kr/b</loc></url></urlset>',
      'https://big.kr/s2.xml': '<urlset><url><loc>https://big.kr/c</loc></url></urlset>',
    })
    // The first child already satisfies the limit, so the second is never fetched.
    expect((await discover('big.kr', get, 2, 0)).urls).toEqual([
      'https://big.kr/a',
      'https://big.kr/b',
    ])
  })

  it('keeps a plain http page, since older publishers still serve them', async () => {
    const get = web({
      'https://old.kr/robots.txt': 'User-agent: *',
      'https://old.kr/sitemap.xml': '<urlset><url><loc>http://old.kr/a</loc></url></urlset>',
    })
    expect((await discover('old.kr', get, undefined, 0)).urls).toEqual(['http://old.kr/a'])
  })

  it('comes back empty from a site that answers nothing, rather than crawling it', async () => {
    // Following links from a homepage is a different and far ruder activity.
    expect((await discover('silent.kr', web({}), undefined, 0)).urls).toEqual([])
  })
})

describe('fetching a publisher’s pages', () => {
  const harvest = {
    domain: 'hani.co.kr',
    urls: ['https://hani.co.kr/a', 'https://hani.co.kr/gone', 'https://hani.co.kr/thin'],
    disallowed: [],
  }

  it('cites each page by its own URL', async () => {
    const get = web({ 'https://hani.co.kr/a': article('한국어 문장. ') })
    const [first] = await collect(sitePages(harvest, get, undefined, 0))
    expect(first?.locator).toBe('https://hani.co.kr/a')
    expect(first?.text).toContain('한국어')
  })

  it('skips a page that will not load', async () => {
    const get = web({ 'https://hani.co.kr/a': article('본문 ') })
    expect(await collect(sitePages(harvest, get, undefined, 0))).toHaveLength(1)
  })

  it('skips a page with almost no text, which is a cookie wall and not evidence', async () => {
    const get = web({
      'https://hani.co.kr/a': article('본문 '),
      'https://hani.co.kr/thin': '<html><body>쿠키</body></html>',
    })
    const found = await collect(sitePages(harvest, get, undefined, 0))
    expect(found.map((document) => document.locator)).toEqual(['https://hani.co.kr/a'])
  })
})

describe('harvesting several publishers', () => {
  it('visits each in turn, so every domain becomes its own family', async () => {
    const get = web({
      'https://hani.co.kr/robots.txt': 'User-agent: *',
      'https://hani.co.kr/sitemap.xml':
        '<urlset><url><loc>https://hani.co.kr/a</loc></url></urlset>',
      'https://hani.co.kr/a': article('첫 번째 신문 '),
      'https://khan.co.kr/robots.txt': 'User-agent: *',
      'https://khan.co.kr/sitemap.xml':
        '<urlset><url><loc>https://khan.co.kr/b</loc></url></urlset>',
      'https://khan.co.kr/b': article('두 번째 신문 '),
    })
    const found = await collect(harvestSites(['hani.co.kr', 'khan.co.kr'], get, undefined, 0))
    expect(found.map((document) => document.locator)).toEqual([
      'https://hani.co.kr/a',
      'https://khan.co.kr/b',
    ])
  })

  it('carries on past a publisher that is unreachable', async () => {
    const get = web({
      'https://up.kr/robots.txt': 'User-agent: *',
      'https://up.kr/sitemap.xml': '<urlset><url><loc>https://up.kr/a</loc></url></urlset>',
      'https://up.kr/a': article('살아있는 '),
    })
    const found = await collect(harvestSites(['down.kr', 'up.kr'], get, undefined, 0))
    expect(found).toHaveLength(1)
  })
})

describe('the real reader', () => {
  const withFetch = async <T>(stub: typeof fetch, run: () => Promise<T>): Promise<T> => {
    const original = globalThis.fetch
    globalThis.fetch = stub
    try {
      return await run()
    } finally {
      globalThis.fetch = original
    }
  }

  it('returns the body of a page that loads', async () => {
    const stub = (async () => new Response('한국어', { status: 200 })) as unknown as typeof fetch
    expect(await withFetch(stub, () => httpGet('https://hani.co.kr/a'))).toBe('한국어')
  })

  it('returns nothing for a page that is not there', async () => {
    const stub = (async () => new Response('gone', { status: 404 })) as unknown as typeof fetch
    expect(await withFetch(stub, () => httpGet('https://hani.co.kr/gone'))).toBeNull()
  })

  it('returns nothing when the host refuses, rather than ending the harvest', async () => {
    // One unreachable publisher must not end a harvest that has nine others to visit.
    const stub = (async () => {
      throw new TypeError('connection refused')
    }) as unknown as typeof fetch
    expect(await withFetch(stub, () => httpGet('https://down.kr/a'))).toBeNull()
  })

  it('says who it is, because that is the least a crawler owes a server', async () => {
    let sent: string | undefined
    const stub = (async (_url: string, init: RequestInit) => {
      sent = (init.headers as Record<string, string>)['user-agent']
      return new Response('ok', { status: 200 })
    }) as unknown as typeof fetch
    await withFetch(stub, () => httpGet('https://hani.co.kr/a'))
    expect(sent).toContain('blinkered-attestation')
    expect(sent).toContain('playblinkered.com')
  })
})
