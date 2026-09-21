/**
 * Reads every `blinkered-dictionary-*` beside this repository and writes the roll-up: the state
 * of each language, and all of their saturation curves on one pair of axes.
 *
 * The division of labour is deliberate and has not changed. A language's statistics are a fact
 * about that language and live in its own repository, measured from its own committed evidence.
 * This reads those repositories and reports them together, because "where do the returns stop"
 * is a question you can only answer by looking across languages, and there is nowhere else that
 * comparison can live.
 *
 * Nothing here is authoritative. If this disagrees with a language repository, the language
 * repository is right and this is stale — which is exactly why regenerating it is part of the
 * rule for pushing one.
 *
 *   node scripts/languages.mjs        # every sibling repository
 *   node scripts/languages.mjs de ko  # only these
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chart, conform, knee, readEvidence, saturation, sourceFor } from '../dist/src/index.js'

const HERE = new URL('..', import.meta.url).pathname
const SIBLINGS = join(HERE, '..')
const PREFIX = 'blinkered-dictionary-'
const ORG = 'blinkered'

const asked = process.argv.slice(2)
const tags = readdirSync(SIBLINGS)
  .filter((name) => name.startsWith(PREFIX))
  .map((name) => name.slice(PREFIX.length))
  .filter((tag) => asked.length === 0 || asked.includes(tag))
  .sort()

const familyOf = (source) => {
  try {
    return sourceFor(source).family
  } catch {
    return source
  }
}

/** What git says about a repository, without failing the roll-up when git says nothing. */
function gitState(root) {
  // stderr goes nowhere: "no upstream configured" is the answer to the question being asked,
  // not a fault, and printing it eight times makes a clean run look broken.
  const git = (...args) =>
    execFileSync('git', ['-C', root, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  try {
    const head = git('rev-parse', '--short', 'HEAD')
    const subject = git('log', '-1', '--format=%s')
    let published = false
    try {
      // `@{upstream}` fails loudly when there is no upstream, which is the common case here and
      // is not an error — it is the thing being reported.
      published = git('rev-list', '--count', `${git('rev-parse', '@{upstream}')}..HEAD`) === '0'
    } catch {
      published = false
    }
    return { head, subject, published }
  } catch {
    return { head: null, subject: 'not committed', published: false }
  }
}

const rows = []
const curves = []

for (const tag of tags) {
  const root = join(SIBLINGS, `${PREFIX}${tag}`)
  const words = join(root, 'words.txt')
  const state = gitState(root)

  if (!existsSync(words)) {
    rows.push({ tag, state, built: false })
    continue
  }

  const list = readFileSync(words, 'utf8')
  const shipped = list.split('\n').filter((line) => line !== '').length - 1
  const evidence = readEvidence(root)
  const steps = saturation(evidence.words, familyOf, evidence.words.length)
  const failures = conform(list, evidence)

  curves.push({ language: tag, steps })
  rows.push({
    tag,
    state,
    built: true,
    candidates: evidence.words.length,
    shipped,
    families: steps.length,
    knee: knee(steps),
    conforms: failures.length === 0,
    failures,
    shards: (existsSync(join(root, 'attestations')) ? readdirSync(join(root, 'attestations')) : [])
      .length,
  })
  process.stderr.write(
    `${tag}: ${String(shipped)}/${String(evidence.words.length)} across ${String(steps.length)} families` +
      `${failures.length === 0 ? '' : `  ${String(failures.length)} CONFORMANCE FAILURES`}\n`,
  )
}

writeFileSync(join(HERE, 'curves.svg'), chart(curves))

// The manifest the live chart reads. It carries a snapshot of every curve, so `index.html` draws
// something the moment it loads and while the language repositories are private; once they are
// public the page refetches each `curve.json` from its own main branch and says which languages
// came back live. Same data either way — this is the fallback, not the source of truth.
writeFileSync(
  join(HERE, 'languages.json'),
  `${JSON.stringify(
    {
      generated: new Date().toISOString().slice(0, 10),
      org: ORG,
      languages: rows.map((row) => ({
        tag: row.tag,
        repo: `${PREFIX}${row.tag}`,
        published: row.state.published,
        built: row.built,
        conforms: row.built ? row.conforms : null,
        candidates: row.built ? row.candidates : null,
        shipped: row.built ? row.shipped : null,
        families: row.built ? row.families : null,
        knee: row.built && row.knee !== undefined ? row.knee.families : null,
        steps: row.built
          ? (curves.find((curve) => curve.language === row.tag)?.steps ?? []).map((step) => ({
              families: step.families,
              added: step.added,
              kept: step.kept,
              share: Number(step.share.toFixed(6)),
              gained: step.gained,
            }))
          : [],
      })),
    },
    null,
    2,
  )}\n`,
)

const count = (value) => (value === undefined ? '—' : value.toLocaleString())
const table = rows.map((row) => {
  if (!row.built) return `| \`${row.tag}\` | not built | — | — | — | — | — | — | no |`
  const coverage = `${((100 * row.shipped) / row.candidates).toFixed(1)}%`
  const stops = row.knee === undefined ? 'still paying' : `${String(row.knee.families)}`
  const evidence = row.shards === 0 ? 'one file' : `${String(row.shards)} shards`
  return (
    `| \`${row.tag}\` | ${count(row.candidates)} | ${count(row.shipped)} | **${coverage}** | ` +
    `${String(row.families)} | ${stops} | ${evidence} | ` +
    `${row.conforms ? 'yes' : '**NO**'} | ${row.state.published ? 'yes' : 'no'} |`
  )
})

const worst = rows.filter((row) => row.built && !row.conforms)

writeFileSync(
  join(HERE, 'LANGUAGES.md'),
  `# The languages, and where each one stands

Generated by \`node scripts/languages.mjs\`, which reads every \`blinkered-dictionary-*\` beside
this repository. **Nothing here is authoritative**: each language's numbers are measured in its
own repository from its own committed evidence, and this is the roll-up. If the two disagree,
the language repository is right and this is stale.

**The live version of this is [the chart](https://blinkered.github.io/blinkered-attestation/)**,
which reads each language's \`curve.json\` from its own main branch and so cannot go stale between
roll-ups. This file is the same thing as a table, for reading on GitHub. Regenerating both is part
of [the rule for pushing a language](README.md#pushing-a-language).

![Every language's saturation curve](curves.svg)

Read the chart as *how much of its own candidate list a language could prove, against the number
of independent families it took*. The first two families of every language keep nothing, because
the rule needs three; a curve that climbs steeply at three and then flattens has found everything
its families can see, and a curve still climbing at twenty has more to gain from another
publisher.

| language | candidates | proved | coverage | families | returns stop at | evidence | conforms | published |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${table.join('\n')}

**Coverage is not a grade.** It is the share of somebody else's dictionary we could independently
prove, and a big dictionary full of inflected forms will score lower than a small one of ordinary
words however well the attestation went. German and French consulted the same five families and
differ by fifty points because German's candidate list is 36,000 words and French's is 144,000.

${
  worst.length === 0
    ? 'Every built language conforms: each ships only what its evidence supports.'
    : `**${String(worst.length)} language${worst.length === 1 ? ' fails' : 's fail'} conformance and must not be published:** ` +
      worst.map((row) => `\`${row.tag}\` (${row.failures[0].check})`).join(', ') +
      '.'
}

Generated ${new Date().toISOString().slice(0, 10)}.
`,
)

process.stderr.write(
  `wrote LANGUAGES.md, curves.svg and languages.json for ${String(rows.length)} languages\n`,
)
