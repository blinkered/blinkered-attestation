import { describe, expect, it } from 'vitest'
import {
  allowed,
  disallowedPaths,
  feedLinks,
  isSitemapIndex,
  pageLinks,
  readableText,
  sitemapLinks,
} from '../src/web.js'

describe('robots.txt', () => {
  const robots = [
    'User-agent: Googlebot',
    'Disallow: /google-only',
    '',
    'User-agent: *',
    'Disallow: /admin',
    'Disallow: /search   # no crawling search results',
    'Allow: /',
    'Sitemap: https://example.com/sitemap.xml',
  ].join('\n')

  it('reads the rules meant for everyone', () => {
    expect(disallowedPaths(robots)).toEqual(['/admin', '/search'])
  })

  it('ignores rules aimed at somebody else', () => {
    expect(disallowedPaths(robots)).not.toContain('/google-only')
  })

  it('reads a rule aimed at us by name', () => {
    const named = ['User-agent: blinkered-attestation', 'Disallow: /private'].join('\n')
    expect(disallowedPaths(named)).toEqual(['/private'])
  })

  it('ignores comments and blank lines', () => {
    expect(disallowedPaths('# just a comment\n\nUser-agent: *\nDisallow: /x')).toEqual(['/x'])
  })

  it('ignores a line with no colon, and an empty Disallow', () => {
    expect(disallowedPaths('User-agent: *\nnonsense\nDisallow:')).toEqual([])
  })

  it('refuses a path under a disallowed prefix and allows the rest', () => {
    const rules = ['/admin', '/search']
    expect(allowed('https://example.com/admin/users', rules)).toBe(false)
    expect(allowed('https://example.com/article/1', rules)).toBe(true)
  })

  it('treats a bare slash as the whole site', () => {
    expect(allowed('https://example.com/anything', ['/'])).toBe(false)
  })

  it('refuses something that is not a URL rather than guessing', () => {
    expect(allowed('not a url', [])).toBe(false)
  })
})

describe('sitemaps', () => {
  const sitemap = `<?xml version="1.0"?><urlset>
    <url><loc>https://www.hani.co.kr/arti/1</loc></url>
    <url><loc>  https://www.hani.co.kr/arti/2  </loc></url>
  </urlset>`

  it('takes every page a sitemap lists', () => {
    expect(sitemapLinks(sitemap)).toEqual([
      'https://www.hani.co.kr/arti/1',
      'https://www.hani.co.kr/arti/2',
    ])
  })

  it('knows an index of sitemaps from a sitemap of pages', () => {
    expect(isSitemapIndex('<sitemapindex><sitemap><loc>x</loc></sitemap></sitemapindex>')).toBe(
      true,
    )
    expect(isSitemapIndex(sitemap)).toBe(false)
  })

  it('finds nothing in a page that is not a sitemap', () => {
    expect(sitemapLinks('<html><body>hello</body></html>')).toEqual([])
  })
})

describe('feeds', () => {
  it('reads RSS, where the URL is the link text', () => {
    const rss = '<rss><channel><item><link>https://khan.co.kr/a</link></item></channel></rss>'
    expect(feedLinks(rss)).toEqual(['https://khan.co.kr/a'])
  })

  it('reads Atom, where the URL is an attribute', () => {
    const atom = '<feed><entry><link rel="alternate" href="https://khan.co.kr/b"/></entry></feed>'
    expect(feedLinks(atom)).toEqual(['https://khan.co.kr/b'])
  })

  it('does not report the same link twice when a feed uses both shapes', () => {
    const both = '<link>https://x/a</link><link href="https://x/a"/>'
    expect(feedLinks(both)).toEqual(['https://x/a'])
  })
})

describe('readable text', () => {
  it('drops scripts and styles, whose contents are not prose', () => {
    // A page of JavaScript would otherwise attest `function` and `return` in every language.
    const html = '<script>function f(){return 1}</script><p>한국어</p><style>a{color:red}</style>'
    expect(readableText(html)).toBe('한국어')
  })

  it('drops comments and noscript', () => {
    expect(readableText('<!-- hidden --><noscript>off</noscript><p>보이는</p>')).toBe('보이는')
  })

  it('unescapes the entities that carry real characters', () => {
    expect(readableText('<p>Caf&#233; &amp; bar &quot;x&quot;</p>')).toBe('Café & bar "x"')
  })

  it('turns an unknown entity into a space rather than leaving it as a word', () => {
    expect(readableText('<p>a&hellip;b</p>')).toBe('a b')
  })

  it('collapses whitespace so tokens do not carry layout with them', () => {
    expect(readableText('<p>one</p>\n\n   <p>two</p>')).toBe('one two')
  })
})

describe('links off an ordinary page', () => {
  it('makes them absolute against the page they were found on', () => {
    const html = '<a href="/texto/casa-tomada/">Casa tomada</a><a href="otro.html">Otro</a>'
    expect(pageLinks(html, 'https://ciudadseva.com/')).toEqual([
      'https://ciudadseva.com/texto/casa-tomada/',
      'https://ciudadseva.com/otro.html',
    ])
  })

  it('drops fragments, because a page and an anchor in it are one document', () => {
    const html = '<a href="/texto#nota">a</a><a href="/texto">b</a>'
    expect(pageLinks(html, 'https://x.es/')).toEqual(['https://x.es/texto'])
  })

  it('leaves alone what cannot be fetched', () => {
    const html = '<a href="mailto:a@b.c">mail</a><a href="javascript:void(0)">js</a>'
    expect(pageLinks(html, 'https://x.es/')).toEqual([])
  })

  it('skips an href that is not a URL relative to anything', () => {
    // Malformed markup is ordinary on an old site, and one bad link must not cost the page.
    const html = '<a href="http://[">broken</a><a href="/good">good</a>'
    expect(pageLinks(html, 'https://x.es/')).toEqual(['https://x.es/good'])
  })

  it('keeps links to other sites, which the harvest filters by domain later', () => {
    // Separation of concerns: this reads a page, `discover` decides whose pages count.
    const html = '<a href="https://elsewhere.org/a">a</a>'
    expect(pageLinks(html, 'https://x.es/')).toEqual(['https://elsewhere.org/a'])
  })
})
