import { describe, expect, it } from 'vitest'
import { conform, shippedWords } from '../src/conformance.js'
import { formatEvidence } from '../src/evidence.js'
import type { WordEvidence } from '../src/evidence.js'

const supported = (word: string, sources: string[]): WordEvidence => ({
  word,
  attestations: sources.map((source) => ({ source, count: 4, locators: ['1'] })),
})

const THREE = ['tat', 'gut', 'wiki:de']

const list = (...words: string[]): string =>
  `#blinkered/wordlist/2 language=de common=1 full=${String(words.length)}\n${words.join('\n')}\n`

const evidenceFor = (...words: WordEvidence[]): string => formatEvidence('de', '2026-09-18', words)

describe('reading the shipped list', () => {
  it('takes the folded key and ignores the written form beside it', () => {
    expect(shippedWords(list('SCHADE', 'ACONG\tA CÒNG'))).toEqual(['SCHADE', 'ACONG'])
  })

  it('reads an empty list as no words rather than one blank one', () => {
    expect(shippedWords(list())).toEqual([])
  })
})

describe('a conforming repository', () => {
  it('passes when every shipped word has three sources and a locator each', () => {
    const evidence = evidenceFor(supported('SCHADE', THREE), supported('HAUS', THREE))
    expect(conform(list('SCHADE', 'HAUS'), evidence)).toEqual([])
  })

  it('takes parsed evidence as readily as text, for a repository whose evidence is sharded', () => {
    const evidence = {
      language: 'de',
      built: '2026-09-18',
      digest: 'x',
      words: [supported('SCHADE', THREE)],
    }
    expect(conform(list('SCHADE'), evidence)).toEqual([])
  })

  it('does not mind evidence holding words the list does not ship', () => {
    // The evidence is the record of what was looked up, so it is legitimately the larger set.
    const evidence = evidenceFor(supported('SCHADE', THREE), supported('ABSEITS', THREE))
    expect(conform(list('SCHADE'), evidence)).toEqual([])
  })
})

describe('conformance refuses', () => {
  it('evidence that does not parse, and says nothing else about the repository', () => {
    const failures = conform(list('SCHADE'), '<!doctype html>')
    // One clear failure beats a page of invented ones derived from evidence we cannot read.
    expect(failures).toHaveLength(1)
    expect(failures[0]?.check).toBe('evidence parses')
  })

  it('a shipped word with no evidence at all', () => {
    const failures = conform(list('SCHADE', 'ERFUNDEN'), evidenceFor(supported('SCHADE', THREE)))
    expect(failures[0]?.check).toBe('every shipped word has evidence')
    expect(failures[0]?.detail).toContain('ERFUNDEN')
  })

  it('a shipped word two sources attest, which is the whole point of the rule', () => {
    const evidence = evidenceFor(supported('SCHADE', ['tat', 'gut']))
    const failures = conform(list('SCHADE'), evidence)
    expect(failures[0]?.check).toBe('every shipped word has 3 independent sources')
    expect(failures[0]?.detail).toContain('SCHADE')
  })

  it('a source nobody registered, since its locators could not be resolved', () => {
    const evidence = evidenceFor(supported('SCHADE', ['tat', 'gut', 'mystery']))
    const failures = conform(list('SCHADE'), evidence)
    expect(failures[0]?.check).toBe('every source is registered')
    expect(failures[0]?.detail).toContain('mystery')
  })

  it('an attestation that names a source but no document', () => {
    const evidence = evidenceFor({
      word: 'SCHADE',
      attestations: [
        { source: 'tat', count: 4, locators: ['1'] },
        { source: 'gut', count: 4, locators: ['2'] },
        { source: 'wiki:de', count: 4, locators: [] },
      ],
    })
    const failures = conform(list('SCHADE'), evidence)
    expect(failures[0]?.check).toBe('every attestation says where to look')
  })

  it('reporting everything wrong at once rather than stopping at the first', () => {
    const evidence = evidenceFor(supported('SCHADE', ['tat', 'unknown']))
    const failures = conform(list('SCHADE', 'ERFUNDEN'), evidence)
    expect(failures.map((failure) => failure.check).sort()).toEqual([
      'every shipped word has 3 independent sources',
      'every shipped word has evidence',
      'every source is registered',
    ])
  })

  it('counting the shortfall rather than listing thousands of words', () => {
    const many = Array.from({ length: 12 }, (_, at) => `WORT${String(at)}`)
    const failures = conform(list(...many), evidenceFor())
    expect(failures[0]?.detail).toContain('12 without any')
    expect(failures[0]?.detail).toContain('and 7 more')
  })
})
