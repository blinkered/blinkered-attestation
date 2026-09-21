import { describe, expect, it } from 'vitest'
import { archiveUrl, pageHolds, prove } from '../src/verify.js'
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
        'https://www.gutenberg.org/cache/epub/21034/pg21034.txt': 'ach, schade!',
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
      'https://www.gutenberg.org/cache/epub/21034/pg21034.txt',
      'https://tatoeba.org/en/sentences/show/230',
    ])
  })

  it('does not hold when a page loaded and the word was not on it', async () => {
    const proof = await prove(
      schade,
      fold,
      pages({
        'https://de.wikipedia.org/?curid=2129': 'wirklich schade',
        'https://www.gutenberg.org/cache/epub/21034/pg21034.txt': 'etwas ganz anderes',
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

  it('checks a dated locator against the archive of its year, not against the page today', async () => {
    // A Leipzig news URL from 2021 cites that page in 2021. Today's version of it is a different
    // article, and finding the word missing from it says nothing about the sighting.
    const crawled: WordEvidence = {
      word: 'SCHADE',
      attestations: [{ source: 'lz:deu_news_2021_1M', count: 5, locators: ['https://news/x'] }],
    }
    const proof = await prove(
      crawled,
      fold,
      pages({
        'https://web.archive.org/web/2021/https://news/x': 'wirklich schade',
        'https://news/x': 'ein ganz anderer Artikel',
      }),
      1,
    )
    expect(proof.checked[0]?.outcome).toBe('archived')
    expect(proof.holds).toBe(true)
  })

  it('falls back to the live page when the archive never saw it, and trusts it less', async () => {
    const crawled: WordEvidence = {
      word: 'SCHADE',
      attestations: [{ source: 'lz:deu_news_2021_1M', count: 5, locators: ['https://news/y'] }],
    }
    const held = await prove(crawled, fold, pages({ 'https://news/y': 'schade' }), 1)
    expect(held.checked[0]?.outcome).toBe('found')

    // Neither the archive nor the live page shows it: that is a page we could not read as it was,
    // not a page that contradicted us.
    const gone = await prove(crawled, fold, pages({ 'https://news/y': 'anderer Text' }), 1)
    expect(gone.checked[0]?.outcome).toBe('unreachable')
  })

  it('does not call a dated locator absent when the archive returned the wrong year', async () => {
    // /web/2021/ redirects to the nearest capture, which for German was routinely a 2022 version
    // of the same news URL. A word missing from a later article is not a contradiction.
    const crawled: WordEvidence = {
      word: 'SCHADE',
      attestations: [{ source: 'lz:deu_news_2021_1M', count: 5, locators: ['https://news/z'] }],
    }
    const proof = await prove(
      crawled,
      fold,
      pages({ 'https://web.archive.org/web/2021/https://news/z': 'ein späterer Artikel' }),
      1,
    )
    expect(proof.checked[0]?.outcome).toBe('unreachable')
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

describe('the Internet Archive', () => {
  it('builds a snapshot URL without an API call, which is what makes it usable', () => {
    // The availability API rate-limits hard; /web/<when>/<url> redirects to the nearest capture.
    expect(archiveUrl('http://book.daum.net/detail/book.do?bookid=KOR97889')).toBe(
      'https://web.archive.org/web/2020/http://book.daum.net/detail/book.do?bookid=KOR97889',
    )
  })

  it('takes a year, so a crawl can be checked against a contemporaneous capture', () => {
    expect(archiveUrl('http://x.kr/a', '2013')).toBe(
      'https://web.archive.org/web/2013/http://x.kr/a',
    )
  })

  it('rescues a citation whose live page has died', async () => {
    const dead: WordEvidence = {
      word: 'SCHADE',
      attestations: [
        { source: 'wiki:de', count: 1, locators: ['1'] },
        { source: 'gut', count: 1, locators: ['2'] },
        { source: 'tat', count: 1, locators: ['3'] },
      ],
    }
    const archiveOnly = pages({
      'https://de.wikipedia.org/?curid=1': 'schade',
      'https://www.gutenberg.org/cache/epub/2/pg2.txt': 'schade',
      // The live Tatoeba page is gone; the archive has it.
      'https://web.archive.org/web/2020/https://tatoeba.org/en/sentences/show/3': 'es ist schade',
    })
    const proof = await prove(dead, fold, archiveOnly, 3)
    expect(proof.holds).toBe(true)
    expect(proof.checked[2]?.outcome).toBe('archived')
  })

  it('does not go to the archive when the live page answered', async () => {
    // A page that loaded without the word is a finding; a second opinion would bury it.
    const both = pages({
      'https://de.wikipedia.org/?curid=1': 'etwas anderes',
      'https://web.archive.org/web/2020/https://de.wikipedia.org/?curid=1': 'schade',
    })
    const one: WordEvidence = {
      word: 'SCHADE',
      attestations: [{ source: 'wiki:de', count: 1, locators: ['1'] }],
    }
    expect((await prove(one, fold, both, 1)).checked[0]?.outcome).toBe('absent')
  })

  it('reports absent when the archive has the page but not the word', async () => {
    const one: WordEvidence = {
      word: 'SCHADE',
      attestations: [{ source: 'tat', count: 1, locators: ['3'] }],
    }
    const archived = pages({
      'https://web.archive.org/web/2020/https://tatoeba.org/en/sentences/show/3': 'ganz anderes',
    })
    expect((await prove(one, fold, archived, 1)).checked[0]?.outcome).toBe('absent')
  })
})
