/**
 * Per publisher, how much of what it contributed is shared with another language's word list.
 *
 * A harvest counts candidates, so it can never attest a word this language's list did not
 * already propose. What it cannot do is tell what language a page is written in — so a candidate
 * that is also a word in a bigger neighbouring language can be confirmed by text in that
 * neighbour. Tagalog is the case that showed it: Philippine publishers code-switch, and some
 * write almost entirely in English.
 *
 * This does not decide anything. It reports a number that separates a publisher writing the
 * language from one writing its neighbour, so `DOMAINS` can be chosen rather than guessed.
 *
 *   node scripts/overlap.mjs tl en
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { domainOf } from '../dist/src/index.js'

const [language, against] = process.argv.slice(2)
if (language === undefined || against === undefined) {
  throw new Error('usage: node scripts/overlap.mjs <language> <other language>')
}

const HERE = new URL('..', import.meta.url).pathname
const LISTS = '/Users/nick/work/tightline/blinkered/packages/words/data'

/** The folded keys a Blinkered list ships, without its header. */
const keys = (path) =>
  new Set(
    readFileSync(path, 'utf8')
      .split('\n')
      .slice(1)
      .filter((line) => line !== '')
      .map((line) => line.split('\t')[0]),
  )

const mine = keys(join(LISTS, language, 'words.txt'))
const theirs = keys(join(LISTS, against, 'words.txt'))
const shared = new Set([...mine].filter((word) => theirs.has(word)))

const harvest = join(HERE, '..', `blinkered-dictionary-${language}`, 'searched.tsv')
const byDomain = new Map()
for (const line of readFileSync(harvest, 'utf8').split('\n')) {
  if (line === '') continue
  const at = line.indexOf('\t')
  if (at < 0) continue
  const domain = domainOf(line.slice(0, at))
  let words = byDomain.get(domain)
  if (words === undefined) byDomain.set(domain, (words = new Set()))
  for (const pair of line.slice(at + 1).split(' ')) {
    const mark = pair.lastIndexOf(':')
    if (mark > 0) words.add(pair.slice(0, mark))
  }
}

process.stdout.write(
  `${language} against ${against}: ${String(shared.size)} of ${String(mine.size)} candidates ` +
    `are in both lists, which is the most a ${against}-language page could reach.\n\n`,
)
const rows = [...byDomain].sort((left, right) => right[1].size - left[1].size)
for (const [domain, words] of rows) {
  const overlap = [...words].filter((word) => shared.has(word)).length
  const share = words.size === 0 ? 0 : (100 * overlap) / words.size
  process.stdout.write(
    `  ${domain.padEnd(26)} ${String(words.size).padStart(6)} words  ${share.toFixed(1).padStart(5)}% shared\n`,
  )
}
