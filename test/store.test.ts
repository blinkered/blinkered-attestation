import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  EVIDENCE_DIR,
  EVIDENCE_FILE,
  evidencePaths,
  readEvidence,
  writeEvidence,
} from '../src/store.js'
import type { WordEvidence } from '../src/evidence.js'

const repo = (): string => mkdtempSync(join(tmpdir(), 'blinkered-store-'))

const words = (count: number): WordEvidence[] =>
  Array.from({ length: count }, (_, at) => ({
    word: `WORT${String(at).padStart(5, '0')}`,
    attestations: [{ source: 'wiki:de', count: at + 1, locators: [String(at)] }],
  }))

describe('finding a language’s evidence', () => {
  it('reads a single file where there is one', () => {
    const root = repo()
    writeEvidence(root, 'de', '2026-09-20', words(3))
    expect(evidencePaths(root)).toEqual([join(root, EVIDENCE_FILE)])
  })

  it('refuses a repository holding both layouts rather than guessing', () => {
    // The duplication hazard: a reader taking both counts every word twice, and a reader taking
    // the first it finds gets a different answer depending on which it looked for.
    const root = repo()
    writeFileSync(join(root, EVIDENCE_FILE), '#blinkered/attestations/1 language=de words=0\n')
    mkdirSync(join(root, EVIDENCE_DIR))
    writeFileSync(
      join(root, EVIDENCE_DIR, '000.tsv'),
      '#blinkered/attestations/1 language=de words=0\n',
    )
    expect(() => evidencePaths(root)).toThrow('One layout or the other')
  })

  it('refuses a repository with no evidence at all', () => {
    expect(() => evidencePaths(repo())).toThrow('has no evidence')
  })

  it('refuses a shard directory holding no shards', () => {
    const root = repo()
    mkdirSync(join(root, EVIDENCE_DIR))
    expect(() => evidencePaths(root)).toThrow('holds no .tsv shards')
  })

  it('reads shards in name order, so a rebuild reads what it wrote', () => {
    const root = repo()
    writeEvidence(root, 'de', '2026-09-20', words(40), 400)
    const found = evidencePaths(root).map((path) => path.split('/').at(-1))
    expect(found).toEqual([...found].sort())
    expect(found[0]).toBe('000.tsv')
  })
})

describe('writing evidence', () => {
  it('keeps one file while it fits', () => {
    const root = repo()
    expect(writeEvidence(root, 'de', '2026-09-20', words(3))).toHaveLength(1)
    expect(existsSync(join(root, EVIDENCE_DIR))).toBe(false)
  })

  it('shards when one file would be too large', () => {
    const root = repo()
    const written = writeEvidence(root, 'de', '2026-09-20', words(40), 400)
    expect(written.length).toBeGreaterThan(1)
    expect(existsSync(join(root, EVIDENCE_FILE))).toBe(false)
  })

  it('splits between words, so every shard parses on its own', () => {
    const root = repo()
    writeEvidence(root, 'de', '2026-09-20', words(40), 400)
    // If a shard held half a line this would throw rather than return a word list.
    for (const name of readdirSync(join(root, EVIDENCE_DIR))) {
      expect(name).toMatch(/^\d{3}\.tsv$/u)
    }
    expect(readEvidence(root).words).toHaveLength(40)
  })

  it('loses no word and duplicates none when sharding', () => {
    const root = repo()
    writeEvidence(root, 'de', '2026-09-20', words(40), 400)
    const read = readEvidence(root).words.map((word) => word.word)
    expect(new Set(read).size).toBe(40)
    expect(read).toEqual(words(40).map((word) => word.word))
  })

  it('clears the other layout, so growing past the limit leaves nothing behind', () => {
    const root = repo()
    writeEvidence(root, 'de', '2026-09-20', words(3))
    expect(existsSync(join(root, EVIDENCE_FILE))).toBe(true)
    writeEvidence(root, 'de', '2026-09-20', words(40), 400)
    expect(existsSync(join(root, EVIDENCE_FILE))).toBe(false)
    // And back again.
    writeEvidence(root, 'de', '2026-09-20', words(3))
    expect(existsSync(join(root, EVIDENCE_DIR))).toBe(false)
  })
})

describe('reading evidence back', () => {
  it('round-trips a single file', () => {
    const root = repo()
    writeEvidence(root, 'de', '2026-09-20', words(3))
    const read = readEvidence(root)
    expect(read.language).toBe('de')
    expect(read.built).toBe('2026-09-20')
    expect(read.words).toHaveLength(3)
  })

  it('reports a sharded digest as its parts, since no single body exists to hash', () => {
    const root = repo()
    writeEvidence(root, 'de', '2026-09-20', words(40), 400)
    expect(readEvidence(root).digest).toContain('+')
  })
})
