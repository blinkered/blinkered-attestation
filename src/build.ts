/**
 * Turning scan results into the three files a dictionary repository ships.
 *
 * The orchestration lives here rather than in each language's repository so that fifty-one of
 * them cannot drift into fifty-one slightly different definitions of "kept". A language
 * repository says which collections to read and where they are; everything after that is this.
 *
 * Three files, and the third is the one people will actually argue about:
 *
 * - `ATTESTATIONS.tsv` — the evidence, every candidate that any collection saw.
 * - `words.txt` — what survived, in Blinkered's own format, commonest first.
 * - `dropped.tsv` — what did not, with the evidence that was not enough.
 *
 * `dropped.tsv` exists because the keep rate is not the check. A German build that keeps a
 * plausible 83% and drops PIZZA looks healthy in every summary statistic and is wrong; only
 * reading the drop list says so. It is an output of the build, not a debugging aid.
 */

import { byRate, independence, partition } from './attest.js'
import { sourceFor } from './registry.js'
import { formatEvidence } from './evidence.js'
import type { WordEvidence } from './evidence.js'
import { merge } from './scan.js'
import type { ScanResult } from './scan.js'

export interface Built {
  readonly language: string
  readonly attestations: string
  readonly words: string
  readonly dropped: string
  readonly kept: number
  readonly droppedCount: number
}

/**
 * Every candidate, including the ones nothing saw.
 *
 * A candidate no collection attests still belongs in the record: "we looked and found nothing"
 * is a finding, and leaving it out would make the evidence file silently smaller than the
 * question it answers.
 */
function allCandidates(
  candidates: Iterable<string>,
  seen: ReadonlyMap<string, { source: string; count: number; locators: readonly string[] }[]>,
): WordEvidence[] {
  const words: WordEvidence[] = []
  for (const [word, attestations] of seen) words.push({ word, attestations })
  for (const word of candidates) if (!seen.has(word)) words.push({ word, attestations: [] })
  return words
}

/** Blinkered's word list format. The common tier is the head of the ranked list. */
function wordList(language: string, ranked: readonly WordEvidence[], common: number): string {
  const head =
    `#blinkered/wordlist/2 language=${language} ` +
    `common=${String(Math.min(common, ranked.length))} full=${String(ranked.length)}`
  return `${head}\n${ranked.map((entry) => entry.word).join('\n')}\n`
}

/**
 * The drop list, with what evidence there was.
 *
 * Sorted by how close the word came — two sources first, then one, then none — because that is
 * the order a reviewer wants. A word two collections attest and a word nothing attests are
 * different kinds of mistake, and the first kind is where a missing collection shows up.
 */
function dropList(dropped: readonly WordEvidence[]): string {
  const ordered = [...dropped].sort((left, right) => {
    const difference = independence(right) - independence(left)
    return difference === 0 ? left.word.localeCompare(right.word) : difference
  })
  const lines = ordered.map((entry) => {
    const sources = entry.attestations.map((attestation) => attestation.source).join(',')
    const counts = entry.attestations.map((attestation) => String(attestation.count)).join(',')
    return `${entry.word}\t${String(independence(entry))}\t${sources}\t${counts}`
  })
  return `#blinkered/dropped/1 words=${String(ordered.length)}\n${lines.join('\n')}\n`
}

export function build(
  language: string,
  built: string,
  candidates: Iterable<string>,
  results: readonly ScanResult[],
  commonCut: number,
): Built {
  const { totals: scanned, words: seen } = merge(results)
  // A collection built by searching for the words themselves attests but does not rank; see
  // `ranks` in the registry. Dropping it from the denominator keeps it out of the ordering
  // without keeping it out of the evidence.
  const totals = new Map(
    [...scanned].filter(([source]) => {
      try {
        return sourceFor(source).ranks !== false
      } catch {
        return true
      }
    }),
  )
  const { kept, dropped } = partition(allCandidates(candidates, seen))
  const ranked = byRate(kept, totals)

  return {
    language,
    // The evidence records every candidate, kept or not, so a drop can be checked as easily
    // as a keep. It is the larger file and the more useful one.
    attestations: formatEvidence(language, built, byRate(allCandidates(candidates, seen), totals)),
    words: wordList(language, ranked, commonCut),
    dropped: dropList(dropped),
    kept: kept.length,
    droppedCount: dropped.length,
  }
}
