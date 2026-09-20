/**
 * Reading Japanese aloud, so a corpus written in kanji can attest a list written in kana.
 *
 * Blinkered deals Japanese as kana tiles. Japanese is written in kanji. So every other language
 * in this project can scan a corpus directly and Japanese cannot: 食べる folds to 食へる, which
 * is not a word and matches nothing. Until the text has been read aloud, a billion tokens of
 * Japanese attest exactly the katakana loanwords and nothing else.
 *
 * Sudachi does the reading, in a subprocess, because it is Python and the alternative is a
 * second implementation of Japanese morphology. What crosses the pipe is one line per document
 * and one line back, so this is a transformer over documents rather than a reader: wrap any
 * collection and its text arrives in kana, with its locator untouched.
 *
 *     withReadings(wikiDocuments('jawiki.xml.bz2'), venvPython, script)
 *
 * **Two known costs, both worth stating rather than discovering.** Sudachi splits 日本語 into
 * ニッポン and ゴ even in its longest mode, so a compound the list holds whole is attested in
 * pieces and missed. And a token Sudachi does not recognise comes back with no reading at all,
 * which is the honest answer — its surface is not a reading and guessing one would attest a
 * word nobody wrote.
 */

import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createInterface } from 'node:readline'
import type { Document } from './scan.js'

/**
 * Documents in, the same documents in kana out.
 *
 * Written and read concurrently rather than in batches. Filling the child's stdin while nothing
 * drains its stdout deadlocks both processes once the pipe buffers fill, and a Wikipedia article
 * is easily large enough to do it.
 */
export async function* withReadings(
  documents: Iterable<Document> | AsyncIterable<Document>,
  python: string,
  script: string,
): AsyncGenerator<Document> {
  const child = spawn(python, [script], { stdio: ['pipe', 'pipe', 'inherit'] })
  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity })

  // A reader that dies mid-stream closes its stdin, and the next write raises EPIPE on a socket
  // with no listener — which takes the whole process down with an unhandled 'error' event and
  // hides the Python traceback that says what actually went wrong. Swallowed here so the exit
  // code below can report the real failure.
  child.stdin.on('error', () => undefined)

  // The child echoes each locator back and results are matched on it, rather than on the order
  // they arrive in. Order looks simpler and is wrong: a child that emits one spurious line
  // shifts every document after it onto somebody else's locator, which would put a citation in
  // the evidence file pointing at a page that never held the word. Matching on the echo makes a
  // stray line a stray line.
  const sent = new Set<string>()
  const ready: Document[] = []

  const reader = (async () => {
    for await (const line of lines) {
      const split = line.indexOf('\t')
      if (split <= 0) continue
      const locator = line.slice(0, split)
      // Only locators we asked about. A child cannot invent a page for us to cite.
      if (!sent.delete(locator)) continue
      const text = line.slice(split + 1)
      // A document whose every token was a particle or an unknown comes back empty. It is
      // dropped rather than yielded: no reading is not the same as a reading of nothing.
      if (text !== '') ready.push({ locator, text })
    }
  })()

  const write = async (document: Document): Promise<void> => {
    sent.add(document.locator)
    // Tabs and newlines are the protocol, so they cannot survive into a document's text.
    const flat = document.text.replace(/[\t\n\r]+/gu, ' ')
    // Backpressure rather than a write callback: `write` says when the buffer is full, and
    // waiting for `drain` is the whole of what there is to do about it. Failures arrive as the
    // child's exit code, which is checked at the end.
    if (!child.stdin.write(`${document.locator}\t${flat}\n`)) await once(child.stdin, 'drain')
  }

  for await (const document of documents) {
    await write(document)
    while (ready.length > 0) yield ready.shift() as Document
  }

  child.stdin.end()
  await reader
  while (ready.length > 0) yield ready.shift() as Document

  await new Promise<void>((resolve, reject) => {
    child.on('close', (code) => {
      if (code === 0 || code === null) resolve()
      else reject(new Error(`${python} exited ${String(code)}`))
    })
    child.on('error', reject)
  })
}
