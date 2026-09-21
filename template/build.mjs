/**
 * Builds this language's list from the evidence, and writes the three files it ships.
 *
 * Identical in every dictionary repository. Everything language-specific is in `sources.mjs`,
 * so fifty-one repositories cannot drift into fifty-one definitions of "kept".
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { alphabetFor } from '@blinkered/engine'
import { build, domainOf, scan, scanByDomain, writeEvidence } from '@blinkered/attestation'
import { LANGUAGE, SOURCES, HARVEST, COMMON_CUT } from './sources.mjs'

const CANDIDATES =
  process.env.CANDIDATES ??
  `/Users/nick/work/tightline/blinkered/packages/words/data/${LANGUAGE}/words.txt`

// A harvest of this language appends to `searched.tsv` for hours. Reading it mid-append gives a
// page some of its words and not others, which no check downstream would catch. If a harvest was
// killed outright the marker can outlive it; delete it by hand once nothing is fetching.
const HARVESTING = new URL('searched.tsv.harvesting', import.meta.url).pathname
if (existsSync(HARVESTING)) {
  throw new Error(
    `a harvest is writing searched.tsv (${readFileSync(HARVESTING, 'utf8').trim()}). ` +
      'Wait for it, or remove searched.tsv.harvesting if nothing is running.',
  )
}

const candidates = new Set(
  readFileSync(CANDIDATES, 'utf8')
    .split('\n')
    .slice(1)
    .filter(Boolean)
    .map((line) => line.split('\t')[0]),
)
const fold = alphabetFor(LANGUAGE).fold
process.stderr.write(`${LANGUAGE}: ${candidates.size} candidates\n`)

const results = []
for (const source of SOURCES) {
  const started = Date.now()
  let result
  try {
    result = await scan(source.id, source.documents(), candidates, fold)
  } catch (cause) {
    // Which collection failed, and which file it was reading. A truncated dump fails deep
    // inside a decompressor with no clue as to whose it was, and hunting that down by hand has
    // cost two builds already.
    throw new Error(`${source.id} failed reading ${source.needs}: ${cause.message}`, { cause })
  }
  results.push(result)
  process.stderr.write(
    `  ${source.id.padEnd(22)} ${String(result.hits.size).padStart(7)} words  ` +
      `${String(result.tokens).padStart(12)} tokens  ${((Date.now() - started) / 1000).toFixed(0)}s\n`,
  )
}

// Harvested pages become one collection per registrable domain, because a domain is a publisher
// and every publisher is a family. A single `web` source would make ten sites one sighting.
if (HARVEST !== undefined) {
  const perDomain = await scanByDomain(HARVEST(), candidates, fold, domainOf)
  results.push(...perDomain)
  const words = new Set(perDomain.flatMap((result) => [...result.hits.keys()]))
  process.stderr.write(
    `  ${'harvest'.padEnd(22)} ${String(words.size).padStart(7)} words  ` +
      `across ${String(perDomain.length)} domains\n`,
  )
}

const today = new Date().toISOString().slice(0, 10)
const built = build(LANGUAGE, candidates, results, COMMON_CUT)
// Sharded only when one file would be too large for GitHub to take comfortably; a language whose
// evidence still fits stays a single `ATTESTATIONS.tsv`, and never both at once.
const written = writeEvidence('.', LANGUAGE, today, built.evidence)
writeFileSync('words.txt', built.words)
writeFileSync('dropped.tsv', built.dropped)
process.stderr.write(`evidence: ${written.join(' ')}\n`)

const total = built.kept + built.droppedCount
process.stderr.write(
  `\nkept ${built.kept} (${((100 * built.kept) / total).toFixed(1)}%)  ` +
    `dropped ${built.droppedCount} (${((100 * built.droppedCount) / total).toFixed(1)}%)\n`,
)
