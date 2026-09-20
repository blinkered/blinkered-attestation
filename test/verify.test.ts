import { describe, expect, it } from 'vitest'
import { pageHolds, prove } from '../src/verify.js'
import type { Reader } from '../src/verify.js'
import type { WordEvidence } from '../src/evidence.js'

/** German's real behaviour, near enough: upper-case, ß to SS, umlauts kept. */
const fold = (raw: string): string => raw.toUpperCase().replace(/ß/gu, 'SS')

const pages =
  (found: Record<string, string>): Reader =>
  async (url) =>
    found[url] ?? null

describe('whether a page holds a word', () => {
  it('compares through the fold, not by eye', () => {
    // The Hamburg article attests TSCHÜSS by containing the pre-1996 spelling. A search for
    // "tschüss" finds nothing and reports a fault that is not there; this has happened twice.
    expect(pageHolds('… genannt „tschüß“ (gesungen von …', 'TSCHÜSS', fold)).toBe(true)
  })

  it('matches whole tokens, not substrings', () => {
    expect(pageHolds('Haustür', 'HAUS', fold)).toBe(false)
    expect(pageHolds('das Haus dort', 'HAUS', fold)).toBe(true)
  })

  it('says no when the word is simply not there', () => {
    expect(pageHolds('ein ganz anderer Text', 'PIZZA', fold)).toBe(false)
  })
})

const schade: WordEvidence = {
  word: 'SCHADE',
  attestations: [
    { source: 'wiki:de', count: 9, locators: ['2129'] },
    { source: 'gut', count: 4, locators: ['21034'] },
    { source: 'tat', count: 2, locators: ['230'] },
  ],
}

describe('proving a word', () => {
  it('holds when three families still show it', async () => {
    const proof = await prove(
      schade,
      fold,
      pages({
        'https://de.wikipedia.org/?curid=2129': 'wirklich schade',
        'https://www.gutenberg.org/ebooks/21034': 'ach, schade!',
        'https://tatoeba.org/en/sentences/show/230': 'Es ist schade, dass …',
      }),
      3,
    )
    expect(proof.holds).toBe(true)
    expect(proof.families).toBe(3)
    expect(proof.checked.every((check) => check.outcome === 'found')).toBe(true)
  })

  it('expands each locator into the URL a person would open', async () => {
    const proof = await prove(schade, fold, pages({}), 3)
    expect(proof.checked.map((check) => check.url)).toEqual([
      'https://de.wikipedia.org/?curid=2129',
      'https://www.gutenberg.org/ebooks/21034',
      'https://tatoeba.org/en/sentences/show/230',
    ])
  })

  it('does not hold when a page loaded and the word was not on it', async () => {
    const proof = await prove(
      schade,
      fold,
      pages({
        'https://de.wikipedia.org/?curid=2129': 'wirklich schade',
        'https://www.gutenberg.org/ebooks/21034': 'etwas ganz anderes',
        'https://tatoeba.org/en/sentences/show/230': 'Es ist schade, dass …',
      }),
      3,
    )
    expect(proof.holds).toBe(false)
    expect(proof.checked[1]?.outcome).toBe('absent')
  })

  it('tells a page that says no from a page that could not be read', async () => {
    // A paywall or a moved article is not evidence that we were wrong.
    const proof = await prove(schade, fold, pages({}), 3)
    expect(proof.checked.every((check) => check.outcome === 'unreachable')).toBe(true)
    expect(proof.holds).toBe(false)
  })

  it('counts families rather than pages, like the rule it is checking', async () => {
    const twice: WordEvidence = {
      word: 'SCHADE',
      attestations: [
        { source: 'wiki:de', count: 9, locators: ['1', '2'] },
        { source: 'wikisource:de', count: 3, locators: ['3'] },
      ],
    }
    const proof = await prove(
      twice,
      fold,
      pages({
        'https://de.wikipedia.org/?curid=1': 'schade',
        'https://de.wikipedia.org/?curid=2': 'schade',
        'https://de.wikisource.org/?curid=3': 'schade',
      }),
      3,
    )
    // Three pages, all found, but one Wikimedia between them.
    expect(proof.families).toBe(1)
    expect(proof.holds).toBe(false)
  })

  it('reports a source the registry cannot resolve rather than skipping it', async () => {
    const unknown: WordEvidence = {
      word: 'X',
      attestations: [{ source: 'mystery', count: 1, locators: ['1'] }],
    }
    const proof = await prove(unknown, fold, pages({}), 3)
    expect(proof.checked[0]?.outcome).toBe('unresolvable')
  })

  it('has nothing to check for a word nothing attests', async () => {
    const proof = await prove({ word: 'X', attestations: [] }, fold, pages({}), 3)
    expect(proof.checked).toEqual([])
    expect(proof.holds).toBe(false)
  })
})
