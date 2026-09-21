/**
 * Which families keep pairing up in a language's drop list, and what that says is missing.
 *
 * The keep rate is not the check; the drop list is. But a drop list is a hundred thousand lines
 * long and nobody reads it, so this asks it the one question that leads somewhere: of the words
 * that came within one family of surviving, which families *did* attest them?
 *
 * Spanish is why this exists. Forty thousand of its fifty thousand near misses were attested by
 * a Wikipedia and a Gutenberg and nothing else — ABALANZAR, ABALORIO, ABACIAL, ordinary literary
 * Spanish that modern news has no use for. A fifth of the candidate list, one family away, and
 * the missing family is not "more text" but a different register: another shelf of books,
 * gathered by somebody other than Gutenberg.
 *
 *   node scripts/nearmiss.mjs es
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sourceFor } from '../dist/src/index.js'

const [language] = process.argv.slice(2)
if (language === undefined) throw new Error('usage: node scripts/nearmiss.mjs <language>')

const root = join(new URL('..', import.meta.url).pathname, '..', `blinkered-dictionary-${language}`)
const familyOf = (source) => {
  try {
    return sourceFor(source).family
  } catch {
    return source
  }
}

const pairs = new Map()
const examples = new Map()
let near = 0
for (const line of readFileSync(join(root, 'dropped.tsv'), 'utf8').split('\n')) {
  if (line === '' || line.startsWith('#')) continue
  const [word, families, sources] = line.split('\t')
  // One short of the rule. Two families is where a missing collection shows up; nought or one is
  // a word that may simply not be in use.
  if (families !== '2' || sources === undefined) continue
  near += 1
  const combo = [...new Set(sources.split(',').filter(Boolean).map(familyOf))].sort().join(' + ')
  pairs.set(combo, (pairs.get(combo) ?? 0) + 1)
  const shown = examples.get(combo) ?? []
  if (shown.length < 5) examples.set(combo, [...shown, word])
}

process.stdout.write(
  `${language}: ${near.toLocaleString()} words came within one family of surviving\n\n`,
)
for (const [combo, count] of [...pairs].sort((left, right) => right[1] - left[1]).slice(0, 8)) {
  const share = `${((100 * count) / near).toFixed(1)}%`
  process.stdout.write(
    `  ${String(count).padStart(7)}  ${share.padStart(6)}  ${combo}\n` +
      `                    ${(examples.get(combo) ?? []).join(', ')}\n`,
  )
}
