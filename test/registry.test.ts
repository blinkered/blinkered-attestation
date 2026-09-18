import { describe, expect, it } from 'vitest'
import { SOURCES, expandLocator, sourceFor, validateSourceId } from '../src/registry.js'

describe('the source registry', () => {
  it('expands a short id into a link somebody can open', () => {
    expect(expandLocator(sourceFor('gut'), '21034')).toBe('https://www.gutenberg.org/ebooks/21034')
    expect(expandLocator(sourceFor('dewiki'), '9912847')).toBe(
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
    ['a colon', 'de:wiki'],
    ['a space', 'de wiki'],
  ])('is refused when it contains %s, because the format spends that character', (_, id) => {
    expect(() => validateSourceId(id)).toThrow('reserved character')
  })

  it('is refused when empty', () => {
    expect(() => validateSourceId('')).toThrow('source id is empty')
  })

  it('is accepted when it is plain', () => {
    expect(() => validateSourceId('dewiki')).not.toThrow()
  })
})
