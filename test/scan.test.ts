import { describe, expect, it } from 'vitest'
import { merge, scan } from '../src/scan.js'
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
    expect((await scan('dewiki', docs(['1', 'haus']), candidates, fold)).source).toBe('dewiki')
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
