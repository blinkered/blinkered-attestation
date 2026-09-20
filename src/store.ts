/**
 * Where a language's evidence lives on disk, and how it is split when it outgrows one file.
 *
 * German's evidence is 52MB with twelve collections and will grow; GitHub warns above 50MB a
 * file and refuses above 100MB. That is a limit on the **file**, not the repository, so the
 * answer is to shard.
 *
 * **One layout or the other, never both.** The duplication hazard is the whole reason this
 * module exists rather than a glob at each call site: a repository holding both
 * `ATTESTATIONS.tsv` and an `attestations/` directory would have every word counted twice by
 * anything that read them both, and once by anything that read the first it found. Which of
 * those happened would depend on the order a reader looked. So `evidencePaths` refuses that
 * repository outright, and every reader goes through it.
 *
 * Each shard is a **complete, independently valid evidence file** — its own header, its own word
 * count, its own digest. Splitting a single file mid-body would produce fragments that only
 * parse when reassembled in the right order, and a corrupt shard would be indistinguishable
 * from a missing one.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { formatEvidence, parseEvidence } from './evidence.js'
import type { EvidenceFile, WordEvidence } from './evidence.js'

export const EVIDENCE_FILE = 'ATTESTATIONS.tsv'
export const EVIDENCE_DIR = 'attestations'

/** Comfortably under GitHub's 50MB warning, with room for a language's evidence to grow. */
export const SHARD_BYTES = 40 * 1024 * 1024

/**
 * Every evidence file in a repository, in order, or an error if it cannot tell.
 *
 * Sorted by name, so `000.tsv` precedes `001.tsv` and a rebuild produces the same reading order
 * as the build that wrote them.
 */
export function evidencePaths(root: string): string[] {
  const single = join(root, EVIDENCE_FILE)
  const directory = join(root, EVIDENCE_DIR)
  const hasSingle = existsSync(single)
  const hasDirectory = existsSync(directory)

  if (hasSingle && hasDirectory) {
    throw new Error(
      `${root} has both ${EVIDENCE_FILE} and ${EVIDENCE_DIR}/. ` +
        'One layout or the other: holding both would count every word twice.',
    )
  }
  if (hasSingle) return [single]
  if (!hasDirectory) throw new Error(`${root} has no evidence: expected ${EVIDENCE_FILE}`)

  const shards = readdirSync(directory)
    .filter((name) => name.endsWith('.tsv'))
    .sort()
    .map((name) => join(directory, name))
  if (shards.length === 0) throw new Error(`${join(root, EVIDENCE_DIR)} holds no .tsv shards`)
  return shards
}

/**
 * Reads a language's evidence, however it is stored.
 *
 * Shards are merged by concatenating their word lists, which is safe because a word appears in
 * exactly one shard: `writeEvidence` splits between words and never within one.
 */
export function readEvidence(root: string): EvidenceFile {
  const parsed = evidencePaths(root).map((path) => parseEvidence(readFileSync(path, 'utf8')))
  const first = parsed[0] as EvidenceFile
  if (parsed.length === 1) return first

  const words: WordEvidence[] = []
  for (const shard of parsed) words.push(...shard.words)
  // The digest of a sharded file is the digests of its parts: no single body exists to hash,
  // and inventing one by concatenation would be a number that matches nothing on disk.
  return {
    language: first.language,
    built: first.built,
    words,
    digest: parsed.map((shard) => shard.digest).join('+'),
  }
}

/**
 * Writes evidence, splitting into shards only when one file would be too large.
 *
 * Returns the paths written. The other layout is removed first, so a language that grows past
 * the limit does not leave its old single file behind for `evidencePaths` to refuse.
 */
export function writeEvidence(
  root: string,
  language: string,
  built: string,
  words: readonly WordEvidence[],
  maxBytes: number = SHARD_BYTES,
): string[] {
  const whole = formatEvidence(language, built, words)
  const single = join(root, EVIDENCE_FILE)
  const directory = join(root, EVIDENCE_DIR)

  if (Buffer.byteLength(whole, 'utf8') <= maxBytes) {
    rmSync(directory, { recursive: true, force: true })
    writeFileSync(single, whole)
    return [single]
  }

  // Split between words, never within one, so every shard parses on its own.
  const shards: WordEvidence[][] = [[]]
  let bytes = 0
  for (const word of words) {
    const size = Buffer.byteLength(formatEvidence(language, built, [word]), 'utf8')
    const current = shards.at(-1) as WordEvidence[]
    if (current.length > 0 && bytes + size > maxBytes) {
      shards.push([word])
      bytes = size
    } else {
      current.push(word)
      bytes += size
    }
  }

  rmSync(single, { force: true })
  rmSync(directory, { recursive: true, force: true })
  mkdirSync(directory, { recursive: true })
  return shards.map((shard, at) => {
    const path = join(directory, `${String(at).padStart(3, '0')}.tsv`)
    writeFileSync(path, formatEvidence(language, built, shard))
    return path
  })
}
