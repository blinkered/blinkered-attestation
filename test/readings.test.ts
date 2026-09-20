import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { withReadings } from '../src/readings.js'
import type { Document } from '../src/scan.js'

async function collect(documents: AsyncGenerator<Document>): Promise<Document[]> {
  const found: Document[] = []
  for await (const document of documents) found.push(document)
  return found
}

/**
 * A stand-in for Sudachi: uppercases each word.
 *
 * The real reader needs a Python venv and a 60MB dictionary, which is not a thing to make a unit
 * test depend on. What is being tested here is the pipe — that documents go in, come back in the
 * same order, keep their locators, and neither side deadlocks on a large one — and any
 * line-in-line-out program exercises that. The Japanese is checked against the real Sudachi by
 * the language's own build.
 */
const STUB = `
import sys
for line in sys.stdin:
    locator, _, text = line.rstrip("\\n").partition("\\t")
    sys.stdout.write(locator + "\\t" + text.upper() + "\\n")
    sys.stdout.flush()
`

const python = process.env.PYTHON ?? 'python3'

describe('reading a corpus aloud', () => {
  const dir = mkdtempSync(join(tmpdir(), 'blinkered-readings-'))
  const script = join(dir, 'stub.py')
  writeFileSync(script, STUB)

  const available = ((): boolean => {
    try {
      execFileSync(python, ['-c', 'pass'], { stdio: 'ignore' })
      return existsSync(script)
    } catch {
      return false
    }
  })()

  it.runIf(available)('replaces the text and keeps the locator', async () => {
    const found = await collect(
      withReadings([{ locator: 'https://x/a', text: 'taberu' }], python, script),
    )
    expect(found).toEqual([{ locator: 'https://x/a', text: 'TABERU' }])
  })

  it.runIf(available)('keeps documents in the order they were sent', async () => {
    const sent = ['a', 'b', 'c', 'd'].map((id) => ({ locator: id, text: id }))
    const found = await collect(withReadings(sent, python, script))
    expect(found.map((document) => document.locator)).toEqual(['a', 'b', 'c', 'd'])
  })

  it.runIf(available)('drops a document that reads as nothing', async () => {
    // Every token a particle or an unknown. No reading is not a reading of nothing.
    const found = await collect(withReadings([{ locator: 'a', text: '' }], python, script))
    expect(found).toEqual([])
  })

  it.runIf(available)('flattens tabs and newlines, which are the protocol', async () => {
    const [first] = await collect(
      withReadings([{ locator: 'a', text: 'one\ttwo\nthree' }], python, script),
    )
    expect(first?.text).toBe('ONE TWO THREE')
  })

  it.runIf(available)('does not deadlock on documents far larger than a pipe buffer', async () => {
    // Filling stdin while nothing drains stdout wedges both processes once the buffers fill,
    // and a Wikipedia article is easily large enough to do it.
    const big = Array.from({ length: 40 }, (_, at) => ({
      locator: String(at),
      text: 'word '.repeat(20_000),
    }))
    const found = await collect(withReadings(big, python, script))
    expect(found).toHaveLength(40)
  })

  it.runIf(available)('fails loudly when the reader itself is broken', async () => {
    const bad = join(dir, 'bad.py')
    writeFileSync(bad, 'import sys\nsys.exit(3)\n')
    await expect(collect(withReadings([{ locator: 'a', text: 'x' }], python, bad))).rejects.toThrow(
      'exited 3',
    )
  })
})

describe('when the reader misbehaves', () => {
  const dir = mkdtempSync(join(tmpdir(), 'blinkered-readings-bad-'))
  const python = process.env.PYTHON ?? 'python3'
  const available = ((): boolean => {
    try {
      execFileSync(python, ['-c', 'pass'], { stdio: 'ignore' })
      return true
    } catch {
      return false
    }
  })()

  it.runIf(available)('ignores lines it never asked for', async () => {
    // A child that says more than it was told must not shift later documents onto somebody
    // else's locator — that would put a citation in the evidence pointing at a page that never
    // held the word. Results are matched on the echoed locator, so a stray line stays stray.
    const chatty = join(dir, 'chatty.py')
    writeFileSync(
      chatty,
      'import sys\nfor line in sys.stdin:\n' +
        '    loc, _, text = line.rstrip("\\n").partition("\\t")\n' +
        '    sys.stdout.write(loc + "\\t" + text + "\\n")\n' +
        '    sys.stdout.write("extra\\tnoise\\n")\n    sys.stdout.flush()\n',
    )
    const found = await collect(
      withReadings(
        [
          { locator: 'a', text: 'one' },
          { locator: 'b', text: 'two' },
        ],
        python,
        chatty,
      ),
    )
    expect(found).toEqual([
      { locator: 'a', text: 'one' },
      { locator: 'b', text: 'two' },
    ])
  })

  it.runIf(available)(
    'refuses a locator it never sent, so a reader cannot invent a page',
    async () => {
      const liar = join(dir, 'liar.py')
      writeFileSync(
        liar,
        'import sys\nfor line in sys.stdin:\n' +
          '    sys.stdout.write("https://invented/\\t\u30bf\u30d9\u30eb\\n")\n' +
          '    sys.stdout.flush()\n',
      )
      expect(await collect(withReadings([{ locator: 'a', text: 'x' }], python, liar))).toEqual([])
    },
  )

  it.runIf(available)('treats a line with no tab as nothing read', async () => {
    const terse = join(dir, 'terse.py')
    writeFileSync(
      terse,
      'import sys\nfor line in sys.stdin:\n    sys.stdout.write("nope\\n")\n    sys.stdout.flush()\n',
    )
    expect(await collect(withReadings([{ locator: 'a', text: 'x' }], python, terse))).toEqual([])
  })
})
