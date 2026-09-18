import { describe, expect, it } from 'vitest'
import { MINIMUM_SOURCES, byRate, partition, rateOf } from '../src/attest.js'
import type { WordEvidence } from '../src/evidence.js'

const word = (name: string, counts: Record<string, number>): WordEvidence => ({
  word: name,
  attestations: Object.entries(counts).map(([source, count]) => ({
    source,
    count,
    locators: [],
  })),
})

describe('the drop rule', () => {
  it('keeps a word three collections attest', () => {
    const three = word('SCHADE', { cc: 412, dewiki: 88, gut: 7 })
    expect(partition([three]).kept).toEqual([three])
  })

  it('drops a word only two collections attest, however many times they saw it', () => {
    const loud = word('GURFLE', { cc: 99_999, dewiki: 99_999 })
    const { kept, dropped } = partition([loud])
    expect(kept).toEqual([])
    expect(dropped).toEqual([loud])
  })

  it('keeps a word three collections barely attest, because rarity does not delete', () => {
    // The SWALE case from Blinkered's docs: seen once each, but seen in three places.
    const swale = word('SWALE', { cc: 1, gut: 1, tat: 1 })
    expect(partition([swale]).kept).toEqual([swale])
  })

  it('counts collections rather than documents, so one loud source is still one source', () => {
    expect(partition([word('MIRROR', { cc: 5000 })]).kept).toEqual([])
  })

  it('takes a minimum other than three, for measuring what the rule costs', () => {
    const two = word('ABSEITS', { cc: 130, dewiki: 12 })
    expect(partition([two], 2).kept).toEqual([two])
    expect(MINIMUM_SOURCES).toBe(3)
  })

  it('returns both halves, because the dropped half is the one worth reading', () => {
    const { kept, dropped } = partition([
      word('KEPT', { cc: 1, gut: 1, tat: 1 }),
      word('GONE', { cc: 1 }),
    ])
    expect(kept.map((entry) => entry.word)).toEqual(['KEPT'])
    expect(dropped.map((entry) => entry.word)).toEqual(['GONE'])
  })
})

describe('the aggregate rate', () => {
  const totals = new Map([
    ['cc', 1_000_000],
    ['gut', 1_000_000],
    ['tat', 1_000_000],
  ])

  it('is occurrences per million averaged over every collection', () => {
    // Three hits in one collection of a million, nothing in the other two: 3/3 = 1.
    expect(rateOf(word('X', { cc: 3 }), totals)).toBeCloseTo(1)
  })

  it('counts a miss as zero rather than skipping the collection', () => {
    const everywhere = rateOf(word('EVERYWHERE', { cc: 2, gut: 2, tat: 2 }), totals)
    const nowhere = rateOf(word('NOWHERE', { cc: 6 }), totals)
    // Same six hits. Agreement across sources has to win, or the ranking contradicts the rule.
    expect(everywhere).toBeCloseTo(nowhere)
    expect(rateOf(word('BROAD', { cc: 3, gut: 3, tat: 3 }), totals)).toBeGreaterThan(nowhere)
  })

  it('is zero when no collection was scanned', () => {
    expect(rateOf(word('X', { cc: 5 }), new Map())).toBe(0)
  })

  it('ignores a collection that contributed no tokens rather than dividing by zero', () => {
    const empty = new Map([
      ['cc', 0],
      ['gut', 1_000_000],
    ])
    expect(Number.isFinite(rateOf(word('X', { cc: 5, gut: 1 }), empty))).toBe(true)
  })

  it('scales with collection size, so a hit in a small corpus counts for more', () => {
    const lopsided = new Map([
      ['small', 1_000],
      ['large', 1_000_000_000],
    ])
    const inSmall = rateOf(word('A', { small: 1 }), lopsided)
    const inLarge = rateOf(word('B', { large: 1 }), lopsided)
    expect(inSmall).toBeGreaterThan(inLarge)
  })
})

describe('ranking', () => {
  const totals = new Map([
    ['cc', 1_000_000],
    ['gut', 1_000_000],
  ])

  it('puts the commonest first', () => {
    const ranked = byRate([word('RARE', { cc: 1 }), word('COMMON', { cc: 900, gut: 900 })], totals)
    expect(ranked.map((entry) => entry.word)).toEqual(['COMMON', 'RARE'])
  })

  it('breaks ties alphabetically, so a rebuild produces the same file', () => {
    const ranked = byRate([word('ZEBRA', { cc: 5 }), word('APFEL', { cc: 5 })], totals)
    expect(ranked.map((entry) => entry.word)).toEqual(['APFEL', 'ZEBRA'])
  })

  it('does not mutate its input', () => {
    const words = [word('B', { cc: 1 }), word('A', { cc: 1 })]
    byRate(words, totals)
    expect(words.map((entry) => entry.word)).toEqual(['B', 'A'])
  })

  it('ranks a word absent from the totals map at the bottom rather than crashing', () => {
    const ranked = byRate([word('KNOWN', { cc: 10 }), word('ORPHAN', { other: 99 })], totals)
    expect(ranked.map((entry) => entry.word)).toEqual(['KNOWN', 'ORPHAN'])
  })
})
