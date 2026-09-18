/**
 * Checking that a dictionary repository says what it claims to say.
 *
 * Fifty-one repositories built from one template will drift, and the drift that matters is not
 * cosmetic: a list that ships a word its evidence file does not support is a list making a claim
 * we cannot back. So this is the check that every `blinkered-dictionary-*` runs, and it asks the
 * questions a sceptic would ask in the order they would ask them.
 *
 * It deliberately does not check spelling, coverage or quality. Those are judgements about a
 * language, and they belong to somebody who speaks it. This only checks that the paperwork and
 * the goods agree.
 */

import { parseEvidence } from './evidence.js'
import type { EvidenceFile } from './evidence.js'
import { MINIMUM_SOURCES, independence } from './attest.js'
import { sourceFor } from './registry.js'

export interface Failure {
  readonly check: string
  readonly detail: string
}

/**
 * Every word the list ships, in the order it ships them.
 *
 * Taken as the folded keys alone: a written form is a fact about spelling and is checked by
 * Blinkered's own tests, not here.
 */
export function shippedWords(wordList: string): readonly string[] {
  return wordList
    .split('\n')
    .slice(1)
    .filter((line) => line !== '')
    .map((line) => line.split('\t')[0] as string)
}

/** How many failures to report before stopping, since one fault usually means thousands. */
const REPORTED = 5

function sample(words: readonly string[]): string {
  const shown = words.slice(0, REPORTED).join(', ')
  return words.length <= REPORTED ? shown : `${shown}, and ${String(words.length - REPORTED)} more`
}

/**
 * Runs every check and returns what failed, rather than throwing on the first problem.
 *
 * A repository with three things wrong should say so once. Stopping at the first turns fixing a
 * rebuild into three rebuilds.
 */
export function conform(wordList: string, evidenceText: string): readonly Failure[] {
  const failures: Failure[] = []

  let evidence: EvidenceFile
  try {
    evidence = parseEvidence(evidenceText)
  } catch (error) {
    // Nothing else can be checked against evidence that did not parse, and guessing at what it
    // might have said would turn one clear failure into a page of invented ones.
    return [{ check: 'evidence parses', detail: (error as Error).message }]
  }

  const unregistered = new Set<string>()
  for (const word of evidence.words) {
    for (const attestation of word.attestations) {
      try {
        sourceFor(attestation.source)
      } catch {
        unregistered.add(attestation.source)
      }
    }
  }
  if (unregistered.size > 0) {
    failures.push({
      check: 'every source is registered',
      detail: `unknown: ${sample([...unregistered].sort())}`,
    })
  }

  const supported = new Map(evidence.words.map((word) => [word.word, word]))
  const shipped = shippedWords(wordList)

  const missing = shipped.filter((word) => !supported.has(word))
  if (missing.length > 0) {
    failures.push({
      check: 'every shipped word has evidence',
      detail: `${String(missing.length)} without any: ${sample(missing)}`,
    })
  }

  // Counted over families, like the rule itself: a word attested only by a Wikipedia and a
  // Wikisource has two collections and one organization behind it.
  const thin = shipped.filter((word) => {
    const found = supported.get(word)
    return found !== undefined && independence(found) < MINIMUM_SOURCES
  })
  if (thin.length > 0) {
    failures.push({
      check: `every shipped word has ${String(MINIMUM_SOURCES)} independent sources`,
      detail: `${String(thin.length)} short: ${sample(thin)}`,
    })
  }

  const silent = evidence.words.filter((word) =>
    word.attestations.some((attestation) => attestation.locators.length === 0),
  )
  if (silent.length > 0) {
    failures.push({
      check: 'every attestation says where to look',
      detail: `${String(silent.length)} with a source and no locator: ${sample(
        silent.map((word) => word.word),
      )}`,
    })
  }

  return failures
}
