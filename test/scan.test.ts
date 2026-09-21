import { describe, expect, it } from 'vitest'
import { merge, scan, scanByDomain, take } from '../src/scan.js'
import type { Document } from '../src/scan.js'

/** German's real fold, near enough for a unit test: upper-case, ß to SS, umlauts kept. */
const fold = (raw: string): string => raw.toUpperCase()

const candidates = new Set(['SCHADE', 'HAUS', 'MÄDCHEN', 'ABSEITS'])

const docs = (...texts: [string, string][]): Document[] =>
  texts.map(([locator, text]) => ({ locator, text }))

describe('scanning a collection', () => {
  it('counts a candidate every time it is seen', async () => {
    const result = await scan(
      'tat',
      docs(['1', 'Schade, schade.'], ['2', 'Wirklich schade!']),
      candidates,
      fold,
    )
    expect(result.hits.get('SCHADE')?.count).toBe(3)
  })

  it('records where it was seen, and only distinct documents', async () => {
    const result = await scan(
      'tat',
      docs(['1', 'schade schade schade'], ['2', 'schade'], ['3', 'schade']),
      candidates,
      fold,
    )
    // Three sightings in document 1 are one place, not three.
    expect(result.hits.get('SCHADE')?.locators).toEqual(['1', '2'])
  })

  it('stops at two samples however many documents hold the word', async () => {
    const many = docs(['1', 'haus'], ['2', 'haus'], ['3', 'haus'], ['4', 'haus'])
    const result = await scan('tat', many, candidates, fold)
    expect(result.hits.get('HAUS')?.locators).toHaveLength(2)
    expect(result.hits.get('HAUS')?.count).toBe(4)
  })

  it('ignores a token that is not a candidate, but still counts it as a token', async () => {
    const result = await scan('tat', docs(['1', 'Katze Hund Schade']), candidates, fold)
    expect(result.hits.has('KATZE')).toBe(false)
    expect(result.tokens).toBe(3)
  })

  it('leaves one- and two-letter tokens out of the denominator entirely', async () => {
    // Half of any corpus, none of it playable, and counting it would scale every rate alike.
    const result = await scan('tat', docs(['1', 'er is am Haus zu']), candidates, fold)
    expect(result.tokens).toBe(1)
  })

  it('applies the fold, so a corpus spelling lands on the shipped key', async () => {
    const result = await scan('tat', docs(['1', 'mädchen MÄDCHEN Mädchen']), candidates, fold)
    expect(result.hits.get('MÄDCHEN')?.count).toBe(3)
  })

  it('reads an async stream as happily as an array', async () => {
    async function* stream(): AsyncGenerator<Document> {
      yield { locator: '1', text: 'schade' }
      yield { locator: '2', text: 'haus' }
    }
    const result = await scan('tat', stream(), candidates, fold)
    expect([...result.hits.keys()].sort()).toEqual(['HAUS', 'SCHADE'])
  })

  it('takes apostrophes inside a word and not the punctuation around it', async () => {
    const result = await scan('tat', docs(['1', '"Haus", schade; Abseits.']), candidates, fold)
    expect([...result.hits.keys()].sort()).toEqual(['ABSEITS', 'HAUS', 'SCHADE'])
  })

  it('reports the source it was given, so merged results stay attributable', async () => {
    expect((await scan('wiki:de', docs(['1', 'haus']), candidates, fold)).source).toBe('wiki:de')
  })

  it('finds nothing in an empty collection without falling over', async () => {
    const result = await scan('tat', [], candidates, fold)
    expect(result.hits.size).toBe(0)
    expect(result.tokens).toBe(0)
  })
})

describe('merging collections', () => {
  it('gathers every collection that saw a word', async () => {
    const one = await scan('tat', docs(['1', 'schade haus']), candidates, fold)
    const two = await scan('gut', docs(['9', 'schade']), candidates, fold)
    const { words } = merge([one, two])
    expect(
      words
        .get('SCHADE')
        ?.map((entry) => entry.source)
        .sort(),
    ).toEqual(['gut', 'tat'])
    expect(words.get('HAUS')?.map((entry) => entry.source)).toEqual(['tat'])
  })

  it('records each collection’s token total, which is what makes counts comparable', async () => {
    const one = await scan('tat', docs(['1', 'schade haus']), candidates, fold)
    const two = await scan('gut', docs(['9', 'schade katze hund']), candidates, fold)
    expect(merge([one, two]).totals).toEqual(
      new Map([
        ['tat', 2],
        ['gut', 3],
      ]),
    )
  })

  it('returns words sorted, so a rebuild diffs cleanly', async () => {
    const one = await scan('tat', docs(['1', 'schade haus abseits']), candidates, fold)
    expect([...merge([one]).words.keys()]).toEqual(['ABSEITS', 'HAUS', 'SCHADE'])
  })

  it('merges nothing into nothing', () => {
    const { totals, words } = merge([])
    expect(totals.size).toBe(0)
    expect(words.size).toBe(0)
  })
})

describe('scanning by domain', () => {
  const domainOf = (locator: string): string => {
    try {
      return new URL(locator).hostname.replace(/^www\./u, '')
    } catch {
      return locator
    }
  }

  it('makes one collection per domain, so five sites are five families', async () => {
    const pages = docs(
      ['https://spiegel.de/a', 'schade'],
      ['https://www.spiegel.de/b', 'haus'],
      ['https://taz.de/c', 'schade abseits'],
    )
    const results = await scanByDomain(pages, candidates, fold, domainOf)
    expect(results.map((result) => result.source)).toEqual(['web:spiegel.de', 'web:taz.de'])
    expect(results[0]?.hits.size).toBe(2)
  })

  it('returns collections sorted, so an unchanged harvest rebuilds identically', async () => {
    const pages = docs(['https://zeit.de/a', 'haus'], ['https://bild.de/b', 'haus'])
    const results = await scanByDomain(pages, candidates, fold, domainOf)
    expect(results.map((result) => result.source)).toEqual(['web:bild.de', 'web:zeit.de'])
  })

  it('scans nothing into nothing', async () => {
    expect(await scanByDomain([], candidates, fold, domainOf)).toEqual([])
  })
})

describe('taking part of a collection', () => {
  it('stops after the count asked for', async () => {
    const many = docs(['1', 'a'], ['2', 'b'], ['3', 'c'], ['4', 'd'])
    const found = []
    for await (const document of take(many, 2)) found.push(document.locator)
    expect(found).toEqual(['1', '2'])
  })

  it('takes the whole collection when it is shorter than the count', async () => {
    const found = []
    for await (const document of take(docs(['1', 'a']), 99)) found.push(document.locator)
    expect(found).toEqual(['1'])
  })

  it('takes nothing when asked for nothing', async () => {
    const found = []
    for await (const document of take(docs(['1', 'a']), 0)) found.push(document.locator)
    expect(found).toEqual([])
  })
})

describe('a document too garbled to be evidence', () => {
  const candidates = new Set(['SCHADE', 'HAUS', 'OKAY'])
  const fold = (raw: string): string => raw.toUpperCase()

  it('drops one whose tokens are mostly not words of the language', async () => {
    // OCR fails in a way that looks like text: an English book run through a Cyrillic model gives
    // РКЕРА СЕ for PREFACE. One such book attests a hundred words nobody wrote.
    const documents = [
      { locator: 'good', text: 'schade haus okay schade haus' },
      { locator: 'ocr', text: 'ркера се веесетш ао шеемое схарткк schade' },
    ]
    const result = await scan('ia', documents, candidates, fold, 0.35)
    expect(result.hits.get('SCHADE')?.locators).toEqual(['good'])
    expect(result.hits.get('SCHADE')?.count).toBe(2)
  })

  it('leaves its tokens out of the denominator too', async () => {
    // Letting them count would still be letting noise decide how common every other word is.
    const documents = [
      { locator: 'good', text: 'schade haus okay' },
      { locator: 'ocr', text: 'aaa bbb ccc ddd eee fff ggg hhh iii jjj' },
    ]
    const result = await scan('ia', documents, candidates, fold, 0.35)
    expect(result.tokens).toBe(3)
  })

  it('counts everything when no floor is asked for', async () => {
    const documents = [{ locator: 'ocr', text: 'aaa bbb ccc schade' }]
    const result = await scan('ia', documents, candidates, fold)
    expect(result.tokens).toBe(4)
    expect(result.hits.get('SCHADE')?.count).toBe(1)
  })

  it('keeps an empty document rather than dividing by zero over it', async () => {
    const result = await scan('ia', [{ locator: 'blank', text: '' }], candidates, fold, 0.35)
    expect(result.tokens).toBe(0)
  })
})
