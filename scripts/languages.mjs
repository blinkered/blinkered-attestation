/**
 * The roll-up: the state of every language, and all of their saturation curves on one chart.
 *
 * The division of labour has not changed. A language's statistics are a fact about that language
 * and are measured in its own repository from its own committed evidence; this only puts the
 * measurements side by side, because "where do the returns stop" is a question you can only
 * answer by looking across languages and there is nowhere else that comparison can live.
 *
 * Two ways to collect them, and they disagree only in what they can see:
 *
 *   node scripts/languages.mjs           # from the sibling repositories on this machine
 *   node scripts/languages.mjs de ko     # only these
 *   node scripts/languages.mjs --remote  # from each published repository's main branch
 *
 * The local reader re-measures from the evidence, so it sees languages that are built and not
 * yet committed. The remote reader fetches the `curve.json` each language publishes, so it sees
 * exactly what the world sees and needs no corpora, no evidence and no checkout — which is what
 * lets the scheduled workflow keep the chart in the README current without this machine.
 *
 * Nothing either of them writes is authoritative. If the roll-up disagrees with a language
 * repository, the language repository is right and the roll-up is stale.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  chart,
  checkabilityOf,
  conform,
  knee,
  readEvidence,
  saturation,
  sourceFor,
} from '../dist/src/index.js'

const HERE = new URL('..', import.meta.url).pathname
const SIBLINGS = join(HERE, '..')
const SITE = join(HERE, 'docs')
const PREFIX = 'blinkered-dictionary-'
const ORG = 'blinkered'

const args = process.argv.slice(2)
const remote = args.includes('--remote')
const asked = args.filter((arg) => !arg.startsWith('--'))

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
  const git = (...more) =>
    execFileSync('git', ['-C', root, ...more], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  try {
    git('rev-parse', 'HEAD')
    try {
      return {
        published: git('rev-list', '--count', `${git('rev-parse', '@{upstream}')}..HEAD`) === '0',
      }
    } catch {
      return { published: false }
    }
  } catch {
    return { published: false }
  }
}

/** Every sibling repository on this machine, re-measured from its committed evidence. */
function fromDisk() {
  const tags = readdirSync(SIBLINGS)
    .filter((name) => name.startsWith(PREFIX))
    .map((name) => name.slice(PREFIX.length))
    .filter((tag) => asked.length === 0 || asked.includes(tag))
    .sort()

  return tags.map((tag) => {
    const root = join(SIBLINGS, `${PREFIX}${tag}`)
    const words = join(root, 'words.txt')
    const published = gitState(root).published
    if (!existsSync(words)) return { tag, published, built: false, steps: [] }

    const list = readFileSync(words, 'utf8')
    const evidence = readEvidence(root)
    const steps = saturation(evidence.words, familyOf, evidence.words.length)
    const failures = conform(list, evidence)

    // Families somebody who disbelieved us could check for themselves, as against families whose
    // locators are somebody else's crawl. It is a real difference in the strength of a language's
    // evidence and it shows up in no coverage number.
    const checkable = new Set()
    for (const word of evidence.words) {
      for (const attestation of word.attestations) {
        try {
          const spec = sourceFor(attestation.source)
          if (checkabilityOf(spec) !== 'crawled') checkable.add(spec.family)
        } catch {
          // An unregistered source is a conformance failure, already reported above.
        }
      }
    }
    return {
      tag,
      published,
      built: true,
      candidates: evidence.words.length,
      shipped: list.split('\n').filter((line) => line !== '').length - 1,
      families: steps.length,
      checkable: checkable.size,
      knee: knee(steps)?.families ?? null,
      conforms: failures.length === 0,
      shards: existsSync(join(root, 'attestations'))
        ? readdirSync(join(root, 'attestations')).length
        : 0,
      steps,
    }
  })
}

/**
 * Every published repository, as the world sees it, merged over what the last local roll-up knew.
 *
 * Merged rather than replaced, because a language that is built and not yet published is still
 * one of our languages and belongs on a chart that answers "how are we going". Dropping it would
 * make the picture look tidier by hiding the part that is not finished. A published language is
 * refreshed from its own main branch; an unpublished one keeps whatever the last local run
 * measured, and the chart says which is which.
 */
async function fromGitHub() {
  const headers = { accept: 'application/vnd.github+json' }
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  const listed = await fetch(`https://api.github.com/orgs/${ORG}/repos?per_page=100`, { headers })
  if (!listed.ok) throw new Error(`listing ${ORG} failed: ${String(listed.status)}`)

  const tags = (await listed.json())
    .map((repo) => repo.name)
    .filter((name) => name.startsWith(PREFIX))
    .map((name) => name.slice(PREFIX.length))
    .filter((tag) => asked.length === 0 || asked.includes(tag))
    .sort()

  // What the last roll-up knew, so a language that is not published yet does not vanish.
  let known = []
  try {
    known = JSON.parse(readFileSync(join(SITE, 'languages.json'), 'utf8')).languages
  } catch {
    // No previous roll-up. Then the published repositories are all there is to draw.
  }

  const fresh = await Promise.all(
    tags.map(async (tag) => {
      // Through the API rather than raw.githubusercontent, which serves from a CDN that holds
      // a copy for several minutes and ignores a cache-busting query string. That staleness is
      // harmless for the chart in a browser and not harmless here: a roll-up run straight after
      // a push would redraw the previous curve and commit it as current.
      const answer = await fetch(
        `https://api.github.com/repos/${ORG}/${PREFIX}${tag}/contents/curve.json`,
        { headers: { ...headers, accept: 'application/vnd.github.raw' } },
      )
      // A repository that exists and publishes no curve has not been measured yet, which is a
      // state worth showing rather than an error worth stopping for.
      if (!answer.ok) return { tag, published: true, built: false, steps: [] }
      const curve = await answer.json()
      return {
        tag,
        published: true,
        built: true,
        candidates: curve.candidates,
        shipped: curve.shipped,
        families: curve.families,
        checkable: curve.checkable ?? null,
        knee: curve.knee,
        conforms: curve.conforms ?? null,
        shards: null,
        steps: curve.steps,
      }
    }),
  )

  const live = new Map(fresh.map((row) => [row.tag, row]))
  const kept = known
    .filter((row) => !live.has(row.tag))
    .map((row) => ({ ...row, published: false, shards: null, steps: row.steps ?? [] }))
  return [...fresh, ...kept].sort((left, right) => left.tag.localeCompare(right.tag))
}

const rows = remote ? await fromGitHub() : fromDisk()
for (const row of rows) {
  process.stderr.write(
    row.built
      ? `${row.tag}: ${String(row.shipped)}/${String(row.candidates)} across ${String(row.families)} families` +
          `${row.conforms === false ? '  CONFORMANCE FAILURES' : ''}\n`
      : `${row.tag}: not built\n`,
  )
}

const curves = rows
  .filter((row) => row.steps.length > 0)
  .map((row) => ({ language: row.tag, steps: row.steps }))

writeFileSync(join(SITE, 'curves.svg'), chart(curves))

// The manifest the live chart reads. It carries a snapshot of every curve, so `index.html` draws
// something the moment it loads; it then refetches each `curve.json` from its own main branch and
// says which languages came back live. Same data either way — this is the starting point, not the
// source of truth.
writeFileSync(
  join(SITE, 'languages.json'),
  `${JSON.stringify(
    {
      generated: new Date().toISOString().slice(0, 10),
      org: ORG,
      languages: rows.map((row) => ({
        tag: row.tag,
        repo: `${PREFIX}${row.tag}`,
        published: row.published,
        built: row.built,
        conforms: row.built ? row.conforms : null,
        candidates: row.built ? row.candidates : null,
        shipped: row.built ? row.shipped : null,
        families: row.built ? row.families : null,
        checkable: row.built ? (row.checkable ?? null) : null,
        knee: row.built ? row.knee : null,
        steps: row.steps.map((step) => ({
          families: step.families,
          added: step.added,
          kept: step.kept,
          share: Number(step.share.toFixed(6)),
          gained: step.gained,
        })),
      })),
    },
    null,
    2,
  )}\n`,
)

const table = rows.map((row) => {
  if (!row.built)
    return `| \`${row.tag}\` | not built | — | — | — | — | — | — | ${row.published ? 'yes' : 'no'} |`
  const proved = row.steps.at(-1).kept
  const coverage = `${((100 * proved) / row.candidates).toFixed(1)}%`
  const stops = row.knee === null ? 'still paying' : String(row.knee)
  const evidence =
    row.shards === null ? '—' : row.shards === 0 ? 'one file' : `${String(row.shards)} shards`
  const conforms = row.conforms === null ? '—' : row.conforms ? 'yes' : '**NO**'
  return (
    `| \`${row.tag}\` | ${row.candidates.toLocaleString()} | ${proved.toLocaleString()} | ` +
    `**${coverage}** | ${String(row.families)} | ${row.checkable ?? '—'} | ${stops} | ${conforms} | ` +
    `${row.published ? 'yes' : 'no'} |`
  )
})

const worst = rows.filter((row) => row.built && row.conforms === false)

writeFileSync(
  join(HERE, 'LANGUAGES.md'),
  `# The languages, and where each one stands

**The live version of this is [the chart](https://${ORG}.github.io/blinkered-attestation/)**, which
reads each language's \`curve.json\` from its own main branch. This file is the same thing as a
table, for reading on GitHub, and is regenerated by \`pnpm roll\`. Regenerating both is part of
[the rule for pushing a language](README.md#the-rule-for-changing-a-language).

**Nothing here is authoritative**: each language's numbers are measured in its own repository from
its own committed evidence. If the two disagree, the language repository is right and this is
stale.

![Every language's saturation curve](docs/curves.svg)

Read the chart as *how much of its own candidate list a language could prove, against the number
of independent families it took*. The first two families of every language keep nothing, because
the rule needs three; a curve that climbs steeply at three and then flattens has found everything
its families can see, and a curve still climbing at twenty has more to gain from another
publisher.

| language | candidates | proved | coverage | families | checkable | returns stop at | conforms | published |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${table.join('\n')}

**Checkable** is how many of a language's families somebody who disbelieved us could confirm by
fetching: a stable identifier, or a page we fetched ourselves. The rest are crawls somebody else
made, where the document holding the word is their published corpus rather than the web. Russian
passes the rule on four families and only two are checkable; Korean's twenty-three are all but one.
That difference is invisible in a coverage number and is the thing a sceptic would attack.

**Coverage is not a grade.** It is the share of somebody else's dictionary we could independently
prove, and a big dictionary full of inflected forms will score lower than a small one of ordinary
words however well the attestation went. German and French consulted the same five families and
differ by fifty points because German's candidate list is 36,000 words and French's is 144,000.

${
  worst.length === 0
    ? 'Every built language conforms: each ships only what its evidence supports.'
    : `**${String(worst.length)} language${worst.length === 1 ? ' fails' : 's fail'} conformance and must not be published:** ` +
      worst.map((row) => `\`${row.tag}\``).join(', ') +
      '.'
}

Generated ${new Date().toISOString().slice(0, 10)} ${remote ? 'from the published repositories' : 'from the working copies on one machine'}.
`,
)

process.stderr.write(
  `wrote LANGUAGES.md, curves.svg and languages.json for ${String(rows.length)} languages\n`,
)
