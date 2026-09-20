/**
 * Proving a word, from the evidence file back out to the pages it cites.
 *
 * Everything else in this project produces the claim. This checks it, the way somebody who did
 * not believe us would: take a word, read what the evidence says attests it, turn each locator
 * into a URL, fetch that URL, and look for the word on the page.
 *
 * **Through the fold, never by eye.** A word ships under its folded key — SCHADE, ひーる,
 * ㄱㅏㄱ — and almost never appears that way on the page. The Hamburg article attests TSCHÜSS by
 * containing `tschüß`, in the orthography Germany reformed in 1996, and a naive search for
 * "tschüss" finds nothing and reports a fault that is not there. That has now happened twice
 * while spot-checking by hand, which is why the check belongs in code: the only reliable
 * comparison is between the stored key and every token of the page put through the game's own
 * fold.
 *
 * A word this cannot prove is not necessarily a word we were wrong about — a page can be
 * paywalled, moved, or rewritten since the harvest — so the verdict distinguishes "the page does
 * not have it" from "the page could not be read".
 */

import { expandLocator, sourceFor } from './registry.js'
import type { WordEvidence } from './evidence.js'

/** What happened when we went and looked. */
export type Outcome =
  /** The page loaded and the word is on it. The claim holds. */
  | 'found'
  /** The page loaded and the word is not on it. The claim does not hold. */
  | 'absent'
  /** The page could not be read at all, so it says nothing either way. */
  | 'unreachable'
  /** The source is not registered, so its locator cannot even be turned into a URL. */
  | 'unresolvable'

export interface Checked {
  readonly source: string
  readonly locator: string
  readonly url: string
  readonly outcome: Outcome
}

export interface Proof {
  readonly word: string
  readonly checked: readonly Checked[]
  /** Distinct families whose pages were fetched and shown to hold the word. */
  readonly families: number
  /** Whether the evidence, re-checked from scratch, still supports shipping the word. */
  readonly holds: boolean
}

/** Letters, marks and inner apostrophes: the scanner's own rule, so a check sees what it saw. */
const TOKEN = /\p{L}[\p{L}\p{M}'’]*/gu

/** Whether a page holds a word, compared the only way that works: both through the fold. */
export function pageHolds(text: string, word: string, fold: (raw: string) => string): boolean {
  for (const match of text.matchAll(TOKEN)) {
    if (fold(match[0].normalize('NFC')) === word) return true
  }
  return false
}

export interface Reader {
  /** Fetches a URL as text, or null if it cannot be read. */
  (url: string): Promise<string | null>
}

/**
 * Re-checks one word against every page its evidence cites.
 *
 * `minimum` is the rule the word shipped under, so a proof "holds" only if the word is still
 * found on pages from that many different families — not merely on that many pages.
 */
export async function prove(
  evidence: WordEvidence,
  fold: (raw: string) => string,
  read: Reader,
  minimum: number,
): Promise<Proof> {
  const checked: Checked[] = []
  const proven = new Set<string>()

  for (const attestation of evidence.attestations) {
    let spec
    try {
      spec = sourceFor(attestation.source)
    } catch {
      for (const locator of attestation.locators) {
        checked.push({ source: attestation.source, locator, url: '', outcome: 'unresolvable' })
      }
      continue
    }

    for (const locator of attestation.locators) {
      const url = expandLocator(spec, locator)
      const text = await read(url)
      const outcome: Outcome =
        text === null ? 'unreachable' : pageHolds(text, evidence.word, fold) ? 'found' : 'absent'
      if (outcome === 'found') proven.add(spec.family)
      checked.push({ source: attestation.source, locator, url, outcome })
    }
  }

  return {
    word: evidence.word,
    checked,
    families: proven.size,
    holds: proven.size >= minimum,
  }
}
