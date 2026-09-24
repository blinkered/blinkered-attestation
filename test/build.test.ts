import { describe, expect, it } from 'vitest'
import { build, trustedSpellings } from '../src/build.js'
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
  const built = build('de', CANDIDATES, THREE, 1)

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
    expect(built.evidence.map((word) => word.word)).toContain('ERFUNDEN')
    expect(built.evidence).toHaveLength(3)
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
    const small = build('de', CANDIDATES, THREE, 9999)
    expect(small.words).toContain('common=1 full=1')
  })

  it('ranks the shipped list commonest first', () => {
    const four = [
      ...THREE,
      result('wiki:de', 1000, [
        ['PIZZA', 900, ['7']],
        ['OKAY', 1, ['8']],
      ]),
    ]
    const ranked = build('de', CANDIDATES, four, 2)
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
    const tied = build('de', ['ZEBRA', 'APFEL'], two, 1)
    expect(tied.dropped.split('\n').slice(1, 3)).toEqual([
      'APFEL\t2\tgut,tat\t1,1',
      'ZEBRA\t2\tgut,tat\t1,1',
    ])
  })

  it('writes a word the way the candidate list spelled it, when folding lost something', () => {
    // ABADIA is the key and ABADÍA the word. Without the written form the game spells the key,
    // and every attested list lost its accents that way before anybody noticed.
    const accented = build('de', CANDIDATES, THREE, 1, undefined, new Map([['OKAY', 'ÖKAY']]))
    expect(accented.words).toBe('#blinkered/wordlist/2 language=de common=1 full=1\nOKAY\tÖKAY\n')
  })

  it('builds nothing from nothing without falling over', () => {
    const empty = build('de', [], [], 10)
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
      result('wiki:de', 1_000_000, [
        ['ALLTAG', 5000, ['1']],
        ['KURZSCHLIESSEN', 2, ['2']],
      ]),
      result('gut', 1_000_000, [
        ['ALLTAG', 4000, ['3']],
        ['KURZSCHLIESSEN', 1, ['4']],
      ]),
      result('tat', 1_000_000, [['ALLTAG', 3000, ['5']]]),
      result('web:example.de', 12, [['KURZSCHLIESSEN', 6, ['https://example.de/x']]]),
    ]
    const built = build('de', ['ALLTAG', 'KURZSCHLIESSEN'], withSearch, 2)
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
      result('wiki:de', 1_000_000, [['NEU', 1, ['2']]]),
      result('gut', 1_000_000, [['NEU', 1, ['3']]]),
    ]
    // mystery counts as its own family, so NEU has three and is kept.
    expect(build('de', ['NEU'], unknown, 1).kept).toBe(1)
  })
})

describe('building on evidence already here', () => {
  // What a rebuild looks like after a collection has been deleted: the dump is gone, its
  // testimony is in the file, and the build must use the file rather than pretend the
  // collection never existed.
  const prior = {
    language: 'de',
    built: '2026-09-18',
    digest: 'x',
    totals: new Map([
      ['gut', 1000],
      ['wiki:de', 5000],
    ]),
    words: [
      {
        word: 'OKAY',
        attestations: [
          { source: 'gut', count: 20, locators: ['21034'] },
          { source: 'wiki:de', count: 9, locators: ['2129'] },
        ],
      },
      { word: 'PIZZA', attestations: [{ source: 'wiki:de', count: 3, locators: ['7740'] }] },
    ],
  }

  const fresh = [
    result('tat', 1000, [
      ['OKAY', 40, ['1']],
      ['PIZZA', 10, ['2']],
    ]),
  ]

  it('keeps the testimony of a collection it no longer has', () => {
    const built = build('de', CANDIDATES, fresh, 10, prior)
    const okay = built.evidence.find((word) => word.word === 'OKAY')
    expect(okay?.attestations.map((one) => one.source)).toEqual(['gut', 'tat', 'wiki:de'])
    expect(built.reused).toEqual(['gut', 'wiki:de'])
  })

  it('keeps their token totals, which is what lets the next build rank without them', () => {
    const built = build('de', CANDIDATES, fresh, 10, prior)
    expect(built.totals.get('gut')).toBe(1000)
    expect(built.totals.get('tat')).toBe(1000)
  })

  it('counts a reused family towards the rule, because a sighting does not expire', () => {
    // Three families, one of them scanned today and two read off the file. OKAY ships.
    const built = build('de', CANDIDATES, fresh, 10, prior)
    expect(built.words).toContain('OKAY')
    expect(built.kept).toBe(1)
  })

  it('prefers a fresh scan over the record, so putting a dump back means rescan', () => {
    const rescanned = [...fresh, result('gut', 99, [['PIZZA', 7, ['555']]])]
    const built = build('de', CANDIDATES, rescanned, 10, prior)
    expect(built.reused).toEqual(['wiki:de'])
    expect(built.totals.get('gut')).toBe(99)
    // OKAY was in Gutenberg per the record and not per today's scan; today's scan wins.
    const okay = built.evidence.find((word) => word.word === 'OKAY')
    expect(okay?.attestations.map((one) => one.source)).toEqual(['tat', 'wiki:de'])
  })

  it('keeps a word only the record saw, which is a whole collection’s tail', () => {
    // ERFUNDEN is in the record and in nothing scanned today. Dropping it would quietly delete
    // everything a deleted collection uniquely attested.
    const only = {
      ...prior,
      words: [
        ...prior.words,
        { word: 'ERFUNDEN', attestations: [{ source: 'gut', count: 2, locators: ['9'] }] },
      ],
    }
    const built = build('de', CANDIDATES, fresh, 10, only)
    const found = built.evidence.find((word) => word.word === 'ERFUNDEN')
    expect(found?.attestations.map((one) => one.source)).toEqual(['gut'])
  })

  it('forgets a word that is no longer a candidate, however well the record attests it', () => {
    // Basque's list lost its English, and a rebuild over the old record shipped AND and NEW on
    // reused sightings alone. The record answers questions; it does not get to ask them.
    const built = build('de', ['PIZZA'], fresh, 10, prior)
    expect(built.evidence.map((word) => word.word)).toEqual(['PIZZA'])
    expect(built.words).not.toContain('OKAY')
  })

  it('refuses a collection that scans empty when the record says it held text', () => {
    // A book shelf emptied of its books but not removed: scanning it would erase every word
    // the books attested, and nothing downstream would say so.
    expect(() => build('de', CANDIDATES, [...fresh, result('gut', 0, [])], 10, prior)).toThrow(
      /gut scanned empty, but the evidence here records 1000 tokens/u,
    )
  })

  it('accepts an empty collection the record never had', () => {
    expect(build('de', CANDIDATES, [...fresh, result('ia', 0, [])], 10, prior).kept).toBe(1)
  })

  it('builds from nothing when there is no evidence yet', () => {
    const built = build('de', CANDIDATES, fresh, 10)
    expect(built.reused).toEqual([])
  })
})

describe('which written forms to trust', () => {
  const TILES = new Set(['A', 'B', 'D', 'I', 'T', 'U', 'R'])

  it('trusts a mark many words use, which is what an accent looks like', () => {
    const rows = Array.from({ length: 3 }, (_, at) => [`ABADIA${String(at)}`, 'ABADÍA'] as const)
    expect(trustedSpellings(rows, TILES, 3).size).toBe(3)
  })

  it('drops a mark only a few words use, which is what corpus noise looks like', () => {
    // Icelandic ĀTT and BŨR: its accented letters are tiles, so a real spelling never differs.
    const rows = [
      ['ATT', 'ĀTT'],
      ['BUR', 'BŨR'],
    ] as const
    expect(trustedSpellings(rows, TILES, 3).size).toBe(0)
  })

  it('treats a composed and a decomposed mark as the same mark', () => {
    const rows = [
      ['ABADIA', 'ABADÍA'],
      ['DIA', 'DÍA'],
    ] as const
    expect(trustedSpellings(rows, TILES, 2).get('DIA')).toBe('DÍA')
  })

  it('defaults to fifty words, which clears every real accent in the candidate lists', () => {
    const rows = Array.from({ length: 49 }, (_, at) => [`A${String(at)}`, 'Á'] as const)
    expect(trustedSpellings(rows, TILES).size).toBe(0)
    expect(trustedSpellings([...rows, ['B', 'Á']], TILES).size).toBe(50)
  })
})
