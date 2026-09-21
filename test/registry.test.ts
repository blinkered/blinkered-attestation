import { describe, expect, it } from 'vitest'
import { SOURCES, domainOf, expandLocator, sourceFor, validateSourceId } from '../src/registry.js'

describe('a collection that says when it looked', () => {
  it('reads the year out of a Leipzig package name, so its URLs are checked against it', () => {
    expect(sourceFor('lz:deu_news_2021_1M').asOf).toBe('2021')
    expect(sourceFor('lz:deu_newscrawl-public_2018_1M').asOf).toBe('2018')
  })

  it('says nothing about a package with no year in its name', () => {
    // Then its locators are checked as they stand, which is the safe reading: a source that does
    // not say when it looked cannot have an archive year invented for it.
    expect(sourceFor('lz:deu_mixed_1M').asOf).toBeUndefined()
  })

  it('leaves permanent citations alone', () => {
    expect(sourceFor('wiki:de').asOf).toBeUndefined()
    expect(sourceFor('gut').asOf).toBeUndefined()
  })
})

describe('the source registry', () => {
  it('expands a short id into a link somebody can open', () => {
    expect(expandLocator(sourceFor('gut'), '21034')).toBe(
      'https://www.gutenberg.org/cache/epub/21034/pg21034.txt',
    )
    expect(expandLocator(sourceFor('wiki:de'), '9912847')).toBe(
      'https://de.wikipedia.org/?curid=9912847',
    )
    expect(expandLocator(sourceFor('tat'), '551')).toBe('https://tatoeba.org/en/sentences/show/551')
  })

  it('returns a crawl locator unchanged, because the stored string is already the answer', () => {
    const url = 'https://example.de/artikel'
    expect(expandLocator(sourceFor('cc'), url)).toBe(url)
  })

  it('refuses an unregistered source rather than returning a hole', () => {
    expect(() => sourceFor('nope')).toThrow('no registered source "nope"')
  })

  it('registers every source under an id the evidence format can carry', () => {
    for (const source of SOURCES) expect(() => validateSourceId(source.id)).not.toThrow()
  })

  it('gives every source a name and an attribution, since we cite these collections', () => {
    for (const source of SOURCES) {
      expect(source.name).not.toBe('')
      expect(source.attribution).not.toBe('')
    }
  })

  it('has no duplicate ids, which would make a locator ambiguous', () => {
    expect(new Set(SOURCES.map((source) => source.id)).size).toBe(SOURCES.length)
  })
})

describe('a source id', () => {
  it.each([
    ['a tab', 'de\twiki'],
    ['a comma', 'de,wiki'],
    ['a space', 'de wiki'],
  ])('is refused when it contains %s, because the format spends that character', (_, id) => {
    expect(() => validateSourceId(id)).toThrow('reserved character')
  })

  it('is refused when empty', () => {
    expect(() => validateSourceId('')).toThrow('source id is empty')
  })

  it('is accepted when it is plain', () => {
    expect(() => validateSourceId('wiki:de')).not.toThrow()
  })
})

describe('derived sources', () => {
  it('builds a wiki source from its language tag', () => {
    const spec = sourceFor('wiki:fr')
    expect(spec.family).toBe('wikimedia')
    expect(expandLocator(spec, '12345')).toBe('https://fr.wikipedia.org/?curid=12345')
  })

  it('puts a Wikisource in the same family as its Wikipedia', () => {
    expect(sourceFor('wikisource:fr').family).toBe(sourceFor('wiki:fr').family)
    expect(expandLocator(sourceFor('wikisource:ru'), '99')).toBe(
      'https://ru.wikisource.org/?curid=99',
    )
  })

  it('builds a Leipzig package source, all of them one family', () => {
    expect(sourceFor('lz:fra_news_2024_1M').family).toBe('leipzig')
    expect(sourceFor('lz:spa_web_2016_1M').family).toBe('leipzig')
  })

  it('builds an eBible source from its translation code', () => {
    expect(expandLocator(sourceFor('ebible:deuelo'), 'GEN01')).toBe(
      'https://ebible.org/deuelo/GEN01.htm',
    )
    expect(sourceFor('ebible:tglulb').family).toBe('ebible')
  })

  it('gives a fetched domain its own family, and does not let it rank', () => {
    // Nick's rule: a domain is a publisher, so every new domain is a new family. That is what
    // makes fetching pages able to carry a word over the line rather than nudge it.
    expect(sourceFor('web:lemonde.fr').family).toBe('lemonde.fr')
    expect(sourceFor('web:spiegel.de').family).toBe('spiegel.de')
    expect(sourceFor('web:lemonde.fr').ranks).toBe(false)
  })

  it('keeps every crawl-derived dataset in one family', () => {
    // Three re-processings of the same crawled web are three datasets and one opinion. This is
    // the line that makes Egyptian Arabic fail the rule rather than pass it on a technicality.
    expect(sourceFor('fw2').family).toBe(sourceFor('cc').family)
  })

  it('refuses a prefix it does not know, and a prefix with nothing after it', () => {
    expect(() => sourceFor('nonsense:x')).toThrow('no registered source')
    expect(() => sourceFor('wiki:')).toThrow('no registered source')
    expect(() => sourceFor(':fr')).toThrow('no registered source')
  })
})

describe('the registrable domain', () => {
  it('is the domain, not the subdomain', () => {
    expect(domainOf('https://blog.example.com/a')).toBe('example.com')
    expect(domainOf('https://shop.example.com/b')).toBe('example.com')
  })

  it('drops a leading www', () => {
    expect(domainOf('https://www.spiegel.de/x')).toBe('spiegel.de')
  })

  it('keeps three labels under a suffix anyone can register beneath', () => {
    expect(domainOf('https://www.bbc.co.uk/news')).toBe('bbc.co.uk')
    expect(domainOf('https://abante.com.ph/story')).toBe('abante.com.ph')
    expect(domainOf('https://www.asahi.co.jp/a')).toBe('asahi.co.jp')
  })

  it('handles a bare two-label host', () => {
    expect(domainOf('https://lemonde.fr/')).toBe('lemonde.fr')
  })

  it('ignores port, path and case', () => {
    expect(domainOf('https://WWW.Example.COM:8443/Path?q=1')).toBe('example.com')
  })

  it('returns an unparseable locator whole rather than bucketing it with every other one', () => {
    // A wiki page id is not a URL and must not collapse into a single "unparseable" family.
    expect(domainOf('12345')).toBe('12345')
  })
})
