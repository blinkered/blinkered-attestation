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
  /** The live page is gone, but the Internet Archive's copy of it holds the word. */
  | 'archived'
  /** The page loaded and the word is not on it. The claim does not hold. */
  | 'absent'
  /** Neither the page nor an archived copy could be read, so it says nothing either way. */
  | 'unreachable'
  /** The source is not registered, so its locator cannot even be turned into a URL. */
  | 'unresolvable'

/**
 * The Internet Archive's copy of a page, which is what makes a crawled citation durable.
 *
 * A locator taken from a web crawl is a snapshot of a page that has since moved, changed or
 * gone: verifying six Korean words, every stable-id citation resolved and every crawl URL that
 * failed was a dead link. The archive answers for those, and it answers without an API call —
 * `/web/<when>/<url>` redirects to the nearest capture — which matters because the availability
 * API rate-limits hard.
 *
 * The original URL stays in the evidence. It is the truth about where the text was, and pointing
 * a citation at an intermediary would record where we went looking instead.
 */
export function archiveUrl(url: string, when = '2020'): string {
  return `https://web.archive.org/web/${when}/${url}`
}

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

      // A source that says when it looked is checked against the archive of that year, because
      // its locator cites the page as it was and today's version of a news URL is a different
      // document. Everything else cites something permanent and is checked as it stands.
      const first = spec.asOf === undefined ? url : archiveUrl(url, spec.asOf)
      const live = await read(first)

      let outcome: Outcome
      if (live !== null) {
        const holds = pageHolds(live, evidence.word, fold)
        outcome = holds ? (spec.asOf === undefined ? 'found' : 'archived') : 'absent'
      } else if (spec.asOf === undefined) {
        // Only when the live page is gone. A page that loaded and did not hold the word is a
        // finding, and going to the archive for a second opinion would bury it.
        const archived = await read(archiveUrl(url))
        outcome =
          archived === null
            ? 'unreachable'
            : pageHolds(archived, evidence.word, fold)
              ? 'archived'
              : 'absent'
      } else {
        // The archive has no snapshot from that year. The live page is then the only thing left
        // to ask, and it is a weaker witness, so a miss on it is unreachable rather than absent.
        const now = await read(url)
        outcome = now !== null && pageHolds(now, evidence.word, fold) ? 'found' : 'unreachable'
      }

      if (outcome === 'found' || outcome === 'archived') proven.add(spec.family)
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
