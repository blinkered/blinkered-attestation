/**
 * Turning scan results into the three files a dictionary repository ships.
 *
 * The orchestration lives here rather than in each language's repository so that fifty-one of
 * them cannot drift into fifty-one slightly different definitions of "kept". A language
 * repository says which collections to read and where they are; everything after that is this.
 *
 * Three files, and the third is the one people will actually argue about:
 *
 * - the evidence, every candidate that any collection saw, written by `writeEvidence`.
 * - `words.txt` — what survived, in Blinkered's own format, commonest first.
 * - `dropped.tsv` — what did not, with the evidence that was not enough.
 *
 * `dropped.tsv` exists because the keep rate is not the check. A German build that keeps a
 * plausible 83% and drops PIZZA looks healthy in every summary statistic and is wrong; only
 * reading the drop list says so. It is an output of the build, not a debugging aid.
 */

import { byRate, independence, partition } from './attest.js'
import { sourceFor } from './registry.js'
import type { Attestation, EvidenceFile, WordEvidence } from './evidence.js'
import { merge } from './scan.js'
import type { ScanResult } from './scan.js'

export interface Built {
  readonly language: string
  /** Playable tokens per collection, carried into the evidence so it need not be re-counted. */
  readonly totals: ReadonlyMap<string, number>
  /** Collections whose testimony came from the evidence already here, not from a fresh scan. */
  readonly reused: readonly string[]
  /**
   * The evidence, as records rather than as text.
   *
   * German's evidence passed sixty megabytes once it had a harvest behind it, and GitHub warns
   * above fifty a file. Formatting it here would force every caller to write one file; handing
   * back the records lets `writeEvidence` decide whether this language still fits in one.
   */
  readonly evidence: readonly WordEvidence[]
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

/**
 * The written forms worth trusting, from a candidate list's second column.
 *
 * The column is the commonest spelling a corpus had for each key, and a corpus is not careful.
 * Where a language's accented letters are tiles of their own, a real spelling never differs from
 * its key, so what is there is noise: Icelandic ĀTT and BŨR, Croatian SLUÈAJEVI for SLUČAJEVI,
 * Russian Ќ. Where folding removes marks it is the whole point: Spanish has 53,000 of them.
 *
 * So a character that is not a tile is trusted only when many different words use it. Spanish Á
 * clears that thousands of times; Icelandic Ũ twenty-three. A spelling with an untrusted
 * character is dropped, and the game spells the key instead, which is what it did before any of
 * this was carried: the filter can only make a word look better, never worse.
 */
export function trustedSpellings(
  rows: Iterable<readonly [string, string]>,
  tiles: ReadonlySet<string>,
  atLeast = 50,
): Map<string, string> {
  const all = [...rows].map(([word, spelling]) => [word, spelling.normalize('NFC')] as const)
  const uses = new Map<string, number>()
  for (const [, spelling] of all) {
    for (const mark of new Set(spelling)) {
      if (!tiles.has(mark)) uses.set(mark, (uses.get(mark) ?? 0) + 1)
    }
  }
  const trusted = (mark: string): boolean =>
    tiles.has(mark) || (uses.get(mark) as number) >= atLeast
  return new Map(all.filter(([, spelling]) => [...spelling].every(trusted)))
}

/**
 * Blinkered's word list format. The common tier is the head of the ranked list.
 *
 * A word carries its written form after a tab when folding lost something: ABADIA is the key and
 * ABADÍA is the word, and Vietnamese ACÒNG is A CÒNG. Only the candidate list knows the written
 * form, so it is handed in rather than recovered. Dropping it cost every attested list its
 * accents, silently, because the game falls back to spelling the key.
 */
function wordList(
  language: string,
  ranked: readonly WordEvidence[],
  common: number,
  written: ReadonlyMap<string, string>,
): string {
  const head =
    `#blinkered/wordlist/2 language=${language} ` +
    `common=${String(Math.min(common, ranked.length))} full=${String(ranked.length)}`
  const line = (word: string): string => {
    const spelling = written.get(word)
    return spelling === undefined ? word : `${word}\t${spelling}`
  }
  return `${head}\n${ranked.map((entry) => line(entry.word)).join('\n')}\n`
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

/**
 * Everything the evidence already here recorded, for collections this build did not scan.
 *
 * This is what makes a collection disposable. A build that adds a literary family to a language
 * has no reason to re-read twenty-four gigabytes of Wikipedia to rediscover what the last build
 * wrote down about it; it reads the lines. A collection is reused when the evidence has a token
 * total for it and this build produced no result of its own — which in practice means its dump
 * has been deleted, and deleting a dump is exactly how you say "use what is recorded".
 *
 * Only for words that are still candidates. A candidate list can shrink, as Basque's did when its
 * English came out, and a record that carried every word it ever held would ship AND and NEW on
 * old sightings alone, with a header still counting the words that were removed and a
 * conformance check that passes, because the evidence really does support them.
 */
function recorded(
  prior: EvidenceFile | undefined,
  fresh: ReadonlySet<string>,
  candidates: ReadonlySet<string>,
): { totals: Map<string, number>; words: Map<string, Attestation[]>; reused: string[] } {
  const totals = new Map<string, number>()
  const words = new Map<string, Attestation[]>()
  if (prior === undefined) return { totals, words, reused: [] }

  const reused = [...prior.totals.keys()].filter((source) => !fresh.has(source))
  const keep = new Set(reused)
  for (const [source, tokens] of prior.totals) if (keep.has(source)) totals.set(source, tokens)
  for (const word of prior.words) {
    if (!candidates.has(word.word)) continue
    const kept = word.attestations.filter((attestation) => keep.has(attestation.source))
    if (kept.length > 0) words.set(word.word, kept)
  }
  return { totals, words, reused: reused.sort() }
}

export function build(
  language: string,
  candidates: Iterable<string>,
  results: readonly ScanResult[],
  commonCut: number,
  prior?: EvidenceFile,
  written: ReadonlyMap<string, string> = new Map(),
): Built {
  const asked = new Set(candidates)
  const { totals: scanned, words: freshWords } = merge(results)
  const carried = recorded(prior, new Set(scanned.keys()), asked)

  // Fresh testimony and recorded testimony, one map. A source appears in exactly one of them:
  // `recorded` keeps only what this build did not scan.
  const seen = new Map<string, { source: string; count: number; locators: readonly string[] }[]>()
  for (const [word, attestations] of freshWords) {
    if (asked.has(word)) seen.set(word, [...attestations])
  }
  for (const [word, attestations] of carried.words) {
    seen.set(word, [...(seen.get(word) ?? []), ...attestations])
  }
  for (const [word, attestations] of seen) {
    seen.set(
      word,
      [...attestations].sort((left, right) => left.source.localeCompare(right.source)),
    )
  }
  // Everything this build knows about, scanned or recorded. This is what goes into the evidence,
  // so a later build can reuse any of it; a source with no recorded total can never be reused,
  // which is how a deleted harvest file would quietly cost a language its publishers.
  const all = new Map(scanned)
  for (const [source, tokens] of carried.totals) all.set(source, tokens)

  // A collection built by searching for the words themselves attests but does not rank; see
  // `ranks` in the registry. Dropping it from the denominator keeps it out of the ordering
  // without keeping it out of the evidence.
  const totals = new Map(
    [...all].filter(([source]) => {
      try {
        return sourceFor(source).ranks !== false
      } catch {
        return true
      }
    }),
  )
  const { kept, dropped } = partition(allCandidates(asked, seen))
  const ranked = byRate(kept, totals)

  return {
    language,
    totals: all,
    reused: carried.reused,
    // The evidence records every candidate, kept or not, so a drop can be checked as easily
    // as a keep. It is the larger file and the more useful one.
    evidence: byRate(allCandidates(asked, seen), totals),
    words: wordList(language, ranked, commonCut, written),
    dropped: dropList(dropped),
    kept: kept.length,
    droppedCount: dropped.length,
  }
}
