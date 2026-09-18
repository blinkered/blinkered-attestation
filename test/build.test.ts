import { describe, expect, it } from 'vitest'
import { build } from '../src/build.js'
import type { ScanResult } from '../src/scan.js'

const result = (
  source: string,
  tokens: number,
  hits: [string, number, string[]][],
): ScanResult => ({
  source,
  tokens,
  hits: new Map(hits.map(([word, count, locators]) => [word, { count, locators }])),
})

const THREE = [
  result('tat', 1000, [
    ['OKAY', 40, ['1']],
    ['PIZZA', 10, ['2']],
  ]),
  result('lznews', 1000, [
    ['OKAY', 30, ['https://a/x']],
    ['PIZZA', 8, ['https://a/y']],
  ]),
  result('gut', 1000, [['OKAY', 20, ['21034']]]),
]

const CANDIDATES = ['OKAY', 'PIZZA', 'ERFUNDEN']

describe('building a language', () => {
  const built = build('de', '2026-09-18', CANDIDATES, THREE, 1)

  it('keeps what three collections attest and drops the rest', () => {
    expect(built.kept).toBe(1)
    expect(built.droppedCount).toBe(2)
  })

  it('writes the word list in Blinkered’s own format', () => {
    expect(built.words).toBe('#blinkered/wordlist/2 language=de common=1 full=1\nOKAY\n')
  })

  it('records every candidate in the evidence, including ones nothing saw', () => {
    // "We looked and found nothing" is a finding. Leaving it out would make the evidence file
    // quietly smaller than the question it answers.
    expect(built.attestations).toContain('ERFUNDEN')
    expect(built.attestations).toContain('words=3')
  })

  it('puts the near misses at the top of the drop list', () => {
    // A word two collections attest is a missing collection; a word nothing attests is not.
    const [, first, second] = built.dropped.split('\n')
    expect(first?.startsWith('PIZZA\t2\t')).toBe(true)
    expect(second?.startsWith('ERFUNDEN\t0\t')).toBe(true)
  })

  it('names the count of dropped words in the drop list header', () => {
    expect(built.dropped.startsWith('#blinkered/dropped/1 words=2\n')).toBe(true)
  })

  it('reports the language it was asked for', () => {
    expect(built.language).toBe('de')
  })

  it('caps the common tier at the number of words there are', () => {
    const small = build('de', '2026-09-18', CANDIDATES, THREE, 9999)
    expect(small.words).toContain('common=1 full=1')
  })

  it('ranks the shipped list commonest first', () => {
    const four = [
      ...THREE,
      result('dewiki', 1000, [
        ['PIZZA', 900, ['7']],
        ['OKAY', 1, ['8']],
      ]),
    ]
    const ranked = build('de', '2026-09-18', CANDIDATES, four, 2)
    expect(ranked.words.split('\n').slice(1, 3)).toEqual(['PIZZA', 'OKAY'])
  })

  it('breaks a tie in the drop list alphabetically, so a rebuild diffs cleanly', () => {
    // Most of a drop list sits at the same independence; without this the order is unstable
    // and every rebuild looks like a change.
    const two = [
      result('tat', 1000, [
        ['ZEBRA', 1, ['1']],
        ['APFEL', 1, ['2']],
      ]),
      result('gut', 1000, [
        ['ZEBRA', 1, ['3']],
        ['APFEL', 1, ['4']],
      ]),
    ]
    const tied = build('de', '2026-09-18', ['ZEBRA', 'APFEL'], two, 1)
    expect(tied.dropped.split('\n').slice(1, 3)).toEqual([
      'APFEL\t2\ttat,gut\t1,1',
      'ZEBRA\t2\ttat,gut\t1,1',
    ])
  })

  it('builds nothing from nothing without falling over', () => {
    const empty = build('de', '2026-09-18', [], [], 10)
    expect(empty.kept).toBe(0)
    expect(empty.droppedCount).toBe(0)
    expect(empty.words).toBe('#blinkered/wordlist/2 language=de common=0 full=0\n\n')
  })
})

describe('a source that attests but does not rank', () => {
  it('lets a search hit satisfy the rule without distorting the order', () => {
    // `search` collects pages by looking for the words themselves, so its token total is an
    // artefact of what was searched for. Ranking by it would make the rarest words look like
    // the commonest, because they are the only ones anybody searched for.
    const withSearch = [
      result('dewiki', 1_000_000, [
        ['ALLTAG', 5000, ['1']],
        ['KURZSCHLIESSEN', 2, ['2']],
      ]),
      result('gut', 1_000_000, [
        ['ALLTAG', 4000, ['3']],
        ['KURZSCHLIESSEN', 1, ['4']],
      ]),
      result('tat', 1_000_000, [['ALLTAG', 3000, ['5']]]),
      result('search', 12, [['KURZSCHLIESSEN', 6, ['https://example.de/x']]]),
    ]
    const built = build('de', '2026-09-18', ['ALLTAG', 'KURZSCHLIESSEN'], withSearch, 2)
    // Both kept: three families each, search supplying the third for the rare one.
    expect(built.kept).toBe(2)
    // And the common word still ranks first, which it would not if six hits in twelve tokens
    // counted as a rate.
    expect(built.words.split('\n').slice(1, 3)).toEqual(['ALLTAG', 'KURZSCHLIESSEN'])
  })

  it('ranks by a source the registry has never heard of rather than discarding it', () => {
    // An unregistered source is a conformance failure, reported there. Silently dropping it
    // from the ranking here would change the order for a reason nothing in the output explains.
    const unknown = [
      result('mystery', 1_000_000, [['NEU', 900, ['1']]]),
      result('dewiki', 1_000_000, [['NEU', 1, ['2']]]),
      result('gut', 1_000_000, [['NEU', 1, ['3']]]),
    ]
    // mystery counts as its own family, so NEU has three and is kept.
    expect(build('de', '2026-09-18', ['NEU'], unknown, 1).kept).toBe(1)
  })
})
