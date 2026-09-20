/**
 * Fetches this language's publishers and writes what they say into `searched.tsv`.
 *
 * A separate, deliberate step, run rarely and by hand. The build reads the file it writes, so a
 * rebuild needs no network and the evidence stays reproducible — nobody re-fetches six thousand
 * pages to rebuild a list.
 *
 * It appends. A harvest is a slow thing (one request at a time, a second apart, by design) and
 * stopping one halfway should cost the pages not yet fetched, not the ones already in hand. Run
 * it again with more domains and it adds them.
 *
 * Usage:
 *   node harvest.mjs              # every domain in sources.mjs
 *   node harvest.mjs 200          # at most 200 pages per domain
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { domainOf, harvestSites } from '@blinkered/attestation'
import { DOMAINS } from './sources.mjs'

const OUT = new URL('searched.tsv', import.meta.url).pathname
const perDomain = Number(process.argv[2] ?? 300)

// Pages already in hand are not fetched again. The point of appending is that a harvest can be
// interrupted, extended, or re-run with more domains without paying for what it already has.
const already = new Set(
  existsSync(OUT)
    ? readFileSync(OUT, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => line.slice(0, line.indexOf('\t')))
    : [],
)
process.stderr.write(`${DOMAINS.length} domains, up to ${perDomain} pages each\n`)
if (already.size > 0) process.stderr.write(`${already.size} pages already harvested\n`)

const counts = new Map()
let added = 0
for await (const page of harvestSites(DOMAINS, undefined, perDomain)) {
  if (already.has(page.locator)) continue
  already.add(page.locator)
  appendFileSync(OUT, `${page.locator}\t${page.text.replace(/\s+/gu, ' ')}\n`)
  const domain = domainOf(page.locator)
  counts.set(domain, (counts.get(domain) ?? 0) + 1)
  added += 1
  if (added % 50 === 0) process.stderr.write(`  ${added} pages\n`)
}

process.stderr.write(`\nadded ${added} pages across ${counts.size} domains\n`)
for (const [domain, n] of [...counts].sort((left, right) => right[1] - left[1])) {
  process.stderr.write(`  ${domain.padEnd(28)} ${String(n)}\n`)
}
