import { describe, expect, it } from 'vitest'
import { SAMPLES_PER_SOURCE, digestOf, formatEvidence, parseEvidence } from '../src/evidence.js'
import { independence } from '../src/attest.js'
import type { WordEvidence } from '../src/evidence.js'

const schade: WordEvidence = {
  word: 'SCHADE',
  attestations: [
    { source: 'gut', count: 7, locators: ['21034'] },
    { source: 'cc', count: 412, locators: ['https://example.de/artikel'] },
    { source: 'dewiki', count: 88, locators: ['9912847', '7740221'] },
  ],
}

const abseits: WordEvidence = {
  word: 'ABSEITS',
  attestations: [
    { source: 'cc', count: 130, locators: ['https://example.de/spiel'] },
    { source: 'dewiki', count: 12, locators: [] },
  ],
}

describe('the evidence file', () => {
  it('writes sources sorted, with counts in the same order', () => {
    const [, line] = formatEvidence('de', '2026-09-18', [schade]).split('\n')
    expect(line).toBe(
      'SCHADE\tcc,dewiki,gut\t412,88,7\t' +
        'cc:https://example.de/artikel dewiki:9912847 dewiki:7740221 gut:21034',
    )
  })

  it('records the language, the count, the distinct sources and the date in its header', () => {
    const [head] = formatEvidence('de', '2026-09-18', [schade, abseits]).split('\n')
    expect(head).toContain('language=de')
    expect(head).toContain('words=2')
    // Three distinct sources across both words, not five attestations.
    expect(head).toContain('sources=3')
    expect(head).toContain('built=2026-09-18')
  })

  it('round-trips through the parser', () => {
    const parsed = parseEvidence(formatEvidence('de', '2026-09-18', [schade, abseits]))
    expect(parsed.language).toBe('de')
    expect(parsed.built).toBe('2026-09-18')
    expect(parsed.words).toHaveLength(2)
    expect(parsed.words[0]?.attestations).toEqual([
      { source: 'cc', count: 412, locators: ['https://example.de/artikel'] },
      { source: 'dewiki', count: 88, locators: ['9912847', '7740221'] },
      { source: 'gut', count: 7, locators: ['21034'] },
    ])
  })

  it('keeps a word whose sources carry no sample locators at all', () => {
    const bare: WordEvidence = {
      word: 'NUR',
      attestations: [{ source: 'cc', count: 3, locators: [] }],
    }
    const parsed = parseEvidence(formatEvidence('de', '2026-09-18', [bare]))
    expect(parsed.words[0]).toEqual({
      word: 'NUR',
      attestations: [{ source: 'cc', count: 3, locators: [] }],
    })
  })

  it('writes at most two samples per source, however many were found', () => {
    const many: WordEvidence = {
      word: 'VIELE',
      attestations: [{ source: 'gut', count: 9, locators: ['1', '2', '3', '4'] }],
    }
    const [, line] = formatEvidence('de', '2026-09-18', [many]).split('\n')
    expect(line?.endsWith('gut:1 gut:2')).toBe(true)
    expect(SAMPLES_PER_SOURCE).toBe(2)
  })

  it('is byte-identical when rebuilt from unchanged evidence', () => {
    const once = formatEvidence('de', '2026-09-18', [schade, abseits])
    // Attestations supplied in a different order must not move anything in the output.
    const shuffled: WordEvidence = { ...schade, attestations: [...schade.attestations].reverse() }
    expect(formatEvidence('de', '2026-09-18', [shuffled, abseits])).toBe(once)
  })

  it('round-trips a word no collection saw, as no attestations rather than one empty one', () => {
    // "We looked and found nothing" is a finding the file has to be able to state. The trap is
    // that `''.split(',')` yields one empty string rather than none, so this parsed as a single
    // attestation from a source named "" until a real build put it in front of the conformance
    // check. 100% branch coverage did not catch it; the bug is in the data, not the branches.
    const unseen: WordEvidence = { word: 'BLUFFST', attestations: [] }
    const parsed = parseEvidence(formatEvidence('de', '2026-09-18', [unseen]))
    expect(parsed.words[0]).toEqual({ word: 'BLUFFST', attestations: [] })
  })

  it('writes a word nothing attests as empty columns', () => {
    const [, line] = formatEvidence('de', '2026-09-18', [
      { word: 'BLUFFST', attestations: [] },
    ]).split('\n')
    expect(line).toBe('BLUFFST\t\t\t')
  })

  it('counts distinct collections rather than attestations', () => {
    expect(independence(schade)).toBe(3)
    expect(independence(abseits)).toBe(2)
  })
})

describe('the digest', () => {
  it('changes when the evidence changes and holds when it does not', () => {
    expect(digestOf('a')).toBe(digestOf('a'))
    expect(digestOf('a')).not.toBe(digestOf('b'))
  })

  it('is sixteen hex characters', () => {
    expect(digestOf('anything at all')).toMatch(/^[0-9a-f]{16}$/u)
  })
})

describe('the parser refuses', () => {
  it('a file that is not an evidence file', () => {
    expect(() => parseEvidence('<!doctype html>')).toThrow('not a Blinkered attestation file')
  })

  it('a truncated file, because a short download reads as valid text', () => {
    const text = formatEvidence('de', '2026-09-18', [schade, abseits])
    const lines = text.split('\n')
    expect(() => parseEvidence(`${lines[0] ?? ''}\n${lines[1] ?? ''}\n`)).toThrow(
      'truncated or mislabelled',
    )
  })

  it('a header with no word count', () => {
    expect(() => parseEvidence('#blinkered/attestations/1 language=de\n')).toThrow(
      'truncated or mislabelled',
    )
  })

  it('sources and counts that have drifted out of step', () => {
    const text = '#blinkered/attestations/1 language=de words=1\nX\tcc,gut\t4\t\n'
    expect(() => parseEvidence(text)).toThrow('2 sources and 1 counts')
  })

  it('a count that is not a number', () => {
    const text = '#blinkered/attestations/1 language=de words=1\nX\tcc\tmany\t\n'
    expect(() => parseEvidence(text)).toThrow('non-numeric count for cc')
  })

  it('a negative count', () => {
    const text = '#blinkered/attestations/1 language=de words=1\nX\tcc\t-2\t\n'
    expect(() => parseEvidence(text)).toThrow('non-numeric count for cc')
  })

  it('a line missing its columns', () => {
    const text = '#blinkered/attestations/1 language=de words=1\nX\tcc\n'
    expect(() => parseEvidence(text)).toThrow('malformed line')
  })

  it('a header naming no language, reporting the gap rather than guessing one', () => {
    // The message names the language it could not find, which is the empty string here. Worth
    // asserting because a file with no language is exactly the one somebody hand-edited.
    expect(() => parseEvidence('#blinkered/attestations/1 words=9\nX\tcc\t4\t\n')).toThrow(
      'attestations for "" are truncated or mislabelled',
    )
  })

  it('a locator with no source prefix', () => {
    const text = '#blinkered/attestations/1 language=de words=1\nX\tcc\t4\t21034\n'
    expect(() => parseEvidence(text)).toThrow('malformed locator')
  })
})

describe('the parser tolerates', () => {
  it('a line whose optional fourth column is missing entirely', () => {
    // Written by hand rather than by `formatEvidence`, which always emits four columns.
    const parsed = parseEvidence('#blinkered/attestations/1 language=de words=1\nX\tcc\t4\n')
    expect(parsed.words[0]).toEqual({
      word: 'X',
      attestations: [{ source: 'cc', count: 4, locators: [] }],
    })
  })
})
