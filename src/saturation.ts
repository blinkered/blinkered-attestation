/**
 * How much a language gains from each family it consults, and where that stops paying.
 *
 * The rule needs three independent families, so the first two buy nothing at all and the third
 * buys everything they have in common. After that each family adds only the words the others
 * missed, and the question worth answering before spending an afternoon harvesting a twentieth
 * newspaper is where that curve flattens.
 *
 * **Greedily, best-first.** The curve depends entirely on what order families are added in, and
 * the order that matters is the good one: a language's answer to "how many families do I need"
 * should not be worsened by having consulted a bad one first. So at each step this takes the
 * family that rescues the most words, which reports the shape a careful builder would get rather
 * than the shape this particular `sources.mjs` happened to produce.
 *
 * Greedy is not provably optimal for set cover, but the gap is small and the alternative is
 * enumerating every subset of twenty-odd families.
 */

import { MINIMUM_SOURCES } from './attest.js'
import type { FamilyOf } from './attest.js'
import type { WordEvidence } from './evidence.js'

export interface Step {
  /** How many families have been consulted at this point. */
  readonly families: number
  /** The one added at this step, and what it was worth. */
  readonly added: string
  /** Words the rule would keep with these families. */
  readonly kept: number
  /** Share of the candidate list, 0 to 1. */
  readonly share: number
  /** Words this family added that the ones before it did not have. */
  readonly gained: number
}

/** Every family that attests anything, with the words each one saw. */
function wordsByFamily(
  words: readonly WordEvidence[],
  familyOf: FamilyOf,
): Map<string, Set<string>> {
  const byFamily = new Map<string, Set<string>>()
  for (const word of words) {
    for (const attestation of word.attestations) {
      let family: string
      try {
        family = familyOf(attestation.source)
      } catch {
        family = attestation.source
      }
      const seen = byFamily.get(family)
      if (seen === undefined) byFamily.set(family, new Set([word.word]))
      else seen.add(word.word)
    }
  }
  return byFamily
}

/** How many words reach the minimum, given only these families. */
function keptWith(
  chosen: readonly Set<string>[],
  candidates: readonly string[],
  minimum: number,
): number {
  let kept = 0
  for (const word of candidates) {
    let seen = 0
    for (const family of chosen) {
      if (family.has(word)) seen += 1
      if (seen >= minimum) {
        kept += 1
        break
      }
    }
  }
  return kept
}

/**
 * The curve: families consulted against words kept, adding the best family at each step.
 *
 * Every step is reported, including the first two, which keep nothing. That is not padding —
 * it is the shape of the rule, and a language whose third family is tiny is a language whose
 * curve starts almost flat. Korean is the example: two collections saw thirty-four thousand
 * words each and the list shipped two thousand six hundred.
 */
export function saturation(
  words: readonly WordEvidence[],
  familyOf: FamilyOf,
  total: number,
  minimum: number = MINIMUM_SOURCES,
): Step[] {
  const byFamily = wordsByFamily(words, familyOf)
  const candidates = words.map((word) => word.word)

  const chosen: Set<string>[] = []
  const chosenNames: string[] = []
  const steps: Step[] = []
  let previous = 0

  while (chosenNames.length < byFamily.size) {
    let best: { name: string; words: Set<string>; kept: number } | null = null
    for (const [name, seen] of byFamily) {
      if (chosenNames.includes(name)) continue
      const kept = keptWith([...chosen, seen], candidates, minimum)
      if (best === null || kept > best.kept) best = { name, words: seen, kept }
    }
    // `byFamily` is non-empty inside the loop by its own condition, so a best is always found.
    const found = best as { name: string; words: Set<string>; kept: number }

    chosen.push(found.words)
    chosenNames.push(found.name)
    steps.push({
      families: chosen.length,
      added: found.name,
      kept: found.kept,
      share: total === 0 ? 0 : found.kept / total,
      gained: found.kept - previous,
    })
    previous = found.kept
  }
  return steps
}
