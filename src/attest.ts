/**
 * The rule: three independent collections, or the word does not ship.
 *
 * "Independent" means three different collections, not three documents inside one, and — the
 * refinement that matters once a language has more than a handful of sources — not three
 * collections gathered by the same people. A Wikipedia and a Wikisource are two collections and
 * one Wikimedia. Five years of Leipzig news are five collections and one crawler. Counting
 * those as three sightings would let a word clear the rule on a single organization's word,
 * which is the thing the rule exists to prevent, so the count is over **families**.
 *
 * Rarity is not part of this rule and never deletes a word. A word attested by three
 * collections is real whether it is common or not; how common it is decides which tier it lands
 * in, which is a question about whether a board should be required to be solvable from it. That
 * separation is inherited from Blinkered and is load-bearing: `docs/DICTIONARIES.md` records a
 * frequency floor that was tried and withdrawn because it rejected SWALE, an ordinary English
 * word with thirteen occurrences in a corpus of film subtitles. Thirteen occurrences is a fact
 * about films. Three collections is a fact about English.
 */

import type { WordEvidence } from './evidence.js'
import { sourceFor } from './registry.js'

/** Three, and the reason is in this file's header rather than in a constant's name. */
export const MINIMUM_SOURCES = 3

/** Which organization gathered a collection. Registry-backed, and injectable for tests. */
export type FamilyOf = (source: string) => string

const registeredFamily: FamilyOf = (source) => sourceFor(source).family

/**
 * How many independent families attest this word. The number the drop rule reads.
 *
 * A source the registry does not know is counted under its own id rather than refused: the
 * conformance check is where an unregistered source is a failure, and making the count throw
 * would turn one bad row into an unreadable build.
 */
export function independence(
  evidence: WordEvidence,
  familyOf: FamilyOf = registeredFamily,
): number {
  const found = new Set<string>()
  for (const attestation of evidence.attestations) {
    try {
      found.add(familyOf(attestation.source))
    } catch {
      found.add(attestation.source)
    }
  }
  return found.size
}

export interface Partition {
  readonly kept: readonly WordEvidence[]
  readonly dropped: readonly WordEvidence[]
}

/**
 * Splits candidates into what the evidence supports and what it does not.
 *
 * Both halves are returned because the dropped half is the one worth reading. A build that
 * keeps a plausible number of words can still be wrong in a way only a speaker will see, and
 * the drop list is where that shows up — so it is an output, not a diagnostic.
 */
export function partition(
  words: readonly WordEvidence[],
  minimum: number = MINIMUM_SOURCES,
  familyOf: FamilyOf = registeredFamily,
): Partition {
  const kept: WordEvidence[] = []
  const dropped: WordEvidence[] = []
  for (const word of words) {
    if (independence(word, familyOf) >= minimum) kept.push(word)
    else dropped.push(word)
  }
  return { kept, dropped }
}

/**
 * How many tokens each collection contributed, which is what makes counts comparable.
 *
 * Without it a hit in Tatoeba's few million words and a hit in a web crawl's few billion would
 * carry the same weight, and the ranking would say more about which collections we happened to
 * scan than about the language.
 */
export type SourceTotals = ReadonlyMap<string, number>

const PER = 1_000_000

/**
 * Occurrences per million, averaged across every collection, counting a miss as zero.
 *
 * Averaging over *every* collection rather than only the attesting ones is the deliberate part.
 * Take the mean over attesting collections and a word one source has seen often outranks a word
 * every source has seen occasionally, which is backwards: agreement across sources is the
 * evidence we are ranking by everywhere else in this project, and the ranking should not
 * contradict the drop rule.
 *
 * This is a starting point, not a settled answer. It gets checked the way Blinkered checks
 * everything — by measuring board density against the result — rather than by argument.
 */
export function rateOf(evidence: WordEvidence, totals: SourceTotals): number {
  if (totals.size === 0) return 0
  let sum = 0
  for (const [source, total] of totals) {
    const found = evidence.attestations.find((attestation) => attestation.source === source)
    if (found !== undefined && total > 0) sum += (found.count / total) * PER
  }
  return sum / totals.size
}

/**
 * Commonest first, ties broken alphabetically.
 *
 * The tie-break is not cosmetic. A great many words share a rate once the tail is reached, and
 * an unstable order there would make every rebuild produce a different file and every diff
 * unreadable.
 */
export function byRate(
  words: readonly WordEvidence[],
  totals: SourceTotals,
): readonly WordEvidence[] {
  // Rated once and carried alongside, rather than looked up per comparison. A map keyed by the
  // word would need a fallback for a key it must always hold, and a fallback that cannot happen
  // is a branch no test can reach honestly.
  const rated = words.map((word) => ({ word, rate: rateOf(word, totals) }))
  rated.sort((left, right) =>
    right.rate === left.rate
      ? left.word.word.localeCompare(right.word.word)
      : right.rate - left.rate,
  )
  return rated.map((entry) => entry.word)
}
